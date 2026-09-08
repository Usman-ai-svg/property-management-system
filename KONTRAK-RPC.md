# Kontrak RPC — Modul PROYEK

Daftar lengkap **135 aksi tulis** repo ini beserta usulan RPC Postgres-nya.
Dokumen ini menggantikan versi lama yang menyebut 77 aksi.

Untuk penerjemah RPC: kolom **Masukan** menunjuk tipe di `src/lib/kontrak/`.
Tipe itu beserta fungsi `periksa*`-nya sudah murni dan bertes (305 tes) — salin
isinya ke dalam RPC, jangan tulis ulang dari layar. Kolom **Invarian** adalah
yang harus ditegakkan di sisi server; sebagian sudah dijaga fungsi `periksa*`,
sebagian butuh membaca data lain lebih dulu (lihat parameter `konteks` tiap
fungsi — daftar field-nya persis daftar yang harus dibaca RPC).

## Ringkasan

| Hal | Angka |
|---|---|
| Aksi tulis | 135 |
| Berkas ber-`"use server"` | 13 |
| RPC setelah peleburan | **93** |
| Tipe masukan di `src/lib/kontrak/` | 10 berkas, 2.647 baris |
| Tes kontrak | 305 |

**Catatan jujur soal angka 93.** Panduan menargetkan sekitar 45 RPC. Angka itu
tidak tercapai dengan peleburan yang aman, dan memaksakannya berarti menyatukan
aksi yang invariannya berbeda ke dalam satu fungsi bercabang — persis bentuk
yang membuat aturan gampang hanyut. Bagian "Peleburan" di bawah menjelaskan
pola apa yang dipakai, dan tingkat kedua peleburan yang MUNGKIN tapi tidak
disarankan beserta alasannya.

## Konvensi

- Nama RPC: `proyek_<entitas>_<kerja>`, semuanya `SECURITY DEFINER`.
- Baris pertama tiap RPC memeriksa izin, lalu validasi, lalu simpan, lalu audit.
- **Butuh ubah** = perlu izin tingkat "ubah" pada sub-bagian itu. Seluruh aksi
  di dokumen ini menulis data, jadi kolomnya selalu "ya" — dipertahankan karena
  formatnya diminta panduan dan karena RPC baca (`*_bootstrap`) nanti masuk
  daftar yang sama dengan nilai "tidak".
- **Efek samping** = tabel LAIN yang ikut berubah di luar tabel utamanya.

## Daftar aksi

| Nama aksi | Usulan RPC | Masukan | Sub-bagian izin | Butuh ubah | Invarian | Jejak audit | Efek samping |
|---|---|---|---|---|---|---|---|
| `ubahIzin` | `proyek_izin_set` | `MasukanUbahIzin` | admin (kelola akses) | ya | sub-bagian & tingkat izin dikenal | Ubah hak akses | — |
| `ubahStatusUser` | `proyek_user_status` | `MasukanId` | admin (kelola akses) | ya | tidak menonaktifkan diri sendiri | Ubah status akun | — |
| `tambahUser` | `proyek_user_simpan` | `MasukanUser` | admin (kelola akses) | ya | email unik & berbentuk sah; sandi ≥ 8; minimal satu peran | Tambah pengguna | — |
| `ubahUser` | `proyek_user_simpan` | `MasukanUser` | admin (kelola akses) | ya | email unik; sandi kosong = tidak diganti; minimal satu peran | Setel ulang kata sandi | userProjectAccess, user |
| `hapusUser` | `proyek_user_hapus` | `MasukanId` | admin (kelola akses) | ya | — | Hapus pengguna | — |
| `tambahAset` | `proyek_aset_simpan` | `MasukanAset` | aset | ya | kode unik; alat Sewa menyebut vendor | — | — |
| `ubahAset` | `proyek_aset_simpan` | `MasukanAset` | aset | ya | kode unik; alat Sewa menyebut vendor | — | — |
| `hapusAset` | `proyek_aset_hapus` | `MasukanId` | aset | ya | — | — | — |
| `catatPenyesuaianAset` | `proyek_aset_penyesuaian` | `MasukanPenyesuaianAset` | penyesuaianAset | ya | stok tak pernah negatif; stok hanya berubah lewat baris ini | — | equipmentAdjustment |
| `catatServis` | `proyek_aset_servis` | `MasukanServis` | aset | ya | jadwal berikutnya ≥ tanggal servis | Catat servis | equipmentService |
| `tambahPenggunaan` | `proyek_aset_penggunaan_simpan` | `MasukanPenggunaan` | aset | ya | Σ penggunaan aktif ≤ stok alat | — | — |
| `selesaikanPenggunaan` | `proyek_aset_penggunaan_selesai` | `MasukanId` | aset | ya | — | — | — |
| `hapusPenggunaan` | `proyek_aset_penggunaan_hapus` | `MasukanId` | aset | ya | — | — | — |
| `tambahPemasok` | `proyek_pemasok_simpan` | `MasukanPemasok` | hargaRabRap | ya | — | Tambah pemasok | — |
| `ubahPemasok` | `proyek_pemasok_simpan` | `MasukanPemasok` | hargaRabRap | ya | — | — | — |
| `hapusPemasok` | `proyek_pemasok_hapus` | `MasukanId` | hargaRabRap | ya | pemasok berpenawaran ditolak | Hapus pemasok | — |
| `tambahHargaDasar` | `proyek_harga_dasar_simpan` | `MasukanHargaDasar` | hargaRabRap | ya | kode unik | Tambah harga dasar | — |
| `ubahHargaDasar` | `proyek_harga_dasar_simpan` | `MasukanHargaDasar` | hargaRabRap | ya | kode unik | — | — |
| `hapusHargaDasar` | `proyek_harga_dasar_hapus` | `MasukanId` | hargaRabRap | ya | harga dasar terpakai komponen ditolak | Hapus harga dasar | — |
| `tambahPenawaran` | `proyek_penawaran_simpan` | `MasukanPenawaran` | hargaRabRap | ya | — | Tambah penawaran | hargaDasar |
| `jadikanAcuan` | `proyek_harga_dasar_acuan` | `MasukanId` | hargaRabRap | ya | — | Ubah harga acuan | — |
| `hapusPenawaran` | `proyek_penawaran_hapus` | `MasukanId` | hargaRabRap | ya | — | Hapus penawaran | — |
| `simpanAnalisa` | `proyek_analisa_simpan` | `MasukanAnalisa` | hargaRabRap | ya | kode unik; tiap koefisien > 0; minimal satu komponen | Ubah analisa | Tambah analisa | analisaHarga |
| `hapusAnalisa` | `proyek_analisa_hapus` | `MasukanId` | hargaRabRap | ya | baris RAB kehilangan telusur, harga snapshot tetap | Hapus analisa | — |
| `tambahRabEstimasi` | `proyek_rab_simpan` | `MasukanRabEstimasi` | hargaRabRap | ya | — | Buat RAB estimasi | — |
| `ubahRabEstimasi` | `proyek_rab_simpan` | `MasukanId` | hargaRabRap | ya | status Draft/Ditolak | — | — |
| `hapusRabEstimasi` | `proyek_rab_hapus` | `MasukanId` | hargaRabRap | ya | — | Hapus RAB estimasi | — |
| `ajukanRab` | `proyek_rab_transisi` | `MasukanId` | hargaRabRap | ya | status Draft/Ditolak; RAB tidak kosong | Ajukan RAB | — |
| `setujuiRab` | `proyek_rab_transisi` | `MasukanId` | setujuiRab | ya | status Diajukan | Setujui RAB | — |
| `tolakRab` | `proyek_rab_transisi` | `MasukanId` | setujuiRab/hargaRabRap | ya | status Diajukan | Tolak RAB | — |
| `tambahBarisRab` | `proyek_rab_baris_simpan` | `MasukanBarisRab` | — | ya | status Draft/Ditolak; baris punya analisa ATAU harga ketik | Tambah baris RAB | — |
| `ubahBarisRab` | `proyek_rab_baris_simpan` | `MasukanBarisRab` | hargaRabRap | ya | status Draft/Ditolak | — | — |
| `simpanBarisRabEstimasi` | `proyek_rab_tabel_simpan` | `GrupRabMasuk[]` | hargaRabRap | ya | status Draft/Ditolak; tabel tidak kosong | Ubah baris RAB | — |
| `segarkanHargaBaris` | `proyek_rab_baris_segarkan` | `MasukanId` | hargaRabRap | ya | — | Segarkan harga dari AHSP | — |
| `hapusBarisRab` | `proyek_rab_baris_hapus` | `MasukanId` | hargaRabRap | ya | status Draft/Ditolak | Hapus baris RAB | — |
| `imporBarisRab` | `proyek_rab_tabel_simpan` | `MasukanId` | hargaRabRap | ya | status Draft/Ditolak; impor semua-atau-tidak | Impor baris RAB dari Excel | — |
| `tambahVendorPembanding` | `proyek_rab_pembanding_simpan` | `MasukanId` | — | ya | — | Tambah vendor pembanding | — |
| `hapusVendorPembanding` | `proyek_rab_pembanding_hapus` | `MasukanId` | — | ya | — | Hapus vendor pembanding | rabPenawaran, rabPembanding |
| `simpanPenawaranVendor` | `proyek_rab_penawaran_simpan` | `MasukanId` | — | ya | — | Input penawaran vendor | rabEstimasiItem |
| `simpanPemenang` | `proyek_rab_pemenang_simpan` | `MasukanId` | — | ya | — | Simpan pemenang | — |
| `buatKontrakDariRab` | `proyek_kontrak_dari_rab` | `MasukanId` | progress | ya | nilai kontrak = Σ baris menang × jumlah objek cakupan | Buat kontrak dari RAB | contract |
| `catatPengeluaran` | `proyek_pengeluaran_simpan` | `MasukanCatatPengeluaran` | keuangan | ya | Σ alokasi = total; sasaran cocok peruntukan; objek milik proyek ini | Catat pengeluaran | — |
| `ubahPengeluaran` | `proyek_pengeluaran_simpan` | `MasukanUbahPengeluaran` | keuangan | ya | Σ alokasi = total; metode Hutang tetap Hutang; total ≥ Σ cicilan; baris tertaut kontrak/PO ditolak | — | expense |
| `hapusPengeluaran` | `proyek_pengeluaran_hapus` | `MasukanId` | keuangan | ya | hutang bercicilan ditolak; baris tertaut kontrak/PO ditolak | Hapus pengeluaran | — |
| `bagikanBiayaUnitRata` | `proyek_biaya_bagi_rata` | `MasukanId` | keuangan | ya | Σ alokasi tiap pengeluaran tetap = totalnya | Bagikan biaya ke unit (rata) | — |
| `buatPembelian` | `proyek_po_simpan` | `MasukanBuatPembelian` | keuangan | ya | — | Buat PO material | — |
| `terimaPembelian` | `proyek_po_terima` | `MasukanTerimaPembelian` | keuangan | ya | — | Terima barang PO | — |
| `hapusPembelian` | `proyek_po_hapus` | `MasukanId` | keuangan | ya | PO berpembayaran ditolak | Hapus PO material | — |
| `bayarPembelian` | `proyek_po_bayar` | `MasukanBayarPembelian` | keuangan | ya | Σ pembayaran ≤ nilai PO; metode bukan Hutang | Bayar PO | — |
| `hapusPembayaran` | `proyek_po_bayar_hapus` | `MasukanId` | keuangan | ya | — | Hapus pembayaran termin | — |
| `bayarHutang` | `proyek_hutang_cicil` | `MasukanBayarHutang` | keuangan | ya | Σ cicilan ≤ total hutang; induk bermetode Hutang | Bayar cicilan hutang | — |
| `hapusCicilanHutang` | `proyek_hutang_cicil_hapus` | `MasukanId` | keuangan | ya | — | Hapus cicilan hutang | — |
| `beriDanaPetty` | `proyek_petty_dana_beri` | `MasukanBeriDanaPetty` | keuangan | ya | pemegang Supervisor aktif | Beri dana petty cash | pettyCashTopUp |
| `reimburseLaporanPetty` | `proyek_petty_laporan_transisi` | `MasukanId` | keuangan | ya | status Disetujui; nilai laporan > 0 | Reimburse laporan petty cash | — |
| `catatPengeluaranPetty` | `proyek_petty_pengeluaran_simpan` | `MasukanCatatPengeluaranPetty` | pettyCash | ya | dana aktif; pelaku pemegang dana | Catat pengeluaran petty cash | expense |
| `ajukanLaporanPetty` | `proyek_petty_laporan_transisi` | `MasukanId` | pettyCash | ya | status Draft; pelaku pemegang dana; laporan berisi; nota gabungan ada | Ajukan laporan petty cash | — |
| `transisiLaporanPetty` | `proyek_petty_laporan_transisi` | `MasukanTransisiLaporan` | pettyCash | ya | transisi sah menurut TRANSISI_PETTY; wewenang tahap | — | — |
| `ubahProgresUnit` | `proyek_progres_manual` | `MasukanUbahProgresManual` | progress | ya | objek ber-BOQ ditolak (progresnya turunan); progres 0–100 | Ubah progress konstruksi | progressRecord |
| `ubahProgresSarpras` | `proyek_progres_manual` | `MasukanUbahProgresManual` | progress | ya | objek ber-BOQ ditolak (progresnya turunan); progres 0–100 | Ubah progress konstruksi | progressRecord |
| `simpanOpnameUnit` | `proyek_opname_simpan` | `MasukanSimpanOpname` | progress | ya | jumlah id = jumlah nilai; tiap progres 0–100; Unit.progress dihitung ulang | Opname konstruksi per baris BOQ | — |
| `simpanOpnameSarpras` | `proyek_opname_simpan` | `MasukanSimpanOpname` | progress | ya | jumlah id = jumlah nilai; tiap progres 0–100; progres sarpras dihitung ulang | Opname konstruksi per baris BOQ | infrastructureBoqItem |
| `simpanKategoriHpp` | `proyek_bp_kategori_simpan` | `MasukanKategoriRencana` | — | ya | — | Tambah kategori HPP | — |
| `hapusKategoriHpp` | `proyek_bp_kategori_hapus` | `MasukanId` | — | ya | — | Hapus kategori HPP | — |
| `simpanBarisHpp` | `proyek_bp_baris_simpan` | `MasukanBarisRencana` | — | ya | — | — | — |
| `hapusBarisHpp` | `proyek_bp_baris_hapus` | `MasukanId` | — | ya | — | Hapus baris HPP | — |
| `simpanHargaDasarUnit` | `proyek_bp_omzet_unit_set` | `MasukanHargaDasarUnit` | — | ya | — | Ubah harga dasar rencana | — |
| `resetHargaDasarUnit` | `proyek_bp_omzet_unit_set` | `MasukanId` | businessPlan | ya | — | Reset harga dasar rencana | — |
| `simpanKategoriOperasional` | `proyek_bp_kategori_simpan` | `MasukanKategoriRencana` | — | ya | — | Tambah kategori operasional | operationalCost |
| `hapusKategoriOperasional` | `proyek_bp_kategori_hapus` | `MasukanId` | — | ya | — | Hapus kategori operasional | — |
| `simpanBarisOperasional` | `proyek_bp_baris_simpan` | `MasukanBarisRencana` | — | ya | — | — | — |
| `hapusBarisOperasional` | `proyek_bp_baris_hapus` | `MasukanId` | — | ya | — | Hapus baris operasional | — |
| `simpanCashflow` | `proyek_bp_cashflow_simpan` | `MasukanCashflow` | — | ya | — | Tambah periode cashflow | — |
| `hapusCashflow` | `proyek_bp_cashflow_hapus` | `MasukanId` | — | ya | — | Hapus periode cashflow | — |
| `simpanPembanding` | `proyek_bp_pembanding_simpan` | `MasukanPembanding` | businessPlan/businessPlan | ya | — | Tambah pembanding pasar | marketComparableType |
| `hapusPembanding` | `proyek_bp_pembanding_hapus` | `MasukanId` | businessPlan | ya | — | Hapus pembanding pasar | marketComparableType |
| `catatBiayaOperasional` | `proyek_biaya_operasional_simpan` | `MasukanBiayaOperasional` | businessPlan/keuangan | ya | kategori ada di pos business plan proyek | Catat biaya operasional | — |
| `simpanPembayaranJual` | `proyek_penjualan_bayar_simpan` | `MasukanPembayaranJual` | — | ya | — | Catat pembayaran penjualan | — |
| `hapusPembayaranJual` | `proyek_penjualan_bayar_hapus` | `MasukanId` | — | ya | — | Hapus pembayaran penjualan | — |
| `tambahProyek` | `proyek_proyek_simpan` | `MasukanProyek` | deskripsi | ya | kode cocok pola & unik | Buat proyek | — |
| `ubahProyek` | `proyek_proyek_simpan` | `MasukanProyek` | deskripsi | ya | — | — | — |
| `hapusProyek` | `proyek_proyek_hapus` | `MasukanId` | deskripsi | ya | proyek berisi unit/sarpras/pengeluaran ditolak | Hapus proyek | — |
| `simpanFase` | `proyek_fase_simpan` | `MasukanFase` | deskripsi/deskripsi | ya | kode fase unik dalam proyek | Tambah fase | — |
| `hapusFase` | `proyek_fase_hapus` | `MasukanId` | deskripsi | ya | fase berisi unit ditolak | Hapus fase | — |
| `aturJumlahFase` | `proyek_fase_atur_jumlah` | `{ projectId, jumlah }` | deskripsi | ya | 1 ≤ jumlah ≤ 50 | Atur jumlah fase | — |
| `ubahLokasiProyek` | `proyek_proyek_simpan` | `MasukanId` | deskripsi | ya | — | — | — |
| `ubahLuasLahan` | `proyek_proyek_simpan` | `MasukanId` | deskripsi | ya | — | — | — |
| `ubahBiayaLahan` | `proyek_proyek_simpan` | `MasukanId` | hargaRabRap | ya | — | — | — |
| `ubahLegalitas` | `proyek_legalitas_simpan` | `BarisLegalitas[]` | deskripsi | ya | tiap NIB menyebut jenis & nomor hak | Ubah data legalitas | — |
| `simpanTipeUnit` | `proyek_tipe_simpan` | `MasukanTipeUnit` | dokumenTeknis | ya | kode unik dalam proyek; luas > 0 | Tambah tipe unit | — |
| `hapusTipeUnit` | `proyek_tipe_hapus` | `MasukanId` | dokumenTeknis | ya | tipe terpakai unit ditolak | Hapus tipe unit | — |
| `ubahUnit` | `proyek_unit_simpan` | `MasukanUnit` | progress | ya | kode unit tetap unik bila fase/nomor berubah | — | progressRecord |
| `tambahUnit` | `proyek_unit_simpan` | `MasukanUnit` | daftarUnit | ya | kode unit (fase+nomor) unik dalam proyek | Tambah unit | progressRecord |
| `hapusUnit` | `proyek_unit_hapus` | `MasukanId` | daftarUnit | ya | — | Hapus unit | — |
| `hapusUnitPaksa` | `proyek_unit_hapus` | `MasukanId` | daftarUnit | ya | — | Hapus paksa unit | — |
| `ubahBarisBoq` | `proyek_boq_simpan` | `MasukanBarisTabel` | hargaRabRap | ya | — | — | — |
| `ubahBarisRap` | `proyek_rap_simpan` | `MasukanBarisTabel` | hargaRabRap | ya | — | — | — |
| `unggahRevisi` | `proyek_dokumen_revisi` | `MasukanId` | dokumenTeknis | ya | — | Unggah revisi | legality, project, unitType, customWork, contract, infrastructure, documentVersion |
| `simpanSarpras` | `proyek_sarpras_simpan` | `MasukanSarpras` | daftarSarpras | ya | — | Tambah sarpras | progressRecord |
| `hapusSarpras` | `proyek_sarpras_hapus` | `MasukanId` | daftarSarpras | ya | — | Hapus sarpras | — |
| `hapusSarprasPaksa` | `proyek_sarpras_hapus` | `MasukanId` | daftarSarpras | ya | — | Hapus paksa sarpras | — |
| `simpanBoqUnit` | `proyek_boq_simpan` | `BarisBoq[]` | hargaRabRap | ya | — | Ubah baris BOQ | — |
| `simpanBoqKerjaTambah` | `proyek_boq_simpan` | `BarisBoq[]` | hargaRabRap | ya | — | Ubah baris BOQ | — |
| `simpanBoqSarpras` | `proyek_boq_simpan` | `BarisBoq[]` | hargaRabRap | ya | — | Ubah baris BOQ | infrastructure |
| `simpanBoqTipe` | `proyek_boq_simpan` | `BarisBoq[]` | dokumenTeknis | ya | — | Ubah baris BOQ | — |
| `simpanRapUnit` | `proyek_rap_simpan` | `BarisRap[]` | hargaRabRap | ya | — | Ubah rincian RAP | unit |
| `simpanRapKerjaTambah` | `proyek_rap_simpan` | `BarisRap[]` | hargaRabRap | ya | — | Ubah rincian RAP | customWork |
| `simpanRapSarpras` | `proyek_rap_simpan` | `BarisRap[]` | hargaRabRap | ya | — | Ubah rincian RAP | infrastructure |
| `simpanRapTipe` | `proyek_rap_simpan` | `BarisRap[]` | dokumenTeknis | ya | — | Ubah rincian RAP | unitType |
| `imporTabel` | `proyek_tabel_impor` | `MasukanId` | — | ya | impor semua-atau-tidak | — | — |
| `tambahKerjaTambah` | `proyek_kerja_tambah_simpan` | `MasukanId` | daftarUnit | ya | — | Tambah kerja tambah | — |
| `ubahJudulKerjaTambah` | `proyek_kerja_tambah_simpan` | `MasukanId` | daftarUnit | ya | — | Ubah judul kerja tambah | — |
| `hapusKerjaTambah` | `proyek_kerja_tambah_hapus` | `MasukanId` | daftarUnit | ya | — | Hapus kerja tambah | — |
| `tambahVo` | `proyek_vo_simpan` | `MasukanTambahVo` | progress | ya | objek tiap baris di dalam cakupan kontrak; nilai VO ≠ 0 | Tambah Variation Order | — |
| `hapusVo` | `proyek_vo_hapus` | `MasukanId` | progress | ya | — | Hapus Variation Order | — |
| `ubahStatusVo` | `proyek_vo_status` | `MasukanId` | progress | ya | — | Ubah status VO | — |
| `tambahPembayaran` | `proyek_kontrak_bayar` | `MasukanPembayaranKontrak` | keuangan | ya | Σ pembayaran ≤ nilai efektif kontrak (nominal + VO disetujui) | Catat pembayaran | — |
| `hapusPembayaran` | `proyek_kontrak_bayar_hapus` | `MasukanId` | keuangan | ya | — | Hapus pembayaran | — |
| `tambahVendor` | `proyek_vendor_simpan` | `MasukanVendor` | progress | ya | — | Tambah vendor | — |
| `ubahVendor` | `proyek_vendor_simpan` | `MasukanVendor` | progress | ya | — | — | — |
| `hapusVendor` | `proyek_vendor_hapus` | `MasukanId` | progress | ya | vendor berkontrak ditolak | Hapus vendor | — |
| `tambahKontrak` | `proyek_kontrak_simpan` | `MasukanKontrak` | progress | ya | vendor Aktif; dokumen SPK wajib | Buat kontrak | contract |
| `ubahKontrak` | `proyek_kontrak_simpan` | `MasukanUbahKontrak` | progress | ya | — | — | — |
| `tandaiSelesai` | `proyek_kontrak_selesai_set` | `MasukanId` | progress | ya | progres SPK = 100; belum ditandai selesai | Tandai selesai | — |
| `batalSelesai` | `proyek_kontrak_selesai_set` | `MasukanId` | progress | ya | — | Batalkan tanda selesai | — |
| `hapusKontrak` | `proyek_kontrak_hapus` | `MasukanId` | progress | ya | kontrak berpembayaran ditolak | Hapus kontrak | — |
| `tambahBarisBoqSpk` | `proyek_spk_boq_simpan` | `MasukanBarisBoqSpk` | progress | ya | — | Tambah baris BOQ template | — |
| `ubahBarisBoqSpk` | `proyek_spk_boq_simpan` | `MasukanUbahBarisBoqSpk` | progress | ya | — | Ubah baris BOQ template | — |
| `hapusBarisBoqSpk` | `proyek_spk_boq_hapus` | `MasukanId` | progress | ya | — | Hapus baris BOQ template | — |
| `imporBoqSpk` | `proyek_spk_boq_impor` | `MasukanId` | progress | ya | berkas ada & terbaca ≥ 1 baris; impor semua-atau-tidak | Impor BOQ template dari Excel | — |
| `ubahOverrideBoq` | `proyek_spk_boq_override` | `MasukanOverrideBoq` | progress | ya | — | Sesuaikan BOQ per objek | — |
| `resetOverrideBoq` | `proyek_spk_boq_override` | `MasukanId` | progress | ya | — | Samakan baris BOQ ke template | — |
| `simpanProgresBoqSpk` | `proyek_spk_opname_simpan` | `MasukanSimpanProgres` | progress | ya | tiap progres 0–100; progres SPK dihitung ulang dari baris | Opname progres BOQ | contractVoItem |
| `login` | _(tidak jadi RPC — Supabase Auth)_ | `MasukanLogin` | — | ya | — | — | — |
| `logout` | _(tidak jadi RPC — Supabase Auth)_ | `MasukanId` | — | ya | — | — | — |
| `gantiPeran` | `proyek_peran_aktif_set` | `MasukanId` | — | ya | — | — | — |

## Peleburan (B4)

135 aksi → **93 RPC**. Tiga pola dipakai, dan hanya tiga.

### 1. `tambah` + `ubah` → satu `*_simpan`

Bentuk masukannya sudah sama; yang membedakan cuma ada-tidaknya id. Di
Postgres ini satu fungsi dengan `INSERT ... ON CONFLICT` atau percabangan
`IF p_id IS NULL`.

Contoh: `tambahVendor`/`ubahVendor` → `proyek_vendor_simpan`;
`tambahPemasok`/`ubahPemasok` → `proyek_pemasok_simpan`;
`tambahUnit`/`ubahUnit` → `proyek_unit_simpan`.

Kasus terbesar pola ini ada di Master: `ubahProyek`, `ubahLokasiProyek`,
`ubahLuasLahan`, dan `ubahBiayaLahan` semuanya `UPDATE project` dengan kolom
berbeda — empat aksi, satu RPC `proyek_proyek_simpan`. Yang membedakan hanya
sub-bagian izinnya (`ubahBiayaLahan` butuh `hargaRabRap`, sisanya `deskripsi`),
dan itu jadi percabangan izin di dalam RPC, bukan RPC terpisah.

### 2. Beda OBJEK saja → satu RPC berparameter jenis objek

Delapan aksi tabel BOQ/RAP adalah aturan yang sama pada empat tabel berbeda:

```
simpanBoqUnit · simpanBoqKerjaTambah · simpanBoqSarpras · simpanBoqTipe
  → proyek_boq_simpan(objek jsonb, baris jsonb)

simpanRapUnit · simpanRapKerjaTambah · simpanRapSarpras · simpanRapTipe
  → proyek_rap_simpan(objek jsonb, baris jsonb)
```

Pola yang sama berlaku pada progres manual (`ubahProgresUnit` +
`ubahProgresSarpras`), opname (`simpanOpnameUnit` + `simpanOpnameSarpras`), dan
seluruh kategori/baris business plan HPP + operasional.

### 3. Transisi status → satu RPC `*_transisi`

`ajukanRab`, `setujuiRab`, dan `tolakRab` bukan tiga aturan melainkan satu
mesin status dengan tiga tujuan. Begitu pula alur petty cash: `ajukanLaporan`,
`transisiLaporan`, dan `reimburseLaporan` semuanya menggerakkan
`PettyCashReport.status` menurut tabel transisi yang sama
(`TRANSISI_PETTY` di `calc/petty-cash.ts`).

### Yang sengaja TIDAK dilebur

Aksi yang bentuk masukannya mirip tetapi **invariannya berbeda** tetap terpisah.
Contoh yang paling gampang tertukar:

| Terlihat sama | Sebenarnya beda |
|---|---|
| `hapusPembelian` vs `hapusPembayaran` (PO) | yang pertama MENOLAK bila PO punya pembayaran; yang kedua justru menghapus pembayaran itu |
| `hapusUnit` vs `hapusUnitPaksa` | dilebur (satu RPC berbendera), karena aturannya memang satu dengan pengecualian eksplisit |
| `tandaiSelesai` vs `batalSelesai` | dilebur — keduanya menyetel `tanggalSelesai`, satu mengisi satu mengosongkan |

### Tingkat kedua peleburan — mungkin, tapi tidak disarankan

Angka 93 bisa ditekan ke sekitar 66 dengan satu langkah lagi: menyatukan ~28
aksi `hapus*` berbentuk "satu id" menjadi satu RPC
`proyek_hapus(entitas text, id uuid)`.

**Jangan.** Tiap penghapusan punya syaratnya sendiri — fase menolak bila masih
berisi unit, PO menolak bila sudah dibayar, hutang menolak bila sudah dicicil,
analisa justru MEMBIARKAN baris RAB kehilangan telusur. Menyatukannya berarti
satu fungsi dengan `CASE` dua puluh delapan cabang, dan tiap cabang adalah
aturan yang seharusnya bisa dibaca sendiri. Yang dihemat cuma jumlah nama
fungsi; yang hilang adalah kemampuan membaca satu aturan tanpa membaca dua
puluh tujuh lainnya.

## Yang tidak ikut jadi RPC

`login`, `logout`, dan `gantiPeran` tidak diterjemahkan: identitas di ERP datang
dari Supabase Auth. `gantiPeran` tetap didaftar karena mekanismenya — peran
aktif yang menentukan hak akses — memang ikut pindah, hanya penyimpanannya yang
berbeda.

Aksi Admin (`tambahUser`, `ubahUser`, `hapusUser`, `ubahStatusUser`) juga tidak
akan punya RPC di modul PROYEK: pengelolaan pengguna sudah ada di ERP. Yang
IKUT adalah `ubahIzin` beserta tabel `RoleSectionPermission`-nya — di ERP
matriks itu dibiarkan terbuka penuh, tetapi mekanismenya harus utuh supaya bisa
diperketat tanpa membongkar RPC satu per satu.
