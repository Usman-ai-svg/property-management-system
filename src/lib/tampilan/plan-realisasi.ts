/**
 * Penyusunan angka halaman Plan vs Realisasi.
 *
 * Bebas framework dan bebas Prisma. Toleransi serapannya TIDAK didefinisikan di
 * sini — ia milik `calc/keuangan.ts` dan hanya diteruskan ulang, supaya tidak
 * bisa bergeser sendiri seperti dulu.
 */

import { TOLERANSI_SERAPAN, tingkatSerapanPecahan } from "@/lib/calc/keuangan";

export { TOLERANSI_SERAPAN };

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
    melampaui: cacahMelampaui(biaya, progres),
  };
}

/**
 * Berapa pos biaya yang serapannya mendahului progres fisik melebihi toleransi.
 *
 * Berdiri sendiri karena halaman Landbank membutuhkan angka ini tanpa KPI
 * lainnya — dan dulu menghitungnya sendiri dengan cara membandingkan token
 * warna. Pos tanpa rencana (`plan` nol) tidak ikut: tidak ada yang bisa
 * dilampaui kalau tidak ada rencananya.
 */
export function cacahMelampaui(biaya: BarisBiaya[], progres: number): number {
  return biaya.filter(
    (c) => Boolean(c.plan) && tingkatSerapanPecahan(c.real / c.plan, progres) === "Over",
  ).length;
}

/** Token warna untuk tiap tingkat serapan. Presentasi, bukan aturan. */
const WARNA_SERAPAN = {
  Over: "var(--red)",
  Sesuai: "var(--amber)",
  Hemat: "var(--green)",
} as const;

/**
 * Warna penanda serapan sebuah pos biaya terhadap progres fisik.
 *
 * Merah berarti uang keluar mendahului pekerjaan jadi; hijau berarti hemat.
 * Mengembalikan nama token CSS, bukan hex, supaya tema ERP bisa menimpanya.
 *
 * Keputusannya sendiri ada di `tingkatSerapanPecahan()` — di sini tinggal
 * memetakan hasilnya ke warna. Pemisahan ini bukan kerapian: halaman Landbank
 * dulu mencacah pos boros dengan membandingkan `=== "var(--red)"`, sehingga
 * mengganti nama token warna akan membuat cacahnya jadi nol tanpa galat.
 */
export function warnaSerapan(terpakai: number, progres: number): string {
  return WARNA_SERAPAN[tingkatSerapanPecahan(terpakai, progres)];
}
