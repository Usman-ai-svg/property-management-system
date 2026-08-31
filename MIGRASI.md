# Panduan Migrasi ke ERP Perusahaan

Dokumen ini ditujukan untuk orang yang akan memindahkan Nanoland Management
System ke laman utama website Management System perusahaan. Isinya bukan
ringkasan fitur, melainkan hal-hal yang perlu diketahui sebelum menyentuh
kodenya: apa yang bisa dipindahkan apa adanya, apa yang harus ditulis ulang,
dan mana bagian yang kalau salah dipindahkan akan diam-diam menghasilkan
angka yang keliru.

ERP tujuan sudah diketahui bentuknya: **satu index.html, vanilla JS, dan
Supabase RPC** — tanpa React, tanpa Next.js, tanpa bundler. Dokumen ini ditulis
untuk kenyataan itu. Bagian [Menyerap ke ERP vanilla JS](#menyerap-ke-erp-vanilla-js)
adalah titik masuknya; sisa dokumen menjelaskan aturan yang harus ikut pindah
apa pun kerangkanya.

---

## 1. Peta lapisan

Kode dibagi menurut seberapa terikat ia pada framework. Semakin ke atas
daftar ini, semakin mudah dipindahkan.

| Lapisan | Lokasi | Baris | Bergantung pada |
|---|---|---:|---|
| Aturan hitung | `src/lib/calc/` | 908 | tidak ada — TypeScript murni |
| Enum & template | `src/lib/domain/` | 387 | tidak ada — TypeScript murni |
| Penyusun angka halaman | `src/lib/tampilan/` | 493 | tidak ada — TypeScript murni |
| Aturan adaptor | `src/lib/adaptor/` | 489 | tidak ada — TypeScript murni |
| Pengambilan data | `src/lib/data/` | 1.958 | Prisma |
| Hak akses | `src/lib/auth/` | 544 | Prisma, `jose`, cookie Next.js |
| Komponen tampilan | `src/components/` | 2.930 | React |
| Halaman & aksi | `src/app/(app)/` | 13.576 | Next.js App Router |

Empat lapisan teratas — 2.277 baris — **tidak mengimpor apa pun dari
framework maupun dari Prisma**. Keempatnya bisa disalin ke ERP tanpa
perubahan sebaris pun, dan itu memang disengaja sejak awal: di situlah
seluruh rumus bisnis berada.

Sifat ini gampang rusak tanpa terasa — satu `import` yang praktis hari ini
membuat seluruh berkas tidak bisa dipindah tahun depan. Karena itu ada
penjaganya: `src/lib/lapisan.test.ts` memeriksa baris impor setiap berkas di
empat lapisan itu dan menolak React, Next, Prisma, ExcelJS, API Node, maupun
lapisan di bawahnya. Penjaganya sendiri ikut diuji, supaya tidak lolos hanya
karena penelusuran foldernya rusak.

Lapisan paling bawah adalah yang paling banyak barisnya sekaligus paling
tidak berharga untuk dipindahkan mentah-mentah. Isinya perakitan halaman:
menyusun kartu dan tabel dari data yang sudah disiapkan lapisan di atasnya.
Kalau ERP punya kerangka halaman sendiri, tulis ulang lapisan ini dan pakai
lapisan di atasnya.

### Aturan: halaman tidak boleh menyentuh Prisma

Seluruh `page.tsx` dan `route.ts` **tidak mengimpor `@/lib/db`**. Setiap
pengambilan data lewat fungsi bernama di `src/lib/data/`.

Aturan ini dijaga tes — `src/lib/lapisan.test.ts`, blok *penjaga halaman tidak
menyentuh Prisma* — jadi `npm test` akan gagal sambil menyebut berkasnya bila
ada yang melanggar. Untuk pemeriksaan cepat tanpa menjalankan tes:

```bash
grep -rl 'from "@/lib/db"' src/app --include='page.tsx' --include='route.ts'
```

Keluaran kosong berarti aturannya masih utuh. Bila ada yang muncul, turunkan
query-nya ke `src/lib/data/` sebelum melanjutkan.

> Penjaganya baru ditambahkan setelah aturan ini sempat luntur: lima berkas
> — dua rute bukti, rute ekspor Excel, rute template penawaran, dan halaman
> rincian tipe unit — sudah memegang query Prisma sendiri padahal dokumen ini
> menjanjikan sebaliknya. Selama aturannya hanya tertulis di sini beserta
> perintah grep untuk memeriksanya sendiri, tidak ada yang menjalankannya.

Gunanya untuk migrasi: saat modul ini diserap ERP, **hanya `src/lib/data/`
yang berganti isi** — dari `prisma.*` menjadi pemanggilan RPC Supabase.
Halaman tidak perlu tahu sumber datanya berubah. Tanpa aturan ini, 26 berkas
halaman harus dibongkar satu per satu, dan penyaring hak aksesnya ikut
berisiko tergeser.

Yang **masih** memanggil Prisma dan memang disengaja: `*actions.ts` (lapisan
perubahan data — nantinya menjadi RPC penulisan) dan `src/app/login/actions.ts`
(titik sambung identitas).

> **Yang paling mudah rusak saat menurunkan query:** blok
> `...(bolehHarga ? { … } : {})` di dalam `select`. Itu bukan kerapian, itu
> penegakan hak akses — kolom yang tidak boleh dilihat memang tidak ikut
> di-SELECT. Kalau saat dipindah blok itu diratakan menjadi select biasa,
> angka RAB/RAP akan sampai ke browser peran yang tidak berhak, dan **tidak
> ada yang berubah di layar** sehingga tidak ada yang menyadarinya.

### Aturan: halaman tidak boleh menghitung

`src/lib/tampilan/` berisi penyusun angka tiap halaman — masuk data mentah,
keluar angka siap gambar. Halaman hanya menggambar hasilnya.

Bedanya dengan `src/lib/calc/`: `calc` berisi rumus yang berlaku di mana pun
(serapan anggaran, progres tertimbang, pembagian kontrak), sedangkan
`tampilan` menjawab "angka apa saja yang dibutuhkan layar ini". Keduanya
sama-sama TypeScript murni dan sama-sama bertes.

Isinya sekarang:

| Berkas | Isi |
|---|---|
| `keuangan-proyek.ts` | pembagian biaya kontrak & pengeluaran ke unit/sarpras |
| `landbank.ts` | luas lahan, biaya perolehan, ringkasan business plan |
| `vendor.ts` | posisi kontrak per vendor, KPI vendor |
| `konstruksi.ts` | rata-rata progres tertimbang |
| `aset.ts` | KPI peralatan, ambang servis |
| `plan-realisasi.ts` | target vs realisasi, ambang toleransi serapan |

Periksa kemurniannya dengan:

```bash
grep -rl 'from "react"\|from "next\|@/lib/db' src/lib/tampilan
```

Keluaran kosong berarti lapisan ini masih bisa dipindahkan apa adanya.

> **Kenapa ini yang menentukan saat penulisan ulang ke ERP:** yang ditulis
> ulang nanti adalah cara menggambar, dan itu pekerjaan mekanis. Yang TIDAK
> boleh ikut ditulis ulang adalah aturannya — bahwa realisasi penjualan hanya
> dihitung dari yang sudah akad, bahwa rata-rata progres ditimbang jumlah
> unit, bahwa biaya per unit dijumlahkan dari baris alokasi dan bukan dari
> total transaksi. Selama aturan itu berada di `tampilan/` dan dijaga tes,
> penulis ulang tinggal memanggilnya.

### Aturan: hak akses per kolom dinyatakan sekali

`src/lib/auth/kolom-terbatas.ts` menyatakan kolom mana milik sub-bagian mana:

```ts
KOLOM_TERBATAS = {
  unit:           { hargaRabRap: ["hargaJual", "rapUpah", "boqItems", "rapItems"] },
  infrastructure: { hargaRabRap: ["rab", "rapUpah", "boqItems", "rapItems"] },
  project:        { hargaRabRap: ["hargaPerM2", "biayaPembelian", …] },
  equipment:      { hargaRabRap: ["nilai"] },
  customWork:     { hargaRabRap: ["rapUpah", "boqItems", "rapItems"] },
}
```

Penegakannya tetap lewat blok `...(bolehHarga ? { … } : {})` di dalam
`select`, karena bentuk itulah yang membuat Prisma menghasilkan tipe yang
tepat — halaman mengandalkan penyempitan tipe itu (`"boqItems" in unit`).
Deklarasi di atas adalah **kontraknya**, dan sebuah tes menjaga keduanya tetap
sejalan: `kolom-terbatas.test.ts` membaca kode sumber `src/lib/data/` dan
menolak kolom uang yang di-SELECT di luar blok bersyarat.

Untuk ERP, deklarasi yang sama bisa dibaca untuk membangun fungsi RPC atau
policy RLS — `saringSelect()` sudah tersedia untuk membentuk select secara
dinamis, yang di sana justru lebih cocok karena tipe Prisma tidak lagi
berlaku.

#### Dua penjagaan yang berbeda, dan yang kedua lebih rapuh

| Cara | Contoh | Sifat |
|---|---|---|
| Per kolom | `detailUnit()` | aman sendiri |
| Per halaman | `keuanganPerProyek()` | aman **hanya bila matriks mendukung** |

Beberapa jalur — `keuangan.ts`, `ringkasan.ts`, `plan-real.ts` — mengambil
kolom RAP tanpa syarat, karena satu-satunya halaman yang memanggilnya sudah
menolak peran tak berhak lebih dulu. Itu aman **hanya selama** setiap
pemegang izin penjaga juga berhak atas `hargaRabRap`.

Hari ini benar, tapi itu bentuk matriks saat ini — bukan sifat kodenya.
`WAJIB_IKUT_HARGA` mencatat implikasinya dan tesnya memeriksanya terhadap
matriks awal. Bila suatu saat ada peran diberi `keuangan` tanpa `hargaRabRap`,
tes gagal dan menunjuk tepat ke risikonya.

> **Satu celah yang diketahui:** `src/lib/data/aset.ts` mengambil
> `Equipment.nilai` tanpa syarat karena formulir Ubah Aset memerlukannya.
> Peran yang boleh mengubah aset tapi tidak berhak atas `hargaRabRap` akan
> menerima nilai perolehan alat di muatan komponen klien. Tidak terjadi hari
> ini — keenam peran yang boleh mengubah aset semuanya berhak atas harga —
> tapi ini satu penyuntingan matriks dari menjadi kebocoran. Tercatat sebagai
> `PENGECUALIAN` di `kolom-terbatas.test.ts`.

### Tiga adaptor: identitas, berkas, Excel

`src/lib/adaptor/` memisahkan **aturan** dari **mesinnya**. Aturannya murni
dan ikut pindah; mesinnya diganti.

| Aturan (ikut pindah) | Mesin sekarang | Mesin di ERP |
|---|---|---|
| `identitas.ts` — bentuk `Pengguna` | `jose` JWT di cookie | Supabase Auth + `profiles` |
| `berkas-aturan.ts` — jenis, ukuran, nama, kunci objek | `storage/` (disk **atau** Google Drive) | Google Drive |
| `tabel-aturan.ts` — baris judul, sinonim kolom, angka, validasi | `impor-excel.ts` (ExcelJS) | SheetJS di browser |

**Identitas.** Seluruh aplikasi membaca pengguna lewat satu fungsi,
`ambilPengguna()`. `identitas.ts` menyatakan kontraknya, dan
`periksaPengguna()` menolak adaptor baru yang lupa mengisi `izin` atau
mengisi `peranAktif` dengan daftar — ketahuan di sana, bukan nanti sebagai
halaman kosong tanpa penjelasan.

**Berkas.** Yang diamankan bukan kerapian melainkan daftar putih jenis
berkas, batas ukuran, dan pembersihan nama. `bersihkanNamaFile()` sekarang
juga mengenali pemisah gaya Windows — berkas diunggah dari dua jenis mesin,
sementara `path.basename` di server hanya mengenali salah satu.

### Berkas besar: Google Drive, bukan object storage berbayar

Berkas `.skp` pada proyek ini berukuran **24–38 MB**. Ribuan berkas sebesar itu
menjadi tagihan terbesar jauh sebelum sisa data proyek digabung sekalipun
mendekatinya — karena itu berkas besar ditaruh di Google Drive, di kuota
organisasi yang memang sudah dibayar.

Mesinnya dipilih lewat satu variabel:

```bash
STORAGE_ENGINE="lokal"   # bawaan — demo jalan tanpa kredensial apa pun
STORAGE_ENGINE="gdrive"  # butuh GDRIVE_CLIENT_EMAIL / _PRIVATE_KEY / _FOLDER_ID
```

Tiga hal yang perlu diketahui sebelum menyentuhnya:

**Kunci berkas Drive diberi awalan `gdrive:`, dan pembacaan mengikuti awalan
itu — bukan mesin yang sedang dikonfigurasi.** Akibatnya berkas yang telanjur
tersimpan di disk tetap terbaca setelah organisasi pindah ke Drive, dan
peralihannya tidak perlu sekali jalan. Kalau routing mengikuti konfigurasi,
hari peralihan berubah menjadi migrasi besar yang harus berhasil seluruhnya,
dan setiap dokumen lama menjadi tautan mati sampai selesai.

**Masuknya lewat service account, bukan OAuth pengguna.** Berkas milik
organisasi, bukan milik orang yang kebetulan mengunggahnya, dan tidak boleh
ikut hilang saat orang itu keluar dari perusahaan.

**Unggahan memakai protokol resumable, bukan multipart.** Pada ukuran .skp,
satu putus jaringan di tengah berarti mengulang 38 MB dari nol. Resumable juga
mengumumkan ukuran lebih dulu, sehingga penolakan kuota datang sebelum satu
byte pun terkirim.

> Kesalahan penyiapan yang paling sering: folder tujuan belum dibagikan ke
> alamat service account sebagai Editor. Drive menjawab 403, dan pesan
> galatnya di `gdrive.ts` sengaja menyebut hal ini secara langsung.

Protokolnya bertes tanpa kredensial Google — `fetch` dan jamnya disuntik,
lihat `src/lib/storage/gdrive.test.ts`.

**Excel.** ERP sudah memuat SheetJS 0.18. Yang perlu ditulis ulang hanya
`kisiDariExcel()`: `XLSX.utils.sheet_to_json(sheet, { header: 1 })`
menghasilkan bentuk `Tabel` yang sama, dan seluruh aturan pembacaannya —
termasuk prinsip "impor tidak boleh separuh jadi" — dipakai ulang apa adanya.

---

## RBAC ganda: ERP di depan, model sendiri di belakang

`src/lib/auth/peran-erp.ts`. Saklarnya variabel lingkungan `RBAC_MODE`;
bawaannya `internal`, dan `erp` menyalakan mode ERP.

Peta peran, dikonfirmasi pemilik sistem:

| Peran ERP | Setara | hargaRabRap | businessPlan | keuangan | progress | aset |
|---|---|---|---|---|---|---|
| `director` | BOD | ubah | ubah | ubah | ubah | ubah |
| `accountant` | Finance / Consultant Finance | lihat | — | ubah | lihat | lihat |
| `manager` | Project Manager / Head Ops Project | lihat | — | lihat | ubah | ubah |
| `admin` | Admin (Staff Administration) | lihat | — | ubah | — | lihat |
| `staff` | Supervisor dan setingkat | — | — | — | ubah | lihat |

`sales`, `viewer`, dan `hrd` tidak ada di peta — ketiganya memang tidak
berhak membuka modul proyek di ERP. Daftar putih, bukan daftar hitam: peran
baru di ERP tidak otomatis mendapat akses.

Batas yang dijaga tes, bukan sekadar dicatat:

- `staff` tidak boleh memegang `hargaRabRap`, `businessPlan`, maupun
  `keuangan`. Kalau suatu saat dibuka karena dianggap praktis, tes yang gagal
  menjelaskan kenapa itu bukan ide bagus.
- Setiap peran yang boleh mengubah `keuangan` juga harus berhak atas
  `hargaRabRap` — jalur data Keuangan mengambil kolom RAP tanpa syarat.
- Hanya `director` yang memegang `businessPlan`.

> **Pelonggaran yang disengaja:** ERP tidak punya pembatasan per proyek.
> Selama `RBAC_MODE=erp`, setiap pengguna melihat SELURUH proyek —
> `semuaProyek` selalu `true`. Di sistem ini Hendra Kurnia hanya boleh
> melihat NT4 dan GN2; di mode ERP ia melihat semuanya. Memalsukannya jadi
> daftar kosong akan membuat setiap halaman tampak kosong tanpa penjelasan,
> jadi dipilih melonggarkan — dengan catatan tertulis.

---

## Lapisan perubahan data

79 Server Action, 4.658 baris. Ini permukaan tulis modul — di ERP semuanya
menjadi RPC Postgres. Inventaris lengkapnya, beserta izin penjaga dan usulan
nama RPC tiap aksi, ada di **`KONTRAK-RPC.md`**.

Yang penting dipahami sebelum menyentuhnya: berkas `"use server"` mengekspor
SELURUH fungsinya sebagai endpoint yang bisa dipanggil langsung dari browser.
Tombol yang tidak digambar tidak menahan apa pun.

`src/lib/actions/penjaga-aksi.test.ts` menelusuri tiap aksi yang diekspor dan
menolak yang tidak sampai ke pemeriksaan izin — langsung, lewat fungsi
pembantu di berkas yang sama, atau lewat aksi lain yang sudah terjaga.

> **Dua endpoint tanpa penjaga ditemukan saat tes itu ditulis**, keduanya juga
> tanpa satu pun pemanggil: `nilaiTerpasangSpk` di `vendor/boq-actions.ts`
> (mengembalikan nilai terpasang sebuah SPK ke siapa pun) dan `imporPeragaan`
> di `master/actions.ts` (menulis teks bebas dari pengguna ke jejak audit).
> Keduanya peninggalan yang sudah tergantikan, dan sudah dihapus.

Validasi isiannya ada di `src/lib/adaptor/formulir.ts` — murni, bekerja di
atas fungsi pembaca `(nama) => string | null`, jadi bisa dipakai apa adanya
ketika isian datang sebagai parameter RPC alih-alih `FormData`.

> **Yang paling mudah salah pada pembacaan angka:** `"1.250"` berarti seribu
> dua ratus lima puluh, sedangkan `"12.5"` berarti dua belas setengah.
> Keduanya satu titik. Aturannya dulu ada dua salinan — satu untuk formulir,
> satu untuk impor Excel — dan sekarang satu, dipakai bersama. Satu-satunya
> perbedaan yang disengaja: impor Excel menerima awalan "Rp", formulir tidak.

---

## Skema Postgres yang sudah disiapkan

`npm run skema:postgres` menghasilkan dua berkas dari `prisma/schema.prisma`:

| Berkas | Isi |
|---|---|
| `prisma/schema.postgres.prisma` | 43 tabel berawalan `pm_`, 34 kolom uang jadi `Decimal(18,2)` |
| `prisma/enum-postgres.sql` | 19 `CREATE TYPE` dari `src/lib/domain/enums.ts` |

Sudah lolos `prisma validate`. Aplikasi ini tidak memakainya — gunanya bahan
siap pakai saat penyerapan.

Awalan `pm_` dipakai karena ERP sudah punya 40-an tabel; tanpa awalan,
`projects` kita akan bertabrakan dengan milik mereka.

> **Yang paling mudah salah di sini:** menaikkan SEMUA `Float` jadi
> `Decimal(18,2)`. Volume pekerjaan punya pecahan halus — 12,375 m³ beton
> akan dibulatkan jadi 12,38 dan menggeser seluruh RAB yang dihitung darinya.
> Koordinat peta lebih parah: dua desimal menggeser titik sampai sekitar satu
> kilometer. 22 kolom sengaja tetap `Float`, didaftar sebagai `BUKAN_UANG` di
> `scripts/skema-postgres.mjs` dan dijaga tes.

Yang masih menunggu keputusan manusia: enum masih bertipe `String` (SQL-nya
sudah siap, tapi menaikkannya perlu migrasi data), Row Level Security belum
ada sama sekali, dan apakah tabel `User`/`Role` kita dipakai atau digantikan
`profiles` ERP.

---

## 2. Model data

Skema ada di `prisma/schema.prisma`, 43 model. Ini bagian yang paling
bernilai dan paling tahan lama — kalaupun seluruh tampilan ditulis ulang,
struktur data ini yang menentukan sistemnya benar atau tidak.

### Kelompok model

**Pengguna dan hak akses**
`User`, `Role`, `UserRole`, `UserProjectAccess`, `RoleSectionPermission`

**Proyek dan isinya**
`Project`, `Legality`, `Phase`, `UnitType`, `Unit`, `Infrastructure`

**Volume dan biaya rencana** — BOQ (volume pekerjaan) dan RAP (rencana biaya)
`UnitBoqItem`, `UnitRapItem`, `InfrastructureBoqItem`, `InfrastructureRapItem`,
`CustomWork`, `CustomWorkBoqItem`, `CustomWorkRapItem`

**Pelaksanaan**
`ProgressRecord`, `Equipment`, `EquipmentAdjustment`

**Vendor dan kontrak**
`Vendor`, `Contract`, `ContractUnit`, `ContractInfrastructure`,
`ContractBoqItem`, `VariationOrder`, `Tender`, `TenderParticipant`

**Uang keluar dan masuk**
`Expense`, `ExpenseAllocation`, `OperationalCost`, `SalesPayment`

**Rencana bisnis**
`BusinessPlan`, `BpHppItem`, `BpOmzetItem`, `BpOperasionalItem`,
`BpCashflowItem`, `MarketComparable`, `MarketComparableType`

**Dokumen dan jejak**
`Document`, `DocumentVersion`, `AuditLog`

### Enam keputusan yang mudah salah dipindahkan

**a. Pengeluaran berbentuk induk–rincian.** `Expense` adalah satu pembayaran
— setara satu baris mutasi rekening bank. Pembebanannya ke unit atau ke
sarana & prasarana **tidak** disimpan di `Expense`, melainkan sebagai
beberapa baris `ExpenseAllocation`. Ini menjawab kasus nyata: satu transfer
upah borongan untuk lima unit tetap satu baris di rekening koran, dan harus
tetap satu baris di sistem, supaya rekonsiliasi bank tidak berantakan.

> **Invarian yang wajib dijaga:** jumlah seluruh `ExpenseAllocation.nominal`
> harus **sama persis** dengan `Expense.total`. Ditegakkan oleh
> `periksaAlokasi()` di `src/lib/calc/keuangan.ts`. Bila ERP membuat jalur
> input pengeluaran sendiri, jalur itu **harus** memanggil fungsi yang sama.
> Tanpa itu, biaya per unit akan diam-diam tidak sama dengan total
> pengeluaran, dan tidak ada yang menyadarinya sampai tutup buku.

Alokasi dengan `unitId` dan `infrastructureId` sama-sama kosong berarti biaya
level proyek — perijinan, pengolahan lahan — yang memang tidak dibebankan ke
unit mana pun.

**Pembayaran vendor juga `Expense`**, yaitu yang `contractId`-nya terisi.
Tidak ada tabel pembayaran kontrak tersendiri: pernah ada, dan akibatnya uang
yang sama tercatat dua kali — sekali di tab Pembayaran vendor, sekali di Catat
Pengeluaran — lalu terhitung ganda di halaman Keuangan. "Terbayar" pada sebuah
kontrak dihitung dari `Expense` yang menunjuk kontrak itu.

Untuk membagi sebuah termin ke unit yang dicakup kontrak, pakai
`alokasiPembayaran()`, **bukan** `alokasiKontrak()`. Yang kedua membagi nilai
kontrak dan mengembalikan `nilaiOverride` apa adanya — dipakai untuk membagi
termin, pembayaran Rp 162 juta pada kontrak Rp 540 juta menghasilkan alokasi
Rp 540 juta.

**b. Uang disimpan sebagai `Float`, bukan `Int`.** `Int` pada Prisma adalah
32-bit, tembus di angka sekitar 2,1 miliar — sementara nilai kontrak di sini
rutin melewatinya. Kalau ERP memakai PostgreSQL, ganti ke `Decimal` dengan
presisi yang memadai; itu lebih benar daripada `Float`. Yang **tidak boleh**
adalah membiarkannya jadi `Int`.

**c. Enum disimpan sebagai `String`.** Karena SQLite tidak punya tipe enum.
Nilai yang sah didaftar di `src/lib/domain/enums.ts` dan divalidasi di
lapisan aplikasi. Bila ERP memakai PostgreSQL, enum asli lebih aman — tapi
ambil daftar nilainya dari `enums.ts`, jangan menulis ulang dari layar.

**d. Ada DUA progres yang berbeda, dan keduanya tidak saling mengisi.**

| | Progress Konstruksi | Progress Vendor |
|---|---|---|
| Lingkup | Seluruh pekerjaan unit — struktur, arsitektur, MEP, subkon | Hanya pekerjaan dalam satu SPK |
| Sumber | `UnitBoqItem` / `InfrastructureBoqItem` (BOQ Master Proyek) | `ContractBoqItem` (BOQ kontrak, dimuat di SPK) |
| Diisi di | Halaman Konstruksi unit / sarpras | Halaman detail SPK |

Vendor atap yang tuntas 100% TIDAK membuat unitnya selesai — ia hanya
menuntaskan satu item dari lingkup penuh. Keduanya sengaja tidak saling
menghitung karena BOQ SPK kerap tidak sebangun dengan BOQ Master: pekerjaan
digabung, dipecah, atau diberi uraian berbeda. QS mengisi keduanya.

`Unit.progress` dan `Infrastructure.progress` adalah CACHE dari baris BOQ
Master, tertimbang nilai. Kolomnya tetap ditulis karena puluhan tempat
membacanya dan karena `statusPembangunan` dipakai menyaring di tingkat
database.

> **Invarian yang wajib dijaga:** setiap jalur yang mengubah
> `UnitBoqItem.progress` harus memanggil `hitungUlangProgresUnit()` di
> `src/lib/data/progres-konstruksi.ts` sebelum selesai. Cache yang tidak
> diperbarui tidak menimbulkan galat apa pun — hanya angka kemajuan yang
> diam-diam keliru.

Objek yang belum punya baris BOQ tetap memakai progres satu angka manual.
Yang sudah punya menolak isian manual, di UI maupun di Server Action.

**e. Stok aset hanya berubah lewat penyesuaian.** `Equipment.jumlah` tidak
bisa diketik dari formulir Ubah Aset; ia hanya bergerak lewat baris
`EquipmentAdjustment`, sehingga tiap perubahan punya alasan, tanggal, dan
penanggung jawab. `jumlahRusak` dipisah dari `status` karena status melekat
pada seluruh baris — 5 helm yang 2 di antaranya rusak tidak bisa dinyatakan
lewat satu status saja. Riwayatnya hanya-tambah: pencatatan yang salah
diperbaiki dengan baris "Koreksi Stok" baru.

Nilai rupiah aset sengaja tidak ikut berubah. Penyusutan dan pembukuan
kerugian dikerjakan Finance di luar sistem ini; nilai perolehan sebuah aset
lama bukan angka kerugian yang benar.

**f. `AuditLog` bersifat hanya-tambah.** Tidak ada jalur ubah atau hapus di
seluruh aplikasi. `catatDiff()` menulis satu baris per kolom yang berubah,
bukan satu baris per aksi, supaya "siapa mengubah angka apa dari berapa jadi
berapa" bisa dilacak per kolom. Pertahankan sifat ini.

---

## 3. Indeks rumus bisnis

Semua ada di `src/lib/calc/`, tanpa impor framework, dan **seluruhnya sudah
punya tes** (145 tes, `npm test`). Ini daftar yang perlu diperiksa ulang
bersama tim keuangan dan teknik sebelum dipakai di produksi — bukan karena
diragukan, tapi karena angka-angka inilah yang nanti dipakai mengambil
keputusan.

| Berkas | Fungsi | Yang dihitung |
|---|---|---|
| `boq-rap.ts` | `buatBoqDariTemplate` | BOQ awal dari luas bangunan |
| | `buatRapDariTemplate` | RAP awal dari luas bangunan |
| | `hitungUpahRap` | Upah borongan dari luas bangunan |
| | `kelompokkanRap` | Pengelompokan RAP per grup pekerjaan |
| | `rapGenerik`, `boqSarprasDefault` | Template untuk sarpras |
| `keuangan.ts` | `statusSerapan` | Hemat / Sesuai / Over, toleransi 3% |
| | `ringkasKontrak` | Nilai efektif, terbayar, retensi, VO |
| | `alokasiKontrak` | Bagian tiap unit atas NILAI kontrak borongan |
| | `alokasiPembayaran` | Bagian tiap unit atas satu TERMIN pembayaran |
| | `bagiRata` | Pembagian rata; sisa pembulatan ke baris pertama |
| | `periksaAlokasi` | Penegak invarian induk–rincian di atas |
| `plan-real.ts` | `ringkasPlanReal` | Rencana vs realisasi per pos |
| `aset.ts` | `terapkanPenyesuaian` | Akibat kehilangan/kerusakan pada stok aset |
| | `unitTerpakai`, `taksiranNilaiRusak` | Unit siap pakai dan taksiran nilai rusak |
| `opname.ts` | `susunOpname`, `ringkasOpname` | Opname mingguan dari progres per baris |
| | `susunOpnameDariPersen` | Taksiran lama, untuk BOQ yang belum diopname |
| | `fraksiBaris` | Pembagian progres ke baris pekerjaan |
| `kontrak-boq.ts` | `progresTertimbang` | Progres dari baris BOQ, tertimbang nilai |
| | `statusSelaras` | Status bangun yang selaras dengan progres |
| | `progresPerUnit`, `progresPerSarpras` | Pengelompokan progres per objek |
| | `nilaiTerpasang` | Rupiah pekerjaan terpasang — dasar penagihan |
| | `periksaBarisBoqSpk` | Validasi baris BOQ SPK |

Dua yang paling perlu dibaca sebelum dipercaya:

- **`ringkasKontrak`** menentukan *nilai efektif* kontrak — nilai awal
  ditambah VO yang **sudah disetujui** saja; VO yang masih diajukan sengaja
  tidak dihitung. Retensi dipotong dari nilai efektif itu.
- **`alokasiKontrak`** membagi kontrak borongan ke beberapa unit secara rata,
  **kecuali** unit yang punya `nilaiOverride` sendiri. Unit ber-override
  diambil lebih dulu, sisanya baru dibagi rata.

Satu catatan tentang `fraksiBaris`: fungsi itu memecah SATU angka persen ke
baris-baris BOQ dengan anggapan pekerjaan diselesaikan berurutan, dan
anggapan itu hanya benar bila tiap baris berbobot sama. Kini ia hanya dipakai
`susunOpnameDariPersen`, untuk objek lama yang baris BOQ-nya belum pernah
diopname. Arah data yang benar sudah terbalik: QS mengisi tiap baris, dan
`progresTertimbang` menghitung persen objeknya DARI baris-baris itu.

---

## 4. Hak akses

Ada di `src/lib/auth/rbac.ts`. Bagian ini yang paling penting dipahami
sebelum menyambungkannya ke sistem login ERP.

### Prinsipnya

Data yang tidak boleh dilihat **tidak pernah di-`SELECT`** dari database —
bukan diambil lalu disembunyikan di komponen. Untuk angka RAB/RAP dan
business plan, menyembunyikan di sisi klien bukan pengamanan: siapa pun yang
membuka DevTools bisa membacanya.

Konsekuensinya: hak akses ikut menentukan bentuk query, bukan hanya bentuk
tampilan. Kalau ERP menyalin halaman tapi tidak menyalin pola ini, kebocoran
akan terjadi tanpa gejala apa pun di layar.

### Sepuluh sub-bagian

`deskripsi`, `daftarUnit`, `daftarSarpras`, `dokumenTeknis`, `hargaRabRap`,
`businessPlan`, `keuangan`, `progress`, `aset`, `penyesuaianAset`

`aset` dan `penyesuaianAset` sengaja dipisah: yang mendata kehilangan dan
kerusakan adalah orang lapangan, sedangkan yang menambah atau menghapus master
aset adalah bagian pengadaan.

Tiap peran punya satu dari tiga tingkat per sub-bagian: tidak boleh lihat,
boleh lihat, atau boleh ubah. Tersimpan di `RoleSectionPermission`, bisa
disunting lewat halaman Admin.

### Halaman Ringkasan menyaring per grup, bukan per angka

`src/lib/data/kpi-ringkasan.ts` menyusun KPI seluruh modul untuk halaman
depan. Penyaringnya sengaja disamakan persis dengan penyaring menu di
`src/lib/nav.ts` — termasuk Landbank yang disaring per izin **`businessPlan`**
(dulu per peran `PIMPINAN`, diseragamkan saat Plan vs Realisasi disatukan ke
Landbank supaya aksesnya bisa dikonfigurasi). Halaman depan tidak boleh
memamerkan angka dari modul yang menunya sendiri tidak muncul, dan grup yang
tidak lolos tidak dihitung sama sekali: query-nya memang tidak dijalankan.

Di dalam grup yang lolos, kolom rupiah masih bisa tertutup sendiri lewat
`hargaRabRap`. Saat itu terjadi KPI-nya **berganti isi**, bukan berganti nilai
jadi nol — "Nilai Aset Sendiri" berubah menjadi "Servis ≤ 30 Hari". Nol yang
sebenarnya berarti "tidak boleh dilihat" adalah angka yang menyesatkan.

Angkanya memakai rumus yang sama persis dengan halaman asalnya (rata-rata
progres ditimbang jumlah unit, `ringkasKontrak()` untuk nilai kontrak). Bila
Ringkasan dan modul asal menyebut angka berbeda untuk hal yang sama, yang
rusak adalah kepercayaan pada keduanya.

### Satu perilaku yang sering disangka bug

**Izin mengikuti peran yang sedang aktif saja, bukan gabungan semua peran
yang dimiliki pengguna.** Seseorang yang merangkap Komisaris dan Project
Manager akan benar-benar kehilangan akses Keuangan ketika sedang berperan
sebagai Komisaris. Ini disengaja — itulah yang membuat pemilih "Lihat
sebagai" bermakna. Bila sebuah modul tampak tertutup padahal pengguna
"punya" peran yang berhak, periksa dulu peran mana yang sedang dipilih.

### 20 peran, 8 kelompok

| Kelompok | Peran |
|---|---|
| lead | BOD, Komisaris |
| ops | Head Operation Office, Head Operation Project, Project Manager, Supervisor |
| tech | Arsitek, Procurement, Quantity Surveyor |
| fin | Admin, Consultant Finance, Finance |
| mkt | Agent Coordinator, Head Marketing & Sales, Sales |
| biz | Business Development |
| media | Editor, Head Content & Media |
| cc | Customer Care |
| hr | HRD |

### Pembatasan per proyek

Terpisah dari izin sub-bagian. `User.semuaProyek = true` berarti semua
proyek; selain itu dibatasi lewat `UserProjectAccess`. Gunakan `filterProyek()`
dan `filterProjectId()` untuk menyisipkan klausa `where`-nya. Pengguna tanpa
akses proyek apa pun menghasilkan **nol baris**, bukan semua baris — perhatikan
ini bila menulis ulang query, karena salah tulis di sini membuka semuanya.

---

## 5. Yang perlu diganti saat migrasi

| Bagian sekarang | Di ERP |
|---|---|
| Login sendiri (`jose` JWT + `crypto.scrypt`) | Ganti dengan login ERP |
| Sidebar (`src/app/(app)/sidebar.tsx` + aturan `.side` di `globals.css`) | Ganti dengan navigasi ERP |
| Halaman login (`src/app/login/`) | Hapus |
| SQLite + `@prisma/adapter-better-sqlite3` | Basis data ERP |
| Palet warna di `globals.css` | Timpa token, lihat bagian 6 |

Yang **tidak perlu** diganti: `src/lib/calc/`, `src/lib/domain/`, skema
Prisma, dan sebagian besar `src/components/`.

Titik sambung dengan login ERP hanya satu fungsi: `ambilPengguna()` di
`rbac.ts`. Selama ia mengembalikan objek `Pengguna` yang sama bentuknya —
`id`, `nama`, `peranAktif`, `peran[]`, `semuaProyek`, `proyekIds[]`, dan peta
`izin` — seluruh aplikasi di atasnya tidak perlu tahu login-nya diganti.
Itu satu-satunya tempat yang membaca sesi.

---

## 6. Warna dan tampilan

Seluruh warna aplikasi berupa custom property CSS di `:root`
(`src/app/globals.css`). Menyesuaikan tampilan dengan tema ERP dilakukan
dengan menimpa blok itu — tidak perlu menyisir style inline di ratusan
tempat. Penamaannya mengikuti maknanya (`--rona-baris`, `--garis-halus`),
bukan warnanya, supaya tetap masuk akal ketika temanya diganti gelap.

Di luar sidebar dan halaman login — dua bagian yang memang diganti kerangka
ERP — tidak ada lagi warna yang ditulis langsung sebagai hex.

---

## 7. Cara menjaga lapisan hitung tetap bersih

Nilai utama `src/lib/calc/` dan `src/lib/domain/` ada pada satu sifat: tidak
mengimpor apa pun dari React, Next.js, atau Prisma. Sifat itu rusak hanya
dengan satu `import` yang tampak tidak berbahaya, dan rusaknya tidak
menimbulkan galat apa pun — baru terasa saat migrasi berikutnya.

Perintah untuk memeriksanya:

```bash
grep -rE "^import .* from \"(react|next|@prisma|@/lib/db)" src/lib/calc src/lib/domain
```

Tidak ada keluaran berarti masih bersih. Ada baiknya perintah ini dipasang di
CI ERP.

Aturan turunannya, yang juga sudah berlaku di kode ini:

- `src/components/` tidak boleh mengimpor dari `src/app/`. Komponen yang
  perlu memanggil Server Action menerimanya lewat props, bukan mengimpornya.
  Dengan begitu folder komponen bisa dipindahkan sendirian.
- Komponen tidak menyentuh Prisma dan tidak memakai tipe bentukan Prisma.
  Semuanya memakai antarmuka yang didefinisikan sendiri.

---

## 8. Urutan migrasi yang disarankan

Disusun supaya tiap langkah bisa diuji sebelum melangkah ke berikutnya, dan
supaya kesalahan ketahuan saat masih murah diperbaiki.

1. **Skema dulu.** Pindahkan `prisma/schema.prisma` ke basis data ERP.
   Sesuaikan `Float` → `Decimal` dan `String` → enum asli bila memakai
   PostgreSQL. Belum perlu menyentuh tampilan.
2. **Lapisan hitung.** Salin `src/lib/calc/` dan `src/lib/domain/` apa
   adanya, berikut berkas tesnya. Jalankan tesnya di ERP — kalau 86 tes lulus
   di sana, rumusnya terbawa utuh.
3. **Hak akses.** Sambungkan `ambilPengguna()` ke login ERP. Uji dengan
   beberapa peran berbeda sebelum lanjut, khususnya peran yang tidak boleh
   melihat `hargaRabRap` dan `businessPlan`.
4. **Data dan komponen.** Pindahkan `src/lib/data/` dan `src/components/`.
   Di titik ini aplikasi sudah bisa membaca data ERP.
5. **Halaman, satu modul per waktu.** Urutan yang disarankan: Master Proyek →
   Konstruksi → Keuangan → Vendor → Landbank → Plan vs Realisasi → Admin.
   Master Proyek lebih dulu karena modul lain merujuk unit dan sarpras yang
   didefinisikan di sana.
6. **Terakhir, jejak audit dan dokumen.** `AuditLog` dan penyimpanan berkas
   biasanya sudah ada padanannya di ERP; pertimbangkan memakai milik ERP
   daripada memindahkan yang ini.

Data demo tidak perlu ikut. `prisma/seed.ts` hanya untuk peragaan.

---

## Menyerap ke ERP vanilla JS

ERP memakai satu index.html + vanilla JS + Supabase RPC. Yang berikut ini sudah
disiapkan supaya penyerapannya tidak dimulai dari nol.

### Aturan bisnis sebagai ESM siap-browser

```bash
npm run bangun:portabel
```

Perintah itu memancarkan lapisan murni menjadi `portabel/` — **26 modul, 199
ekspor** — berupa `.js` biasa yang bisa langsung ditulis di `<script
type="module">`, tanpa bundler dan tanpa langkah kompilasi:

```html
<script type="module">
  import { totalBaris } from "./portabel/calc/boq.js";
  import { rp, PPN_RATE } from "./portabel/format.js";
</script>
```

Isinya `calc/`, `domain/`, `tampilan/`, `adaptor/`, ditambah `format.ts`
(rupiah, persen, tanggal, tarif PPN 11% dan all-in 10%) dan `nav.ts` (struktur
menu beserta sub-bagiannya). Berkas `.d.ts` ikut dipancarkan, jadi editor tetap
memberi bantuan tipe meski dipanggil dari JavaScript biasa.

`tsc` saja tidak cukup untuk ini: sumbernya memakai impor tanpa ekstensi dan
beberapa alias `@/lib/...`, yang sah di TypeScript tetapi tidak bisa dimuat
browser. `scripts/bangun-portabel.mjs` menulis ulang keduanya, lalu memeriksa
hasilnya dan meng-import setiap modul untuk membuktikan semuanya berdiri
sendiri — membangun tanpa memeriksa hanya memindahkan kegagalan ke browser
orang lain.

### Halaman acuan

`contoh-erp/index.html` adalah halaman kecil yang berjalan sungguhan: ia
mengimpor modul portabel, menghitung nilai BOQ, PPN, kategori RAP, status
hutang, dan menegakkan invarian pembebanan — semuanya dari aturan asli, tidak
ada rumus yang disalin ulang. Sajikan dari akar repo, mis.
`python -m http.server 8080`, lalu buka `/contoh-erp/`.

`contoh-erp/rpc.js` adalah pemanggil Supabase RPC tanpa pustaka apa pun —
cukup `fetch` bawaan. Ia membedakan penolakan izin (`42501`) dari galat lain,
supaya tampilan bisa berkata "Anda tidak berhak" alih-alih "terjadi
kesalahan".

### Yang tetap harus ditulis ulang

Seluruh `src/app/` (13.576 baris) dan `src/components/` (2.930 baris). Itu
perakitan halaman, dan ERP punya kerangkanya sendiri.

Server Actions tidak punya padanan langsung. Setiap aksi di
`src/app/(app)/**/actions.ts` menjadi fungsi RPC Postgres — daftar lengkap 77
aksi beserta izin dan usulan namanya ada di `KONTRAK-RPC.md`. Urutannya tidak
boleh berubah: periksa hak akses lebih dulu, lalu validasi, lalu simpan, lalu
catat ke audit log.

> **Yang paling mudah keliru di arsitektur ini.** Di Next.js, kode yang
> memeriksa izin kebetulan berjalan di server. Di vanilla JS tidak ada
> "kebetulan" itu — semua yang Anda tulis berjalan di browser dan bisa dipanggil
> siapa pun lewat devtools. Pemeriksaan izin harus berada di dalam fungsi
> Postgres (`SECURITY DEFINER`, periksa di baris pertama). Menyembunyikan
> tombol adalah kenyamanan tampilan, bukan penjagaan.

---

## Menjalankan proyek ini

```bash
npm install
npm run db:reset     # buat ulang basis data + data demo
npm run dev
```

Password semua akun demo ada di `prisma/seed.ts`. Perintah lain yang berguna:
`npm test`, `npm run typecheck`, `npm run db:studio`.

Bila muncul galat yang menyebut tabel atau kolom tidak dikenal setelah menarik
perubahan skema, jalankan `npm run db:reset`. README memuat tabel
gejala → perintah yang lebih lengkap.
