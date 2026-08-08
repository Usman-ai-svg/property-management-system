-- Enum asli Postgres, dihasilkan dari src/lib/domain/enums.ts.

CREATE TYPE pm_status_proyek AS ENUM (
  'Perencanaan',
  'Proses Legal & Perizinan',
  'Dalam Pembangunan',
  'Selesai'
);

CREATE TYPE pm_status_lahan AS ENUM (
  'Perencanaan',
  'Proses Legal & Perizinan',
  'Pembangunan',
  'Selesai Terbangun'
);

CREATE TYPE pm_status_pembangunan AS ENUM (
  'Belum terbangun',
  'Progress',
  'Selesai',
  'Serah Terima',
  'Habis Masa Garansi'
);

CREATE TYPE pm_status_jual AS ENUM (
  'Tersedia',
  'Booking',
  'Akad',
  'Serah Terima'
);

CREATE TYPE pm_status_sarpras AS ENUM (
  'Belum terbangun',
  'Progress',
  'Selesai'
);

CREATE TYPE pm_jenis_sarpras AS ENUM (
  'Sarana',
  'Prasarana'
);

CREATE TYPE pm_jenis_kontrak AS ENUM (
  'Unit',
  'Sarpras'
);

CREATE TYPE pm_status_vo AS ENUM (
  'Diajukan',
  'Disetujui',
  'Ditolak'
);

CREATE TYPE pm_status_vendor AS ENUM (
  'Aktif',
  'Nonaktif'
);

CREATE TYPE pm_kategori_pemasok AS ENUM (
  'Material',
  'Tenaga Kerja',
  'Alat'
);

CREATE TYPE pm_status_pemasok AS ENUM (
  'Aktif',
  'Nonaktif'
);

CREATE TYPE pm_status_pembelian AS ENUM (
  'Draft',
  'Diterima'
);

CREATE TYPE pm_kategori_harga_dasar AS ENUM (
  'UPAH',
  'BAHAN',
  'ALAT'
);

CREATE TYPE pm_status_rab_estimasi AS ENUM (
  'Draft',
  'Diajukan',
  'Ditolak',
  'Final'
);

CREATE TYPE pm_peruntukan_biaya AS ENUM (
  'Unit (rumah dijual)',
  'Prasarana & Sarana',
  'Perijinan & Ormas',
  'Pengolahan Lahan',
  'Material'
);

CREATE TYPE pm_jenis_biaya AS ENUM (
  'Upah Borongan',
  'Material',
  'Subkon',
  'Upah Harian',
  'Lain-lain proyek'
);

CREATE TYPE pm_metode_bayar AS ENUM (
  'Transfer',
  'Petty Cash',
  'Tunai langsung'
);

CREATE TYPE pm_status_bayar AS ENUM (
  'Lunas',
  'DP',
  'Belum'
);

CREATE TYPE pm_status_aset AS ENUM (
  'Tersedia',
  'Digunakan',
  'Pemeliharaan',
  'Rusak'
);

CREATE TYPE pm_kepemilikan_aset AS ENUM (
  'Milik Sendiri',
  'Sewa'
);

CREATE TYPE pm_satuan_pakai AS ENUM (
  'jam',
  'hari'
);

CREATE TYPE pm_jenis_penyesuaian_aset AS ENUM (
  'Hilang',
  'Rusak',
  'Perbaikan Selesai',
  'Koreksi Stok'
);

CREATE TYPE pm_jenis_hak_atas_tanah AS ENUM (
  'Hak Milik (HM)',
  'Hak Guna Usaha (HGU)',
  'Hak Guna Bangunan (HGB)',
  'Hak Pakai',
  'Hak Pengelolaan (HPL)',
  'Hak Tanggungan'
);
