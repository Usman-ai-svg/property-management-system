/**
 * Perhitungan evaluasi Tender terhadap RAB Estimasi.
 *
 * Semua fungsi di sini murni: input → output, tanpa I/O, tanpa React, tanpa
 * Prisma — sama seperti `ahsp.ts` dan `boq.ts`. Rumusnya dimaksudkan terbaca
 * sebagai spesifikasi evaluasi lelang.
 *
 * Model datanya (lihat skema `TenderItem`/`TenderBid`):
 *
 *   - Tiap BARIS tender adalah salinan beku satu baris RAB dengan harga satuan
 *     acuan (`hpsHargaSatuan`) — inilah HPS per baris, RAHASIA dari vendor.
 *   - Tiap baris punya sejumlah PENAWARAN (`bids`), satu per vendor, berisi
 *     harga satuan tawaran vendor. Volume diambil dari baris, bukan dari bid.
 *   - Pemenang ditetapkan PER BARIS (`pemenangVendorId`), sehingga satu tender
 *     bisa dimenangkan beberapa vendor sekaligus.
 *
 * Nilai selalu = volume × harga satuan. HPS baris = volume × hpsHargaSatuan.
 */

export interface BidTender {
  vendorId: string;
  hargaSatuan: number;
}

export interface BarisTenderLike {
  volume: number;
  hpsHargaSatuan: number;
  pemenangVendorId?: string | null;
  bids: BidTender[];
}

/** Nilai HPS satu baris = volume × harga satuan acuan RAB. */
export const nilaiHpsBaris = (b: { volume: number; hpsHargaSatuan: number }): number =>
  b.volume * b.hpsHargaSatuan;

/** Total HPS tender = Σ nilai HPS seluruh baris. */
export const totalHps = (items: { volume: number; hpsHargaSatuan: number }[]): number =>
  items.reduce((s, b) => s + nilaiHpsBaris(b), 0);

/** Harga satuan terendah pada satu baris; null bila belum ada penawaran. */
export function hargaTerendah(b: { bids: BidTender[] }): number | null {
  if (b.bids.length === 0) return null;
  return Math.min(...b.bids.map((x) => x.hargaSatuan));
}

/**
 * Nilai penawaran pemenang sebuah baris = volume × harga satuan vendor pemenang.
 * Null bila belum ada pemenang, atau pemenang ditetapkan tanpa bid yang cocok
 * (anomali data — diperlakukan sebagai belum bernilai, bukan nol yang menyesatkan).
 */
export function nilaiMenangBaris(b: BarisTenderLike): number | null {
  if (!b.pemenangVendorId) return null;
  const bid = b.bids.find((x) => x.vendorId === b.pemenangVendorId);
  if (!bid) return null;
  return b.volume * bid.hargaSatuan;
}

/** Satu sel penawaran pada tabel perbandingan. */
export interface SelBid {
  vendorId: string;
  hargaSatuan: number;
  /** volume × hargaSatuan. */
  nilai: number;
  /** nilai − HPS baris. Negatif = di bawah HPS (menguntungkan). */
  selisihHps: number;
  /** Harga satuan terendah di baris ini (bisa lebih dari satu bila seri). */
  terendah: boolean;
}

/** Satu baris tabel perbandingan: barisnya + kolom sel sejajar `vendorIds`. */
export interface BarisPerbandingan<T> {
  baris: T;
  hpsNilai: number;
  /** Sejajar dengan `vendorIds`; null bila vendor itu tak menawar baris ini. */
  sel: (SelBid | null)[];
  pemenangVendorId: string | null;
}

/**
 * Susun matriks perbandingan: satu baris per pekerjaan, satu kolom per vendor.
 * `vendorIds` menentukan urutan & kelengkapan kolom (vendor yang belum menawar
 * satu baris tetap punya sel — bernilai null — agar kolom tetap sejajar).
 */
export function susunPerbandingan<T extends BarisTenderLike>(
  items: T[],
  vendorIds: string[],
): BarisPerbandingan<T>[] {
  return items.map((baris) => {
    const hpsNilai = nilaiHpsBaris(baris);
    const min = hargaTerendah(baris);
    const sel = vendorIds.map((vid): SelBid | null => {
      const bid = baris.bids.find((x) => x.vendorId === vid);
      if (!bid) return null;
      const nilai = baris.volume * bid.hargaSatuan;
      return {
        vendorId: vid,
        hargaSatuan: bid.hargaSatuan,
        nilai,
        selisihHps: nilai - hpsNilai,
        terendah: min !== null && bid.hargaSatuan === min,
      };
    });
    return { baris, hpsNilai, sel, pemenangVendorId: baris.pemenangVendorId ?? null };
  });
}

/** Ringkasan posisi satu vendor di sebuah tender. */
export interface TotalVendor {
  vendorId: string;
  /** Berapa baris yang vendor ini tawar. */
  jumlahBarisDitawar: number;
  /** Σ nilai seluruh penawaran vendor ini (lintas baris yang ia tawar). */
  totalTawaran: number;
  /** Berapa baris yang dimenangkan vendor ini. */
  jumlahBarisMenang: number;
  /** Σ nilai baris yang dimenangkan vendor ini (pakai harga tawarannya). */
  totalMenang: number;
}

/** Ringkas tiap vendor: total tawaran dan total baris yang dimenangkannya. */
export function rekapVendor<T extends BarisTenderLike>(
  items: T[],
  vendorIds: string[],
): TotalVendor[] {
  return vendorIds.map((vid) => {
    let jumlahBarisDitawar = 0;
    let totalTawaran = 0;
    let jumlahBarisMenang = 0;
    let totalMenang = 0;
    for (const b of items) {
      const bid = b.bids.find((x) => x.vendorId === vid);
      if (bid) {
        jumlahBarisDitawar += 1;
        totalTawaran += b.volume * bid.hargaSatuan;
      }
      if (b.pemenangVendorId === vid && bid) {
        jumlahBarisMenang += 1;
        totalMenang += b.volume * bid.hargaSatuan;
      }
    }
    return { vendorId: vid, jumlahBarisDitawar, totalTawaran, jumlahBarisMenang, totalMenang };
  });
}

/** Rekap hasil penetapan pemenang seluruh tender. */
export interface RekapPemenang {
  /** Total HPS atas SELURUH baris tender. */
  totalHps: number;
  /** Σ nilai baris yang sudah ada pemenangnya (harga tawaran pemenang). */
  totalDimenangkan: number;
  /** Jumlah baris yang belum ditetapkan pemenangnya. */
  barisBelumDitetapkan: number;
  /**
   * Penghematan atas baris yang sudah diputus = Σ(HPS − nilai menang) pada
   * baris berpemenang saja. Positif = menang di bawah HPS. Baris tanpa
   * pemenang tidak ikut supaya angka ini adil (belum ada keputusan harga).
   */
  hematVsHps: number;
  /** Ringkasan per vendor pemenang: berapa baris & total nilainya. */
  perVendor: { vendorId: string; jumlahBaris: number; total: number }[];
}

/** Hitung rekap pemenang untuk kepala halaman & basis pembuatan SPK. */
export function rekapPemenang(items: BarisTenderLike[]): RekapPemenang {
  let totalDimenangkan = 0;
  let barisBelumDitetapkan = 0;
  let hematVsHps = 0;
  const peta = new Map<string, { jumlahBaris: number; total: number }>();

  for (const b of items) {
    const nilaiMenang = nilaiMenangBaris(b);
    if (nilaiMenang === null) {
      barisBelumDitetapkan += 1;
      continue;
    }
    totalDimenangkan += nilaiMenang;
    hematVsHps += nilaiHpsBaris(b) - nilaiMenang;
    const vid = b.pemenangVendorId as string;
    const cur = peta.get(vid) ?? { jumlahBaris: 0, total: 0 };
    cur.jumlahBaris += 1;
    cur.total += nilaiMenang;
    peta.set(vid, cur);
  }

  return {
    totalHps: totalHps(items),
    totalDimenangkan,
    barisBelumDitetapkan,
    hematVsHps,
    perVendor: [...peta.entries()].map(([vendorId, v]) => ({ vendorId, ...v })),
  };
}

/**
 * Nilai SPK dari baris-baris yang menang, untuk sekian objek cakupan.
 *
 * Model "satu BOQ berlaku untuk tiap unit": template BOQ digandakan ke SETIAP
 * objek yang dicakup kontrak, jadi nilai SPK ikut jumlah objek supaya "Nilai
 * BOQ Terinci" sama dengan "Nilai SPK". Salah di sini berarti seluruh kontrak
 * bernilai sepersekian dari yang seharusnya, dan itu baru ketahuan saat opname
 * pertama tidak pernah bisa mencapai 100%.
 */
export const nilaiKontrakDariMenang = (totalMenang: number, jumlahObjek: number): number =>
  Math.round(totalMenang * jumlahObjek);
