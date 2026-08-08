/**
 * Template BOQ dan RAP.
 *
 * PENTING — template ini HANYA dipakai saat sebuah unit pertama kali dibuat,
 * untuk membangkitkan baris-baris yang lalu DISIMPAN ke `unit_boq_items` /
 * `unit_rap_items`. Setelah tersimpan, unit tidak pernah lagi membaca template.
 *
 * Konsekuensinya: mengubah harga di sini hanya memengaruhi unit yang dibuat
 * SETELAH perubahan. Unit yang sudah berjalan atau sudah selesai tidak bergeser.
 * Inilah perbaikan atas prototipe, yang menghitung ulang RAB dari template
 * global setiap kali dirender.
 *
 * Bebas dependensi framework.
 */

export interface BaseTemplateBoq {
  grup: string;
  uraian: string;
  satuan: string;
  /**
   * Volume per m² luas bangunan. Nilai 0 berarti lump sum — volumenya selalu 1,
   * tidak diskalakan terhadap luas.
   */
  perM2: number;
  hargaSatuan: number;
  spesifikasi: string;
}

export const TEMPLATE_BOQ: BaseTemplateBoq[] = [
  { grup: "Persiapan", uraian: "Pek. Persiapan & Bouwplank", satuan: "ls", perM2: 0, hargaSatuan: 3_500_000, spesifikasi: "Bouwplank kaso 5/7 + papan, pembersihan lahan, direksi kit" },
  { grup: "Struktur", uraian: "Pek. Pondasi & Sloof", satuan: "m2", perM2: 1.0, hargaSatuan: 620_000, spesifikasi: "Pondasi batu kali 1:4, sloof 15/20 besi D12, beton K-225" },
  { grup: "Struktur", uraian: "Pek. Kolom, Balok & Plat", satuan: "m2", perM2: 1.0, hargaSatuan: 780_000, spesifikasi: "Kolom 15/15 besi D12, balok 15/25, plat t-10 cm, beton K-225" },
  { grup: "Arsitektur", uraian: "Pek. Dinding & Plester", satuan: "m2", perM2: 2.8, hargaSatuan: 165_000, spesifikasi: "Bata ringan hebel 10 cm, lem hebel, plester + aci semen" },
  { grup: "Arsitektur", uraian: "Pek. Atap & Rangka", satuan: "m2", perM2: 1.15, hargaSatuan: 385_000, spesifikasi: "Baja ringan 0,75 mm, reng baja, penutup metal pasir, alu foil" },
  { grup: "Arsitektur", uraian: "Pek. Lantai & Keramik", satuan: "m2", perM2: 1.0, hargaSatuan: 285_000, spesifikasi: "Keramik 60x60 Valentino gress cream ivory, KM 60x60 anti slip" },
  { grup: "Arsitektur", uraian: "Pek. Plafon", satuan: "m2", perM2: 0.95, hargaSatuan: 145_000, spesifikasi: "Gypsum 9 mm, rangka hollow 4x4 & 2x4, kompon + kasa" },
  { grup: "Arsitektur", uraian: "Pek. Pengecatan", satuan: "m2", perM2: 3.2, hargaSatuan: 42_000, spesifikasi: "Interior Mowilex silky white, eksterior Mowilex weathercoat, sealer Avitex" },
  { grup: "Kusen", uraian: "Pas. Kusen, Pintu & Jendela", satuan: "ls", perM2: 0, hargaSatuan: 18_500_000, spesifikasi: "Kusen aluminium powder coating, pintu utama panel, jendela kaca 5 mm" },
  { grup: "MEP", uraian: "Instalasi Listrik", satuan: "titik", perM2: 0.45, hargaSatuan: 285_000, spesifikasi: "Kabel NYM 3x2,5 mm, saklar & stopkontak Panasonic, downlight LED Philips" },
  { grup: "MEP", uraian: "Instalasi Sanitair & Plumbing", satuan: "ls", perM2: 0, hargaSatuan: 12_000_000, spesifikasi: "Pipa Rucika AW, closet jongkok, kran, floordrain, septictank" },
  { grup: "Finishing", uraian: "Finishing & Pembersihan", satuan: "ls", perM2: 0, hargaSatuan: 4_500_000, spesifikasi: "Perapian akhir, pembersihan area, serah terima" },
];

export interface BaseTemplateRapItem {
  nama: string;
  satuan: string;
  /** Volume per m² luas bangunan, sebelum kalibrasi. */
  perM2: number;
  hargaSatuan: number;
  keterangan?: string;
}

export interface BaseTemplateRapGroup {
  nama: string;
  items: BaseTemplateRapItem[];
}

export const TEMPLATE_RAP: BaseTemplateRapGroup[] = [
  {
    nama: "Material Alam",
    items: [
      { nama: "Pasir", satuan: "colt", perM2: 0.04, hargaSatuan: 400_000 },
      { nama: "Split", satuan: "colt", perM2: 0.02, hargaSatuan: 500_000 },
      { nama: "Bata ringan (hebel 10)", satuan: "m3", perM2: 0.05, hargaSatuan: 550_000 },
      { nama: "Semen", satuan: "sak", perM2: 0.42, hargaSatuan: 46_000 },
      { nama: "Lem hebel", satuan: "sak", perM2: 0.06, hargaSatuan: 65_000 },
      { nama: "Semen acian", satuan: "sak", perM2: 0.12, hargaSatuan: 75_000 },
    ],
  },
  {
    nama: "Bekisting",
    items: [
      { nama: "Kaso 4/6", satuan: "ikat", perM2: 0.04, hargaSatuan: 175_000 },
      { nama: "Triplek 9 mm", satuan: "lbr", perM2: 0.12, hargaSatuan: 105_000 },
      { nama: "Paku 5, 7, 10", satuan: "dus", perM2: 0.02, hargaSatuan: 385_000 },
    ],
  },
  {
    nama: "Material Besi",
    items: [
      { nama: "Besi 6 mm - full", satuan: "btg", perM2: 0.82, hargaSatuan: 35_000 },
      { nama: "Besi 8 mm - full", satuan: "btg", perM2: 0.04, hargaSatuan: 50_000 },
      { nama: "Besi 12 mm - full", satuan: "btg", perM2: 0.12, hargaSatuan: 105_000 },
      { nama: "Kawat beton @25kg", satuan: "roll", perM2: 0.01, hargaSatuan: 350_000 },
      { nama: "Kawat ayam", satuan: "roll", perM2: 0.02, hargaSatuan: 60_000 },
    ],
  },
  {
    nama: "Finishing Lantai",
    items: [
      { nama: "Keramik 60x60", satuan: "dus", perM2: 0.24, hargaSatuan: 142_500, keterangan: "Valentino gress cream ivory" },
      { nama: "Keramik 60x60 kamar mandi", satuan: "dus", perM2: 0.02, hargaSatuan: 160_000, keterangan: "Anti slip" },
    ],
  },
  {
    nama: "Cat",
    items: [
      { nama: "Sealer (Avitex)", satuan: "peil", perM2: 0.02, hargaSatuan: 650_000 },
      { nama: "Cat interior (Mowilex silky white)", satuan: "gln", perM2: 0.04, hargaSatuan: 500_000 },
      { nama: "Cat exterior (Mowilex weathercoat)", satuan: "gln", perM2: 0.02, hargaSatuan: 1_050_000 },
      { nama: "Cat aquaproof", satuan: "peil", perM2: 0.02, hargaSatuan: 850_000 },
      { nama: "Plamir", satuan: "gln", perM2: 0.02, hargaSatuan: 75_000 },
      { nama: "Cat plafon (Avitex interior)", satuan: "gln", perM2: 0.02, hargaSatuan: 350_000 },
    ],
  },
  {
    nama: "Plumbing",
    items: [
      { nama: 'Pipa 3" D ex Rucika', satuan: "btg", perM2: 0.06, hargaSatuan: 110_000 },
      { nama: 'Pipa 1" AW', satuan: "btg", perM2: 0.1, hargaSatuan: 47_000 },
      { nama: "Closet jongkok", satuan: "bh", perM2: 0.02, hargaSatuan: 350_000 },
      { nama: "Kran", satuan: "bh", perM2: 0.02, hargaSatuan: 80_000 },
      { nama: "Floordrain", satuan: "bh", perM2: 0.04, hargaSatuan: 90_000 },
      { nama: "Aksesoris pipa", satuan: "ls", perM2: 0.02, hargaSatuan: 500_000 },
    ],
  },
  {
    nama: "Alat Listrik",
    items: [
      { nama: "Pipa listrik", satuan: "btg", perM2: 0.2, hargaSatuan: 18_000 },
      { nama: "Kabel NYM 3x2,5", satuan: "roll", perM2: 0.012, hargaSatuan: 1_095_000 },
      { nama: "Saklar Panasonic", satuan: "bh", perM2: 0.04, hargaSatuan: 25_000 },
      { nama: "Stopkontak Panasonic", satuan: "bh", perM2: 0.1, hargaSatuan: 25_000 },
      { nama: 'Downlight 4"', satuan: "bh", perM2: 0.04, hargaSatuan: 70_000 },
      { nama: "Lampu LED Philips 6 watt", satuan: "bh", perM2: 0.04, hargaSatuan: 30_000 },
    ],
  },
  {
    nama: "Plafon",
    items: [
      { nama: "Gypsum", satuan: "lembar", perM2: 0.08, hargaSatuan: 68_000 },
      { nama: "Hollow 4x4", satuan: "btg", perM2: 0.3, hargaSatuan: 32_500 },
      { nama: "Hollow 2x4", satuan: "btg", perM2: 0.2, hargaSatuan: 27_000 },
      { nama: "Kompon", satuan: "sak", perM2: 0.04, hargaSatuan: 65_000 },
      { nama: "Skrup gypsum", satuan: "dus", perM2: 0.01, hargaSatuan: 100_000 },
    ],
  },
  {
    nama: "Atap",
    items: [
      { nama: "Baja ringan 0,75", satuan: "btg", perM2: 0.04, hargaSatuan: 95_000 },
      { nama: "Reng baja", satuan: "btg", perM2: 0.045, hargaSatuan: 50_000 },
      { nama: "Alumunium foil", satuan: "roll", perM2: 0.01, hargaSatuan: 400_000 },
      { nama: "Penutup atap metal pasir", satuan: "lbr", perM2: 0.1, hargaSatuan: 45_000 },
    ],
  },
  {
    nama: "Material Lain",
    items: [
      { nama: "Pintu & jendela aluminium", satuan: "unit", perM2: 0.02, hargaSatuan: 3_500_000 },
      { nama: "Sika top 107", satuan: "set", perM2: 0.02, hargaSatuan: 400_000 },
      { nama: "Railing tangga", satuan: "m", perM2: 0.024, hargaSatuan: 775_000 },
      { nama: "Kanopi baja ringan", satuan: "btg", perM2: 0.04, hargaSatuan: 95_000 },
    ],
  },
];

/**
 * Kelompok pekerjaan RAB — mengikuti struktur REKAP/RAB pada berkas AHSP
 * perusahaan (NL_DRAF_RAB_RAP.xlsx). Dipakai untuk:
 *   - mengelompokkan baris pada tabel Analisa AHSP dan rincian RAB Estimasi,
 *   - urutan tampilnya (bukan alfabetis, tapi urut pelaksanaan),
 *   - pilihan `kelompok` saat menyusun analisa.
 *
 * Bukan enum ketat di database (kolom `kelompok` tetap String bebas) supaya
 * proyek dengan lingkup khusus masih bisa menambah kelompok sendiri; daftar ini
 * hanya kanon standar + urutannya.
 */
export const KELOMPOK_AHSP = [
  "Pekerjaan Persiapan",
  "Pekerjaan Tanah",
  "Pekerjaan Struktur",
  "Pekerjaan Arsitektur",
  "Pekerjaan MEP",
  "Pekerjaan Lain-lain",
] as const;

export type KelompokAhsp = (typeof KELOMPOK_AHSP)[number];

/** RAP ditargetkan 88% dari RAB. */
export const RASIO_RAP_TERHADAP_RAB = 0.88;

/** Dari RAP, 65% dialokasikan ke material; sisanya upah tenaga kerja. */
export const PORSI_MATERIAL_DALAM_RAP = 0.65;
