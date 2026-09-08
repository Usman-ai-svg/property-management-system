/**
 * Penyusunan angka halaman Master Proyek. Murni — tanpa Prisma, tanpa framework.
 *
 * Isinya perakitan, bukan rumus baru: nilai tiap unit dan sarpras dihitung
 * `tampilan/proyek.ts`, di sini hanya dijumlahkan menjadi angka yang tampil di
 * kepala halaman dan baris TOTAL tiap tabel.
 */

/** Total RAB & RAP se-proyek, dipisah antara unit dan sarpras. */
export interface TotalRabRap {
  rabUnit: number;
  rapUnit: number;
  rabSarpras: number;
  rapSarpras: number;
  rab: number;
  rap: number;
}

const NOL: TotalRabRap = {
  rabUnit: 0, rapUnit: 0, rabSarpras: 0, rapSarpras: 0, rab: 0, rap: 0,
};

/**
 * Jumlahkan nilai seluruh unit dan sarpras sebuah proyek.
 *
 * `bolehHarga` sengaja jadi bagian dari fungsi ini, bukan diperiksa di halaman.
 * Peran tanpa hak atas angka harga mendapat NOL, bukan angka yang disembunyikan
 * di sisi tampilan — angka yang tidak boleh dilihat memang tidak boleh sampai
 * ke browser.
 */
export function totalRabRap(
  unit: { rab: number; rap: number }[],
  sarpras: { rab: number; rap: number }[],
  bolehHarga: boolean,
): TotalRabRap {
  if (!bolehHarga) return { ...NOL };

  const rabUnit = unit.reduce((s, u) => s + u.rab, 0);
  const rapUnit = unit.reduce((s, u) => s + u.rap, 0);
  const rabSarpras = sarpras.reduce((s, x) => s + x.rab, 0);
  const rapSarpras = sarpras.reduce((s, x) => s + x.rap, 0);

  return {
    rabUnit,
    rapUnit,
    rabSarpras,
    rapSarpras,
    rab: rabUnit + rabSarpras,
    rap: rapUnit + rapSarpras,
  };
}

/**
 * Total baris TOTAL pada tabel unit / sarpras.
 *
 * Baris yang nilainya belum terisi dihitung nol, bukan membuat totalnya
 * hilang — tabel dengan satu baris kosong tetap harus menampilkan jumlah
 * baris lainnya.
 */
export function totalKolomRabRap(
  rows: { rab?: number | null; rap?: number | null }[],
): { rab: number; rap: number } {
  return {
    rab: rows.reduce((s, r) => s + (r.rab ?? 0), 0),
    rap: rows.reduce((s, r) => s + (r.rap ?? 0), 0),
  };
}

/** Total luas tanah yang sudah bersertifikat, dari daftar legalitas proyek. */
export const luasBersertifikat = (legalitas: { luas?: number | null }[]): number =>
  legalitas.reduce((a, l) => a + (l.luas || 0), 0);
