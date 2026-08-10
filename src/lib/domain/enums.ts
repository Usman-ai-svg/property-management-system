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

/** Jenis hak atas tanah pada legalitas proyek. */
export const JENIS_HAK_ATAS_TANAH = [
  "Hak Milik (HM)",
  "Hak Guna Usaha (HGU)",
  "Hak Guna Bangunan (HGB)",
  "Hak Pakai",
  "Hak Pengelolaan (HPL)",
  "Hak Tanggungan",
] as const;

export const JENIS_KONTRAK = ["Unit", "Sarpras"] as const;

export const STATUS_VO = ["Diajukan", "Disetujui", "Ditolak"] as const;

export const STATUS_VENDOR = ["Aktif", "Nonaktif"] as const;

/** Kategori pemasok — menentukan jenis harga dasar yang lazim ditawarkannya. */
export const KATEGORI_PEMASOK = ["Material", "Tenaga Kerja", "Alat"] as const;

/** Status pemasok. Nilainya sama dengan vendor, tapi entitasnya terpisah. */
export const STATUS_PEMASOK = ["Aktif", "Nonaktif"] as const;

/**
 * Alur pembelian material (PO → penerimaan barang).
 *   Draft    — PO diterbitkan, barang belum diterima; belum boleh dibayar.
 *   Diterima — barang diterima; jadi hutang berjalan & boleh dibayar bertermin.
 * "Lunas" tidak disimpan — ia turunan dari Σ pembayaran ≥ total nota.
 */
export const STATUS_PEMBELIAN = ["Draft", "Diterima"] as const;

/**
 * Kelompok harga dasar pada AHSP: upah tenaga kerja (ΣA), bahan (ΣB), alat (ΣC).
 * Menentukan komponen masuk ke kelompok mana saat menghitung harga satuan.
 */
export const KATEGORI_HARGA_DASAR = ["UPAH", "BAHAN", "ALAT"] as const;

/**
 * Status sebuah RAB Estimasi (alur persetujuan).
 *   Draft    — sedang disusun, bisa diubah.
 *   Diajukan — menunggu persetujuan, terkunci dari perubahan.
 *   Ditolak  — dikembalikan dengan catatan; bisa diubah lalu diajukan ulang.
 *   Final    — disetujui & terkunci; baru boleh ditenderkan.
 */
export const STATUS_RAB_ESTIMASI = ["Draft", "Diajukan", "Ditolak", "Final"] as const;

// Peruntukan = SASARAN biaya (ke mana dibebankan), bukan jenis biaya. "Material"
// sengaja TIDAK di sini — itu jenis biaya (lihat JENIS_BIAYA di bawah).
export const PERUNTUKAN_BIAYA = [
  "Unit (rumah dijual)",
  "Prasarana & Sarana",
  "Perijinan & Ormas",
  "Pengolahan Lahan",
] as const;

/**
 * Jenis sasaran pembebanan yang absah untuk tiap peruntukan.
 *
 * Ini yang mengikat pilihan "Dibebankan ke": peruntukan unit hanya boleh ke
 * unit, prasarana hanya ke sarpras, sisanya murni level proyek (tak ada objek).
 * Dipakai bersama oleh form (menyaring pilihan) dan server (memvalidasi) supaya
 * penyaringan UI bukan sekadar kosmetik.
 */
export const SASARAN_PERUNTUKAN: Record<
  (typeof PERUNTUKAN_BIAYA)[number],
  { unit: boolean; sarpras: boolean }
> = {
  "Unit (rumah dijual)": { unit: true, sarpras: false },
  "Prasarana & Sarana": { unit: false, sarpras: true },
  "Perijinan & Ormas": { unit: false, sarpras: false },
  "Pengolahan Lahan": { unit: false, sarpras: false },
};

/**
 * Pos HPP yang dibiayai tiap peruntukan. Tidak diminta ke pengguna melainkan
 * diturunkan dari peruntukannya, supaya kolom di laporan selalu sinkron dengan
 * pembebanan. Dipakai bersama oleh Catat/Ubah Pengeluaran, Bayar PO, pembayaran
 * kontrak vendor, dan penyemaian — satu sumber kebenaran menghindari data
 * `posHpp` yang menyimpang antar-jalur.
 */
export const POS_HPP: Record<(typeof PERUNTUKAN_BIAYA)[number], string> = {
  "Unit (rumah dijual)": "E — Konstruksi",
  "Prasarana & Sarana": "D — Prasarana",
  "Perijinan & Ormas": "C — Perijinan",
  "Pengolahan Lahan": "B — Pengolahan Lahan",
};

/**
 * Jenis biaya sebuah pengeluaran.
 *
 * "Kontraktor" berbeda kodrat dari sisanya: ia BUKAN rincian biaya, melainkan
 * penanda paket menyeluruh (upah + material) yang tak terurai — dipakai saat
 * satu scope diborongkan penuh ke kontraktor dan perusahaan memang tidak
 * melihat rincian pengeluarannya. Karena itu "Kontraktor" hanya sah lahir dari
 * sebuah SPK (kontrak vendor), tak pernah dari pengeluaran swakelola. Dua
 * himpunan bagian di bawah menegakkan pemisahan itu — dipakai bersama oleh form
 * (menyaring pilihan) dan server (memvalidasi lewat `pilihan`).
 *
 * Satu proyek bisa mencampur keduanya: mis. pos satpam yang pek. sipilnya
 * diborongkan (SPK "Kontraktor") sementara pek. pagarnya dikerjakan sendiri
 * lewat subkon (pengeluaran/SPK "Subkon") — dua transaksi terpisah pada sarpras
 * yang sama.
 */
export const JENIS_BIAYA = [
  "Kontraktor",
  "Upah Borongan",
  "Upah Harian",
  "Material",
  "Subkon",
  "Lain-lain proyek",
] as const;

// Dua himpunan bagian di bawah SENGAJA diturunkan dari JENIS_BIAYA (bukan
// daftar `as const` tersendiri): selain anti-hanyut bila daftar induk berubah,
// bentuk ini juga tidak dianggap "enum kolom baru" oleh penjaga SEMUA_ENUM —
// keduanya memang bukan enum database, hanya penyaring pilihan.

/** Set anggota outsourced — hanya di sinilah "Kontraktor" boleh dipilih. */
const OUTSOURCED = new Set<JenisBiaya>(["Kontraktor", "Upah Borongan", "Subkon"]);

/**
 * Jenis biaya yang sah untuk SPK/kontrak vendor — pekerjaan yang di-outsource.
 */
export const JENIS_BIAYA_KONTRAK = JENIS_BIAYA.filter((j) => OUTSOURCED.has(j));

/**
 * Jenis biaya yang sah untuk pengeluaran swakelola (Pengeluaran Lain) — seluruh
 * daftar KECUALI "Kontraktor", yang hanya boleh datang dari SPK.
 */
export const JENIS_BIAYA_SWAKELOLA = JENIS_BIAYA.filter(
  (j): j is Exclude<JenisBiaya, "Kontraktor"> => j !== "Kontraktor",
);

/**
 * Cara sebuah pengeluaran dibayar.
 *
 * "Hutang" berbeda kodrat dari sisanya: tiga yang lain adalah kas benar-benar
 * keluar, sedangkan "Hutang" berarti biaya sudah timbul tapi kas BELUM keluar —
 * ia menandai pengeluaran sebagai utang berjalan yang dilunasi bertahap lewat
 * cicilan (lihat model HutangCicilan). Karena itu "Hutang" hanya sah pada
 * pencatatan pengeluaran manual, tak pernah pada pembayaran tunai kontrak/PO/
 * cicilan itu sendiri — subset METODE_TUNAI di bawah menegakkan pemisahan itu.
 */
export const METODE_BAYAR = ["Transfer", "Petty Cash", "Tunai langsung", "Hutang"] as const;

/**
 * Metode kas — seluruh METODE_BAYAR KECUALI "Hutang". Dipakai pada konteks di
 * mana uang benar-benar keluar: pembayaran termin PO, pembayaran kontrak vendor,
 * dan pelunasan cicilan hutang. Diturunkan dari daftar induk agar tak hanyut.
 */
export const METODE_TUNAI = METODE_BAYAR.filter(
  (m): m is Exclude<MetodeBayar, "Hutang"> => m !== "Hutang",
);

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
  "setujuiRab",
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
  setujuiRab: "Setujui RAB Estimasi",
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
  "Social Media",
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
  "Social Media": "media",
};

/**
 * Struktur organisasi: divisi beserta peran anggotanya, berurut sesuai bagan.
 *
 * Dipakai untuk mengelompokkan baris pada Admin → Kelola Hak Akses dan Kelola
 * User. Peran pertama tiap divisi adalah "kepala"-nya (mis. Head Operation
 * Project); sisanya anggota di bawahnya. Sebagian nama divisi memang sama
 * dengan nama peran kepalanya — kepala tetap punya baris hak aksesnya sendiri.
 *
 * "Social Media" dicantumkan sesuai bagan meski belum ada sebagai peran;
 * barisnya muncul otomatis di posisi ini begitu peran tersebut dibuat.
 */
export const DIVISI: { nama: string; peran: string[] }[] = [
  { nama: "Administrator Sistem", peran: ["Administrator Sistem"] },
  { nama: "Komisaris / BOD", peran: ["Komisaris", "BOD"] },
  { nama: "Project Manager", peran: ["Project Manager", "Supervisor"] },
  {
    nama: "Head Operation Project",
    peran: [
      "Head Operation Project", "Business Development", "Arsitek",
      "Quantity Surveyor", "Procurement", "Customer Care",
    ],
  },
  {
    nama: "Head Operation Office",
    peran: ["Head Operation Office", "Consultant Finance", "Finance", "Admin", "HRD"],
  },
  { nama: "Head Marketing & Sales", peran: ["Head Marketing & Sales", "Agent Coordinator", "Sales"] },
  { nama: "Head Content & Media", peran: ["Head Content & Media", "Editor", "Social Media"] },
];

/** Indeks divisi yang memuat sebuah peran, atau -1 bila tak ada. */
export function divisiPeran(nama: string): number {
  return DIVISI.findIndex((d) => d.peran.includes(nama));
}

export type StatusProyek = (typeof STATUS_PROYEK)[number];
export type StatusLahan = (typeof STATUS_LAHAN)[number];
export type StatusPembangunan = (typeof STATUS_PEMBANGUNAN)[number];
export type StatusJual = (typeof STATUS_JUAL)[number];
export type StatusSarpras = (typeof STATUS_SARPRAS)[number];
export type JenisSarpras = (typeof JENIS_SARPRAS)[number];
export type JenisHakAtasTanah = (typeof JENIS_HAK_ATAS_TANAH)[number];
export type JenisKontrak = (typeof JENIS_KONTRAK)[number];
export type StatusVo = (typeof STATUS_VO)[number];
export type StatusVendor = (typeof STATUS_VENDOR)[number];
export type KategoriPemasok = (typeof KATEGORI_PEMASOK)[number];
export type StatusPemasok = (typeof STATUS_PEMASOK)[number];
export type StatusPembelian = (typeof STATUS_PEMBELIAN)[number];
export type KategoriHargaDasar = (typeof KATEGORI_HARGA_DASAR)[number];
export type StatusRabEstimasi = (typeof STATUS_RAB_ESTIMASI)[number];
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
  KategoriPemasok: KATEGORI_PEMASOK,
  StatusPemasok: STATUS_PEMASOK,
  StatusPembelian: STATUS_PEMBELIAN,
  KategoriHargaDasar: KATEGORI_HARGA_DASAR,
  StatusRabEstimasi: STATUS_RAB_ESTIMASI,
  PeruntukanBiaya: PERUNTUKAN_BIAYA,
  JenisBiaya: JENIS_BIAYA,
  MetodeBayar: METODE_BAYAR,
  StatusBayar: STATUS_BAYAR,
  StatusAset: STATUS_ASET,
  KepemilikanAset: KEPEMILIKAN_ASET,
  SatuanPakai: SATUAN_PAKAI,
  JenisPenyesuaianAset: JENIS_PENYESUAIAN_ASET,
  JenisHakAtasTanah: JENIS_HAK_ATAS_TANAH,
} as const satisfies Record<string, readonly string[]>;
