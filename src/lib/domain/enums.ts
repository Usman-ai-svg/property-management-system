/**
 * Nilai enum domain.
 *
 * SQLite tidak mendukung enum di Prisma, jadi kolom-kolom ini bertipe String
 * di database dan divalidasi di sini. Saat pindah ke Postgres/ERP, daftar di
 * bawah adalah sumber kebenaran untuk membuat enum aslinya.
 *
 * File ini sengaja bebas dependensi — tidak mengimpor React, Next, maupun Prisma.
 */

export const STATUS_PROYEK = [
  "Perencanaan",
  "Proses Legal & Perizinan",
  "Dalam Pembangunan",
  "Selesai",
] as const;

export const STATUS_LAHAN = [
  "Perencanaan",
  "Proses Legal & Perizinan",
  "Pembangunan",
  "Selesai Terbangun",
] as const;

export const STATUS_PEMBANGUNAN = [
  "Belum terbangun",
  "Progress",
  "Selesai",
  "Serah Terima",
  "Habis Masa Garansi",
] as const;

export const STATUS_JUAL = ["Tersedia", "Booking", "Akad", "Serah Terima"] as const;

export const STATUS_SARPRAS = ["Belum terbangun", "Progress", "Selesai"] as const;

export const JENIS_SARPRAS = ["Sarana", "Prasarana"] as const;

export const JENIS_KONTRAK = ["Unit", "Sarpras"] as const;

export const STATUS_VO = ["Diajukan", "Disetujui", "Ditolak"] as const;

export const STATUS_VENDOR = ["Aktif", "Nonaktif"] as const;

/** Kelengkapan dokumen peserta tender. */
export const DOKUMEN_TENDER = ["Lengkap", "Kurang dokumen"] as const;

export const STATUS_TENDER = ["Dibuka", "Evaluasi", "Ditetapkan", "Batal"] as const;

export const PERUNTUKAN_BIAYA = [
  "Unit (rumah dijual)",
  "Prasarana & Sarana",
  "Perijinan & Ormas",
  "Pengolahan Lahan",
] as const;

export const JENIS_BIAYA = [
  "Upah Borongan",
  "Material",
  "Subkon",
  "Upah Harian",
  "Lain-lain proyek",
] as const;

export const METODE_BAYAR = ["Transfer", "Petty Cash", "Tunai langsung"] as const;

export const STATUS_BAYAR = ["Lunas", "DP", "Belum"] as const;

export const STATUS_ASET = ["Tersedia", "Digunakan", "Pemeliharaan", "Rusak"] as const;

export const KEPEMILIKAN_ASET = ["Milik Sendiri", "Sewa"] as const;
/** Satuan pemakaian alat: alat berat dihitung per jam, alat bantu per hari. */
export const SATUAN_PAKAI = ["jam", "hari"] as const;

/**
 * Jenis penyesuaian stok aset.
 *
 * Dibedakan karena akibatnya pada angka tidak sama:
 *   - Hilang mengurangi jumlah — barangnya memang tidak ada lagi.
 *   - Rusak TIDAK mengurangi jumlah, hanya menambah bagian yang tak terpakai;
 *     barangnya masih dimiliki dan bisa diperbaiki.
 *   - Perbaikan Selesai mengembalikan bagian rusak menjadi terpakai.
 *   - Koreksi Stok menambah atau mengurangi jumlah setelah opname fisik.
 */
export const JENIS_PENYESUAIAN_ASET = [
  "Hilang",
  "Rusak",
  "Perbaikan Selesai",
  "Koreksi Stok",
] as const;

/** Sub-bagian yang hak aksesnya diatur terpisah di Admin → Kelola Hak Akses. */
export const SECTIONS = [
  "deskripsi",
  "daftarUnit",
  "daftarSarpras",
  "dokumenTeknis",
  "hargaRabRap",
  "businessPlan",
  "keuangan",
  "progress",
  "aset",
  "penyesuaianAset",
] as const;

export const SECTION_LABELS: Record<Section, string> = {
  deskripsi: "Deskripsi Proyek",
  daftarUnit: "Daftar Unit",
  daftarSarpras: "Daftar Sarpras",
  dokumenTeknis: "Dokumen Teknis",
  hargaRabRap: "Harga RAB & RAP",
  businessPlan: "Business Plan / Margin",
  keuangan: "Keuangan Operasional",
  progress: "Progress & Kontrak",
  aset: "Equipment & Asset",
  penyesuaianAset: "Penyesuaian Aset",
};

/** Peran. Satu user boleh memegang lebih dari satu. */
export const ROLES = [
  "Komisaris",
  "BOD",
  "Head Operation Office",
  "Head Operation Project",
  "Project Manager",
  "Supervisor",
  "Business Development",
  "Arsitek",
  "Quantity Surveyor",
  "Procurement",
  "Customer Care",
  "Consultant Finance",
  "Finance",
  "Admin",
  "HRD",
  "Head Marketing & Sales",
  "Agent Coordinator",
  "Sales",
  "Head Content & Media",
  "Editor",
] as const;

/** Pengelompokan peran, dipakai untuk pewarnaan chip di UI. */
export const ROLE_GROUP: Record<Role, RoleGroup> = {
  Komisaris: "lead",
  BOD: "lead",
  "Head Operation Office": "ops",
  "Head Operation Project": "ops",
  "Project Manager": "ops",
  Supervisor: "ops",
  "Business Development": "biz",
  Arsitek: "tech",
  "Quantity Surveyor": "tech",
  Procurement: "tech",
  "Customer Care": "cc",
  "Consultant Finance": "fin",
  Finance: "fin",
  Admin: "fin",
  HRD: "hr",
  "Head Marketing & Sales": "mkt",
  "Agent Coordinator": "mkt",
  Sales: "mkt",
  "Head Content & Media": "media",
  Editor: "media",
};

export type StatusProyek = (typeof STATUS_PROYEK)[number];
export type StatusLahan = (typeof STATUS_LAHAN)[number];
export type StatusPembangunan = (typeof STATUS_PEMBANGUNAN)[number];
export type StatusJual = (typeof STATUS_JUAL)[number];
export type StatusSarpras = (typeof STATUS_SARPRAS)[number];
export type JenisSarpras = (typeof JENIS_SARPRAS)[number];
export type JenisKontrak = (typeof JENIS_KONTRAK)[number];
export type StatusVo = (typeof STATUS_VO)[number];
export type StatusTender = (typeof STATUS_TENDER)[number];
export type StatusVendor = (typeof STATUS_VENDOR)[number];
export type DokumenTender = (typeof DOKUMEN_TENDER)[number];
export type PeruntukanBiaya = (typeof PERUNTUKAN_BIAYA)[number];
export type JenisBiaya = (typeof JENIS_BIAYA)[number];
export type MetodeBayar = (typeof METODE_BAYAR)[number];
export type StatusBayar = (typeof STATUS_BAYAR)[number];
export type StatusAset = (typeof STATUS_ASET)[number];
export type KepemilikanAset = (typeof KEPEMILIKAN_ASET)[number];
export type SatuanPakai = (typeof SATUAN_PAKAI)[number];
export type Section = (typeof SECTIONS)[number];
export type Role = (typeof ROLES)[number];
export type RoleGroup =
  | "lead"
  | "ops"
  | "biz"
  | "tech"
  | "cc"
  | "fin"
  | "hr"
  | "mkt"
  | "media";

/**
 * Seluruh enum domain dalam satu peta.
 *
 * Dipakai `scripts/skema-postgres.mjs` untuk menghasilkan `CREATE TYPE`
 * Postgres. Menambah enum baru di atas tanpa mendaftarkannya di sini berarti
 * enum itu tidak ikut terbawa saat modul dipindah — ada tes yang menjaganya.
 */
export const SEMUA_ENUM = {
  StatusProyek: STATUS_PROYEK,
  StatusLahan: STATUS_LAHAN,
  StatusPembangunan: STATUS_PEMBANGUNAN,
  StatusJual: STATUS_JUAL,
  StatusSarpras: STATUS_SARPRAS,
  JenisSarpras: JENIS_SARPRAS,
  JenisKontrak: JENIS_KONTRAK,
  StatusVo: STATUS_VO,
  StatusVendor: STATUS_VENDOR,
  DokumenTender: DOKUMEN_TENDER,
  StatusTender: STATUS_TENDER,
  PeruntukanBiaya: PERUNTUKAN_BIAYA,
  JenisBiaya: JENIS_BIAYA,
  MetodeBayar: METODE_BAYAR,
  StatusBayar: STATUS_BAYAR,
  StatusAset: STATUS_ASET,
  KepemilikanAset: KEPEMILIKAN_ASET,
  SatuanPakai: SATUAN_PAKAI,
  JenisPenyesuaianAset: JENIS_PENYESUAIAN_ASET,
} as const satisfies Record<string, readonly string[]>;
