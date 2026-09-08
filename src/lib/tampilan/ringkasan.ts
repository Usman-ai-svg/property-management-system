/**
 * Angka kartu Ringkasan (dashboard). Murni — tanpa Prisma, tanpa framework.
 */

/** Proyek yang punya angka progres, sebagaimana dipakai kartu ringkasan. */
export interface ProyekRingkas {
  status: string;
  unitProgress: number;
  rataProgress: number;
}

/** Status proyek yang dianggap sedang berjalan di lapangan. */
export const STATUS_BERJALAN = "Dalam Pembangunan";

/**
 * Proyek yang sedang dibangun, beserta yang progresnya tertinggi.
 *
 * `tertinggi` bernilai undefined bila tidak ada proyek berjalan sama sekali —
 * bukan proyek pertama dari daftar kosong. Pengurutan tidak mengubah daftar
 * asalnya; menyalin dulu, karena `sort` bekerja di tempat dan daftar yang sama
 * dipakai bagian lain halaman.
 */
export function proyekBerjalan<T extends ProyekRingkas>(
  proyek: T[],
): { aktif: T[]; tertinggi: T | undefined } {
  const aktif = proyek.filter((p) => p.status === STATUS_BERJALAN);
  const tertinggi = [...aktif].sort((a, b) => b.rataProgress - a.rataProgress)[0];
  return { aktif, tertinggi };
}

/** Jumlah progres unit seluruh proyek — dasar kartu progres di dashboard. */
export const totalProgresUnit = (proyek: { unitProgress: number }[]): number =>
  proyek.reduce((s, p) => s + p.unitProgress, 0);
