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
  /** Kategori operasional; nilai kategori = Σ (volume × harga) baris di bawahnya. */
  operasional: { rows: { volume: number; harga: number }[] }[];
}

/** Nilai satu kategori HPP: Σ volume × harga seluruh barisnya. */
export const totalKategoriHpp = (rows: { volume: number; harga: number }[]): number =>
  rows.reduce((s, r) => s + r.volume * r.harga, 0);

/** Nilai satu kategori operasional: Σ volume × harga seluruh barisnya (ala RAB). */
export const totalKategoriOps = (rows: { volume: number; harga: number }[]): number =>
  rows.reduce((s, r) => s + r.volume * r.harga, 0);

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

// ===========================================================================
// CASHFLOW — pengelompokan Tahun → Kuartal
// ===========================================================================

export interface BarisCashflow {
  id?: string;
  /** "YYYY-MM". */
  periode: string;
  masuk: number;
  keluar: number;
}

export type BulanCashflow<B> = B & { net: number; kumulatif: number };

export interface KuartalCashflow<B> {
  tahun: number;
  /** 1..4. */
  kuartal: number;
  bulan: BulanCashflow<B>[];
  masuk: number;
  keluar: number;
  net: number;
}

export interface TahunCashflow<B> {
  tahun: number;
  kuartal: KuartalCashflow<B>[];
  masuk: number;
  keluar: number;
  net: number;
  /** Kumulatif net dari awal seluruh data sampai akhir tahun ini. */
  kumulatifAkhir: number;
}

/** Kuartal (1..4) dari periode "YYYY-MM". Periode tak sah jatuh ke kuartal 1. */
export function kuartalPeriode(periode: string): { tahun: number; kuartal: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return { tahun: 0, kuartal: 1 };
  return { tahun: Number(m[1]), kuartal: Math.ceil(Number(m[2]) / 3) };
}

/**
 * Kelompokkan cashflow bulanan menjadi Tahun → Kuartal, dengan subtotal per
 * kuartal & per tahun serta kumulatif net yang berjalan lintas seluruh periode.
 *
 * Barisnya diurutkan kronologis lebih dulu supaya kumulatif tidak bergantung
 * pada urutan masukan — periode "YYYY-MM" membuat urut string = urut waktu.
 */
export function kelompokKuartal<B extends BarisCashflow>(cashflow: B[]): TahunCashflow<B>[] {
  const urut = [...cashflow].sort((a, b) => a.periode.localeCompare(b.periode));

  let kum = 0;
  const tahunan: TahunCashflow<B>[] = [];

  for (const c of urut) {
    const { tahun, kuartal } = kuartalPeriode(c.periode);
    kum += c.masuk - c.keluar;
    const bulan: BulanCashflow<B> = { ...c, net: c.masuk - c.keluar, kumulatif: kum };

    let t = tahunan.find((x) => x.tahun === tahun);
    if (!t) {
      t = { tahun, kuartal: [], masuk: 0, keluar: 0, net: 0, kumulatifAkhir: 0 };
      tahunan.push(t);
    }
    let q = t.kuartal.find((x) => x.kuartal === kuartal);
    if (!q) {
      q = { tahun, kuartal, bulan: [], masuk: 0, keluar: 0, net: 0 };
      t.kuartal.push(q);
    }

    q.bulan.push(bulan);
    q.masuk += c.masuk; q.keluar += c.keluar; q.net += bulan.net;
    t.masuk += c.masuk; t.keluar += c.keluar; t.net += bulan.net;
    t.kumulatifAkhir = kum;
  }

  return tahunan;
}

/** Label kuartal Indonesia: "Kuartal 3 · 2025 (Jul–Sep)". */
export function labelKuartal(tahun: number, kuartal: number): string {
  const rentang = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Okt–Des"][kuartal - 1] ?? "";
  return `Kuartal ${kuartal} · ${tahun} (${rentang})`;
}
