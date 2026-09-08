/**
 * Penyusun angka halaman Estimasi RAB.
 *
 * Masuk: bentuk data mentah seperti yang datang dari `src/lib/data/estimasi.ts`
 * (analisa dengan komponennya, baris RAB). Keluar: angka siap gambar. Murni —
 * tanpa Prisma, tanpa React — jadi ikut pindah apa adanya saat modul diserap
 * ERP. Aturan hitungnya sendiri ada di `src/lib/calc/ahsp.ts`; di sini hanya
 * pemetaan dari bentuk basis data ke bentuk yang dimengerti mesin hitung.
 */

import {
  hargaSatuanAnalisa, rekapAnalisa, rekapRabPerGrup, totalRab,
  type Analisa, type KelompokDasar, type RekapAnalisa,
} from "@/lib/calc/ahsp";

/** Bentuk analisa seperti yang datang dari basis data. */
export interface AnalisaDb {
  overheadPct: number;
  komponen: {
    koefisien: number;
    hargaDasar: { kategori: string; hargaAcuan: number };
  }[];
}

/** Ubah analisa bentuk basis data menjadi masukan mesin hitung. */
function keAnalisa(a: AnalisaDb): Analisa {
  return {
    overheadPct: a.overheadPct,
    komponen: a.komponen.map((k) => ({
      // Kategori harga dasar (UPAH/BAHAN/ALAT) langsung menjadi kelompoknya.
      kelompok: k.hargaDasar.kategori as KelompokDasar,
      koefisien: k.koefisien,
      hargaAcuan: k.hargaDasar.hargaAcuan,
    })),
  };
}

/** Harga satuan sebuah analisa (rupiah bulat) — dasar snapshot ke RAB. */
export const hargaSatuanDb = (a: AnalisaDb): number => hargaSatuanAnalisa(keAnalisa(a));

/** Rincian lengkap sebuah analisa (upah/bahan/alat/overhead/harga satuan). */
export const rekapAnalisaDb = (a: AnalisaDb): RekapAnalisa => rekapAnalisa(keAnalisa(a));

export interface RingkasEstimasi<T> {
  grup: { nama: string; items: T[]; total: number }[];
  total: number;
}

/**
 * Kelompokkan baris RAB per grup pekerjaan beserta grand total-nya.
 * Urutan grup mengikuti kemunculan pertama, bukan alfabetis.
 */
export function ringkasEstimasi<T extends { grup: string; volume: number; hargaSatuan: number }>(
  items: T[],
): RingkasEstimasi<T> {
  return { grup: rekapRabPerGrup(items), total: totalRab(items) };
}

/** Ringkasan nilai pembelian seorang pemasok. */
export interface RingkasPemasok {
  totalBeli: number;
  totalBayar: number;
  totalHutang: number;
}

/**
 * Jumlahkan seluruh PO seorang pemasok.
 *
 * Hutangnya dihitung dari selisih total — bukan dijumlahkan dari hutang tiap
 * PO — supaya kelebihan bayar pada satu PO tetap mengurangi hutang keseluruhan,
 * persis seperti yang terjadi pada uangnya.
 */
export function ringkasPemasok(
  pembelian: { total: number; terbayar: number }[],
): RingkasPemasok {
  const totalBeli = pembelian.reduce((s, b) => s + b.total, 0);
  const totalBayar = pembelian.reduce((s, b) => s + b.terbayar, 0);
  return { totalBeli, totalBayar, totalHutang: totalBeli - totalBayar };
}
