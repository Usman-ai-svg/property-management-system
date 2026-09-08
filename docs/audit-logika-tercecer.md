# Audit Logika Tercecer

Temuan Kelompok A1 dari `docs/PANDUAN-SIAP-MIGRASI.md`. Dokumen kerja: tiap baris
dicoret saat logikanya sudah pindah di A2, dan baris yang sudah dicoret menyebut
fungsi tujuannya beserta tesnya.

**Kenapa ini penting.** Apa pun yang tertinggal di dalam komponen React atau
Server Action akan ditulis ulang dari nol oleh orang yang tidak menulisnya,
sambil menebak maksudnya. Yang sudah duduk di lapisan murni tinggal disalin —
`bundel:hitung` membungkusnya jadi `proyek-hitung.min.js`, dan `proyek.js` di ERP
tinggal memanggilnya.

Dipindai pada commit `1a00a42`, branch `siap-migrasi-erp`.

## Cakupan dan cara pindai

| Hal | Angka |
|---|---|
| Berkas ditelusuri | 80 di `src/app/(app)/` + 23 di `src/components/` |
| Berkas bertanda | 78 |
| Baris kandidat | 499 |
| Temuan setelah triase | 39 |
| Di antaranya aturan bisnis berganda | 7 |

Pemindaian mencari delapan pola: agregasi (`.reduce`), matematika (`Math.*`),
pembulatan (`toFixed`), persentase (`* 100`, `/ 100`), pengurutan (`.sort`),
peta nilai ke label, peta `Record<>`, dan ambang (`>= 100`, `> 0 &&`). Hasil
mentahnya lalu dibaca satu per satu — kebanyakan tanda "peta label" ternyata
pewarnaan angka menurut tandanya, dan itu memang presentasi (lihat bagian 5).

Status: ☐ belum dipindah · ☑ sudah dipindah (A2)

---

## 1. Aturan bisnis yang hidup di lebih dari satu tempat

Ini kelompok paling berbahaya. Bukan karena angkanya salah hari ini, melainkan
karena satu perubahan hanya akan mengenai sebagian penyalinnya — dan tidak ada
galat yang muncul saat itu terjadi.

### ☑ A1-01 · Toleransi serapan 3% ada di empat tempat

| | |
|---|---|
| Lokasi | `src/lib/calc/keuangan.ts:15` · `src/lib/tampilan/plan-realisasi.ts:10` · `src/app/(app)/landbank/[kode]/page.tsx:170-171` · `src/app/(app)/keuangan/[kode]/page.tsx:710` |
| Yang dihitung | Kapan biaya dianggap mendahului progres fisik: `terpakai > progres + 0,03` |
| Tujuan | `calc/keuangan.ts` — satu konstanta `TOLERANSI_SERAPAN`, `statusSerapan()` memakainya sebagai bawaan; `tampilan/plan-realisasi.ts` mengimpornya, bukan mendefinisikan ulang |

**Sudah dipindah (A2).** `TOLERANSI_SERAPAN` + `statusSerapan()` + `tingkatSerapanPecahan()` di `calc/keuangan.ts`; `tampilan/plan-realisasi.ts` meneruskan ulang, tidak mendefinisikan. Tes: `calc/keuangan.test.ts`.

`statusSerapan(terpakai, progres, toleransi = 0.03)` menuliskan angkanya sebagai
nilai bawaan parameter, sementara `plan-realisasi.ts` mendeklarasikan
`TOLERANSI_SERAPAN = 0.03` sendiri — lengkap dengan komentar yang berbunyi
*"nilainya sengaja satu tempat supaya keduanya tidak bisa bergeser
sendiri-sendiri"*. Komentar itu **tidak benar**: nilainya ada di dua berkas, dan
dua lagi ditulis langsung di halaman. Menaikkannya jadi 5% hari ini akan meleset
di tiga tempat tanpa satu pun tes yang jatuh.

### ☑ A1-02 · Peruntukan biaya diturunkan dari jenis kontrak di tiga tempat

| | |
|---|---|
| Lokasi | `src/app/(app)/vendor/actions.ts:244` · `src/app/(app)/vendor/[id]/page.tsx:426` · `src/lib/data/keuangan.ts:389` |
| Yang dihitung | `jenis === "Unit" ? "Unit (rumah dijual)" : "Prasarana & Sarana"` |
| Tujuan | `domain/enums.ts` — `peruntukanDariJenisKontrak(jenis: JenisKontrak): PeruntukanBiaya` |

**Sudah dipindah (A2).** `peruntukanDariJenisKontrak()` di `domain/enums.ts`, dipakai ketiga tempat. Tes: `domain/enums.test.ts`.

Pemetaan antara dua enum domain, ditulis tangan tiga kali. Yang di `lib/data/`
sebetulnya di luar cakupan A1, tapi temuannya satu dan pindahnya sekali.

### ☑ A1-03 · Markup harga jual 1,42 tanpa nama dan tanpa tes

| | |
|---|---|
| Lokasi | `src/app/(app)/master/actions.ts:867` |
| Yang dihitung | `hargaJual = round((BOQ tipe atau rabAcuan(luasBangunan)) * 1.42)` |
| Tujuan | `calc/boq.ts` — `hargaJualAcuan(rab: number): number` |

**Sudah dipindah (A2).** `MARKUP_HARGA_JUAL` + `hargaJualAcuan()` di `calc/boq.ts`. Tes: `calc/boq.test.ts`.

Segala sesuatu di sekelilingnya sudah murni dan bertes (`rabAcuan`,
`totalBaris`, `buatBoqDariTemplate`); hanya markup 42% ini yang tertinggal di
dalam aksi. Ini angka kebijakan perusahaan, bukan detail teknis — di ERP ia
harus bisa ditemukan tanpa membaca kode pembuatan unit.

### ☑ A1-04 · Status pembelian (PO) punya dua turunan yang berbeda

| | |
|---|---|
| Lokasi | `src/app/(app)/keuangan/pembelian.tsx:39-45` (empat keadaan) · `src/app/(app)/estimasi/pemasok/[id]/page.tsx:39` (dua keadaan) |
| Yang dihitung | Draft / DP / Dibayar Penuh / Diterima / Lunas, dari `diterima`, `total`, `terbayar` |
| Tujuan | `calc/pembelian.ts` — `statusPembelian(diterima, total, terbayar)`, bertetangga dengan `statusHutang()` yang sudah ada di `calc/keuangan.ts:28` |

**Sudah dipindah (A2).** `calc/pembelian.ts` baru: `statusPembelian()`, `totalPembelian()`, `terbayarPembelian()`, `hutangPembelian()`. Halaman Pemasok kini memakai lima keadaan yang sama (keputusan Usman). Tes: `calc/pembelian.test.ts`.

Halaman Keuangan membedakan "Dibayar Penuh" (lunas di muka, barang belum
datang) dari "Lunas"; halaman Pemasok tidak. PO yang sama bisa tampil berbeda
tergantung dari mana dilihat.

### ☑ A1-05 · Rekap analisa AHSP dihitung ulang di tabel Estimasi

| | |
|---|---|
| Lokasi | `src/app/(app)/estimasi/tabel.tsx:140-149` |
| Yang dihitung | `subtotal = koefisien × hargaAcuan`, `langsung = Σ subtotal`, `overhead = langsung × overheadPct / 100` |
| Tujuan | pakai `rekapAnalisa()` yang sudah ada di `calc/ahsp.ts:71` |

**Sudah dipindah (A2).** memakai `rekapAnalisa()` dan `biayaKomponen()` dari `calc/ahsp.ts`.

Rumus yang sama persis sudah murni dan bertes. Komponennya menghitung sendiri.

### ☑ A1-06 · Rekap opname ditulis dua kali di dua komponen

| | |
|---|---|
| Lokasi | `src/components/opname-boq.tsx:77-82` · `src/components/opname-spk.tsx:87-92` |
| Yang dihitung | `total = Σ volume × hargaSatuan`, `terpasang = Σ volume × hargaSatuan × persen/100`, `persen = terpasang / total × 100` |
| Tujuan | `calc/opname.ts` — `ringkasOpnamePersen(baris, persenPerBaris)`, sebelah `ringkasOpname()` yang sudah ada |

**Sudah dipindah (A2).** `ringkasOpnamePersen()` di `calc/opname.ts`, dipakai kedua komponen. Tes: `calc/opname.test.ts`.

Dua salinan identik, keduanya tanpa tes.

### ☑ A1-07 · Predikat bisnis dinyatakan sebagai perbandingan warna

| | |
|---|---|
| Lokasi | `src/app/(app)/landbank/[kode]/page.tsx:170-171` |
| Yang dihitung | `warnaSerapan(...) === "var(--red)"` dipakai untuk mencacah pos yang melampaui progres |
| Tujuan | angkanya sudah tersedia lewat `kpiPlanRealisasi().melampaui` di `tampilan/plan-realisasi.ts` — pakai itu; pisahkan `tingkatSerapan()` (semantik) dari `warnaSerapan()` (token CSS) |

**Sudah dipindah (A2).** `cacahMelampaui()` di `tampilan/plan-realisasi.ts`; `warnaSerapan()` kini hanya memetakan hasil `tingkatSerapanPecahan()` ke token warna. Tes: `tampilan/plan-realisasi.test.ts`.

Halaman menanyakan "berapa pos yang boros" dengan cara mencocokkan nama token
CSS. Ganti nama tokennya dan cacahnya jadi nol tanpa galat apa pun. Fungsi yang
benar sudah ada dan bertes; halamannya tidak memakainya.

---

## 2. Penyusunan angka halaman — tujuan `src/lib/tampilan/`

Bukan rumus baru, melainkan perakitan: "angka apa saja yang dibutuhkan layar
ini". Inilah yang nanti jadi keluaran RPC `*_bootstrap`, jadi tiap butir di sini
langsung menjawab satu bagian spesifikasi layar Kelompok F.

| ID | Lokasi | Yang dihitung | Tujuan |
|---|---|---|---|
| ☑ A1-08 | `keuangan/[kode]/page.tsx:65-71` | `totalRab`, `totalRap` (Σ unit + Σ sarpras), `totalRealisasi` | **selesai** — `totalProyek()` di `tampilan/keuangan-proyek.ts`, bertes |
| ☑ A1-09 | `keuangan/[kode]/page.tsx:84-101` | realisasi per kategori lewat `KATEGORI_DARI_JENIS`, lalu dirakit jadi baris RAP vs realisasi | **selesai** — `realisasiPerKategori()` + `anggaranPerKategori()`, bertes termasuk kasus "Kontraktor" dilewatkan |
| ☑ A1-10 | `keuangan/[kode]/page.tsx:115-133` | subtotal unit & sarpras: RAP + biaya langsung + alokasi kontrak | **selesai** — `subtotalBiaya()`, bertes |
| ☑ A1-11 | `keuangan/[kode]/page.tsx:855-856, 881, 894` | total RAP & realisasi per kategori, penanda `over` | **selesai** — `totalAnggaranKategori()`, bertes |
| ☑ A1-12 | `master/[kode]/page.tsx:50, 56-59` | total luas bersertifikat; total RAB & RAP unit dan sarpras | **selesai** — `totalRabRap()` + `luasBersertifikat()` di `tampilan/master.ts` (baru), bertes; `bolehHarga` jadi bagian fungsi supaya angka terlarang tak sampai ke browser |
| ☑ A1-13 | `vendor/[id]/page.tsx:113-114, 448` | nilai & terbayar seluruh kontrak vendor per proyek | **selesai** — `totalKontrakProyek()` + `kumulatifPembayaran()` di `tampilan/vendor.ts`, bertes |
| ☑ A1-14 | `vendor/[id]/kontrak/[kode]/page.tsx:96, 103, 226` | nilai BOQ, nilai template, nilai satu opname; syarat kontrak boleh ditandai selesai (`progres === 100`, juga di `vendor/[id]/page.tsx:223`) | **selesai** — memakai `totalBaris()` dari `calc/boq.ts` |
| ☑ A1-15 | `keuangan/page.tsx:27, 38` | pengeluaran 30 hari terakhir; sisa hutang | **selesai** — `pengeluaranTerakhir()` + `totalSisaHutang()`, bertes |
| ☑ A1-16 | `landbank/page.tsx:26-27` | total luas lahan & biaya perolehan seluruh landbank | **selesai** — `totalLandbank()` di `tampilan/landbank.ts`, bertes |
| ☑ A1-17 | `landbank/[kode]/page.tsx:494, 497` | omzet rencana: Σ `hargaPpn` dan Σ `hargaAllIn` | **selesai** — `totalOmzetRencana()`, bertes |
| ☑ A1-18 | `estimasi/pemasok/[id]/page.tsx:36-43` | total, terbayar, hutang per PO; total beli & bayar pemasok | **selesai** — `ringkasPemasok()` di `tampilan/estimasi.ts`, bertes |
| ☑ A1-19 | `keuangan/pembelian.tsx:115, 393-396` | total PO dari baris; hutang & penanda lunas | **selesai** — memakai `totalPembelian()`/`hutangPembelian()` dari `calc/pembelian.ts` |
| ☑ A1-20 | `keuangan/hutang-tabel.tsx:61-63, 104-106` | subtotal total / terbayar / sisa, dua kali dalam berkas yang sama | **selesai** — `subtotalHutang()`, dipakai dua kali di berkas yang sama |
| ☑ A1-21 | `app/(app)/page.tsx:21-23` | rata-rata progres seluruh proyek; proyek dengan progres tertinggi | **selesai** — `proyekBerjalan()` + `totalProgresUnit()` di `tampilan/ringkasan.ts` (baru), bertes |
| ☑ A1-22 | `master/[kode]/tabel-unit.tsx:85-88` · `tabel-sarpras.tsx:67-70` | subtotal RAB & RAP baris tabel | **selesai** — `totalKolomRabRap()` di `tampilan/master.ts`, bertes |
| ☑ A1-23 | `keuangan/[kode]/transaksi.tsx:187, 208, 211` | terbayar dari cicilan, lalu status Lunas/DP | **selesai** — `terbayarCicilan()` di `calc/keuangan.ts`, dipakai enam tempat; status memakai `statusHutang()` yang sudah ada |

---

## 3. Aturan di dalam Server Action — tujuan `src/lib/calc/`

Aksi seharusnya cuma transport: baca masukan, panggil aturan, tulis, catat.
Semua butir di bawah dihitung di dalam aksi. Sebagian akan ikut tersapu
Kelompok B (kontrak masukan), tapi perhitungannya tetap harus pindah lebih dulu.

| ID | Lokasi | Yang dihitung | Tujuan |
|---|---|---|---|
| ☑ A1-24 | `keuangan/actions.ts:37, 608` | panjang baris alokasi = maksimum tiga larik sejajar | **selesai** — `barisSejajar()` di `adaptor/formulir.ts`, bertes termasuk kasus larik pendek |
| ☑ A1-25 | `keuangan/actions.ts:640, 753-754, 846` | total PO dari item; terbayar dari pembayaran; terbayar dari cicilan | **selesai** — `totalPembelian()`/`terbayarPembelian()` di `calc/pembelian.ts`; `terbayarCicilan()` di `calc/keuangan.ts` |
| ☑ A1-26 | `vendor/actions.ts:94, 210-212` | nominal VO = round(Σ volume × hargaSatuan); sisa yang boleh dibayar | **selesai** — `nominalVo()` di `calc/kontrak-boq.ts`; VO & terbayar memakai `totalVoDisetujui()`/`totalTerbayar()` yang sudah ada |
| ☑ A1-27 | `estimasi/actions.ts:670-671, 1063-1068` | nilai RAB sebelum vs sesudah revisi; `totalMenang × jumlah cakupan` | **selesai** — `totalBaris()` untuk nilai RAB; `nilaiKontrakDariMenang()` di `calc/tender.ts`, bertes |
| ☑ A1-28 | `konstruksi/actions.ts:272` · `vendor/boq-actions.ts:409, 422` | pembulatan progres per baris sebelum disimpan | **selesai** — `progresSah()` + `bulatkanProgres()` di `calc/opname.ts`; menolak di luar rentang, tidak menjepit |
| ☑ A1-29 | `keuangan/petty-actions.ts:137` · `landbank/plan-real-actions.ts:132` | total pengeluaran satu laporan; nominal yang sudah diterima | **selesai** — memakai `totalLaporan()` di `calc/petty-cash.ts`; `totalPenerimaan()` di `tampilan/landbank.ts` |
| ☑ A1-30 | `master/actions.ts:574` | syarat menolak perubahan luas bangunan bila tipe sudah punya unit | **selesai** — `perluPeringatanLuasBangunan()` di `calc/boq.ts`, bertes |

---

## 4. Komponen yang menghitung sendiri

| ID | Lokasi | Yang dihitung | Tujuan |
|---|---|---|---|
| ☑ A1-31 | `components/ringkas-progress.tsx:17-23` | klasifikasi progres: belum (≤ 0), dikerjakan, selesai (≥ 100); rata-rata dibulatkan; persentase tiap kelompok | **selesai** — `sebaranProgres()` + `porsiPersen()` di `calc/status-bangun.ts`, bertes termasuk kesamaan ambang dengan `statusBangunSarpras` |
| ☑ A1-32 | `components/tabel-mingguan.tsx:21` | total tiap kolom laporan mingguan | **selesai** — memakai `ringkasOpname()` yang sudah ada |
| ☑ A1-33 | `components/boq-table.tsx:106-107, 317` | total seluruh kelompok; bobot baris = sub / total × 100 | **selesai** — `totalBaris()` + `bobotBaris()` di `calc/boq.ts`, bertes |
| ☑ A1-34 | `components/rap-table.tsx:38, 41` | total baris RAP; nama bawaan menurut kategori Material/Subkon | **sebagian** — total memakai `totalBaris()`; nama bawaan baris baru DIBIARKAN di komponen, itu teks antarmuka bukan aturan |
| ☑ A1-35 | `components/alokasi-biaya.tsx:75, 178-183` | jumlah alokasi dan selisihnya terhadap total | **selesai** — `jumlahAlokasi()` + `selisihAlokasi()` di `calc/keuangan.ts`, bertes bersama `periksaAlokasi()` |
| ☑ A1-36 | `components/charts.tsx:12, 92` | total sebagai pembagi proporsi | **selesai** — `pembagiProporsi()` + `porsiPotongan()` di `tampilan/grafik.ts` (baru), bertes |
| ☑ A1-37 | `components/panel-tabel.tsx:38-44` | pengelompokan baris + urutan grup: yang tak dikenal ditaruh terakhir, lalu abjad | **selesai** — `kelompokkanBaris()` di `adaptor/kelompok-tabel.ts` (berkas baru; `tabel-aturan.ts` khusus impor Excel), bertes |
| ☑ A1-38 | `components/opname-spk.tsx:236, 243, 253` | BOQ dianggap cocok dengan nilai SPK bila selisihnya kurang dari Rp 1 | **selesai** — `TOLERANSI_SELISIH_BOQ` + `boqCocokDenganSpk()` di `calc/kontrak-boq.ts`, bertes |
| ☑ A1-39 | `components/opname-boq.tsx:75` · `opname-spk.tsx:79` | jepit masukan progres ke rentang 0–100 | **selesai** — `jepitProgres()` di `calc/opname.ts`, bertes |

---

## 5. Yang sengaja TIDAK dipindah

Supaya A2 tidak mengejar bayangan. Semua ini presentasi murni: tidak ada
keputusan bisnis yang hilang kalau nanti ditulis ulang bebas di `proyek.js`.

| Hal | Contoh |
|---|---|
| Warna menurut tanda angka | `net >= 0 ? "var(--green)" : "var(--red)"` di seluruh tabel landbank dan vendor |
| Tanda minus dan nilai mutlak untuk tampilan | `{n < 0 ? "−" : ""}{rp(Math.abs(n))}` |
| Label tombol dan judul menurut keadaan form | `labelSimpan={baris ? "Simpan" : "Tambah"}`, chevron `rotate(-90deg)` |
| Geometri grafik | skala sumbu `maks × 1.12` di `tren-chart.tsx:38`; langkah sumbu `Math.pow(10, ...)` di `grafik-cashflow.tsx:182`; lebar bar `Math.min(nilai, 100)` |
| Posisi popover dan tinggi maksimum panel | `panel-tabel.tsx:99-103`, `form.tsx:72` |
| Peta warna status | `WARNA_STATUS`, `WARNA_KATEGORI`, `WARNA_PETTY`, `WARNA_STATUS_PO` — isinya token tema, bukan aturan |

Dua catatan pembatas:

- **Peta warna status tetap presentasi, tapi kuncinya tidak.** Kalau sebuah peta
  memuat kunci yang bukan anggota enum (mis. status yang sudah dihapus), itu
  temuan tersendiri — akan tertangkap penjaga `KOLOM_ENUM` di E2, bukan di sini.
- **Ambang `=== 100` untuk mewarnai hijau** dibiarkan, tapi `=== 100` yang
  memutuskan sebuah tombol boleh muncul (kontrak boleh ditandai selesai) adalah
  aturan bisnis, dan sudah masuk sebagai bagian A1-14.

---

## Cara mengulang pemindaian

Skrip pemindainya tidak disimpan di repo — ia sekali pakai dan hasilnya sudah
dibaca tangan. Untuk memeriksa ulang setelah A2, yang lebih berguna adalah
membandingkan jumlah baris:

```
find "src/app/(app)" -name "*.tsx" -o -name "*.ts" | xargs cat | wc -l
find src/lib/calc src/lib/domain src/lib/tampilan src/lib/adaptor -name "*.ts" ! -name "*.test.ts" | xargs cat | wc -l
```

Titik awal pada `1a00a42`: `src/app/(app)` **23.774** baris, lapisan murni tanpa
tes **3.855** baris. A2 selesai kalau angka pertama turun dan angka kedua naik,
dengan `npm test` tetap hijau di tiap langkah.

---

## Hasil A2 — seluruh temuan sudah dipindah

Ditutup bersama Kelompok A. Ke-39 temuan berstatus ☑; satu di antaranya
(A1-34) hanya sebagian, karena separuhnya ternyata teks antarmuka, bukan aturan.

Dua temuan tambahan muncul saat mengerjakan A2, dan ikut diselesaikan:

- **`nilaiUnit` dan `nilaiSarpras` murni tapi tinggal di `lib/data/proyek.ts`**
  bersama query Prisma. Dipindah ke `tampilan/proyek.ts`; `lib/data/proyek.ts`
  meneruskannya kembali supaya pemanggil lama tetap jalan.
- **`src/lib/format.ts` berada di luar penjagaan** (ini tugas A3). Dijadikan
  folder ber-index `src/lib/format/` dan didaftarkan sebagai lapisan murni
  kelima. Jalur impor `@/lib/format` tidak berubah, jadi 54 pemanggilnya tidak
  perlu disentuh sama sekali.

### Perubahan ukuran

| | Sebelum (`1a00a42`) | Sesudah |
|---|---|---|
| Lapisan murni, tanpa tes | 3.855 | 4.961 |
| `src/app/(app)` | 23.774 | 23.766 |
| `src/components` | 4.517 | 4.483 |

Lapisan murni naik 1.106 baris (+29%); halaman dan komponen hanya turun tipis.
Selisih itu bukan kejanggalan: tiap blok perhitungan yang keluar dari halaman
digantikan satu baris pemanggilan plus satu baris impor, sementara di sisi
lapisan murni ia tumbuh menjadi fungsi bernama beserta penjelasan dan tesnya.
**Ukuran yang sebenarnya penting bukan jumlah baris, melainkan bahwa tiap
aturan bisnis sekarang hanya punya satu tempat tinggal** — dan itulah yang
membuat penulisan ulang tampilan di ERP jadi pekerjaan mekanis.

---

## Catatan lanjutan (Kelompok B)

Beberapa temuan A1 yang berupa aturan di dalam Server Action kini punya rumah
kedua: `src/lib/kontrak/`. A2 memindahkan **perhitungannya**; Kelompok B
memindahkan **validasinya**. Contoh paling jelas A1-25 dan A1-26 — total PO
dan nominal VO kini dihitung di `calc/`, sementara syarat "tak melebihi sisa"
dan "nilai VO bukan nol" ada di `kontrak/`.
