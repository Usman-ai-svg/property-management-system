# Panduan Migrasi ke ERP Perusahaan

Dokumen ini ditujukan untuk orang yang akan memindahkan Nanoland Management
System ke laman utama website Management System perusahaan. Isinya bukan
ringkasan fitur, melainkan hal-hal yang perlu diketahui sebelum menyentuh
kodenya: apa yang bisa dipindahkan apa adanya, apa yang harus ditulis ulang,
dan mana bagian yang kalau salah dipindahkan akan diam-diam menghasilkan
angka yang keliru.

Ditulis dengan asumsi ERP tujuan memakai Next.js/React. Bila ternyata bukan,
bagian [Kalau ERP-nya bukan Next.js](#kalau-erp-nya-bukan-nextjs) menjelaskan
apa yang berubah.

---

## 1. Peta lapisan

Kode dibagi menurut seberapa terikat ia pada framework. Semakin ke atas
daftar ini, semakin mudah dipindahkan.

| Lapisan | Lokasi | Baris | Bergantung pada |
|---|---|---:|---|
| Aturan hitung | `src/lib/calc/` | 952 | tidak ada — TypeScript murni |
| Enum & template | `src/lib/domain/` | 339 | tidak ada — TypeScript murni |
| Pengambilan data | `src/lib/data/` | 664 | Prisma |
| Hak akses | `src/lib/auth/` | 296 | Prisma, `jose`, cookie Next.js |
| Komponen tampilan | `src/components/` | 2.579 | React |
| Halaman & aksi | `src/app/(app)/` | 12.366 | Next.js App Router |

Dua lapisan teratas — 1.291 baris — **tidak mengimpor apa pun dari framework
maupun dari Prisma**. Keduanya bisa disalin ke ERP tanpa perubahan sebaris
pun, dan itu memang disengaja sejak awal: di situlah seluruh rumus bisnis
berada. Sifat ini gampang rusak tanpa terasa, jadi lihat
[bagian 7](#7-cara-menjaga-lapisan-hitung-tetap-bersih).

Lapisan paling bawah adalah yang paling banyak barisnya sekaligus paling
tidak berharga untuk dipindahkan mentah-mentah. Isinya perakitan halaman:
mengambil data, menyaring menurut hak akses, lalu menyusun kartu dan tabel.
Kalau ERP punya kerangka halaman sendiri, tulis ulang lapisan ini dan pakai
lapisan di atasnya.

---

## 2. Model data

Skema ada di `prisma/schema.prisma`, 42 model. Ini bagian yang paling
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
`ProgressRecord`, `Equipment`

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

### Lima keputusan yang mudah salah dipindahkan

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

**e. `AuditLog` bersifat hanya-tambah.** Tidak ada jalur ubah atau hapus di
seluruh aplikasi. `catatDiff()` menulis satu baris per kolom yang berubah,
bukan satu baris per aksi, supaya "siapa mengubah angka apa dari berapa jadi
berapa" bisa dilacak per kolom. Pertahankan sifat ini.

---

## 3. Indeks rumus bisnis

Semua ada di `src/lib/calc/`, tanpa impor framework, dan **seluruhnya sudah
punya tes** (125 tes, `npm test`). Ini daftar yang perlu diperiksa ulang
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

### Sembilan sub-bagian

`deskripsi`, `daftarUnit`, `daftarSarpras`, `dokumenTeknis`, `hargaRabRap`,
`businessPlan`, `keuangan`, `progress`, `aset`

Tiap peran punya satu dari tiga tingkat per sub-bagian: tidak boleh lihat,
boleh lihat, atau boleh ubah. Tersimpan di `RoleSectionPermission`, bisa
disunting lewat halaman Admin.

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
| Sidebar (`src/app/(app)/sidebar.tsx`) | Ganti dengan navigasi ERP |
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

## Kalau ERP-nya bukan Next.js

Yang tetap terpakai tanpa perubahan: skema Prisma, `src/lib/calc/`,
`src/lib/domain/`, dan berkas tesnya. Itu sekitar 1.291 baris aturan bisnis
plus 42 model data — bagian yang paling mahal untuk dibuat ulang dan paling
berbahaya kalau ditulis ulang dari layar.

Yang harus ditulis ulang: seluruh `src/app/` dan `src/components/`. Pola
penegakan hak akses di bagian 4 tetap berlaku apa pun frameworknya, dan
`rbac.ts` bisa dijadikan acuan meski kodenya tidak dipakai langsung.

Yang perlu diperhatikan: Server Actions tidak punya padanan langsung di luar
Next.js. Setiap aksi di `src/app/(app)/**/actions.ts` perlu menjadi endpoint
API, dengan urutan yang sama seperti sekarang — periksa hak akses lebih dulu,
lalu validasi, lalu simpan, lalu catat ke audit log.

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
