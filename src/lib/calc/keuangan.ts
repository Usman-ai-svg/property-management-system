/**
 * Perhitungan keuangan: serapan anggaran, kontrak, dan plan vs realisasi.
 * Murni — tanpa I/O, tanpa framework.
 */

export type StatusSerapan = "Hemat" | "Sesuai" | "Over";

/**
 * Bandingkan serapan anggaran terhadap progres fisik.
 *
 * Serapan 60% pada progres 60% berarti "Sesuai". Serapan jauh mendahului
 * progres berarti "Over" — uang keluar lebih cepat daripada pekerjaan jadi.
 * Toleransi ±3 poin persen supaya tidak berkedip karena pembulatan.
 */
export function statusSerapan(terpakai: number, progres: number, toleransi = 0.03): StatusSerapan {
  const acuan = progres / 100;
  if (terpakai > acuan + toleransi) return "Over";
  if (terpakai > acuan - toleransi) return "Sesuai";
  return "Hemat";
}

export interface VariationOrderLike {
  nominal: number;
  status: string;
}

export interface KontrakLike {
  nominal: number;
  retensiPct: number;
  pembayaran: { nominal: number }[];
  variationOrders: VariationOrderLike[];
}

/** Total yang sudah dibayarkan pada sebuah kontrak. */
export const totalTerbayar = (k: Pick<KontrakLike, "pembayaran">): number =>
  k.pembayaran.reduce((s, p) => s + p.nominal, 0);

/** Total VO yang sudah disetujui (boleh negatif untuk pekerjaan kurang). */
export const totalVoDisetujui = (vo: VariationOrderLike[]): number =>
  vo.filter((v) => v.status === "Disetujui").reduce((s, v) => s + v.nominal, 0);

/** Total VO yang masih diajukan / belum disetujui. */
export const totalVoDiajukan = (vo: VariationOrderLike[]): number =>
  vo.filter((v) => v.status !== "Disetujui").reduce((s, v) => s + v.nominal, 0);

/** Ringkasan posisi keuangan sebuah kontrak. */
export function ringkasKontrak(k: KontrakLike) {
  const voDisetujui = totalVoDisetujui(k.variationOrders);
  const nilaiEfektif = k.nominal + voDisetujui;
  const terbayar = totalTerbayar(k);
  const retensi = (nilaiEfektif * k.retensiPct) / 100;

  return {
    nilaiAwal: k.nominal,
    voDisetujui,
    voDiajukan: totalVoDiajukan(k.variationOrders),
    nilaiEfektif,
    terbayar,
    sisa: nilaiEfektif - terbayar,
    retensi,
    /** Sisa yang bisa ditagih sekarang, retensi masih ditahan. */
    sisaTanpaRetensi: nilaiEfektif - retensi - terbayar,
    persenTerbayar: nilaiEfektif ? terbayar / nilaiEfektif : 0,
  };
}

/**
 * Bagi satu nominal ke beberapa penerima dalam rupiah bulat.
 *
 * Dipakai untuk mengisi awal pembebanan satu pembayaran ke beberapa unit.
 * Hasilnya boleh disunting per baris setelahnya — bagi rata hanyalah titik
 * awal, bukan aturan. Sisa pembagian ditaruh pada baris pertama, bukan
 * dibuang, supaya jumlah seluruh pecahannya **persis** sama dengan nominal
 * aslinya. Selisih satu rupiah pada laporan keuangan adalah selisih yang
 * harus dicari orang, jadi tidak boleh ada.
 */
export function bagiRata(nominal: number, banyak: number): number[] {
  if (banyak <= 0) return [];
  if (banyak === 1) return [nominal];

  const dasar = Math.floor(nominal / banyak);
  const bagian = Array<number>(banyak).fill(dasar);
  bagian[0] += nominal - dasar * banyak;
  return bagian;
}

export interface BarisAlokasi {
  unitId?: string | null;
  infrastructureId?: string | null;
  nominal: number;
}

/**
 * Periksa apakah pembebanan sebuah pembayaran sudah seimbang.
 *
 * Satu baris pengeluaran adalah satu baris mutasi bank; alokasinya adalah
 * pembagian ke unit atau sarpras. Jumlah alokasi harus sama **persis** dengan
 * totalnya — bukan sekadar mendekati — supaya angka per unit selalu bisa
 * dijumlahkan balik ke angka yang keluar dari bank. Selisih satu rupiah pada
 * laporan keuangan adalah selisih yang harus dicari orang.
 *
 * Mengembalikan pesan kesalahan, atau null bila sudah benar.
 */
export function periksaAlokasi(total: number, baris: BarisAlokasi[]): string | null {
  if (baris.length === 0) return "Pembayaran harus dibebankan ke setidaknya satu tujuan.";

  for (const b of baris) {
    if (b.unitId && b.infrastructureId) {
      return "Satu baris pembebanan hanya boleh ke unit ATAU ke sarana & prasarana, tidak keduanya.";
    }
    if (!Number.isFinite(b.nominal)) return "Ada nominal pembebanan yang bukan angka.";
    if (b.nominal <= 0) return "Nominal tiap pembebanan harus lebih dari nol.";
  }

  const jumlah = baris.reduce((s, b) => s + b.nominal, 0);
  if (jumlah !== total) {
    const selisih = jumlah - total;
    return (
      `Jumlah pembebanan Rp ${jumlah.toLocaleString("id-ID")} tidak sama dengan total pembayaran ` +
      `Rp ${total.toLocaleString("id-ID")} — ${selisih > 0 ? "lebih" : "kurang"} Rp ` +
      `${Math.abs(selisih).toLocaleString("id-ID")}.`
    );
  }

  return null;
}

/**
 * Alokasikan nilai kontrak ke tiap unit/item.
 *
 * Bila sebuah item punya `nilaiOverride`, nilai itu dipakai apa adanya
 * (mis. unit sudut dihargai lebih). Sisa nilai kontrak dibagi rata ke
 * item-item yang tidak di-override.
 */
export function alokasiKontrak<T extends { nilaiOverride?: number | null }>(
  nilaiKontrak: number,
  items: T[],
): (T & { alokasi: number })[] {
  if (items.length === 0) return [];

  const diOverride = items.filter((i) => i.nilaiOverride != null);
  const sisaItem = items.filter((i) => i.nilaiOverride == null);
  const totalOverride = diOverride.reduce((s, i) => s + (i.nilaiOverride ?? 0), 0);
  const perItem = sisaItem.length ? (nilaiKontrak - totalOverride) / sisaItem.length : 0;

  return items.map((i) => ({
    ...i,
    alokasi: i.nilaiOverride ?? perItem,
  }));
}

// ---------------------------------------------------------------------------
// Plan vs Realisasi
// ---------------------------------------------------------------------------

export interface BarisPlanReal {
  kode: string;
  nama: string;
  plan: number;
  real: number;
}

export interface RingkasanPlanReal {
  /** Penjualan */
  penjualanPlan: number;
  penjualanReal: number;
  /** Harga pokok penjualan */
  hppPlan: number;
  hppReal: number;
  /** Laba kotor */
  labaKotorPlan: number;
  labaKotorReal: number;
  /** Biaya operasional */
  opsPlan: number;
  opsReal: number;
  /** Laba bersih */
  labaBersihPlan: number;
  labaBersihReal: number;
  /** Margin laba bersih terhadap penjualan */
  marginPlan: number;
  marginReal: number;
}

export function ringkasPlanReal(
  penjualanPlan: number,
  penjualanReal: number,
  hpp: BarisPlanReal[],
  ops: BarisPlanReal[],
): RingkasanPlanReal {
  const hppPlan = hpp.reduce((s, x) => s + x.plan, 0);
  const hppReal = hpp.reduce((s, x) => s + x.real, 0);
  const opsPlan = ops.reduce((s, x) => s + x.plan, 0);
  const opsReal = ops.reduce((s, x) => s + x.real, 0);

  const labaKotorPlan = penjualanPlan - hppPlan;
  const labaKotorReal = penjualanReal - hppReal;
  const labaBersihPlan = labaKotorPlan - opsPlan;
  const labaBersihReal = labaKotorReal - opsReal;

  return {
    penjualanPlan,
    penjualanReal,
    hppPlan,
    hppReal,
    labaKotorPlan,
    labaKotorReal,
    opsPlan,
    opsReal,
    labaBersihPlan,
    labaBersihReal,
    marginPlan: penjualanPlan ? labaBersihPlan / penjualanPlan : 0,
    marginReal: penjualanReal ? labaBersihReal / penjualanReal : 0,
  };
}
