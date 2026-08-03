# Kontrak RPC — Inventaris Aksi Perubahan Data

Dokumen pendamping `MIGRASI.md`. Isinya satu daftar: **77 Server Action** yang
mengubah data, beserta sub-bagian hak akses yang menjaganya dan usulan nama
fungsi RPC Postgres-nya.

Gunanya saat penyerapan ke ERP: inilah permukaan tulis yang harus tersedia
sebagai RPC. Halaman boleh ditulis ulang bebas, tapi setiap aksi di bawah ini
harus punya padanan — dan padanannya **harus memeriksa izin yang sama**.

---

## Tiga aturan yang wajib ikut pindah

**1. Penjagaan ada di sisi server, bukan di UI.**
Berkas `"use server"` mengekspor SELURUH fungsinya sebagai endpoint yang bisa
dipanggil langsung dari browser. Tombol yang tidak digambar tidak menahan apa
pun. Di Postgres, padanannya `SECURITY DEFINER` ditambah pemeriksaan izin di
baris pertama fungsi.

Dijaga tes: `src/lib/actions/penjaga-aksi.test.ts` menelusuri tiap aksi yang
diekspor dan menolak yang tidak sampai ke pemeriksaan izin.

> Dua endpoint tanpa penjaga ditemukan saat tes itu ditulis, keduanya juga
> tanpa pemanggil: `nilaiTerpasangSpk` (mengembalikan nilai terpasang sebuah
> SPK) dan `imporPeragaan` (menulis teks bebas ke jejak audit). Keduanya sudah
> dihapus.

**2. Validasi isian tidak boleh ditulis ulang.**
`src/lib/adaptor/formulir.ts` membaca angka bergaya Indonesia, menegakkan
batas, dan menolak nilai enum di luar daftar. Aturannya murni dan bekerja di
atas fungsi pembaca `(nama) => string | null`, jadi bisa dipakai apa adanya
ketika isian datang sebagai parameter RPC alih-alih `FormData`.

Yang paling mudah salah: `"1.250"` berarti seribu dua ratus lima puluh,
sedangkan `"12.5"` berarti dua belas setengah. Keduanya satu titik.

**3. Setiap perubahan menulis jejak audit.**
`catat()` dan `catatDiff()` di `src/lib/audit.ts`. `AuditLog` hanya-tambah:
tidak ada jalur ubah maupun hapus. Fungsi RPC penggantinya harus menulis baris
yang sama, kalau tidak riwayat perubahan berhenti tanpa ada yang menyadarinya.

---

## Invarian yang tidak boleh hilang saat aksi jadi RPC

| Invarian | Ditegakkan oleh | Kalau hilang |
|---|---|---|
| Jumlah `ExpenseAllocation` = `Expense.total` | `periksaAlokasi()` | Biaya per unit diam-diam tidak sama dengan total pengeluaran |
| `UnitBoqItem.progress` berubah → hitung ulang `Unit.progress` | `hitungUlangProgresUnit()` | Angka kemajuan keliru tanpa galat apa pun |
| Status pembangunan mengikuti progres | `statusSelaras()` | Unit bisa berstatus "Selesai" pada progres 40% |
| Stok aset hanya bergerak lewat penyesuaian | `terapkanPenyesuaian()` | Stok berubah tanpa alasan, tanggal, dan penanggung jawab |
| Impor Excel tidak boleh separuh jadi | `bacaBoq()` / `bacaRap()` | Tabel tertinggal campur aduk, lebih sulit diperbaiki daripada mengulang |

---

## Daftar aksi

### `admin`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `hapusFase` | `deskripsi` | `pm_hapus_fase` |
| `hapusProyek` | `deskripsi` | `pm_hapus_proyek` |
| `hapusUser` | `deskripsi` | `pm_hapus_user` |
| `simpanFase` | `deskripsi` | `pm_simpan_fase` |
| `tambahProyek` | `deskripsi` | `pm_tambah_proyek` |
| `tambahUser` | `deskripsi` | `pm_tambah_user` |
| `ubahIzin` | `deskripsi` | `pm_ubah_izin` |
| `ubahProyek` | `deskripsi` | `pm_ubah_proyek` |
| `ubahStatusUser` | `deskripsi` | `pm_ubah_status_user` |
| `ubahUser` | `deskripsi` | `pm_ubah_user` |

### `equipment`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `catatPenyesuaianAset` | `penyesuaianAset` | `pm_catat_penyesuaian_aset` |
| `hapusAset` | `aset` | `pm_hapus_aset` |
| `tambahAset` | `aset` | `pm_tambah_aset` |
| `ubahAset` | `aset` | `pm_ubah_aset` |

### `keuangan`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `catatPengeluaran` | `keuangan` | `pm_catat_pengeluaran` |
| `hapusPengeluaran` | `keuangan` | `pm_hapus_pengeluaran` |
| `ubahPengeluaran` | `keuangan` | `pm_ubah_pengeluaran` |

### `konstruksi`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `simpanOpnameSarpras` | `progress` | `pm_simpan_opname_sarpras` |
| `simpanOpnameUnit` | `progress` | `pm_simpan_opname_unit` |
| `ubahProgresSarpras` | `progress` | `pm_ubah_progres_sarpras` |
| `ubahProgresUnit` | `progress` | `pm_ubah_progres_unit` |

### `landbank`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `hapusCashflow` | `businessPlan` | `pm_hapus_cashflow` |
| `hapusPembanding` | `businessPlan` | `pm_hapus_pembanding` |
| `hapusPosHpp` | `businessPlan` | `pm_hapus_pos_hpp` |
| `hapusPosOmzet` | `businessPlan` | `pm_hapus_pos_omzet` |
| `hapusPosOperasional` | `businessPlan` | `pm_hapus_pos_operasional` |
| `simpanCashflow` | `businessPlan` | `pm_simpan_cashflow` |
| `simpanPembanding` | `businessPlan` | `pm_simpan_pembanding` |
| `simpanPosHpp` | `businessPlan` | `pm_simpan_pos_hpp` |
| `simpanPosOmzet` | `businessPlan` | `pm_simpan_pos_omzet` |
| `simpanPosOperasional` | `businessPlan` | `pm_simpan_pos_operasional` |

### `master`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `hapusKerjaTambah` | `daftarUnit` | `pm_hapus_kerja_tambah` |
| `hapusSarpras` | `daftarSarpras` | `pm_hapus_sarpras` |
| `hapusTipeUnit` | `dokumenTeknis` | `pm_hapus_tipe_unit` |
| `hapusUnit` | `daftarUnit` | `pm_hapus_unit` |
| `imporTabel` | `hargaRabRap` | `pm_impor_tabel` |
| `simpanBoqKerjaTambah` | `hargaRabRap` | `pm_simpan_boq_kerja_tambah` |
| `simpanBoqSarpras` | `hargaRabRap` | `pm_simpan_boq_sarpras` |
| `simpanBoqUnit` | `hargaRabRap` | `pm_simpan_boq_unit` |
| `simpanRapKerjaTambah` | `hargaRabRap` | `pm_simpan_rap_kerja_tambah` |
| `simpanRapSarpras` | `hargaRabRap` | `pm_simpan_rap_sarpras` |
| `simpanRapUnit` | `hargaRabRap` | `pm_simpan_rap_unit` |
| `simpanSarpras` | `daftarSarpras` | `pm_simpan_sarpras` |
| `simpanTipeUnit` | `dokumenTeknis` | `pm_simpan_tipe_unit` |
| `tambahKerjaTambah` | `daftarUnit` | `pm_tambah_kerja_tambah` |
| `tambahUnit` | `daftarUnit` | `pm_tambah_unit` |
| `ubahBarisBoq` | `hargaRabRap` | `pm_ubah_baris_boq` |
| `ubahBarisRap` | `hargaRabRap` | `pm_ubah_baris_rap` |
| `ubahBiayaLahan` | `hargaRabRap` | `pm_ubah_biaya_lahan` |
| `ubahJudulKerjaTambah` | `daftarUnit` | `pm_ubah_judul_kerja_tambah` |
| `ubahLegalitas` | `deskripsi` | `pm_ubah_legalitas` |
| `ubahLokasiProyek` | `deskripsi` | `pm_ubah_lokasi_proyek` |
| `ubahLuasLahan` | `deskripsi` | `pm_ubah_luas_lahan` |
| `ubahUnit` | `progress` | `pm_ubah_unit` |
| `ubahUpahRap` | `hargaRabRap` | `pm_ubah_upah_rap` |
| `unggahRevisi` | `dokumenTeknis` | `pm_unggah_revisi` |

### `plan-realisasi`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `catatBiayaOperasional` | `businessPlan` | `pm_catat_biaya_operasional` |
| `hapusPembayaranJual` | `keuangan` | `pm_hapus_pembayaran_jual` |
| `simpanPembayaranJual` | `keuangan` | `pm_simpan_pembayaran_jual` |

### `vendor`

| Aksi | Izin | Usulan nama RPC |
|---|---|---|
| `hapusBarisBoqSpk` | `progress` | `pm_hapus_baris_boq_spk` |
| `hapusKontrak` | `progress` | `pm_hapus_kontrak` |
| `hapusTender` | `progress` | `pm_hapus_tender` |
| `hapusVendor` | `progress` | `pm_hapus_vendor` |
| `imporBoqSpk` | `progress` | `pm_impor_boq_spk` |
| `salinBoqKeSemua` | `progress` | `pm_salin_boq_ke_semua` |
| `simpanProgresBoqSpk` | `progress` | `pm_simpan_progres_boq_spk` |
| `tambahBarisBoqSpk` | `progress` | `pm_tambah_baris_boq_spk` |
| `tambahKontrak` | `progress` | `pm_tambah_kontrak` |
| `tambahPembayaran` | `keuangan` | `pm_tambah_pembayaran` |
| `tambahPesertaTender` | `progress` | `pm_tambah_peserta_tender` |
| `tambahTender` | `progress` | `pm_tambah_tender` |
| `tambahVendor` | `progress` | `pm_tambah_vendor` |
| `tambahVo` | `progress` | `pm_tambah_vo` |
| `ubahBarisBoqSpk` | `progress` | `pm_ubah_baris_boq_spk` |
| `ubahKontrak` | `progress` | `pm_ubah_kontrak` |
| `ubahStatusTender` | `progress` | `pm_ubah_status_tender` |
| `ubahVendor` | `progress` | `pm_ubah_vendor` |

---

## Catatan penamaan

Usulan nama RPC memakai awalan `pm_` dan gaya ular, seragam dengan awalan
tabel di `prisma/schema.postgres.prisma`. ERP sudah memakai pola serupa
(`proyek_bootstrap`, `kpr_save`), jadi `pm_` menjaga modul ini tetap terbaca
sebagai satu kelompok tanpa bertabrakan dengan yang sudah ada.

Beberapa aksi lebih baik digabung menjadi satu RPC bergaya `bootstrap` seperti
milik ERP — misalnya seluruh `simpanBoq*` dan `simpanRap*` yang bentuk
masukannya sama persis. Itu keputusan yang lebih baik diambil setelah skema
Postgres ERP terlihat.
