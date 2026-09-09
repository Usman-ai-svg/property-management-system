# Jahitan Identitas

Setiap tempat identitas pengguna menembus lapisan, beserta keputusannya.

**Kenapa dokumen ini ada.** Repo punya tabel `User`, hash sandi, dan JWT
sendiri. ERP Nanoland tidak memakai satu pun: identitas di sana dari Supabase
Auth (`auth.users`), peran dari `public.profiles.role`. Tabel `User`, `Role`,
dan `UserRole` **tidak ikut migrasi** — tetapi data yang menyebut siapa
melakukan apa harus tetap bermakna sesudahnya.

Dikerjakan pada Kelompok C, branch `siap-migrasi-erp`.

---

## Keputusan pokok: simpan id DAN nama

Untuk tiap kolom yang menyebut pelaku, disimpan **dua-duanya**:

| | Isinya | Kenapa |
|---|---|---|
| `<kolom>` (nama) | nama tampilan **pada saat kejadian** | dokumen lama tetap berbunyi seperti saat dibuat, walau orangnya berganti nama atau keluar |
| `<kolom>Id` (id) | id pelaku | keputusan tetap bisa ditelusuri balik ke akun, walau ada dua orang bernama sama |

Keduanya sah dipilih sendiri-sendiri, dan panduan memang menyerahkannya. Yang
dipilih Usman: **dua-duanya**, karena keduanya menjawab pertanyaan berbeda.
Nama menjawab "dokumen ini bunyinya apa"; id menjawab "siapa orangnya".

**Bentuk id sengaja teks biasa, tanpa relasi.** Di repo ini isinya cuid dari
tabel `User`; di ERP `auth.users.id` yang berupa uuid. Keduanya teks, jadi
kolomnya ikut pindah tanpa konversi. Tanpa foreign key juga disengaja:
baris-baris ini jejak sejarah, dan menghapus akun tidak boleh ikut menghapus
atau mengosongkannya.

---

## 1. Kolom yang menyimpan PELAKU — dapat id berdampingan

Sembilan kolom, semuanya sudah diisi berpasangan.

| Model | Kolom nama | Kolom id (baru) | Ditulis oleh |
|---|---|---|---|
| `Expense` | `pic` | `picId` | catat pengeluaran, bayar PO, pembayaran kontrak, pengeluaran petty cash, biaya operasional |
| `HutangCicilan` | `pic` | `picId` | bayar cicilan hutang |
| `OperationalCost` | `pic` | `picId` | catat biaya operasional |
| `ProgressRecord` | `dicatatOleh` | `dicatatOlehId` | ubah progres, opname, ubah unit/sarpras |
| `EquipmentAdjustment` | `dicatatOleh` | `dicatatOlehId` | catat penyesuaian stok |
| `EquipmentService` | `dicatatOleh` | `dicatatOlehId` | catat servis |
| `EquipmentUsage` | `dicatatOleh` | `dicatatOlehId` | tambah penggunaan alat |
| `RabEstimasi` | `diajukanOleh` | `diajukanOlehId` | ajukan RAB |
| `RabEstimasi` | `diputusOleh` | `diputusOlehId` | setujui / tolak RAB |

Kolom id dibuat **opsional** (`String?`) supaya baris lama tetap sah. Baris yang
idnya kosong berarti dicatat sebelum Kelompok C — namanya tetap ada, telusurnya
saja yang tidak.

## 2. Kolom yang SUDAH menyimpan id — tinggal dialihkan

Tiga kolom sudah berupa relasi ke `User`. Di ERP, FK-nya diarahkan ke
`auth.users`:

| Model | Kolom | Catatan |
|---|---|---|
| `Document.diunggahOlehId` | relasi ke `User` | satu-satunya jejak identitas yang ber-FK; di ERP jadi `references auth.users(id)` |
| `PettyCashFund.pemegangId` | relasi ke `User` | **bukan jejak sejarah** — ini penunjukan yang berlaku sekarang, jadi FK-nya memang benar |
| `PettyCashTopUp.olehId` | relasi ke `User` | siapa yang memberi dana |

`PettyCashFund.pemegangId` perlu diperhatikan saat migrasi: ia dipakai
memutuskan **siapa boleh mencatat pengeluaran** dana itu, bukan sekadar
mencatat sejarah. Kalau pemegangnya tidak punya akun di ERP, dana itu jadi tak
bisa dipakai siapa pun — bukan sekadar kehilangan keterangan.

## 3. Kolom yang TAMPAK identitas tetapi bukan — dibiarkan teks

Ini yang paling mudah keliru dipindahkan. Ketiganya menyebut **orang di dunia
nyata**, yang belum tentu punya akun:

| Model | Kolom | Kenapa dibiarkan |
|---|---|---|
| `Pembelian.penerima` | siapa yang menerima barang | diisi awal dengan nama pengguna aktif, **tetapi bisa disunting** — sering diisi nama mandor atau satpam yang menerima kiriman. Memaksanya jadi id akan menolak kenyataan lapangan |
| `EquipmentUsage.penanggungJawab` | penanggung jawab alat di lapangan | sama: bisa nama tukang atau supervisor yang bukan pengguna aplikasi |
| `Contract` / vendor | nama vendor, kontak | vendor bukan pengguna sistem sama sekali |

Kalau suatu saat ketiganya ingin ditautkan ke akun, yang benar adalah menambah
kolom id **opsional** di sampingnya — bukan mengubah kolom teksnya.

## 4. Identitas di dalam ALUR, bukan di dalam data

Tempat identitas dipakai untuk memutuskan, bukan disimpan. Semuanya sudah lewat
`Pengguna` dari `ambilPengguna()`, jadi tidak ada yang menyentuh sesi langsung:

| Tempat | Dipakai untuk |
|---|---|
| `izinkan(section, projectId)` | gerbang tiap aksi tulis — peran aktif + akses proyek |
| `petty-actions.ts` | `pengguna.id === dana.pemegangId` — hanya pemegang dana boleh mencatat |
| `admin/actions.ts` | `target.id === pengguna.id` — tidak bisa menonaktifkan/menghapus diri sendiri |
| `admin/actions.ts` | `pengguna.peranAktif === role.nama` — tidak bisa mencabut hak kelola diri sendiri |
| `audit.ts` (`catat`) | jejak audit menyimpan pelaku setiap aksi |

Di ERP, keempat yang pertama jadi pemeriksaan di baris pertama tiap RPC dengan
`auth.uid()`. Yang kelima sudah berupa tabel tersendiri dan ikut apa adanya.

---

## Yang berubah di Kelompok C

**C1 — satu pintu.** `PenyediaIdentitas` di `src/lib/auth/penyedia.ts` menjawab
tiga pertanyaan saja: `siapa()`, `peran()`, `boleh()`. Seluruh mekanisme sesi
(nama cookie, umur token, `jose`, `next/headers`) kini tidak pernah keluar dari
`src/lib/auth/` — dijaga tes `penyedia.test.ts`, yang membaca berkas sumber dan
gagal bila ada satu impor yang menembus.

Tiga operasi sesi yang dulu tinggal di `src/app/login/actions.ts` — masuk,
keluar, ganti peran — pindah ke `src/lib/auth/masuk.ts`. Aksi layar masuk
sekarang cuma menerjemahkan `FormData` lalu mengarahkan halaman.

Satu pengecualian dicatat eksplisit di penjaganya: `src/lib/storage/gdrive.ts`
memakai `jose` untuk menandatangani permintaan service-account Google Drive.
Itu tidak ada hubungannya dengan identitas pengguna dan memang tetap ada di ERP.

**C2 — sembilan kolom id.** Seperti tabel di atas.

**C3 — matriks izin dikunci ke nama peran.** `RoleSectionPermission.roleId`
menjadi `roleNama` (teks), relasi ke `Role` dilepas. Alasannya: tabel `Role`
tidak ikut migrasi, jadi matriks yang menunjuk `roleId` akan kehilangan
induknya. Dengan nama peran, **seluruh isi tabel itu bisa ditempel apa adanya
ke ERP**.

Konsekuensinya disengaja dan perlu diketahui: mengganti nama sebuah peran
sekarang **memutus izinnya**. Itu memang harus terlihat — lebih baik daripada
izin diam-diam diwarisi peran berbeda yang kebetulan memakai id yang sama.

---

## Yang perlu diputuskan di sisi ERP

Tiga hal yang tidak bisa diselesaikan dari repo ini:

1. **Pemetaan akun.** Tiap pengguna repo perlu padanan di `auth.users`. Selama
   belum dipetakan, kolom `*Id` lama menunjuk cuid yang tidak ada di ERP —
   masih terbaca sebagai teks, tetapi tidak bisa di-join. Yang paling murah:
   satu tabel pemetaan sementara `cuid → uuid` saat memindahkan data.

2. ~~Pembatasan per proyek.~~ **SUDAH DIPUTUSKAN** (Usman, 2026-09-09): boleh
   hilang. Lihat bagian terakhir dokumen ini.

3. **`PettyCashFund.pemegangId`.** Lihat bagian 2: ini penunjukan yang berlaku,
   bukan sejarah. Dana yang pemegangnya tak punya akun ERP menjadi tak terpakai.

---

## Pemetaan posisi ERP → peran modul PROYEK

Ditetapkan bersama Usman **2026-09-09**, dari daftar pengguna ERP yang
sebenarnya. Ditulis di kode (`PETA_POSISI_ERP` di `src/lib/auth/peran-erp.ts`)
dan dijaga tes, bukan disepakati lisan.

**Kenapa POSISI, bukan `profiles.role`.** ERP menyimpan peran kasar
(`director`/`accountant`/`manager`/`admin`/`staff`) dan posisi sebenarnya di
daftar pegawai. Peran kasar terlalu tumpul untuk modul ini: `staff` yang sama
dipakai Logistic Staff, Junior Arsitek, dan Security — padahal ketiganya butuh
akses yang jauh berbeda.

**Isinya nama peran kita, bukan peta izin.** Izinnya sendiri sudah ada di
`RoleSectionPermission` yang sejak C3 dikunci ke nama peran, jadi seluruh isi
tabel itu bisa ditempel apa adanya ke ERP. Menyalin izin ke peta posisi akan
melahirkan sumber kebenaran kedua yang bisa hanyut sendiri.

| Posisi ERP | Divisi | Peran modul PROYEK |
|---|---|---|
| Director | Director | BOD |
| Head of Operation | Operasional | **Head Operation Office + Head Operation Project** |
| Manager Proyek | Produksi | **Project Manager + Supervisor** |
| Logistic Staff | Produksi | **Supervisor** |
| Quantity Surveyor Asst | Produksi | **Quantity Surveyor + Procurement** |
| Junior Arsitek Staff | Produksi | Arsitek |
| Finance & Tax | Operasional | Finance |
| Staff Administration | Operasional | **Admin + Finance** |
| HRD Staff | Operasional | HRD |
| Customer Service | Operasional | Customer Care |
| **Support Function** | Operasional | **tanpa akses modul proyek** |
| Manager Marketing | Marketing | Head Marketing & Sales |
| Sales & Marketing | Marketing | Sales |
| Agent Coordinator | Marketing | Agent Coordinator |
| Copy Writer | Marketing | Head Content & Media |
| Design Graphic Staff | Marketing | Editor |
| Graphic Designer | Marketing | Social Media |
| **Security** | Produksi & Operasional | **tanpa akses modul proyek** |

Kelima posisi Marketing berprofil izin **identik** — enam sub-bagian baca-saja
(deskripsi, daftar unit, daftar sarpras, dokumen teknis, aset, penyesuaian
aset). Peran yang dipilih hanya menentukan label, bukan kewenangan — tetapi
label itu ikut ke jejak audit, jadi tetap perlu benar.

### Empat rangkap peran, dan alasannya

Izin selalu mengikuti peran yang SEDANG dipakai, tidak pernah gabungan. Jadi
rangkap peran berarti orangnya berpindah lewat pemilih "Lihat sebagai".

- **Head of Operation** memegang sisi kantor (Head Operation Office) dan sisi
  lapangan (Head Operation Project). Yang kedua wajib: tahap "Setujui" pada
  alur petty cash menuntut nama peran itu persis. Tanpanya, laporan petty cash
  mentok di DiverifikasiQS dan tidak pernah bisa direimburse.
- **Manager Proyek** merangkap Supervisor sebagai pemegang dana petty cash.
  Konsekuensinya perlu diketahui: Project Manager tidak berhak mengubah petty
  cash, jadi untuk mencatat pengeluaran dana talangannya ia harus berpindah ke
  peran Supervisor lebih dulu. Itu bukan kerepotan tak sengaja — memegang uang
  tunai perusahaan memang tindakan yang berbeda dari mengelola proyek.
- **Logistic Staff** murni Supervisor, sehingga ia tak perlu berpindah peran
  sama sekali untuk memegang dana. Ia bisa mencatat penyesuaian stok (Hilang /
  Rusak / Koreksi Stok) tetapi TIDAK mendaftarkan alat baru — pendaftaran alat
  ikut Procurement, yang kini dipegang QS Asst.
- **Staff Administration** merangkap Finance. Kedua peran itu berprofil izin
  identik, jadi rangkapnya tidak menambah kewenangan apa pun pada matriks. Yang
  ditambahkannya justru hal yang tak terlihat dari matriks: tahap **Reimburse**
  menuntut nama peran "Finance" persis, sehingga pencairan tidak berhenti bila
  Finance & Tax berhalangan.

### Alur petty cash — keempat tahapnya kini ada pemegangnya

```
Pemegang (Supervisor)      → Manager Proyek · Logistic Staff
Verifikasi (QS)            → Quantity Surveyor Asst
Setujui (Head Ops Project) → Head of Operation
Reimburse (Finance)        → Finance & Tax · Staff Administration
```

Ada tes yang gagal bila salah satu tahap kehilangan pemegangnya.

### Yang belum terjawab

| Hal | Keadaannya |
|---|---|
| **Administrator Sistem** | tak ada padanannya di daftar ERP. Selama begitu, matriks hak akses hanya bisa diubah lewat database |
| **Tujuh akun "Belum"** | dua di antaranya kunci: Manager Proyek dan QS Asst. Selama belum aktif, tak ada yang bisa mengisi progres maupun memverifikasi petty cash |
| **Support Function** | diputuskan Usman: tanpa akses modul proyek |
| Komisaris, Business Development, Consultant Finance, Head Content & Media | tak ada orangnya di ERP — barisnya tinggal kosong, tidak masalah |

### Pembatasan per proyek: DIHAPUS

Diputuskan Usman 2026-09-09: pembatasan per proyek boleh hilang di ERP. Enam
akun di repo ini berstatus "proyek terbatas"; di ERP semuanya melihat seluruh
proyek. `penggunaDariErp()` memang sudah menyetel `semuaProyek: true`, jadi
tidak ada yang perlu diubah — tetapi sekarang itu keputusan yang diambil
sadar, bukan pelonggaran yang terlanjur.
