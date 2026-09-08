# Panduan Menyiapkan Repo Referensi untuk Migrasi ke ERP Nanoland

Dokumen serah terima untuk sesi kerja lokal di repo
`Usman-ai-svg/property-management-system`.

**Baca ini dulu sebelum menyentuh kode apa pun.**

---

## 0. Apa yang sedang dikerjakan, dan apa yang TIDAK

Repo ini akan menjadi modul **PROYEK** di ERP Nanoland. ERP-nya sudah ada dan
sudah berjalan dengan empat modul lain; repo ini yang menyesuaikan diri, bukan
sebaliknya.

**Pekerjaannya: mengubah repo ini sampai migrasinya jadi mekanis.**

Artinya bukan menulis ulang repo dalam vanilla JS, bukan menyambungkannya ke
Supabase, dan bukan mengubah satu pun rumus bisnis. Yang dikerjakan adalah
memindahkan jahitan-jahitan (seam) di dalam repo sehingga saat migrasi
sesungguhnya, orang yang mengerjakannya tinggal menyalin, bukan menafsirkan.

Ukuran keberhasilannya satu kalimat: **setelah pekerjaan ini selesai, seluruh
logika bisnis repo bisa dipanggil tanpa memuat React, Next, atau Prisma, dan
setiap penulisan data punya kontrak tertulis yang bisa diterjemahkan ke RPC
Postgres tanpa membaca kode halaman.**

Aplikasi Next.js-nya harus **tetap jalan seperti sekarang** setelah tiap
kelompok pekerjaan selesai. Kalau `npm run dev` rusak, pekerjaannya salah
arah. Repo ini tetap jadi tempat rumusnya diuji, bahkan setelah ERP jalan.

---

## 1. Arsitektur sistem ERP saat ini (tujuan migrasi)

Kamu tidak punya akses ke ERP-nya. Bagian ini yang harus kamu jadikan gambaran
tujuan.

### 1.1 Bentuk aplikasi

ERP Nanoland ada di `erp.nanoland.id`, repo `umaralfaruqi73/nanoland-erp`,
deploy otomatis lewat Vercel.

Filosofi yang mendasari semua keputusannya: **"satu ERP, semua kegiatan
Nanoland dalam satu app, tidak pindah-pindah."** Pengguna tidak boleh
dilempar ke aplikasi lain untuk pekerjaan yang berbeda.

Frontend-nya **satu `index.html` dengan JavaScript vanilla**. Tidak ada React,
tidak ada Next.js, tidak ada build step untuk frontend, tidak ada bundler,
tidak ada npm install. Berkasnya dilayani apa adanya.

Modul PROYEK akan jadi pengecualian terkontrol: dipecah ke berkas
**`proyek.js`** terpisah yang dimuat saat menunya diklik, karena kalau semuanya
masuk ke `index.html`, tiap orang yang cuma mau lihat absensi ikut mengunduh
seluruh modul konstruksi. Tetap satu app dari sisi pengguna, tetap satu deploy.

### 1.2 Backend

Supabase (PostgreSQL) proyek `gyiflotzojngoysqhwtd`, region Mumbai.

Polanya konsisten di seluruh ERP:

- **Baca** lewat PostgREST dengan RLS aktif, atau lewat RPC `*_bootstrap()`
  yang mengembalikan seluruh kebutuhan satu layar dalam satu panggilan JSONB.
- **Tulis** SELALU lewat RPC `SECURITY DEFINER`. Tidak ada `INSERT`/`UPDATE`/
  `DELETE` langsung dari klien. Tabel tidak punya policy tulis sama sekali —
  itu disengaja, bukan kelupaan.
- Tiap RPC memeriksa izin di baris pertamanya, lalu validasi, lalu simpan, lalu
  catat audit.

Schema yang sudah ada: `crm`, `hris`, `marketing`, `agen`, `kpr`, plus
akuntansi di `public`. Modul PROYEK dapat schema `proyek` sendiri.

### 1.3 Identitas dan hak akses

- Identitas dari **Supabase Auth** (`auth.users`), bukan tabel pengguna sendiri.
- Peran pengguna di `public.profiles.role`.
- Akses modul berupa **centang per modul** (crm, hris, marketing, agen,
  keuangan, konten, dan menyusul proyek).
- Penjaganya fungsi seperti `hris.can_konten()` yang dipanggil di dalam RPC.
- Ada juga hak berlapis untuk data sensitif, misalnya `is_hr_admin()` untuk
  gaji.

**Konsekuensi penting untuk repo ini:** tabel `User`, `Role`, `UserRole`, dan
seluruh mekanisme login/JWT di repo **tidak ikut migrasi**. Tapi jangan dibuang
dari repo — repo harus tetap bisa dijalankan. Yang dikerjakan adalah
mengisolasinya di balik satu antarmuka, supaya di sisi ERP tinggal diganti
implementasinya.

### 1.4 Berkas

Berkas desain berat (`.skp`, `.dwg`, 24–38 MB) disimpan di **Google Drive**.
Database hanya menyimpan metadata dan tautannya. Tidak ada object storage untuk
berkas besar.

Berkas kecil (foto progres, bukti transaksi) boleh ke Supabase Storage bucket
privat.

### 1.5 Cara kerja tim

- Bahasa Indonesia non-baku. Kode, komentar, dan nama fungsi berbahasa
  Indonesia — repo ini sudah begitu, pertahankan.
- Iteratif dan berbasis deploy: Umar men-deploy, melaporkan yang dia lihat,
  lalu mengoreksi.
- **Arsitektur mendahulukan isolasi, integrasi belakangan.** Modul baru berdiri
  sendiri dulu, disambung ke data lain nanti.

---

## 2. Jurang antara repo ini dan ERP

| Hal | Repo ini | ERP | Dampak migrasi |
|---|---|---|---|
| Frontend | Next.js 15 App Router, React | `index.html` + vanilla JS | 23.296 baris di `src/app/` ditulis ulang |
| Komponen | 23 berkas React, 4.517 baris | tanpa komponen | ditulis ulang |
| Database | Prisma + SQLite | Supabase Postgres | skema dikonversi |
| Permukaan tulis | 135 Server Action, masukan `FormData` | ~45 RPC, masukan JSONB | kontrak ditulis ulang |
| Identitas | tabel sendiri + JWT `jose` | Supabase Auth + `profiles` | tabel dibuang, jahitan diganti |
| Hak akses | matriks 12 sub-bagian × peran | centang modul | matriks disimpan, dibiarkan terbuka |
| Berkas | penyimpanan lokal + `/api/dokumen` | tautan Google Drive | adaptor diganti |
| Excel | ExcelJS di server | SheetJS di browser | aturan tetap, mesin diganti |
| Bahasa | TypeScript | JavaScript | ditranspilasi |

### Yang selamat utuh dan yang tidak

Empat lapisan ini **murni** — sudah diverifikasi tidak mengimpor React, Next,
atau Prisma sama sekali:

| Lapisan | Baris | Isi |
|---|---|---|
| `src/lib/calc/` | 3.324 | rumus RAB, RAP, alokasi, opname, AHSP, tender, petty cash |
| `src/lib/domain/` | 741 | enum dan template |
| `src/lib/tampilan/` | 1.517 | penyusun angka per halaman |
| `src/lib/adaptor/` | 1.422 | aturan identitas, formulir, berkas, tabel |

Sekitar 7.000 baris, dijaga 208 tes. **Ini bagian yang paling mahal dibuat
ulang dan paling berbahaya kalau ditulis ulang dari layar.** Seluruh pekerjaan
di dokumen ini pada dasarnya bertujuan memperbesar bagian ini dan memperkecil
sisanya.

---

## 3. Alur migrasi

Enam fase. Fase 1–3 adalah isi dokumen ini (dikerjakan di repo ini, lokal).
Fase 4–6 dikerjakan belakangan di sisi ERP.

```
FASE 1  Pemurnian
        Semua logika bisnis dipindah ke lapisan murni.
        Halaman dan action jadi kurus, isinya cuma transport.
              ↓
FASE 2  Kontrak
        Tiap penulisan data punya kontrak tertulis yang bisa dibaca mesin:
        masukan, validasi, invarian, sub-bagian izin, jejak audit.
              ↓
FASE 3  Jahitan
        Identitas, berkas, Excel, dan database diisolasi di balik antarmuka.
        Implementasi Next/Prisma tinggal satu berkas per jahitan.
              ↓
   ── batas repo ini ──────────────────────────────────────────────
              ↓
FASE 4  Skema      → DDL Postgres dijalankan di Supabase
FASE 5  RPC        → kontrak Fase 2 diterjemahkan ke PL/pgSQL
FASE 6  Layar      → spesifikasi layar Fase 2 digambar ulang di proyek.js
```

Urutan modulnya di Fase 4–6, karena semua merujuk unit:

```
Master Proyek → Konstruksi → Keuangan Proyek → Vendor
   → Estimasi RAB → Landbank → Petty Cash → Equipment
```

Menu di ERP (Admin tidak ikut — pengelolaan pengguna dan hak akses sudah ada
di ERP; pembuatan proyek dan fase ternyata memang sudah ada di Master Proyek,
jadi tidak ada yang hilang kecuali penampil Log Perubahan yang jadi tab di
Master Proyek):

```
PROYEK  (sejajar Bisnis dan Backoffice)
├── Ringkasan
├── Master Proyek
├── Estimasi RAB → RAB Estimasi · Pustaka AHSP · Supplier
├── Manajemen Proyek → Konstruksi · Keuangan Proyek · Petty Cash
│                      · Vendor Management · Equipment & Asset
└── Landbank
```

---

## 4. Daftar pekerjaan

Delapan kelompok. **A dan B yang paling menentukan** — kalau waktunya terbatas,
kerjakan dua itu sampai tuntas dan sisanya seadanya.

Aturan yang berlaku di semua kelompok:

- `npm test` harus lulus setiap selesai satu tugas, bukan di akhir.
- `npm run dev` harus tetap jalan.
- **Tidak ada rumus yang berubah nilainya.** Kalau sebuah tes harus diubah agar
  lulus, berhenti — itu tandanya perilakunya berubah, dan itu bukan tujuan
  pekerjaan ini.

---

### Kelompok A — Pemurnian logika

**Kenapa:** apa pun yang tertinggal di dalam komponen React atau Server Action
akan ditulis ulang dari nol oleh orang yang tidak menulisnya, sambil menebak
maksudnya. Yang ada di lapisan murni tinggal disalin.

**A1. Audit kebocoran logika.**
Telusuri 80 berkas di `src/app/(app)/` dan 23 di `src/components/`. Cari
perhitungan yang hidup di sana: penjumlahan, pembagian, pembulatan,
persentase, penentuan status, pengurutan yang punya aturan bisnis, pemetaan
nilai ke label.
Hasilnya satu berkas `docs/audit-logika-tercecer.md`: lokasi, apa yang
dihitung, ke modul mana seharusnya pindah.

**A2. Pindahkan.**
Tiap temuan A1 dipindah ke `src/lib/calc/` (kalau berlaku umum) atau
`src/lib/tampilan/` (kalau menjawab "angka apa yang dibutuhkan layar ini").
Komponen memanggilnya, tidak menghitung sendiri.
Tiap fungsi yang dipindah **wajib dapat tes** — minimal kasus normal, kasus
nol/kosong, dan satu kasus batas.

**A3. Bereskan `src/lib/format.ts`.**
Sekarang dia di luar empat lapisan murni padahal murni dan dipakai
`tampilan/landbank.test.ts`. Pindahkan ke dalam salah satu lapisan, atau
jadikan lapisan kelima yang resmi. Yang penting: definisi "lapisan murni"
jadi bisa diperiksa mesin.

**A4. Pasang penjaga.**
Tes baru yang gagal kalau ada berkas di empat lapisan itu mengimpor `react`,
`next/*`, `@prisma/client`, atau `src/lib/db`. Sudah ada pola serupa di
`src/lib/actions/penjaga-aksi.test.ts` — tiru.

**Selesai kalau:** `docs/audit-logika-tercecer.md` ada dan semua barisnya
tercoret; penjaga A4 lulus; jumlah baris di empat lapisan naik dan di
`src/app/` turun.

---

### Kelompok B — Kontrak penulisan data

**Kenapa:** ini kelompok terpenting. 135 Server Action menerima `FormData` —
transport khas Next.js. RPC Postgres menerima JSONB. Selama masukan tiap aksi
belum jadi objek biasa yang terdokumentasi, penerjemahan ke RPC berarti
membaca 5.952 baris `actions.ts` sambil menebak nama field-nya.

Bentuk aksi sekarang (dari `keuangan/actions.ts`):

```ts
export async function catatPengeluaran(_s, form: FormData) {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan("keuangan", projectId);
    const total = angka(form, "total", { min: 1, wajib: true });
    const alokasi = await bacaAlokasiOpsional(form, projectId, total);
    periksaSasaranPeruntukan(peruntukan, alokasi);
    await prisma.expense.create({ ... });
    await catat({ ... });
    revalidatePath("/keuangan");
  });
}
```

Validasinya (`teks`, `angka`, `pilihan`, `periksaSasaranPeruntukan`) membaca
`FormData` langsung. Itu yang harus dipisah.

**B1. Pisahkan pembacaan dari validasi.**
Untuk tiap aksi, bikin tipe masukan objek biasa dan fungsi validasi murni:

```ts
// src/lib/kontrak/keuangan.ts
export type MasukanCatatPengeluaran = {
  projectId: string;
  peruntukan: PeruntukanBiaya;
  jenis: JenisBiaya;
  metode: MetodeBayar;
  uraian: string;
  total: number;
  alokasi: { unitId?: string; infrastructureId?: string; nominal: number }[];
  kreditur?: string;
  tenggat?: string;
};

// murni: tidak menyentuh FormData, prisma, session
export function periksaCatatPengeluaran(m: MasukanCatatPengeluaran): string | null
```

Server Action jadi tipis: baca `FormData` → jadi objek → panggil validasi →
kalau lolos, tulis. Perilakunya sama persis, jalur validasinya yang pindah.

**Prioritaskan aksi yang menulis uang atau progres.** Yang selebihnya boleh
menyusul.

**B2. Tes validasi terpisah.**
Tiap fungsi `periksa*` dapat tesnya sendiri, tanpa `FormData` dan tanpa
database. Tes-tes inilah yang nanti jadi acuan menguji RPC-nya.

**B3. Tulis kontrak lengkap.**
`KONTRAK-RPC.md` yang ada sekarang **sudah tertinggal**: menyebut 77 aksi
padahal aslinya 135. Tulis ulang, lengkap, satu baris per aksi:

| Kolom | Isi |
|---|---|
| Nama aksi | nama di repo |
| Usulan nama RPC | `proyek_<modul>_<kerja>` |
| Masukan | nama tipe di `src/lib/kontrak/` |
| Sub-bagian izin | argumen `izinkan()` |
| Butuh ubah | ya/tidak |
| Invarian | yang harus ditegakkan di sisi server |
| Jejak audit | objek dan aksi yang dicatat |
| Efek samping | tabel lain yang ikut berubah |

**B4. Gabungkan yang kembar.**
Banyak aksi bentuk masukannya identik (`simpanBoq*`, `simpanRap*`). Tandai di
kontrak mana yang bisa jadi satu RPC. Target realistis: 135 → sekitar 45.

**B5. Daftar invarian yang bisa dibaca mesin.**
Lima invarian repo, plus yang kamu temukan sendiri, jadi
`docs/invarian.md` dengan format tetap: nama, aturan, apa yang rusak kalau
hilang, di fungsi mana ditegakkan sekarang, tes mana yang menjaganya.

Lima yang sudah diketahui:

| Invarian | Kalau hilang |
|---|---|
| jumlah `ExpenseAllocation` = `Expense.total` | biaya per unit diam-diam beda dari total pengeluaran |
| ubah `UnitBoqItem.progress` → hitung ulang `Unit.progress` | angka kemajuan keliru tanpa galat apa pun |
| status pembangunan selaras progres | unit "Selesai" pada progres 40% |
| stok aset hanya lewat baris penyesuaian | stok berubah tanpa alasan dan tanpa penanggung jawab |
| impor Excel semua-atau-tidak-sama-sekali | tabel tertinggal campur aduk |

**Selesai kalau:** semua aksi penulis uang dan progres punya tipe masukan dan
fungsi validasi murni bertes; `KONTRAK-RPC.md` memuat 135 baris;
`docs/invarian.md` ada.

---

### Kelompok C — Jahitan identitas

**Kenapa:** repo punya tabel pengguna, hash sandi, dan JWT sendiri. ERP tidak
memakai satu pun. Sekarang `izinkan()` di `src/lib/actions/guard.ts` sudah jadi
titik masuk tunggal — itu modal bagus, tinggal dipertegas.

**C1. Satu antarmuka identitas.**
Definisikan `PenyediaIdentitas` dengan tiga hal saja: siapa penggunanya, apa
perannya, boleh apa dia. Implementasi Next/JWT jadi salah satu penyedia.
Tidak ada kode di luar `src/lib/auth/` yang boleh menyentuh sesi.

**C2. Cari yang menembus jahitan.**
Contoh yang sudah ketahuan: `catatPengeluaran` menulis `pic: pengguna.nama` —
nama tampilan pengguna masuk ke data. Di ERP yang tersedia `auth.uid()`.
Telusuri semua pemakaian sejenis, daftar di `docs/jahitan-identitas.md`, dan
untuk tiap kasus tentukan: simpan uuid, atau simpan nama sebagai jepretan
sejarah. Dua-duanya sah, tapi harus diputuskan sadar.

**C3. Matriks izin dipertahankan, jangan disederhanakan.**
`RoleSectionPermission` (12 sub-bagian) tetap ada. Di ERP nanti dibiarkan
kosong dan bersifat terbuka penuh, tapi mekanismenya harus utuh supaya bisa
diperketat tanpa menulis ulang RPC.
Yang perlu diubah: matriks dikunci ke **nama peran** (text), bukan `roleId`,
karena tabel `Role` tidak ikut migrasi.

**Selesai kalau:** `grep` untuk sesi/JWT di luar `src/lib/auth/` hasilnya
kosong; `docs/jahitan-identitas.md` ada.

---

### Kelompok D — Jahitan berkas

**Kenapa:** `src/lib/storage.ts` menyimpan berkas ke disk lokal dan
menyajikannya lewat `/api/dokumen/{versiId}` dengan pemeriksaan izin. Di ERP,
berkas berat ada di Google Drive dan ERP cuma menyimpan tautannya.

**D1. Antarmuka penyimpanan.**
Empat fungsi yang sudah ada (`simpanBerkas`, `bacaBerkas`, `hapusBerkas`,
`periksaBerkasKategori`) jadi antarmuka; implementasi disk jadi salah satu
penyedia; tambahkan penyedia "tautan luar" yang cuma menyimpan URL.

**D2. Catat konsekuensi keamanannya.**
Di repo, unduhan diperiksa izinnya. Dengan tautan Drive, **siapa pun yang
pegang tautan bisa membuka**. Tulis di `docs/berkas.md`: apa yang hilang, apa
gantinya (folder Drive dibatasi ke Workspace Nanoland), dan berkas jenis apa
yang tetap layak ke Supabase Storage.

**D3. Pisahkan berat dan ringan.**
Berkas berat (`.skp`, `.dwg`) → Drive. Berkas ringan (foto progres, bukti
transaksi) → boleh object storage. Aturannya ditulis di `periksaBerkasKategori`,
bukan di kode halaman.

**Selesai kalau:** tidak ada `fs` di luar penyedia penyimpanan;
`docs/berkas.md` ada.

---

### Kelompok E — Skema dan generator

**Kenapa:** `scripts/skema-postgres.mjs` sudah ada dan hasilnya sudah dipakai.
Tapi ada dua cacat yang sudah terbukti berbahaya.

**E1. Perbaiki dua cacat yang sudah ditemukan.**

Pertama, **`@default(now())` bisa hilang diam-diam.** Pengurai naif yang
memakai regex `@default\(([^)]*)\)` tidak menangani kurung bersarang: `now()`
terbaca jadi `now(` lalu ditolak, dan kolomnya keluar tanpa default. Ini
terbukti — 21 kolom `dibuatPada` sempat lolos tanpa default dan baru ketahuan
saat `INSERT` pertama gagal. Pakai penghitung kedalaman kurung, jangan regex.

Kedua, **komentar `///` di skema sudah basi terhadap `src/lib/domain/enums.ts`.**
Dua yang sudah terbukti:

- `Expense.metode` — komentar kehilangan `Hutang`
- `Expense.jenis` — komentar kehilangan `Kontraktor`

Kalau CHECK constraint dibangun dari komentar, pencatatan pengeluaran-hutang
dan pekerjaan kontraktor akan ditolak database tanpa alasan yang jelas.
**`enums.ts` adalah sumber kebenaran.** Perbaiki komentarnya, lalu pasang tes
yang gagal kalau keduanya berbeda lagi.

**E2. Generator langsung menghasilkan DDL SQL, bukan skema Prisma.**
Sekarang keluarannya `schema.postgres.prisma` yang masih harus dikonversi lagi.
ERP tidak memakai Prisma sama sekali. Buat `npm run skema:sql` yang langsung
mengeluarkan `CREATE TABLE` polos.

Aturan yang sudah diputuskan dan tidak perlu dipertanyakan lagi:

| Hal | Keputusan |
|---|---|
| Schema | `proyek`, tanpa awalan `pm_` pada nama tabel |
| Nama kolom | tetap camelCase, dikutip |
| Uang | `numeric(18,2)` |
| Volume, luas, koordinat | tetap `double precision` |
| Enum | `text` + CHECK dari `enums.ts`, bukan tipe enum asli |
| `User`/`Role`/`UserRole` | tidak ikut; FK dialihkan ke `auth.users` |
| `RoleSectionPermission` | ikut, dikunci ke nama peran (text) |
| `@updatedAt` | jadi trigger, bukan diisi aplikasi |

**Alasan camelCase**, supaya tidak diperdebatkan lagi: 7.000 baris lapisan
murni memakai nama seperti `hargaSatuan` dan `progressLalu`. Dengan kolom
camelCase, `to_jsonb(baris)` menghasilkan persis bentuk yang diharapkan lapisan
itu. Kalau snake_case, tiap RPC harus memberi alias kolom satu per satu, dan
satu salah ketik pada alias kolom uang adalah angka keliru yang tidak
menimbulkan galat apa pun.

**E3. Generator ikut mengeluarkan RLS dan grant.**
Templat untuk tiap tabel: nyalakan RLS, satu policy `SELECT`, tidak ada policy
tulis. **`anon` tidak boleh disebut sama sekali** — bukan dicabut belakangan,
memang tidak pernah diberi. (Di ERP pernah ada temuan audit: lima view
keuangan ber-`SECURITY DEFINER` dengan grant `anon`, artinya siapa pun pemegang
anon key bisa membaca buku besar tanpa login. Jangan diulang.)

**Selesai kalau:** `npm run skema:sql` menghasilkan DDL yang jalan di Postgres
16 tanpa suntingan tangan; tes E1 lulus.

---

### Kelompok F — Spesifikasi layar

**Kenapa:** 30 halaman, drill-down empat tingkat, 23.296 baris. Semuanya
ditulis ulang dalam vanilla JS oleh orang yang tidak menulis aslinya. Tanpa
spesifikasi, dia akan membaca JSX sambil menebak data mana yang dari server dan
mana yang dihitung di klien.

**F1. Satu berkas per halaman di `docs/layar/`.**
Isinya lima hal saja:

1. Data yang dibutuhkan dari server, dalam bentuk JSON — ini yang jadi
   keluaran RPC `*_bootstrap`
2. Aksi yang bisa dipicu dari halaman ini
3. Sub-bagian izin yang menyembunyikan apa
4. Ke halaman mana saja bisa masuk lebih dalam
5. Keadaan kosong, keadaan memuat, keadaan galat

**F2. Tandai kolom yang tidak boleh terkirim.**
Ini bukan kerapian tampilan. **Di repo ini, kolom yang tidak boleh dilihat
tidak di-`SELECT` sama sekali** — itulah penegakan hak aksesnya. Menyembunyikan
di sisi klien berarti angkanya tetap sampai ke browser dan siapa pun bisa
membacanya lewat DevTools.
Tiap spesifikasi layar harus menyebut kolom mana yang hilang untuk peran mana.

**F3. Peta jalur.**
`docs/layar/README.md` berisi pohon navigasi lengkap dan pemetaan rute Next
sekarang → menu ERP nanti.

**Selesai kalau:** tiap halaman di `src/app/(app)/` punya berkas
spesifikasinya.

---

### Kelompok G — Excel

**Kenapa:** repo memakai ExcelJS di server. ERP memakai SheetJS di browser.
Yang boleh ikut pindah aturan bacanya, bukan mesinnya.

**G1. Pisahkan aturan dari mesin.**
Aturan pembacaan (sinonim nama kolom, angka gaya Indonesia, baris Total
dilewati, kolom wajib) sudah sebagian di `src/lib/adaptor/tabel-aturan.ts`.
Tuntaskan: `impor-excel.ts` cuma mengubah berkas jadi kisi baris-kolom;
seluruh penafsiran ada di adaptor yang murni dan bertes.

**G2. Pertahankan sifat semua-atau-tidak.**
Impor sebagian adalah kerusakan diam-diam. Pastikan sifat ini tetap ada setelah
dipisah, dan tulis di `docs/invarian.md`.

**G3. Ekspor menyusul.**
`ekspor-excel.ts` prioritas rendah — bisa dikerjakan belakangan langsung di
sisi ERP.

**Selesai kalau:** `impor-excel.ts` tidak memuat satu pun aturan bisnis.

---

### Kelompok H — Data awal

**Kenapa:** data di ERP diisi manual dari nol. Tapi tidak semua isi `seed.ts`
itu data peragaan — sebagian adalah data acuan yang harus ada sebelum sistem
bisa dipakai sama sekali.

**H1. Pisahkan dua jenis isi seed.**
Data acuan (pustaka AHSP, template BOQ/RAP, kategori, satuan) dipisah ke
`prisma/acuan/` sebagai JSON. Data peragaan (proyek contoh, unit contoh,
pengeluaran contoh) tetap di `seed.ts`.

**H2. Keluarkan data acuan sebagai SQL siap tempel.**
`npm run acuan:sql` menghasilkan `INSERT` untuk schema `proyek`. Ini yang
dijalankan sekali di ERP sebelum tim mulai mengisi.

**H3. Urutan pengisian.**
`docs/urutan-isi-data.md`: apa yang harus ada sebelum apa. Tim tidak bisa
mengisi BOQ sebelum ada unit, tidak bisa ada unit sebelum ada tipe unit dan
fase. Dokumen ini yang dipakai tim lapangan hari pertama.

**Selesai kalau:** `npm run acuan:sql` jalan; `docs/urutan-isi-data.md` ada.

---

## 5. Daftar output

Yang harus ada di repo setelah semua kelompok selesai. Inilah yang dibawa ke
sesi migrasi.

### Kode

| Berkas | Dari | Untuk |
|---|---|---|
| `src/lib/kontrak/*.ts` | B1 | tipe masukan + validasi murni tiap aksi |
| `src/lib/auth/penyedia.ts` | C1 | antarmuka identitas |
| `src/lib/storage/penyedia.ts` | D1 | antarmuka penyimpanan |
| lapisan murni yang membesar | A2 | bahan `proyek-hitung.js` |

### Skrip

| Perintah | Dari | Keluaran |
|---|---|---|
| `npm run skema:sql` | E2 | DDL `CREATE TABLE` untuk schema `proyek` |
| `npm run acuan:sql` | H2 | `INSERT` data acuan |
| `npm run bundel:hitung` | baru | `proyek-hitung.js` untuk vanilla JS |
| `npm test` | — | seluruh tes, termasuk penjaga baru |

`bundel:hitung` cukup satu baris esbuild:

```bash
npx esbuild src/lib/_bundel.ts --bundle --format=iife \
  --global-name=ProyekHitung --target=es2020 --minify \
  --outfile=dist/proyek-hitung.min.js
```

`_bundel.ts` mengekspor empat namespace: `calc`, `domain`, `tampilan`,
`adaptor` (plus `format`). Jangan meratakan namanya — ada tabrakan nama antar
modul, misalnya `calc/aset` dan `tampilan/aset`.

### Dokumen

| Berkas | Dari | Isi |
|---|---|---|
| `KONTRAK-RPC.md` | B3 | 135 aksi lengkap, usulan nama RPC, izin, invarian, audit |
| `MIGRASI.md` | semua | diperbarui; yang sekarang menyebut 43 model dan 77 aksi, padahal 64 dan 135 |
| `docs/invarian.md` | B5 | aturan yang wajib ditegakkan di server |
| `docs/layar/*.md` | F1 | satu per halaman |
| `docs/layar/README.md` | F3 | pohon navigasi dan pemetaan menu |
| `docs/jahitan-identitas.md` | C2 | tiap tempat identitas menembus lapisan |
| `docs/berkas.md` | D2 | pembagian Drive vs object storage, dan yang hilang |
| `docs/urutan-isi-data.md` | H3 | urutan pengisian data hari pertama |
| `docs/audit-logika-tercecer.md` | A1 | temuan dan status pemindahannya |

### Bukti

| Hal | Kenapa penting |
|---|---|
| `npm test` lulus | rumusnya tidak berubah selama pekerjaan ini |
| penjaga kemurnian lulus | tidak ada React/Next/Prisma di empat lapisan |
| DDL jalan di Postgres 16 | bukan cuma valid secara teks |
| tes kesamaan enum ↔ komentar | cacat E1 tidak kembali |

---

## 6. Yang tidak boleh dilanggar

1. **Jangan mengubah nilai rumus apa pun.** Kalau sebuah tes harus diubah agar
   lulus, berhenti dan tanya. Repo ini adalah acuan kebenaran angkanya.

2. **Jangan membuang tabel `RoleSectionPermission` atau matriks 12
   sub-bagiannya.** Di ERP akan dibiarkan terbuka penuh, tapi mekanismenya
   harus utuh. Memasangnya kembali nanti berarti membongkar 45 RPC satu per
   satu.

3. **Jangan menulis ulang halaman dalam vanilla JS di repo ini.** Repo ini
   tetap Next.js. Vanilla JS ditulis di sisi ERP, dengan spesifikasi Kelompok F
   sebagai acuan.

4. **Jangan menyambungkan apa pun ke Supabase dari repo ini.** Repo tetap
   Prisma + SQLite.

5. **Jangan menganggap `///` di `schema.prisma` sebagai sumber kebenaran
   enum.** Sudah terbukti dua di antaranya basi.

6. **Jangan pernah menyebut `anon` dalam SQL yang dihasilkan.**

7. **Jangan menghapus tes, termasuk tes penjaga struktur** (`tautan-kode.test.ts`,
   `penjaga-aksi.test.ts`, `enums.test.ts`). Tes-tes itu membaca berkas sumber
   dan memang tidak ikut ke ERP, tapi di repo ini justru merekalah yang menjaga
   pekerjaan ini tidak mundur diam-diam.

---

## 7. Urutan mengerjakan

```
E1  perbaiki dua cacat generator          — kecil, dan menghentikan pendarahan
A4  pasang penjaga kemurnian              — supaya A tidak mundur sambil dikerjakan
A1  audit logika tercecer                 — tahu dulu luasnya sebelum memindah
A2  pindahkan                             — porsi terbesar Kelompok A
B1  pisahkan validasi, aksi penulis uang  — porsi terpenting seluruh dokumen
B2  tes validasi
B3  tulis KONTRAK-RPC.md lengkap
B5  docs/invarian.md
C   jahitan identitas
E2  generator DDL SQL
E3  RLS dan grant
F   spesifikasi layar                     — bisa paralel, tidak menghalangi
D   jahitan berkas
G   Excel
H   data awal
A3  format.ts                             — rapikan di akhir
```

Kalau waktunya habis di tengah jalan, **berhenti setelah B3**. Dengan A dan B
selesai, migrasinya sudah bisa jalan meski C sampai H belum. Sebaliknya, tanpa
B, kelompok lain tidak banyak menolong.
