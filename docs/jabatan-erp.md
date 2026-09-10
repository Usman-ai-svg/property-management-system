# Jabatan & hak akses — yang harus dikerjakan di sisi ERP

Dokumen ini ditulis supaya bisa dikerjakan orang yang **belum pernah membuka
repo modul Proyek**. Isinya empat hal: dua jabatan yang perlu dibuat, kebijakan
centang modul, penegasan soal `profiles.role`, dan langkah mengunci kolom
jabatan HRIS jadi daftar tertutup.

---

## 0. Ringkasnya

Hak akses di dalam modul Proyek dikunci ke **jabatan**, bukan ke `profiles.role`.

| Lapis | Sumber | Menjawab |
| --- | --- | --- |
| Luar | `profiles.role` | modul mana yang kelihatan |
| Dalam | jabatan di `hris.employees` | di dalam modul Proyek boleh apa |

`profiles.role` **tidak berubah sama sekali**. Delapan nilainya —
`director`, `accountant`, `manager`, `sales`, `staff`, `viewer`, `hrd`, `admin` —
tetap apa adanya. Tidak ada nilai baru, tidak ada yang diganti artinya. Seluruh
risiko yang sempat dikhawatirkan (`canFinance()` bergeser, `is_hr_admin()`
kebobolan, peran baru tidak bisa absen) tidak berlaku di sini.

Konsekuensi yang perlu diketahui: **orang tanpa data karyawan HRIS tidak punya
jabatan, jadi tidak punya hak apa pun di modul Proyek** meski modulnya dicentang.
Itu perilaku yang benar dan aman — contohnya akun intern marketing yang memang
bukan karyawan. Yang ia lihat: menu Proyek ada, isinya kosong.

---

## 1. Dua jabatan yang perlu dibuat di HRIS

Dibuat **kosong** sekarang, tanpa orang. Barisnya sudah ada di matriks; tinggal
diisi nanti.

| Jabatan | Kenapa dibuat sekarang |
| --- | --- |
| `komisaris` | Melihat 9 sub-bagian termasuk business plan dan keuangan; tanpa hak ubah sama sekali. |
| `consultant finance` | Melihat 9 sub-bagian, hak ubah hanya petty cash. |

Kalau barisnya tidak dibuat sekarang, orang pertama yang menempati jabatan itu
akan masuk tanpa akses apa pun, dan yang terlihat bukan "belum diatur" melainkan
"aplikasinya rusak".

---

## 2. Kebijakan centang modul Proyek

**Dapat centang** — seluruh jabatan pada tabel di bagian 5. Termasuk jabatan
marketing dan media: mereka memang perlu melihat deskripsi proyek, daftar unit,
daftar sarpras, dokumen teknis, dan data aset sebagai bahan kerja.

Yang membatasi mereka bukan centang modul, melainkan **matriks**: delapan
jabatan bercakupan `luar` tidak punya satu pun hak ubah, dan tidak melihat
harga, margin, keuangan, petty cash, progres, maupun persetujuan RAB. Ada tes di
repo yang gagal bila salah satunya mendapat hak ubah.

**Tidak dapat centang** — akun yang bukan karyawan, dan jabatan yang tidak ada
di tabel bagian 5. Keduanya berakhir sama: tanpa jabatan yang dikenal, tidak ada
hak apa pun.

Dua hal yang perlu diputuskan Umar, bukan dikerjakan sekarang:

- `dokumenTeknis` termasuk berkas `.skp` dan `.dwg`. Jadi copy writer, design
  graphic staff, dan graphic designer bisa mengunduh gambar kerja. Untuk
  keperluan konten mungkin memang itu yang diinginkan.
- `progress` **tidak** termasuk yang boleh mereka lihat. Kalau tim konten butuh
  melihat kemajuan pembangunan untuk bahan posting, sub-bagian ini perlu
  ditambahkan. Sekarang belum.

---

## 3. Kolom jabatan HRIS dijadikan daftar tertutup

**Keputusan Umar/Usman: nilainya harus persis 18 dan rapi — salah ketik dicegah,
bukan ditampung.**

Sebabnya bukan kerapian. Tanpa pembatasan, `"Quantity Surveyor Asst"` masuk ke
`hris.employees` tanpa keluhan apa pun, dan orangnya kehilangan **seluruh akses
modul Proyek**: bukan galat, bukan halaman merah, cuma menu yang kosong. Ia akan
melaporkannya sebagai aplikasi rusak, dan yang dicari orang berikutnya adalah bug
di tempat yang salah. Dengan constraint, kekeliruan yang sama ditolak saat
disimpan — oleh orang yang sedang mengetiknya, saat ia masih ingat maksudnya.

Jalankan **`prisma/jabatan-hris.sql`** (dihasilkan `npm run jabatan:sql`).
Isinya tiga langkah, dan **urutannya tidak boleh dibalik**:

| Langkah | Isinya | Kenapa urutannya begitu |
| --- | --- | --- |
| 1. Periksa | nama kolomnya, nilai yang dipakai sekarang, dan mana yang di luar 18 | constraint yang dipasang di atas data belum bersih akan GAGAL, di tengah pekerjaan lain |
| 2. Rapikan | satu `UPDATE` menyeragamkan kapital dan spasi; sisanya manual | yang tersisa setelah langkah otomatis benar-benar jabatan lain, bukan beda ejaan |
| 3. Kunci | `CHECK` constraint 18 nilai | sejak titik ini, salah ketik jadi galat |

Berkasnya dihasilkan dari `src/lib/domain/jabatan.ts` — sumber yang sama dengan
matriks hak akses. Ditulis tangan, keduanya akan berbeda dalam sebulan.

Dua hal yang perlu diketahui sebelum menjalankannya:

- **Kolomnya diasumsikan bernama `jabatan`.** Langkah 1a memastikannya; kalau
  namanya berbeda, ganti di seluruh berkas.
- **`NULL` tetap diizinkan.** Karyawan yang jabatannya belum diisi bukan data
  rusak — ia cuma belum punya akses apa pun di modul Proyek. Yang ditolak adalah
  nilai yang terisi tapi di luar daftar.

### Menambah jabatan baru, nanti

Constraint ini membuat jabatan baru menuntut dua langkah:

1. tambahkan entrinya di `src/lib/domain/jabatan.ts`, lalu `npm run acl:sql` —
   tanpa ini jabatan baru tidak punya satu baris pun hak akses;
2. jalankan ulang `npm run jabatan:sql` dan pasang constraint-nya.

Terasa merepotkan, dan itu disengaja. Jabatan yang ada di HRIS tapi tidak ada di
matriks menghasilkan orang yang bisa masuk tetapi tidak melihat apa-apa —
kegagalan yang sama diamnya dengan salah ketik.

Kalau ternyata jabatan di organisasi sering berubah, ganti `CHECK` dengan tabel
acuan + foreign key: menambah jabatan jadi `INSERT` satu baris, bukan DDL, dan
database tetap menolak nilai yang tidak dikenal. Beri tahu kalau itu yang
dipilih — generatornya tinggal disesuaikan.

## 4. Yang dibawa dari repo

Tiga berkas SQL, dijalankan **berurutan** di SQL editor, sekali:

1. `prisma/jabatan-hris.sql` — merapikan lalu mengunci kolom jabatan HRIS
   (bagian 3). Dijalankan lebih dulu: sisanya bergantung pada nilai yang bersih.
2. `prisma/proyek.sql` — 60 tabel schema `proyek`, RLS aktif, tanpa policy tulis.
3. `prisma/acl.sql` — 145 baris matriks hak akses untuk 18 jabatan.

Ketiganya aman dijalankan ulang. `acuan.sql` dan `acl.sql` memberi tiap baris
id tetap lalu menutupnya dengan `on conflict do nothing`, jadi menjalankan dua
kali tidak menggandakan apa pun dan tidak menimpa penyuntingan yang sudah
dilakukan lewat halaman Admin. `jabatan-hris.sql` membuang constraint lamanya
lebih dulu sebelum memasang yang baru.

Tabelnya `proyek.role_section_permissions`, kolomnya `jabatan`, `section`,
`bolehLihat`, `bolehUbah`.

> **`bolehUbah` pada `pettyCash` berarti "boleh ikut dalam alur", BUKAN "boleh
> semua tahap".** Tahap mana untuk jabatan mana ditegakkan tabel transisi,
> bukan flag ini. Salah membacanya berarti mengira satu orang bisa mengajukan
> sekaligus menyetujui.

Aturan alur petty cash yang harus ikut ke RPC:

- Pemegang dana hanya boleh **mengajukan**. Tahap sesudahnya digerakkan orang
  lain — tidak ada yang memeriksa pertanggungjawabannya sendiri.
- `director` boleh menembus semua transisi, **kecuali** atas dana yang ia pegang
  sendiri. Aturan pertama diperiksa lebih dulu.

---

## 5. Peta jabatan → hak akses

Angka di bawah dihitung dari matriks, bukan diketik tangan. Nilai pada kolom
pertama adalah teks yang harus ada di `hris.employees` — **seragam huruf kecil**,
supaya tidak ada yang perlu menebak kapan sebuah kata berkapital.

| Jabatan HRIS | Orang | Lihat | Ubah | Catatan |
| --- | --- | ---: | ---: | --- |
| director | Umar | 12 | 12 | Administrator sistem de facto: pemegang modul Pengaturan dan jejak audit |
| komisaris | *kosong* | 9 | 0 | Pengawas: melihat banyak, mengubah tak satu pun |
| head of operation | Usman | 12 | 12 | Gabungan Head Operation Office + Project + Business Development |
| manager proyek | Abdillah | 11 | 7 | Boleh memegang dana petty cash |
| logistic staff | Dicky | 8 | 3 | Boleh memegang dana petty cash |
| quantity surveyor asst | Laras | 11 | 5 | QS + Procurement. **Tidak** boleh menyetujui RAB |
| junior arsitek staff | Sabila | 7 | 1 | Dokumen teknis |
| consultant finance | *kosong* | 9 | 1 | Petty cash |
| finance & tax | Nisa | 9 | 2 | Keuangan & reimburse |
| staff administration | Firmanda | 9 | 2 | Keuangan & administrasi |
| hrd staff | Galih | 6 | 0 | Cakupan luar |
| sales & marketing | Diana | 6 | 0 | Cakupan luar |
| customer service | Arzenico | 6 | 0 | Cakupan luar |
| manager marketing | Wahyudi | 6 | 0 | Cakupan luar |
| agent coordinator | Imam Jaka | 6 | 0 | Cakupan luar |
| copy writer | Intan | 6 | 0 | Cakupan luar |
| design graphic staff | Gunawan | 6 | 0 | Cakupan luar |
| graphic designer | Yuzak | 6 | 0 | Cakupan luar |

Dua pemisahan yang **tidak boleh hilang**, keduanya dijaga tes:

1. Quantity surveyor asst menyusun RAB, dan tidak menyetujui buatannya sendiri.
2. Pemegang dana petty cash tidak memverifikasi pengajuannya sendiri.

Sumber angkanya: `prisma/acuan/hak-akses.json`, dihasilkan dari
`src/lib/domain/jabatan.ts`. Yang mengubahnya di aplikasi: halaman Admin →
Kelola Hak Akses, terbuka untuk jabatan yang punya hak ubah `deskripsi`.
