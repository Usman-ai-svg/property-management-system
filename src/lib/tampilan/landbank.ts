/**
 * Penyusunan angka halaman Landbank.
 *
 * Bebas framework dan bebas Prisma. Perhatikan bahwa kolom biaya perolehan
 * bertipe opsional: peran tanpa izin "hargaRabRap" memang tidak menerima
 * kolom itu dari database, jadi di sini ia dibaca sebagai mungkin-tidak-ada,
 * bukan dianggap nol tanpa alasan.
 */

export interface LuasLahan {
  luasKavlingEfektif: number;
  luasSarana: number;
  luasPrasarana: number;
  luasRth: number;
}

export interface BiayaLahan {
  hargaPerM2?: number;
  biayaPembelian?: number;
  biayaNotaris?: number;
  biayaBalikNama?: number;
  biayaLegalLain?: number;
}

export interface RencanaBisnis {
  /** Satu entri per unit; total omset = Σ harga dasar (non-PPN). */
  omzet: { hargaDasar: number }[];
  /** Kategori HPP; nilai kategori = Σ (volume × harga) baris di bawahnya. */
  hpp: { rows: { volume: number; harga: number }[] }[];
  /** Kategori operasional; nilai kategori = Σ nilai baris di bawahnya. */
  operasional: { rows: { nilai: number }[] }[];
}

/** Nilai satu kategori HPP: Σ volume × harga seluruh barisnya. */
export const totalKategoriHpp = (rows: { volume: number; harga: number }[]): number =>
  rows.reduce((s, r) => s + r.volume * r.harga, 0);

/** Nilai satu kategori operasional: Σ nilai seluruh barisnya. */
export const totalKategoriOps = (rows: { nilai: number }[]): number =>
  rows.reduce((s, r) => s + r.nilai, 0);

/** Luas keseluruhan sebuah proyek: kavling + sarana + prasarana + RTH. */
export const luasTotal = (l: LuasLahan): number =>
  l.luasKavlingEfektif + l.luasSarana + l.luasPrasarana + l.luasRth;

/**
 * Total biaya perolehan lahan: harga beli ditambah seluruh biaya legal.
 *
 * Dikembalikan 0 bila peran tidak berhak, karena kolomnya memang tidak
 * di-SELECT — bukan karena biayanya nol.
 */
export const biayaPerolehan = (b: BiayaLahan): number =>
  (b.biayaPembelian ?? 0) + (b.biayaNotaris ?? 0) + (b.biayaBalikNama ?? 0) + (b.biayaLegalLain ?? 0);

export interface RingkasRencana {
  omzet: number;
  hpp: number;
  ops: number;
  laba: number;
  margin: number;
}

/**
 * Ringkas business plan sebuah proyek.
 *
 * Laba bersih = omzet − HPP − operasional. Margin dihitung terhadap omzet,
 * dan bernilai 0 bila omzetnya nol supaya tidak menghasilkan Infinity.
 */
export function ringkasRencana(bp: RencanaBisnis | undefined): RingkasRencana {
  const omzet = bp ? bp.omzet.reduce((s, o) => s + o.hargaDasar, 0) : 0;
  const hpp = bp ? bp.hpp.reduce((s, h) => s + totalKategoriHpp(h.rows), 0) : 0;
  const ops = bp ? bp.operasional.reduce((s, o) => s + totalKategoriOps(o.rows), 0) : 0;
  const laba = omzet - hpp - ops;
  return { omzet, hpp, ops, laba, margin: omzet ? laba / omzet : 0 };
}

export type BarisLandbank<P> = P & RingkasRencana & {
  luasTotal: number;
  rasioEfektif: number;
  hargaPerM2: number;
  perolehan: number;
  punyaBp: boolean;
};

/** Satu baris tabel portofolio landbank: luas, biaya, dan rencana bisnisnya. */
export function susunBarisLandbank<P extends LuasLahan & BiayaLahan & { id: string }>(
  proyek: P[],
  rencana: (RencanaBisnis & { projectId: string })[],
): BarisLandbank<P>[] {
  const perProyek = new Map(rencana.map((r) => [r.projectId, r]));

  return proyek.map((p) => {
    const total = luasTotal(p);
    const bp = perProyek.get(p.id);
    return {
      ...p,
      luasTotal: total,
      rasioEfektif: total ? p.luasKavlingEfektif / total : 0,
      hargaPerM2: p.hargaPerM2 ?? 0,
      perolehan: biayaPerolehan(p),
      punyaBp: !!bp,
      ...ringkasRencana(bp),
    };
  });
}

/**
 * Rata-rata rasio kavling efektif seluruh proyek.
 *
 * Rata-rata dari rasio, bukan rasio dari total — pertanyaannya "seberapa
 * efisien tiap proyek dirancang", bukan "berapa persen seluruh lahan kami".
 */
export const rataRasioEfektif = (baris: { rasioEfektif: number }[]): number =>
  baris.length ? baris.reduce((s, p) => s + p.rasioEfektif, 0) / baris.length : 0;
