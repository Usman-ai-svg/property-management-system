# Invarian

Aturan yang harus **selalu** benar tentang data, apa pun jalur yang menulisnya.

Berbeda dari validasi masukan: validasi menolak isian yang salah bentuk,
invarian menjaga hubungan antar-baris yang sudah tersimpan. Sebuah invarian
yang bocor jarang menimbulkan galat — yang terjadi adalah angka yang salah dan
tampak wajar.

**Untuk penerjemah RPC.** Tiap invarian di bawah menyebut di mana ia ditegakkan
sekarang dan tes mana yang menjaganya. Di ERP, penegakannya pindah ke dalam RPC
`SECURITY DEFINER` — tabelnya tidak punya policy tulis sama sekali, jadi RPC
adalah satu-satunya pintu, dan invarian yang lupa dipindah tidak akan dijaga
oleh apa pun.

Format tiap butir tetap: **aturan · apa yang rusak kalau hilang · ditegakkan di
mana · dijaga tes mana**.

---

## 1. Uang

### INV-01 · Σ alokasi = total pengeluaran

**Aturan.** Jumlah seluruh `ExpenseAllocation` sebuah pengeluaran harus sama
**persis** dengan `Expense.total`. Bukan mendekati — persis.

**Kalau hilang.** Biaya per unit diam-diam berbeda dari total pengeluaran.
Laporan per unit tetap tampil rapi, tetapi tidak lagi bisa dijumlahkan balik ke
baris mutasi bank, dan selisih satu rupiah pada laporan keuangan adalah selisih
yang harus dicari orang.

**Ditegakkan.** `periksaAlokasi()` di `src/lib/calc/keuangan.ts`, dipanggil
lewat `periksaPembebanan()` di `src/lib/kontrak/keuangan.ts`. Jalur yang lewat:
`catatPengeluaran`, `ubahPengeluaran`, `bayarPembelian`, `tambahPembayaran`
(vendor), `bagikanBiayaUnitRata`.

**Tes.** `calc/keuangan.test.ts` (`periksaAlokasi`, `bagiRata`),
`kontrak/keuangan.test.ts` (`periksaPembebanan` — termasuk kasus selisih satu
rupiah dan tujuan ganda).

### INV-02 · Pembayaran kontrak tidak melampaui nilai efektifnya

**Aturan.** Σ pembayaran sebuah kontrak ≤ `nominal + Σ VO disetujui`.
Pembandingnya nilai **efektif**, bukan nilai awal.

**Kalau hilang.** Kelebihan bayar pada kontrak borongan jauh lebih sulit
ditarik kembali daripada dicegah. Memakai nilai awal sebagai pembanding juga
salah ke arah sebaliknya: pembayaran sah atas pekerjaan tambah yang sudah
dikerjakan akan ditolak.

**Ditegakkan.** `periksaPembayaranKontrak()` di `src/lib/kontrak/vendor.ts`,
dengan `nilaiEfektif` dan `sudahTerbayar` sebagai konteks yang dibaca aksi.

**Tes.** `kontrak/vendor.test.ts`, termasuk kasus "membayar tepat sisa" dan
"VO disetujui menambah ruang bayar".

### INV-03 · Pembayaran PO tidak melampaui nilai POnya

**Aturan.** Σ pembayaran sebuah `Pembelian` ≤ Σ `qty × harga` barangnya.
Metodenya tidak boleh "Hutang".

**Kalau hilang.** Membayar PO dengan metode "Hutang" mencatat biaya dua kali —
sekali sebagai hutang PO, sekali sebagai pengeluaran-hutang tersendiri.

**Ditegakkan.** `periksaBayarPembelian()` di `src/lib/kontrak/keuangan.ts`.

**Tes.** `kontrak/keuangan.test.ts`.

### INV-04 · Σ cicilan tidak melampaui total hutang

**Aturan.** Σ `HutangCicilan.nominal` ≤ `Expense.total` induknya, dan induknya
harus bermetode "Hutang". Saat total pengeluaran-hutang disunting, total baru
tidak boleh turun di bawah yang sudah dicicil.

**Kalau hilang.** Sisa hutang jadi negatif — keadaan yang tidak punya arti, dan
membuat total hutang berjalan di dashboard berkurang tanpa ada uang yang keluar.

**Ditegakkan.** `periksaBayarHutang()` dan `periksaUbahPengeluaran()` di
`src/lib/kontrak/keuangan.ts`.

**Tes.** `kontrak/keuangan.test.ts`.

### INV-05 · Pengeluaran akrual tidak dihitung dua kali

**Aturan.** Pelunasan pengeluaran-hutang disimpan sebagai `HutangCicilan`,
**bukan** `Expense` baru.

**Kalau hilang.** Biayanya terhitung dua kali di laporan realisasi: sekali saat
timbul (akrual), sekali saat dibayar.

**Ditegakkan.** Bentuk skema — `bayarHutang` menulis ke `hutangCicilan`, dan
tidak ada jalur lain yang membuat `Expense` dari pelunasan.

**Tes.** Tidak ada tes yang menjaganya secara langsung. **Ini lubang yang
diketahui**; di ERP, cara paling murah menutupnya adalah membuat
`proyek_hutang_cicil` satu-satunya RPC yang boleh menulis `HutangCicilan`, dan
tidak pernah menulis `Expense`.

### INV-06 · Pos HPP diturunkan, tidak diketik

**Aturan.** `Expense.posHpp` selalu `POS_HPP[peruntukan]`, tidak pernah diminta
ke pengguna.

**Kalau hilang.** Perbandingan realisasi dengan business plan pada Plan vs
Realisasi bergantung pada ketelitian pengisian, dan pos yang salah ketik muncul
sebagai realisasi tanpa rencana.

**Ditegakkan.** Peta `POS_HPP` di `src/lib/domain/enums.ts`, dipakai
`catatPengeluaran`, `ubahPengeluaran`, `bayarPembelian`, pembayaran kontrak
vendor, petty cash, dan penyemaian.

**Tes.** `domain/enums.test.ts` (tiap peruntukan punya pos HPP).

---

## 2. Progres

### INV-07 · Progres unit dihitung ulang dari baris BOQ-nya

**Aturan.** Setiap kali `UnitBoqItem.progress` berubah, `Unit.progress` dihitung
ulang sebagai progres **tertimbang nilai** baris-barisnya — bukan rata-rata
sederhana, karena pekerjaan pondasi dan pekerjaan cat tidak sama bobotnya.

**Kalau hilang.** Angka kemajuan keliru tanpa galat apa pun. Unit tampak 40%
padahal baris-barisnya sudah 80%, dan opname berikutnya menagih dari angka yang
salah.

**Ditegakkan.** `hitungUlangProgresUnit()` / `hitungUlangProgresSarpras()` di
`src/lib/data/progres-konstruksi.ts`, memakai `progresTertimbang()` di
`src/lib/calc/kontrak-boq.ts`. Dipanggil `simpanOpnameUnit`,
`simpanOpnameSarpras`, dan seluruh jalur opname SPK.

**Tes.** `calc/kontrak-boq.test.ts` (`progresTertimbang`, termasuk kasus seluruh
baris bernilai nol).

### INV-08 · Progres manual ditolak pada objek yang punya BOQ

**Aturan.** Objek yang sudah punya baris BOQ Master tidak menerima angka progres
manual.

**Kalau hilang.** Angka manualnya akan tertulis ulang pada opname berikutnya —
penggunanya mengira sudah tersimpan padahal tidak.

**Ditegakkan.** `periksaUbahProgresManual()` di `src/lib/kontrak/konstruksi.ts`.

**Tes.** `kontrak/konstruksi.test.ts`.

### INV-09 · Status pembangunan selaras dengan progres

**Aturan.** `Unit.statusPembangunan` dan `Infrastructure.status` adalah nilai
**turunan** dari progres (plus status jual dan tanggal serah terima untuk unit),
bukan pilihan bebas.

**Kalau hilang.** Unit berstatus "Selesai" pada progres 40%.

**Ditegakkan.** `statusBangunUnit()` dan `statusBangunSarpras()` di
`src/lib/calc/status-bangun.ts`, ditulis ulang tiap kali progres berubah.

**Tes.** `calc/status-bangun.test.ts`, termasuk kesamaan ambang dengan
`sebaranProgres()`.

### INV-10 · SPK hanya ditandai selesai pada progres 100%

**Aturan.** `Contract.tanggalSelesai` hanya boleh diisi bila progres tertimbang
seluruh baris BOQ SPK = 100.

**Kalau hilang.** Tanggal itulah yang memulai hitungan masa pemeliharaan dan
jatuh tempo retensi. Menandainya lebih awal berarti retensi cair sebelum
pekerjaannya rampung.

**Ditegakkan.** `periksaTandaiSelesai()` di `src/lib/kontrak/vendor.ts`.

**Tes.** `kontrak/vendor.test.ts`.

---

## 3. Stok

### INV-11 · Stok aset hanya berubah lewat baris penyesuaian

**Aturan.** `Equipment.jumlah` dan `jumlahRusak` tidak pernah disunting
langsung; perubahannya selalu lahir dari sebuah `EquipmentAdjustment` yang
menyebut jenis (Hilang / Rusak / Perbaikan Selesai / Koreksi Stok) dan
penanggung jawabnya.

**Kalau hilang.** Stok berubah tanpa alasan dan tanpa penanggung jawab —
selisih opname fisik tidak bisa ditanyakan ke siapa pun.

**Ditegakkan.** `terapkanPenyesuaian()` di `src/lib/calc/aset.ts`, dipanggil
`catatPenyesuaianAset`. Fungsi itu juga menolak penyesuaian yang membuat stok
negatif.

**Tes.** `calc/aset.test.ts`.

### INV-12 · Penggunaan aktif tidak melampaui stok

**Aturan.** Σ `EquipmentUsage.jumlah` yang berstatus "Aktif" ≤ unit tersedia.

**Kalau hilang.** Satu alat tercatat dipakai di tiga proyek sekaligus melebihi
jumlah fisiknya, dan penjadwalan lapangan memakai angka yang tidak ada barangnya.

**Ditegakkan.** `periksaTambahPenggunaan()` di `src/lib/kontrak/equipment.ts`,
dengan `tersedia` dari `unitTersedia()` di `calc/aset.ts`.

**Tes.** `kontrak/sisa.test.ts`, `calc/aset.test.ts`.

---

## 4. Dokumen dan alur status

### INV-13 · RAB terkunci setelah diajukan

**Aturan.** Isi `RabEstimasi` hanya bisa diubah saat status Draft atau Ditolak.

**Kalau hilang.** Dokumen yang sudah dipakai orang lain untuk memutuskan
berubah isinya setelah keputusan dibuat. RAB Final adalah dasar SPK dan
penagihan.

**Ditegakkan.** `periksaRabDapatDiubah()` di `src/lib/kontrak/estimasi.ts`,
dipanggil seluruh aksi penyunting RAB.

**Tes.** `kontrak/estimasi.test.ts`.

### INV-14 · Transisi status petty cash mengikuti satu tabel

**Aturan.** Perpindahan `PettyCashReport.status` hanya sah menurut
`TRANSISI_PETTY`, dan tiap transisi punya peran yang berwenang.

**Kalau hilang.** Laporan bisa melompat langsung ke Direimburse tanpa
diverifikasi QS — pengeluaran diganti tanpa ada yang memeriksanya.

**Ditegakkan.** `cariTransisi()` di `src/lib/calc/petty-cash.ts`, dibungkus
`periksaTransisiLaporanPetty()`, `periksaAjukanLaporanPetty()`, dan
`periksaReimburseLaporanPetty()`.

**Tes.** `calc/petty-cash.test.ts`, `kontrak/petty-cash.test.ts`.

### INV-15 · Impor Excel bersifat semua-atau-tidak

**Aturan.** Sebuah impor menulis seluruh barisnya atau tidak satu pun.

**Kalau hilang.** Impor sebagian adalah kerusakan diam-diam: tabel tertinggal
campur aduk antara baris lama dan baris baru, dan tidak ada yang tahu batasnya
di mana.

**Ditegakkan.** `prisma.$transaction([...])` pada `imporBarisRab`,
`imporBoqSpk`, dan delapan penyimpan `simpanBoq*`/`simpanRap*` yang dipakai
`imporTabel` — masing-masing `deleteMany` + `createMany` dalam satu transaksi.

**Tes.** Dua paruh, keduanya terjaga. Aturan pembacaannya:
`adaptor/tabel-aturan.test.ts` dan `impor-excel.test.ts` — satu baris cacat
membatalkan seluruh berkas sebelum menyentuh database. Sifat transaksionalnya:
`impor-utuh.test.ts` membaca sumber kesepuluh penulis impor dan menolak
penulisan yang berdiri di luar `prisma.$transaction([...])`, termasuk yang
memisahkan hapus dan buat ke dua transaksi berbeda. Di ERP penjaga ini tidak
diperlukan lagi: satu RPC adalah satu transaksi.

### INV-16 · Kontrak tidak ada tanpa dokumen SPK

**Aturan.** `tambahKontrak` menolak bila dokumen SPK tidak diunggah pada
formulir yang sama.

**Kalau hilang.** Kontrak berjalan tanpa dasar tertulis — tagihan tanpa
perjanjian.

**Ditegakkan.** `periksaTambahKontrak()` di `src/lib/kontrak/vendor.ts`.

**Tes.** `kontrak/vendor.test.ts`.

---

## 5. Identitas dan enum

### INV-17 · Nilai enum selalu dari `enums.ts`

**Aturan.** Kolom berenum hanya menerima nilai dari `src/lib/domain/enums.ts`.
Komentar `///` di `schema.prisma` wajib mengulang daftar itu persis.

**Kalau hilang.** Nilai baru ditolak database tanpa alasan yang jelas — persis
yang hampir terjadi pada "Kontraktor" dan "Hutang" sebelum E1.

**Ditegakkan.** `pilihanSah()` di `src/lib/kontrak/dasar.ts` (masukan) dan
`KOLOM_ENUM` di `src/lib/domain/kolom-enum.ts` (skema).

**Tes.** `domain/kolom-enum.test.ts` — gagal bila komentar skema dan `enums.ts`
berbeda, dan bila ada kolom enum baru yang belum didaftarkan.

### INV-18 · "Kontraktor" hanya lahir dari SPK

**Aturan.** `Expense.jenis = "Kontraktor"` hanya boleh datang dari pembayaran
kontrak vendor, tidak pernah dari pengeluaran yang diketik manual.

**Kalau hilang.** Biaya borongan masuk ke basis RAP, dan realisasi tampak
melampaui anggaran pada proyek yang sebagian besar diborongkan.

**Ditegakkan.** `JENIS_BIAYA_SWAKELOLA` (turunan dari `JENIS_BIAYA`) dipakai
`periksaCatatPengeluaran` dan `periksaCatatPengeluaranPetty`; pembayaran
kontrak memakai `Contract.jenisBiaya` yang dibatasi `JENIS_BIAYA_KONTRAK`.

**Tes.** `kontrak/keuangan.test.ts`, `kontrak/petty-cash.test.ts`.

### INV-19 · Peruntukan pembayaran kontrak mengikuti lingkupnya

**Aturan.** Pembayaran kontrak berperuntukan "Unit (rumah dijual)" bila
`Contract.jenis = "Unit"`, dan "Prasarana & Sarana" bila "Sarpras".

**Kalau hilang.** Nilai teks lain (mis. "Sarana & Prasarana") tidak cocok enum,
sehingga biayanya luput dari laporan realisasi dan komposisi biaya — itu pernah
terjadi.

**Ditegakkan.** `peruntukanDariJenisKontrak()` di `src/lib/domain/enums.ts`,
dipakai ketiga jalur (aksi vendor, halaman vendor, lapisan data).

**Tes.** `domain/enums.test.ts`.

### INV-20 · Kode identitas unik dan berbentuk tetap

**Aturan.** Kode proyek cocok `^[A-Z0-9]{2,8}$` dan unik; kode fase unik dalam
proyek; kode tipe unik dalam proyek; kode unit (fase + nomor) unik dalam proyek;
nama vendor, kode harga dasar, kode analisa, dan kode aset masing-masing unik.

**Kalau hilang.** Kode proyek ikut membentuk kode unit, nomor RAB, nomor SPK,
dan URL tiap halaman — memperbaikinya belakangan berarti mengubah ribuan kode
turunan. Nama vendor ganda membuat penelusuran pembayaran di jejak audit
berhenti pada tebakan.

**Ditegakkan.** `periksaKodeProyek()`, `periksaSimpanFase()`,
`periksaSimpanTipeUnit()`, `periksaUnit()` di `src/lib/kontrak/master.ts`;
`periksaVendor()` di `kontrak/vendor.ts`; `periksaHargaDasar()`,
`periksaSimpanAnalisa()` di `kontrak/estimasi.ts`; `periksaAset()` di
`kontrak/equipment.ts`.

**Tes.** `kontrak/master.test.ts`, `kontrak/vendor.test.ts`,
`kontrak/estimasi.test.ts`, `kontrak/sisa.test.ts`.

### INV-21 · Administrator tidak bisa mengunci dirinya sendiri

**Aturan.** Seorang pengguna tidak bisa menonaktifkan akunnya sendiri.

**Kalau hilang.** Administrator terakhir yang melakukannya mengunci seluruh
sistem, dan memulihkannya butuh akses langsung ke database.

**Ditegakkan.** `periksaUbahStatusUser()` di `src/lib/kontrak/admin.ts`.

**Tes.** `kontrak/sisa.test.ts`.

---

## Satu invarian yang BELUM dijaga tes

Disebut terpisah supaya tidak tersamar di antara yang sudah aman:

| Invarian | Keadaannya |
|---|---|
| INV-05 (akrual tak dihitung dua kali) | dijaga oleh bentuk skema saja; tak ada tes yang gagal bila suatu saat ada jalur yang membuat `Expense` dari pelunasan |

INV-15 dulu ada di daftar ini; sejak kelompok G, sifat transaksionalnya dijaga
`impor-utuh.test.ts`. Yang tersisa lebih mudah dijaga di ERP daripada di sini:
menjadikan satu RPC sebagai satu-satunya penulis sebuah tabel adalah pola yang
sudah dipakai di seluruh ERP.
