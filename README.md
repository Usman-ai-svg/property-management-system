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
cp .env.example .env
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
| `npm run build && npm start` | mode produksi, untuk mengukur performa sebenarnya |
| `npm run typecheck` | periksa tipe tanpa membangun |

Database demo berupa satu berkas `prisma/dev.db` dan tidak ikut masuk repo.
Bila terhapus, cukup jalankan `npm run db:reset`.

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
  app/
    login/             halaman masuk
    (app)/             kerangka aplikasi + halaman
  components/          komponen tampilan bersama
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
| Baris BOQ & RAP | `hargaRabRap` | per unit, tidak memengaruhi unit lain |
| Upah RAP & harga jual | `hargaRabRap` | |
| Sarana & prasarana | `daftarSarpras` | kolom RAB butuh `hargaRabRap` terpisah |

### Membuktikan snapshot bekerja

Masuk sebagai `budi.hartono@nanoland.id` (Quantity Surveyor), lalu:

1. Buka Master Proyek → Nano Town 4 → klik ikon roda gigi pada unit **F1-1**
2. Ubah harga satuan "Pek. Lantai & Keramik" dari 285.000 menjadi 298.000
3. Total RAB unit itu naik dari Rp 253.790.800 menjadi Rp 254.726.800
4. Sekarang buka unit **F2-4** — harganya **tetap Rp 285.000**

Pada prototipe, langkah 4 akan ikut berubah, begitu pula seluruh unit di NT2
yang sudah selesai sejak 2023.

---

## Yang belum dikerjakan

Modul Konstruksi, Keuangan Proyek, Vendor, Equipment, Landbank, Plan vs
Realisasi, dan Admin baru berupa halaman penanda. Model data dan rumusnya sudah
tersedia — yang tersisa membangun tampilannya, mengikuti pola pada
`src/app/(app)/master/`.

Yang juga masih terbuka:

- Menyunting kerja tambah (kini tampil, belum bisa diubah)
- Unggah dokumen — perlu object storage lebih dulu
- Halaman Admin untuk mengubah matriks hak akses lewat antarmuka
- Pengujian otomatis untuk fungsi di `src/lib/calc/`
