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
| `Pembelian.penerima` | siapa yang menerima barang | diprisi nama pengguna aktif, **tetapi bisa disunting** — sering diisi nama mandor atau satpam yang menerima kiriman. Memaksanya jadi id akan menolak kenyataan lapangan |
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

2. **Pembatasan per proyek.** ERP belum punya padanan `semuaProyek` /
   `proyekIds`. Selama mode RBAC ERP aktif, setiap pengguna melihat SELURUH
   proyek — pelonggaran nyata yang sudah dicatat di `src/lib/auth/peran-erp.ts`
   dan diulang di sini supaya tidak ditemukan sebagai kejutan.

3. **`PettyCashFund.pemegangId`.** Lihat bagian 2: ini penunjukan yang berlaku,
   bukan sejarah. Dana yang pemegangnya tak punya akun ERP menjadi tak terpakai.
