# Nanoland Management System

Sistem manajemen pengembang properti untuk penggunaan internal. Repositori ini
adalah **demo** — sasaran akhirnya adalah melebur ke website ERP perusahaan yang
sudah ada.

Karena itu prioritas repositori ini bukan aplikasinya, melainkan tiga hal yang
akan ikut pindah ke ERP:

1. **Model data** — `prisma/schema.prisma`
2. **Rumus bisnis** — `src/lib/calc/`, fungsi murni tanpa dependensi framework
3. **Aturan hak akses** — `src/lib/auth/rbac.ts`, dengan matriks izin tersimpan
   sebagai data

Tampilan sengaja diperlakukan sebagai sekali pakai.

---

## Menjalankan

Prasyarat: **Node.js 20.9 atau lebih baru** (`node -v` untuk memeriksa) dan Git.

```bash
git clone <url-repo>
cd property-management-system
git checkout claude/artifact-review-cn2c4f

npm install
```

Salin berkas contoh environment:

```bash
cp .env.example .env       # macOS / Linux
copy .env.example .env     # Windows
```

Buka `.env`, lalu ganti nilai `SESSION_SECRET` dengan string acak minimal 32
karakter. Aplikasi menolak berjalan bila nilainya masih bawaan.

```bash
# macOS / Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

Lalu siapkan database dan jalankan:

```bash
npm run db:reset     # buat database + semai data demo
npm run dev
```

Buka **http://localhost:3000** — akan langsung diarahkan ke halaman masuk.

### Perintah lain

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | mode pengembangan, perubahan kode langsung termuat |
| `npm run db:reset` | kembalikan data ke kondisi awal — aman diulang kapan saja |
| `npm run db:studio` | Prisma Studio, melihat & mengubah isi tabel langsung |
| `npm run db:generate` | bangkitkan ulang Prisma Client setelah schema diubah |
| `npm run build && npm start` | mode produksi, untuk mengukur performa sebenarnya |
| `npm run typecheck` | periksa tipe tanpa membangun |
| `npm test` | jalankan pengujian fungsi hitung dan pembaca Excel |

Dua hal yang tidak ikut masuk repo dan dibuat ulang di tiap mesin:

- **`prisma/dev.db`** — database demo. Bila terhapus, jalankan `npm run db:reset`.
- **`src/generated/prisma`** — Prisma Client hasil generate. Dibuat otomatis oleh
  `postinstall` setelah `npm install`, dan diperbarui tiap kali `npm run build`,
  `npm run db:push`, atau `npm run db:reset` dijalankan. Bila muncul galat
  `Cannot find module '../src/generated/prisma/client'`, jalankan
  `npm run db:generate`.

### Akun demo

Kata sandi seluruh akun: `nanoland2026`

| Email | Peran | Untuk memperagakan |
|---|---|---|
| `h.nugroho@nanoland.id` | Komisaris, BOD | akses penuh termasuk angka finansial |
| `budi.hartono@nanoland.id` | Quantity Surveyor, Procurement | boleh harga, terbatas pada NT4 & NT2 |
| `fajar.ramadhan@nanoland.id` | Arsitek | **tidak** boleh melihat harga |
| `maya.larasati@nanoland.id` | Customer Care | terbatas pada NT2 saja |

Masuk sebagai Arsitek lalu buka Master Proyek → Nano Town 4: kolom RAB, RAP, dan
harga jual tidak muncul. Periksa source HTML-nya — angka itu memang tidak ada di
sana, bukan disembunyikan dengan CSS.

---

## Dua koreksi terhadap prototipe

Repositori ini berangkat dari prototipe satu-file `NanolandManagementSystem.jsx`
(3.921 baris, seluruh data hardcoded). Dua hal diperbaiki karena keduanya akan
menjadi cacat serius bila ikut terbawa ke ERP.

### 1. Hak akses dipindah ke server

Prototipe memakai `can(acl, role, sec)` di dalam komponen React. Data yang
dibatasi tetap dikirim ke browser dan hanya tidak digambar — siapa pun yang
membuka DevTools bisa membacanya. Untuk angka RAB/RAP dan business plan, itu
kebocoran yang sesungguhnya.

Sekarang `selectUnit()` menyusun klausa `SELECT` berdasarkan izin: bila peran
tidak berhak, kolom harga dan relasi BOQ/RAP tidak ikut diambil dari database.
Penyaringan menu di sidebar hanyalah kenyamanan — halaman yang tidak muncul di
menu juga menolak akses langsung lewat URL.

### 2. Harga BOQ di-snapshot per unit

Prototipe menghitung RAB dari template global setiap kali dirender:

```js
const rabOf = (lb) => boqSum(boqOf(lb));   // selalu membaca BOQ_TPL terkini
```

Artinya mengubah satu harga satuan akan menggeser RAB **seluruh unit di seluruh
proyek** — termasuk NT2 yang sudah selesai dan habis masa garansi sejak 2023.
Log bawaan prototipe bahkan mencontohkan kejadian ini: QS mengubah keramik dari
Rp 285.000 menjadi Rp 298.000/m².

Sekarang template hanya dipakai saat unit **dibuat**; hasilnya disimpan ke
`unit_boq_items`, dan RAB dihitung dari baris tersebut. Perubahan harga menjadi
revisi baru dan tidak menyentuh riwayat.

---

## Susunan

```
prisma/
  schema.prisma        30 model — acuan tabel untuk ERP
  seed-data.ts         data demo, dipindahkan apa adanya dari artifact
  seed.ts              penyemaian

src/
  lib/
    calc/              rumus murni: BOQ/RAB/RAP, opname, plan vs realisasi
    domain/            enum dan template harga
    auth/              session, hash sandi, penegakan hak akses
    data/              query yang sudah sadar hak akses
    storage.ts         penyimpanan berkas, berbentuk seperti object storage
    impor-excel.ts     pembaca tabel BOQ & RAP dari .xlsx
  app/
    login/             halaman masuk
    (app)/             kerangka aplikasi + halaman
    api/dokumen/       pengunduhan dokumen, diperiksa hak aksesnya
  components/          komponen tampilan bersama

storage/               berkas unggahan — tidak masuk repo
```

### Mengapa fungsi hitung dipisah

`src/lib/calc/` tidak mengimpor React, Next, maupun Prisma. Tujuannya agar tim
ERP bisa membacanya sebagai spesifikasi dan memindahkannya ke bahasa apa pun.
Nilai keluarannya sudah diverifikasi identik dengan prototipe untuk seluruh tipe
unit (LB 36, 45, 50, 60, dan 72).

---

## Catatan untuk porting ke ERP

**Nilai uang memakai `Float`.** Prisma `Int` adalah 32-bit (maks ~2,1 miliar) —
tidak cukup, karena cashflow NT4 mencapai Rp 32.010.000.000. `Float` (double)
menyimpan bilangan bulat secara eksak sampai 2^53. Di ERP, petakan ke `BIGINT`
atau `NUMERIC(18,2)`.

**Enum ditulis sebagai `String`.** SQLite tidak mendukung enum di Prisma. Nilai
yang sah ada di `src/lib/domain/enums.ts` dan bisa dinaikkan menjadi enum asli
di Postgres.

**Dokumen baru berupa metadata.** Tabel `documents` dan `document_versions`
menyimpan nama file, ukuran, dan revisi — tetapi belum ada object storage. Saat
diaktifkan, berkas harus masuk S3/R2 (berkas `.skp` di proyek ini berukuran
24–38 MB, jangan sekali-kali disimpan di database), dengan unggah memakai
presigned PUT dan unduh memakai presigned GET ber-TTL pendek setelah hak akses
diperiksa.

**Pindah ke Postgres:** ubah `provider` di `prisma/schema.prisma`, ganti adapter
di `src/lib/db.ts` dan `prisma.config.ts` dengan `@prisma/adapter-pg`, lalu
sesuaikan `DATABASE_URL`.

**Lapisan auth sengaja minimal.** `src/lib/auth/session.ts` sekitar 60 baris
memakai `jose`, dan hash sandi memakai `scrypt` bawaan Node. Tidak ada
dependensi auth pihak ketiga, supaya saat dilebur ke ERP lapisan ini tinggal
dibuang dan diganti mekanisme milik ERP tanpa menyentuh bagian lain.

---

## Menyunting data

Master Proyek sudah bisa diubah isinya. Setiap perubahan melewati tiga lapis:

1. Tombol hanya digambar bila peran berhak — kenyamanan, bukan pengamanan.
2. `izinkan(section, projectId)` di baris pertama Server Action — inilah yang
   benar-benar menahan, karena Server Action bisa dipanggil langsung tanpa
   melalui tombol mana pun.
3. Perubahan dicatat ke `audit_logs`, satu baris per field yang berubah,
   lengkap dengan nilai sebelum dan sesudah.

Yang bisa diubah, beserta izin yang dibutuhkan:

| Bagian | Izin | Catatan |
|---|---|---|
| Deskripsi & luas lahan | `deskripsi` | |
| Biaya perolehan lahan | `hargaRabRap` | terpisah dari deskripsi |
| Legalitas | `deskripsi` | tambah, ubah, hapus |
| Tipe unit | `dokumenTeknis` | tak bisa dihapus bila masih dipakai unit |
| Unit: status & progres | `progress` | progres tersimpan sebagai titik riwayat |
| Unit: tambah & hapus | `daftarUnit` | unit dengan progres > 0 tidak bisa dihapus |
| Baris BOQ & RAP | `hargaRabRap` | per unit, tidak memengaruhi unit lain — bisa disunting langsung atau diimpor dari Excel |
| Upah RAP & harga jual | `hargaRabRap` | |
| Kerja tambah | `daftarUnit` | judul, tabel BOQ, dan tabel RAP-nya |
| Sarana & prasarana | `daftarSarpras` | kolom RAB butuh `hargaRabRap` terpisah |
| Dokumen teknis | `dokumenTeknis` | unggah revisi baru, nomor revisi naik sendiri |
| Biaya operasional | `businessPlan` | lewat Plan vs Realisasi |

### Membuktikan snapshot bekerja

Masuk sebagai `budi.hartono@nanoland.id` (Quantity Surveyor), lalu:

1. Buka Master Proyek → Nano Town 4 → klik ikon roda gigi pada unit **F1-1**
2. Ubah harga satuan "Pek. Lantai & Keramik" dari 285.000 menjadi 298.000
3. Total RAB unit itu naik dari Rp 253.790.800 menjadi Rp 254.726.800
4. Sekarang buka unit **F2-4** — harganya **tetap Rp 285.000**

Pada prototipe, langkah 4 akan ikut berubah, begitu pula seluruh unit di NT2
yang sudah selesai sejak 2023.

---

## Modul

Seluruh modul dari prototipe sudah diporting.

| Modul | Isi |
|---|---|
| **Master Proyek** | Empat tingkat: daftar proyek → detail proyek → detail unit → detail sarpras. Termasuk BOQ/RAP yang bisa disunting dan dokumen berversi. |
| **Konstruksi** | Dashboard, progres per proyek dengan penyaring fase, dan opname mingguan unit & sarpras. |
| **Keuangan Proyek** | Tren pengeluaran, komposisi biaya, pengeluaran per unit dengan alokasi kontrak, dan pencatatan pengeluaran. |
| **Vendor Management** | Daftar vendor, kontrak dengan Variation Order dan retensi, tender, progres pekerjaan, dan pembayaran. |
| **Equipment & Asset** | Peralatan dengan kepemilikan, penempatan, pemakaian, dan jadwal servis. |
| **Landbank** | Portofolio, perbandingan proyek, feasibility study, dan business plan. |
| **Plan vs Realisasi** | HPP, penjualan, operasional, dan rencana laba — realisasi diturunkan dari data yang tercatat. |
| **Admin** | Pengelolaan proyek, matriks hak akses yang bisa disunting, kelola user, dan log perubahan. |

### Catatan tentang Plan vs Realisasi

Prototipe menghitung realisasi sebagai `rencana × progres × faktor acak`.
Di sini realisasi diturunkan dari data yang benar-benar tercatat: pengeluaran,
pembayaran kontrak, dan penerimaan penjualan. Tiap baris HPP menyebutkan sumber
angkanya.

Biaya operasional kini punya pencatatan sendiri (`operational_costs`), dicocokkan
ke pos business plan lewat nama kategorinya. Pos yang belum punya transaksi tetap
menunjukkan nol. Pada laporan yang dipakai mengambil keputusan, angka yang
dikarang lebih berbahaya daripada angka yang kosong.

---

## Unggah berkas dan impor Excel

Keduanya sudah benar-benar berjalan, bukan peragaan lagi.

**Unggah dokumen.** Berkas disimpan ke direktori `storage/` dengan nama acak,
dikelompokkan per tahun. Ukuran dibatasi 64 MB dan jenisnya dibatasi daftar
putih (PDF, gambar, Office, DWG, ZIP) — dicek dari isi berkasnya, bukan dari
nama. Pengunduhan lewat `/api/dokumen/{versiId}`, yang memeriksa sesi, izin
`dokumenTeknis`, dan akses proyek sebelum mengirim isinya; dokumen yatim
ditolak, bukan dibiarkan lewat.

Antarmuka `src/lib/storage.ts` sengaja dibentuk seperti object storage
(`simpanBerkas` / `bacaBerkas` / `hapusBerkas` dengan kunci objek), supaya
penggantinya di ERP cukup mengganti isi berkas itu saja.

**Impor Excel** tersedia pada tiap tabel BOQ dan RAP — unit, kerja tambah, dan
sarpras. Yang dikenali:

- Baris judul dicari otomatis sampai baris ke-10, jadi berkas berkop tetap bisa
  dibaca.
- Nama kolom tidak harus persis: `Vol`, `Qty`, dan `Kuantitas` sama-sama
  dikenali, begitu pula `Uraian` / `Pekerjaan` / `Deskripsi`.
- Angka boleh berupa rumus, teks berformat Indonesia (`1.250.000`), atau
  berawalan `Rp`.
- Baris `Total`, `Jumlah`, dan `Sub Total` dilewati.
- Pada RAP, baris yang namanya memuat "upah" dibaca sebagai upah tenaga kerja,
  bukan sebagai material. Bila berkas tidak memuat baris upah, nilai upah yang
  sudah tersimpan **dipertahankan** — mengimpor material tidak boleh diam-diam
  menghapus upah menjadi nol.

Impor bersifat semua-atau-tidak-sama-sekali: seluruh baris divalidasi lebih
dulu, dan bila ada yang tidak sah tidak ada yang disimpan, sementara seluruh
kesalahannya dilaporkan sekaligus supaya bisa diperbaiki dalam satu putaran.
Impor yang berhenti di tengah meninggalkan tabel campur aduk yang lebih sulit
diperbaiki daripada mengulang dari awal.

---

## Pengujian

```bash
npm test
```

71 pengujian untuk fungsi hitung di `src/lib/calc/` (BOQ, opname, keuangan) dan
pembaca Excel di `src/lib/impor-excel.ts`. Berkas Excel ujinya dibangun di
memori, jadi tidak ada berkas biner yang ikut dirawat di repositori.

Pengujian BOQ menyimpan salinan rumus prototipe dan membandingkannya dengan
hasil fungsi di sini — bukan menyalin keluaran fungsinya sendiri jadi angka
harapan, karena cara itu hanya menguji bahwa kode tidak berubah, bukan bahwa
kode itu benar.

---

## Tambahan di luar prototipe

Selain dua koreksi di atas, ada satu tabel yang memang tidak ada di prototipe
dan sengaja ditambahkan atas persetujuan: **Tipe Unit** pada Master Proyek
tingkat 2.

Prototipe menuliskan tipe unit sebagai teks di dalam tiap baris unit, jadi tipe
tidak punya tempat untuk dikelola: menambah tipe baru, mengoreksi luas
bangunannya, atau menghapus tipe yang salah tidak bisa dilakukan dari mana pun.
Tabel ini yang menjadi tempatnya — lengkap dengan jumlah unit yang memakai tiap
tipe, dan tipe yang masih dipakai ditolak saat hendak dihapus.

Mengubah tipe sebuah unit **tidak** menghitung ulang BOQ dan RAP unit itu,
sesuai keputusan snapshot di atas.

---

## Yang belum dikerjakan

- **Dokumen kerja tambah** belum bisa diganti setelah dibuat; judul serta tabel
  BOQ dan RAP-nya sudah bisa.
- **Biaya operasional** kini sudah bisa dicatat lewat Plan vs Realisasi, tetapi
  hanya pos yang ada pada business plan proyeknya. Pos baru masih harus
  ditambahkan lebih dulu dari business plan.
