/**
 * Penyusunan angka dashboard Konstruksi.
 *
 * Bebas framework dan bebas Prisma.
 */

/**
 * Rata-rata progres yang DITIMBANG jumlah objeknya.
 *
 * Bukan rata-rata dari rata-rata: proyek berisi 51 unit tidak boleh sebobot
 * proyek berisi 12 unit. Salah pada titik ini menghasilkan angka yang tampak
 * masuk akal tapi keliru — dan tidak ada yang menyadarinya karena tidak ada
 * yang terlihat rusak di layar.
 */
export function rataTertimbang(
  baris: { rata: number; jumlah: number }[],
): number {
  const total = baris.reduce((s, p) => s + p.jumlah, 0);
  if (!total) return 0;
  return Math.round(baris.reduce((s, p) => s + p.rata * p.jumlah, 0) / total);
}

export interface KpiKonstruksi {
  jumlahProyek: number;
  totalUnit: number;
  dikerjakan: number;
  rataUnit: number;
  totalSarpras: number;
  rataSarpras: number;
}

/** Angka ringkas dashboard Konstruksi lintas proyek. */
export function kpiKonstruksi(
  proyek: {
    jumlahUnit: number;
    dikerjakan: number;
    rataUnit: number;
    jumlahSarpras: number;
    rataSarpras: number;
  }[],
): KpiKonstruksi {
  return {
    jumlahProyek: proyek.length,
    totalUnit: proyek.reduce((s, p) => s + p.jumlahUnit, 0),
    dikerjakan: proyek.reduce((s, p) => s + p.dikerjakan, 0),
    rataUnit: rataTertimbang(proyek.map((p) => ({ rata: p.rataUnit, jumlah: p.jumlahUnit }))),
    totalSarpras: proyek.reduce((s, p) => s + p.jumlahSarpras, 0),
    rataSarpras: rataTertimbang(
      proyek.map((p) => ({ rata: p.rataSarpras, jumlah: p.jumlahSarpras })),
    ),
  };
}
