# Jahitan berkas — apa yang berubah saat modul ini masuk ERP

Berkas adalah satu dari dua hal di repo ini yang **tidak punya padanan langsung
di ERP**; satunya identitas (lihat [`jahitan-identitas.md`](jahitan-identitas.md)).
Di sini berkas ditulis ke disk aplikasi. Di ERP tidak ada disk yang bertahan
antar permintaan: berkas ada di Google Drive atau di object storage, dan diambil
lewat HTTP.

Dokumen ini mencatat tiga hal: bagaimana lapisannya dibentuk sekarang, **apa
yang hilang** kalau sebuah berkas cuma dicatat alamat Drive-nya, dan berkas
jenis apa yang tetap layak disimpan sendiri.

---

## 1. Siapa yang memegang berkas

| Tempat | Kolom | Isinya |
| --- | --- | --- |
| `DocumentVersion` | `objectKey`, `namaFile`, `ukuranByte` | Revisi dokumen teknis: model 3D, gambar kerja PDF/DWG, render, spek, RAB, legalitas, SPK. Append-only — unggahan baru = baris baru. |
| `Expense` | `bukti`, `buktiKey` | Nota/kwitansi pengeluaran. |
| `PettyCashReport` | `bukti`, `buktiKey` | PDF nota gabungan laporan petty cash. |
| `HutangCicilan` | `bukti`, `buktiKey` | Bukti pembayaran cicilan hutang. |
| `PettyCashTopUp` | `bukti`, `buktiKey` | Bukti pengisian dana petty cash. |

Berkas **tidak pernah** disajikan sebagai aset statis. Setiap pengambilan lewat
satu dari tiga rute, dan tiap rute memeriksa sesi → izin sub-bagian → akses
proyek sebelum satu byte pun dikirim:

- `GET /api/dokumen/[versiId]` — izin `dokumenTeknis`
- `GET /api/bukti/[id]` — izin `keuangan`
- `GET /api/petty-bukti/[id]` — izin `pettyCash`

Menaruhnya di folder `public` akan membuat tautan gambar kerja dan nota bisa
diteruskan ke siapa pun tanpa pemeriksaan apa-apa. Itu tetap berlaku di ERP.

---

## 2. Tiga penyedia, satu antarmuka

Bentuknya di `src/lib/storage/penyedia.ts`, pemilihannya di
`src/lib/storage/index.ts`. Halaman dan aksi cuma memanggil `simpanBerkas`,
`bacaBerkas`, `hapusBerkas`, dan `periksaBerkasKategori` — tidak satu pun tahu
berkasnya ada di mana.

| Penyedia | Bentuk | Awalan kunci | Untuk apa |
| --- | --- | --- | --- |
| `lokal` | isi | *(tanpa awalan)* | Disk aplikasi. Bawaan; demo jalan tanpa kredensial apa pun. |
| `gdrive` | isi | `gdrive:` | Google Drive lewat service account. Untuk .skp 24–38 MB. |
| `tautan` | alamat | `tautan:` | Berkas yang **sudah** ada di Drive; yang dicatat cuma URL-nya. |

Dua catatan yang menentukan bentuknya:

- **Routing pembacaan mengikuti kunci, bukan konfigurasi.** Berkas yang telanjur
  ada di disk tetap terbaca setelah organisasi pindah ke Drive. Kalau routing
  mengikuti `STORAGE_ENGINE`, hari peralihan berubah jadi migrasi besar yang
  harus berhasil seluruhnya, dan tiap dokumen lama jadi tautan mati sampai
  selesai.
- **Beda "isi" dan "alamat" eksplisit di tipe**, bukan lewat method opsional.
  Pemanggil yang lupa menangani kasus alamat gagal saat `tsc` — bukan saat ada
  orang mengklik dokumen dan menerima berkas kosong.

---

## 3. Berat dan ringan

Sebelumnya semua berkas diperlakukan sama: batas 64 MB, tujuan yang sama.
Padahal dua kelasnya berperilaku sangat berbeda.

| Kelas | Kategori | Batas | Tujuan |
| --- | --- | --- | --- |
| **Berat** | `model3d` (.skp), `gambarKerjaDwg` (.dwg) | 64 MB (`MAKS_UKURAN`) | Drive, atau cukup dicatat alamatnya |
| **Ringan** | `gambarKerjaPdf`, `render`, `spek`, `desain`, `rab`, `legalitas`, `analisa`, `lain`, `bukti` | 16 MB (`BATAS_RINGAN`) | Object storage yang kita kendalikan |

Aturannya ditulis di `periksaBerkasKategori`, **bukan di kode halaman**. Tiap
halaman yang menebak sendiri adalah satu tempat lagi yang bisa keliru — dan
kekeliruannya baru terasa sebagai tagihan penyimpanan, berbulan-bulan kemudian.

Perubahan perilaku yang disengaja: bukti transaksi dan dokumen ringan yang
sebelumnya boleh sampai 64 MB kini dibatasi 16 MB. Nota 16 MB adalah hasil
pindai yang belum dikecilkan, bukan kebutuhan. Pesan penolakannya menyebutkan
jalan keluarnya.

---

## 4. Apa yang HILANG kalau berkas cuma jadi tautan Drive

Ini bagian yang tidak boleh disepakati diam-diam. Lima hal hilang sekaligus:

**a. Pemeriksaan izin per permintaan.** Sekarang tiap pembukaan berkas melewati
sesi + izin sub-bagian + akses proyek. Tautan Drive dijaga oleh **sharing Drive**,
bukan oleh matriks hak akses aplikasi. Orang yang dicabut aksesnya di aplikasi
tetap bisa membuka berkasnya kalau tautannya masih ada di Drive.

> Gantinya: folder tujuan dibatasi ke Workspace Nanoland, dibagikan ke service
> account sebagai Editor, dan **tidak** disetel "siapa pun dengan tautan". Rute
> aplikasi tetap menjalankan seluruh pemeriksaan izin lalu baru mengarahkan
> peramban (307) — jadi alamat Drive-nya sendiri tidak bocor ke orang yang tak
> berhak atas proyeknya. Setelah pengarahan, Drive yang memutuskan.

**b. Bukti keaslian.** Penyedia isi menghitung `sha256` tiap berkas; penyedia
tautan tidak bisa — isinya tidak pernah lewat sini. `sha256: ""` berarti sistem
ini **tidak bisa membuktikan** berkas di ujung tautan masih sama dengan yang
dicatat dulu. Seseorang mengganti isi berkas di Drive tidak meninggalkan jejak
apa pun di aplikasi.

> Catatan terbuka: `sha256` sudah dihitung untuk berkas yang isinya kita pegang,
> tapi **belum disimpan di kolom mana pun**. Di ERP, `document_versions`
> sebaiknya punya kolom `sha256` — kalau tidak, perhitungannya percuma.

**c. Penghapusan.** `hapusBerkas` pada kunci tautan sengaja tidak melakukan
apa-apa. Menghapus baris di aplikasi tidak boleh diam-diam menghapus berkas yang
mungkin dipakai orang lain di Drive. Akibatnya: berkas yatim menumpuk di Drive,
dan pembersihannya pekerjaan manual.

**d. Ketahanan tautan.** Berkas yang dipindah, diganti nama, atau dihapus di
Drive membuat baris dokumen menunjuk ke tempat kosong. Aplikasi tidak tahu sampai
ada orang mengkliknya. Berkas yang isinya kita pegang tidak punya masalah ini.

**e. Jejak siapa membuka apa.** Sekarang setiap pembukaan lewat rute aplikasi.
Sesudah pengarahan, jejaknya ada di audit log Drive — tempat yang berbeda, format
yang berbeda, dan tidak ikut terbawa kalau organisasi pindah dari Workspace.

**Penjaga yang ada:** hanya host di `HOST_TAUTAN` yang boleh dicatat
(`drive.google.com`, `docs.google.com`, `sheets.google.com`), dan hanya `https`.
Tanpa daftar itu, siapa pun yang boleh menambah dokumen bisa menanam alamat mana
pun — halaman masuk palsu sekalipun — dan sistem akan menyajikannya dengan nama
dokumen resmi.

---

## 5. Berkas yang tetap layak disimpan sendiri

Semua kelas **ringan**, dan alasannya bukan ukuran melainkan tiga hal ini:

1. **Dibuka lewat halaman.** Nota, kwitansi, PDF gambar kerja, dan spek dibuka
   sebagai bagian dari pekerjaan sehari-hari — tiap pembukaan harus melewati
   pemeriksaan izin, bukan sharing Drive.
2. **Isinya bukti.** Dokumen keuangan harus bisa dibuktikan tidak berubah.
   Itu menuntut `sha256` yang disimpan, dan itu menuntut isinya kita pegang.
3. **Volumenya kecil.** Seluruh berkas ringan digabung masih jauh di bawah satu
   berkas .skp. Yang mahal di object storage adalah kelas berat, bukan ini.

Sebaliknya, berkas berat (.skp, .dwg) jarang dibuka lewat aplikasi, hampir selalu
dibuka di aplikasi desktop, dan sudah ada di Drive sebelum aplikasi menyentuhnya.
Mengunggahnya ulang lewat peramban → fungsi server → Drive berarti memindahkan
puluhan megabyte dua kali untuk berkas yang sudah ada di tempat tujuan.

---

## 6. Yang harus diputuskan di sisi ERP

- [ ] Object storage mana untuk kelas ringan — Supabase Storage adalah bawaan
      yang wajar; bucket privat, tanpa policy publik, akses lewat RPC/rute yang
      sudah memeriksa izin.
- [ ] Tambahkan kolom `sha256` pada `document_versions` dan pada baris ber-bukti;
      nilainya sudah dihitung, tinggal disimpan.
- [ ] Setel folder Drive: dibagikan ke service account sebagai Editor, **tidak**
      "siapa pun dengan tautan".
- [ ] Putuskan siapa yang boleh menempelkan tautan luar. Kemampuan itu setara
      dengan menerbitkan tautan atas nama perusahaan.
- [ ] **Jalan tulisnya belum dipasang di formulir.** Pembacaan sudah lengkap:
      ketiga rute mengenali kunci `tautan:` dan mengarahkan peramban setelah
      pemeriksaan izin. Yang belum ada kolom "tempel tautan" di formulir unggah,
      dan itu sengaja — dua hal harus diputuskan lebih dulu: nama apa yang
      dicatat untuk berkas yang namanya cuma diketahui Drive, dan bagaimana
      aturan berat/ringan ditegakkan pada berkas yang jenisnya tak bisa
      diperiksa. Sisi ERP memanggil `catatTautan(alamat)`; validasi host dan
      protokolnya sudah ada di sana.
- [ ] Rencana pembersihan berkas yatim di Drive (poin 4c) — manual, berkala.

---

## 7. Di mana aturannya ditegakkan

| Aturan | Tempat | Penjaga |
| --- | --- | --- |
| `node:fs` tidak boleh keluar dari penyedia | `src/lib/storage/` | `penyimpanan.test.ts` — membaca seluruh `src/app`, `src/components`, `src/lib` |
| Jenis, ukuran, nama, bentuk kunci | `src/lib/adaptor/berkas-aturan.ts` | tes lapisan adaptor |
| Ekstensi per kategori + batas berat/ringan | `periksaBerkasKategori` | `penyimpanan.test.ts` |
| Host tautan luar dan https | `penyedia.ts` (`HOST_TAUTAN`) | `penyimpanan.test.ts` |
| Izin sebelum berkas dikirim/diarahkan | tiga rute `src/app/api/` | `npm run cek:bukti` (dua rute bukti), `npm run cek:endpoint` |
