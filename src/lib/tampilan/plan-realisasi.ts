/**
 * Penyusunan angka halaman Plan vs Realisasi.
 *
 * Bebas framework dan bebas Prisma. Toleransi ±3 poin persen dipakai di sini
 * dan di `statusSerapan` — nilainya sengaja satu tempat supaya keduanya tidak
 * bisa bergeser sendiri-sendiri.
 */

/** Toleransi selisih serapan terhadap progres, dalam pecahan (0,03 = 3 poin persen). */
export const TOLERANSI_SERAPAN = 0.03;

export interface BarisPenjualan {
  target: number;
  real: number;
  /** Sudah akad — baru pada titik ini penjualan diakui sebagai realisasi. */
  akad: boolean;
}

export interface BarisBiaya {
  plan: number;
  real: number;
}

export interface KpiPlanRealisasi {
  targetJual: number;
  realJual: number;
  terjual: number;
  /** Pos biaya yang serapannya mendahului progres fisik melebihi toleransi. */
  melampaui: number;
}

/**
 * Angka ringkas plan vs realisasi sebuah proyek.
 *
 * Yang mudah salah: **target** dihitung dari SELURUH baris penjualan,
 * sedangkan **realisasi** hanya dari yang sudah akad. Booking belum uang, dan
 * memasukkannya akan membuat capaian tampak lebih tinggi daripada yang benar.
 */
export function kpiPlanRealisasi(
  sales: BarisPenjualan[],
  biaya: BarisBiaya[],
  progres: number,
): KpiPlanRealisasi {
  const sudahAkad = sales.filter((x) => x.akad);
  return {
    targetJual: sales.reduce((s, x) => s + x.target, 0),
    realJual: sudahAkad.reduce((s, x) => s + x.real, 0),
    terjual: sudahAkad.length,
    melampaui: biaya.filter((c) => c.plan && c.real / c.plan > progres + TOLERANSI_SERAPAN).length,
  };
}

/**
 * Warna penanda serapan sebuah pos biaya terhadap progres fisik.
 *
 * Merah berarti uang keluar mendahului pekerjaan jadi; hijau berarti hemat.
 * Mengembalikan nama token CSS, bukan hex, supaya tema ERP bisa menimpanya.
 */
export function warnaSerapan(terpakai: number, progres: number): string {
  if (terpakai > progres + TOLERANSI_SERAPAN) return "var(--red)";
  if (terpakai > progres - TOLERANSI_SERAPAN) return "var(--amber)";
  return "var(--green)";
}
