# Spec — Input & Rekonsiliasi Petty Cash

Status: **rancangan untuk didiskusikan** (belum diimplementasi). Poin #6 dari
perbaikan Keuangan Proyek.

## 1. Masalah

Belum ada cara mencatat **dana petty cash** dan alur pertanggungjawabannya. Alur
nyata di lapangan:

1. **Finance** memberi Supervisor petty cash senominal tertentu (mis. Rp2.000.000).
2. **Supervisor** membayar keperluan mendesak dari petty cash — bisa lintas
   kategori (material, subkon, tenaga kerja, lain-lain).
3. Supervisor merekap pengeluaran (tanggal, keterangan, nominal) + lampiran nota.
4. Supervisor mengirim laporan ke **Quantity Surveyor**; QS merekap & melaporkan
   ke **Head Operation Project**.
5. Bila sesuai, laporan diteruskan ke **Finance** untuk **reimburse** petty cash
   (mengisi ulang saldo).

## 2. Yang SUDAH ada (jangan dibangun ulang)

- `Expense.metode` sudah punya nilai `"Petty Cash"` (skema: `Transfer | Petty
  Cash | Tunai langsung`). Data seed sudah memuat pengeluaran petty cash yang
  dicatat Supervisor (mis. "Upah tukang minggu ke-2", pic `Sari Kusuma`).
- Pembebanan ke unit/sarpras & jenis biaya sudah lewat `Expense` + `ExpenseAllocation`.
- RBAC sudah punya peran **Supervisor**, **Quantity Surveyor**, **Head Operation
  Project**, **Finance**, dan izin `keuangan`.

Artinya: **pengeluaran petty cash = Expense biasa dengan `metode = "Petty Cash"`**.
Yang kurang hanyalah (a) konsep *dana/float* dan saldonya, serta (b) *alur
approval* rekap sebelum reimburse.

## 3. Model data yang diusulkan

### `PettyCashFund` — dana/float per pemegang & proyek
Saldo berjalan dana petty cash yang dipegang seorang Supervisor pada satu proyek.
Saldo **diturunkan**, bukan disimpan: `saldo = Σ topUp/reimburse − Σ pengeluaran`.
Unik per **(proyek, pemegang)** — satu Supervisor boleh memegang dana di beberapa
proyek sekaligus. Saldo **boleh minus**: Supervisor boleh menalangi pengeluaran
lebih dulu, dan reimburse yang mengembalikannya (lihat `plafon`).

| kolom | tipe | catatan |
|---|---|---|
| id | String @id | |
| projectId | String | proyek pemilik dana |
| pemegangId | String | User (Supervisor) pemegang |
| plafon | Float | nilai acuan dana (imprest). **Bukan** batas keras: tidak membatasi pengeluaran maupun reimburse; hanya menjaga saldo hasil reimburse tak melebihi plafon |
| dibuatPada | DateTime | |
| aktif | Boolean | dana ditutup saat penugasan selesai |

### `PettyCashTopUp` — pemberian/reimburse dana oleh Finance
Setiap penambahan saldo: pemberian awal maupun reimburse setelah laporan disetujui.

| kolom | tipe | catatan |
|---|---|---|
| id | String @id | |
| fundId | String | → PettyCashFund |
| tanggal | DateTime | |
| nominal | Float | |
| jenis | String | `Awal` \| `Reimburse` |
| reportId | String? | bila reimburse, → PettyCashReport yang disetujui |
| olehId | String | User Finance yang mencairkan |
| bukti/buktiKey | String? | transfer/kwitansi |

### `PettyCashReport` — rekap batch yang diajukan Supervisor
Membungkus sekumpulan `Expense` (metode Petty Cash) untuk satu siklus
pertanggungjawaban, membawa status alur approval.

| kolom | tipe | catatan |
|---|---|---|
| id | String @id | |
| fundId | String | → PettyCashFund |
| periode | String | mis. "Jul 2026 · minggu 2" |
| status | String | lihat §4 |
| diajukanPada | DateTime? | oleh Supervisor |
| diverifikasiQsPada | DateTime? | oleh QS |
| disetujuiOpsPada | DateTime? | oleh Head Operation Project |
| direimbursePada | DateTime? | oleh Finance (via PettyCashTopUp) |
| catatan | String? | alasan revisi/tolak |
| bukti/buktiKey | String? | **satu** lampiran rekap nota untuk seluruh laporan |

- Relasi ke pengeluaran: tambahkan `Expense.pettyCashReportId String?` (opsional).
  Sebuah Expense petty cash boleh belum masuk laporan (draft), lalu ditarik ke
  satu laporan saat diajukan.
- Bukti nota: **satu lampiran rekap per laporan** (`PettyCashReport.buktiKey`),
  bukan per baris. `Expense.buktiKey` per baris tetap boleh diisi bila ada, tapi
  tidak diwajibkan.

## 4. Status & transisi `PettyCashReport`

```
Draft ─(Supervisor ajukan)→ Diajukan
Diajukan ─(QS verifikasi)→ DiverifikasiQS ─(QS kembalikan)→ Draft
DiverifikasiQS ─(Head Ops setujui)→ Disetujui ─(Head Ops tolak)→ Draft
Disetujui ─(Finance reimburse)→ Direimburse   [buat PettyCashTopUp jenis=Reimburse]
```

- Selama `Draft`, Supervisor bebas menamb/menghapus baris Expense-nya.
- Mulai `Diajukan`, baris **terkunci** (tak bisa diubah Supervisor) — konsisten
  dengan pola "kunci baris tertaut" yang sudah dipakai di Transaksi.
- Reimburse (imprest) menambah saldo `PettyCashFund` **penuh** sebesar total
  laporan yang disetujui — mengembalikan saldo ke arah plafon. Tidak dibatasi
  plafon, kecuali bila saldo dana sudah di atas plafon (kasus tepi: jangan
  menambah lagi di atas plafon).

## 5. Izin (RBAC)

Tambah izin baru agar tidak melebur ke `keuangan` umum:

| izin | lihat | ubah/aksi |
|---|---|---|
| `pettyCash` (catat pengeluaran & ajukan) | Supervisor, PM, Head Ops Project, Finance | Supervisor (pemegang dana) |
| verifikasi QS | — | Quantity Surveyor |
| setujui Ops | — | Head Operation Project |
| reimburse | — | Finance, Consultant Finance |

Pemberian dana awal & reimburse tetap **hanya Finance** (sejalan izin `keuangan`
ubah yang saat ini `Finance, Admin, Head Operation Office, BOD, ...`).

## 6. Sentuhan UI

- **Halaman Keuangan Proyek** (`keuangan/[kode]`): kartu baru **"Petty Cash"** —
  saldo per pemegang, tombol *Beri Dana* (Finance), daftar laporan + statusnya,
  dan aksi sesuai peran (Ajukan / Verifikasi / Setujui / Reimburse).
- **Catat Pembayaran**: sumber baru **"Petty Cash"** (atau Pengeluaran Lain
  dengan metode Petty Cash yang otomatis menaut ke dana pemegang aktif). Nominal
  **tidak** dibatasi sisa saldo/plafon — Supervisor boleh menalangi lebih dulu
  sehingga saldo bisa menyusut hingga minus; reimburse yang mengembalikannya.
  (Beda dari `sisaMaks` pada PO/kontrak yang memang membatasi.)
- **Rincian laporan**: tabel baris Expense (tanggal, keterangan, jenis, nominal,
  nota) + total, tombol transisi status, jejak waktu tiap tahap.

## 7. Keputusan final (2026-08-21)

1. **Multi-proyek:** ya. Satu `PettyCashFund` unik per **(proyek, pemegang)**;
   seorang Supervisor boleh memegang beberapa dana di proyek berbeda sekaligus.
2. **Reimburse:** penuh sebesar laporan yang disetujui (imprest) — mengembalikan
   saldo ke arah plafon.
3. **Approval dua tahap:** QS verifikasi → Head Ops setujui → Finance reimburse.
   Status machine §4 dipakai apa adanya.
4. **Bukti nota:** satu lampiran rekap per `PettyCashReport`, bukan per baris.
   `Expense.buktiKey` per baris tetap opsional.
5. **Plafon:** ada, per dana (`PettyCashFund.plafon`), sebagai nilai acuan
   imprest — **bukan batas keras**. Tidak membatasi pengeluaran (boleh ditalangi
   Supervisor, saldo boleh minus) maupun reimburse; hanya menjaga saldo hasil
   reimburse tidak melampaui plafon.

## 8. Ruang lingkup implementasi (bila lanjut)

- **Skema:** model `PettyCashFund` (+`plafon`), `PettyCashTopUp`, `PettyCashReport`
  (+`buktiKey`); kolom `Expense.pettyCashReportId`. Regen `schema.postgres.prisma`
  via `npm run skema:postgres`.
- **Data:** `keuanganPetty*` di `lib/data/`, penghitung saldo turunan.
- **Aksi:** beri dana, catat/tarik pengeluaran ke laporan, ajukan, verifikasi QS,
  setujui Ops, reimburse — masing-masing dengan izin & guard peran.
- **Izin RBAC:** `pettyCash` (+ turunan verifikasi/persetujuan/reimburse per §5).
- **UI:** kartu Petty Cash di `keuangan/[kode]`, sumber "Petty Cash" di Catat
  Pembayaran, halaman rincian laporan + transisi status.
- **Seed & test:** contoh dana + laporan di 1 proyek; unit test saldo & transisi.
