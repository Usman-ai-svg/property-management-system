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

| kolom | tipe | catatan |
|---|---|---|
| id | String @id | |
| projectId | String | proyek pemilik dana |
| pemegangId | String | User (Supervisor) pemegang |
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

- Relasi ke pengeluaran: tambahkan `Expense.pettyCashReportId String?` (opsional).
  Sebuah Expense petty cash boleh belum masuk laporan (draft), lalu ditarik ke
  satu laporan saat diajukan.

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
- Reimburse menambah saldo `PettyCashFund` sebesar total laporan yang disetujui.

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
  divalidasi terhadap **sisa saldo dana**, mirip `sisaMaks` pada PO/kontrak.
- **Rincian laporan**: tabel baris Expense (tanggal, keterangan, jenis, nominal,
  nota) + total, tombol transisi status, jejak waktu tiap tahap.

## 7. Pertanyaan terbuka (untuk diskusi)

1. Satu Supervisor bisa memegang dana di >1 proyek sekaligus? (asumsi: ya, satu
   `PettyCashFund` per (proyek, pemegang)).
2. Reimburse: selalu **penuh** sebesar laporan disetujui (imprest system), atau
   boleh sebagian?
3. Perlukah plafon dana (batas maksimum saldo) per Supervisor?
4. Apakah tahap **QS** dan **Head Ops** dua persetujuan terpisah, atau QS hanya
   merekap dan satu-satunya persetujuan formal di Head Ops?
5. Nota per baris (wajib?) vs satu lampiran rekap per laporan.
