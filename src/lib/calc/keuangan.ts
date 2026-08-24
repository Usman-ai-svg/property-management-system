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

/**
 * Status pelunasan sebuah hutang, diturunkan dari yang sudah terbayar — bukan
 * disimpan sebagai kolom yang bisa menyimpang. Kosong = "Belum", penuh =
 * "Lunas", di antaranya "DP". Inilah makna nyata dari Status Bayar untuk
 * pengeluaran-hutang; metode "Hutang" dan status "Belum" dulunya konsep kembar.
 */
export function statusHutang(total: number, terbayar: number): "Lunas" | "DP" | "Belum" {
  if (terbayar <= 0) return "Belum";
  if (terbayar >= total) return "Lunas";
  return "DP";
}

/**
 * Seberapa mendesak sebuah tenggat hutang: "lewat" bila sudah terlampaui,
 * "dekat" bila dalam `ambangHari` ke depan, selebihnya "aman". Dipakai untuk
 * mewarnai pengingat hutang di dashboard.
 */
export function jatuhTempo(
  tenggat: Date | null,
  sekarang: Date,
  ambangHari = 7,
): "lewat" | "dekat" | "aman" {
  if (!tenggat) return "aman";
  const selisih = tenggat.getTime() - sekarang.getTime();
  if (selisih < 0) return "lewat";
  if (selisih <= ambangHari * 864e5) return "dekat";
  return "aman";
}

export interface VariationOrderLike {
  nominal: number;
  status: string;
}

export interface KontrakLike {
  nominal: number;
  retensiPct: number;
  /**
   * Pembayaran ke vendor, yaitu `Expense` yang menunjuk kontrak ini.
   *
   * Sengaja bukan tabel tersendiri: pembayaran vendor adalah pengeluaran
   * biasa, dan memisahkannya membuat uang yang sama bisa tercatat dua kali.
   */
  expenses: { total: number }[];
  variationOrders: VariationOrderLike[];
}

/** Total yang sudah dibayarkan pada sebuah kontrak. */
export const totalTerbayar = (k: Pick<KontrakLike, "expenses">): number =>
  k.expenses.reduce((s, e) => s + e.total, 0);

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

export type StatusBayarKontrak = "Belum" | "DP" | "Retensi" | "Retensi Jatuh Tempo" | "Lunas";

export interface KontrakStatusLike extends KontrakLike {
  jatuhTempoBln: number;
  expenses: { total: number; tanggal: Date | string }[];
  /** Tanggal pekerjaan dinyatakan selesai — anchor jatuh tempo retensi. */
  tanggalSelesai?: Date | string | null;
}

/**
 * Tanggal jatuh tempo retensi = tanggal selesai + masa pemeliharaan (bulan).
 *
 * Retensi ditahan sampai masa pemeliharaan berlalu terhitung sejak pekerjaan
 * DINYATAKAN SELESAI — bukan sejak pelunasan. Mengembalikan null bila kontrak
 * belum ditandai selesai atau tidak menahan retensi (retensiPct 0), yaitu saat
 * tidak ada yang perlu diingatkan.
 */
export function jatuhTempoRetensi(k: {
  tanggalSelesai?: Date | string | null;
  jatuhTempoBln: number;
  retensiPct: number;
}): Date | null {
  if (!k.tanggalSelesai || k.retensiPct <= 0) return null;
  const d = new Date(k.tanggalSelesai);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + k.jatuhTempoBln);
  return d;
}

/**
 * Status pembayaran sebuah kontrak — DITURUNKAN dari akumulasi pembayaran,
 * bukan diinput manual. Sengaja properti kontrak (bukan tiap baris pembayaran):
 * satu termin tak bisa "Lunas", yang lunas adalah kontraknya.
 *
 *   Belum → DP → Retensi → Retensi Jatuh Tempo → Lunas
 *
 * Ambang "Retensi" = titik POKOK (nilai − retensi) lunas; yang tersisa hanyalah
 * retensi yang ditahan. retensiPct 0 membuat pita Retensi kosong, jadi kontrak
 * tanpa retensi lompat DP → Lunas. Retensi dilepas setelah masa pemeliharaan
 * (`jatuhTempoBln`) berlalu terhitung sejak tanggal pokok lunas; lewat dari itu
 * dan retensi belum dibayar → "Retensi Jatuh Tempo" (menuntut pelunasan).
 */
export function statusBayarKontrak(k: KontrakStatusLike, kini: Date = new Date()): StatusBayarKontrak {
  const { nilaiEfektif, terbayar, retensi } = ringkasKontrak(k);
  if (terbayar <= 0) return "Belum";
  if (terbayar >= nilaiEfektif) return "Lunas";

  const pokok = nilaiEfektif - retensi;
  if (terbayar < pokok) return "DP";

  // Pokok lunas, hanya retensi tersisa. Jatuh tempo dihitung dari TANGGAL
  // SELESAI bila kontrak sudah ditandai selesai; bila belum, jatuh kembali ke
  // tanggal pembayaran yang pertama kali membuat akumulasi mencapai titik pokok
  // (perilaku lama, agar data tanpa tanggal selesai tetap terlayani).
  const anchor = k.tanggalSelesai
    ? new Date(k.tanggalSelesai)
    : tanggalCapaiAmbang(k.expenses, pokok);
  if (anchor && !Number.isNaN(anchor.getTime())) {
    const jatuh = new Date(anchor);
    jatuh.setMonth(jatuh.getMonth() + k.jatuhTempoBln);
    if (kini >= jatuh) return "Retensi Jatuh Tempo";
  }
  return "Retensi";
}

/** Tanggal pembayaran (urut naik) saat akumulasi pertama kali ≥ ambang. */
function tanggalCapaiAmbang(
  expenses: { total: number; tanggal: Date | string }[],
  ambang: number,
): Date | null {
  const urut = [...expenses].sort(
    (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime(),
  );
  let kum = 0;
  for (const e of urut) {
    kum += e.total;
    if (kum >= ambang) return new Date(e.tanggal);
  }
  return null;
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

/**
 * Bagi satu PEMBAYARAN kontrak ke unit/sarpras yang dicakupnya.
 *
 * Berbeda dari `alokasiKontrak`, yang membagi NILAI KONTRAK. Untuk kontrak
 * yang punya `nilaiOverride`, fungsi itu mengembalikan angka override apa
 * adanya — benar untuk membagi nilai kontrak, tetapi salah besar bila dipakai
 * membagi sebuah termin: pembayaran Rp 162 juta pada kontrak Rp 540 juta akan
 * menghasilkan alokasi Rp 540 juta.
 *
 * Di sini tiap item mendapat porsi SEBANDING dengan bagiannya atas nilai
 * kontrak. Sisa pembulatan ditaruh pada baris pertama supaya jumlah seluruh
 * alokasi persis sama dengan nominal yang dibayarkan — invarian `Expense`
 * mensyaratkan itu, dan selisih satu rupiah pada laporan keuangan adalah
 * selisih yang harus dicari orang.
 */
export function alokasiPembayaran<T extends { nilaiOverride?: number | null }>(
  nominalBayar: number,
  nilaiKontrak: number,
  items: T[],
): (T & { alokasi: number })[] {
  if (items.length === 0) return [];

  const porsiNilai = alokasiKontrak(nilaiKontrak, items);
  const totalPorsi = porsiNilai.reduce((s, i) => s + i.alokasi, 0);

  // Kontrak tanpa nilai — bagi rata saja, tidak ada dasar pembobotan lain.
  const bagian = totalPorsi
    ? porsiNilai.map((i) => Math.floor((nominalBayar * i.alokasi) / totalPorsi))
    : bagiRata(nominalBayar, items.length);

  const sisa = nominalBayar - bagian.reduce((s, b) => s + b, 0);
  bagian[0] += sisa;

  return items.map((i, k) => ({ ...i, alokasi: bagian[k] }));
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
