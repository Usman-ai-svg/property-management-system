/**
 * KONTRAK — Plan vs Realisasi: biaya operasional dan pencairan penjualan.
 *
 * Dua jenis uang yang tidak lewat modul Keuangan: biaya operasional kantor yang
 * dibandingkan langsung dengan pos business plan, dan pencairan hasil penjualan
 * unit. Keduanya kecil jumlah aksinya tetapi langsung memengaruhi angka laba.
 */

import { angkaMinimal, pertamaGagal, tanggalSah, wajibTeks, type Galat } from "./dasar";

// ---------------------------------------------------------------------------
// Biaya operasional
// ---------------------------------------------------------------------------

export interface MasukanBiayaOperasional {
  projectId: string;
  kategori: string;
  nominal: number;
  uraian: string;
  tanggal: string | null;
}

export interface KonteksBiayaOperasional {
  /** Nama pos operasional yang ada di business plan proyek ini. */
  posBusinessPlan: string[];
}

/**
 * Kategori biaya harus SUDAH ADA sebagai pos di business plan.
 *
 * Ini yang membuat halaman Plan vs Realisasi bisa menjajarkan rencana dengan
 * realisasi tanpa mencocok-cocokkan teks: pos yang diketik bebas akan muncul
 * sebagai realisasi tanpa rencana, dan selisihnya tampak seperti pemborosan
 * padahal hanya beda ejaan.
 */
export function periksaCatatBiayaOperasional(
  m: MasukanBiayaOperasional,
  konteks: KonteksBiayaOperasional,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.kategori, "Pos biaya"),
    wajibTeks(m.uraian, "Keterangan"),
    angkaMinimal(m.nominal, 1, "Nominal"),
    m.tanggal === null ? null : tanggalSah(m.tanggal, "Tanggal"),
  );
  if (dasar) return dasar;

  if (konteks.posBusinessPlan.length === 0) {
    return "Proyek ini belum punya pos biaya operasional pada business plan-nya.";
  }
  if (!konteks.posBusinessPlan.includes(m.kategori)) {
    return `Pos "${m.kategori}" tidak ada pada business plan proyek ini.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pencairan penjualan unit
// ---------------------------------------------------------------------------

export interface MasukanPembayaranJual {
  /** Diisi bila menyunting pembayaran yang sudah ada. */
  id: string | null;
  unitId: string;
  nominal: number;
  tanggal: string;
  keterangan: string | null;
}

export function periksaSimpanPembayaranJual(m: MasukanPembayaranJual): Galat {
  return pertamaGagal(
    wajibTeks(m.unitId, "Unit"),
    angkaMinimal(m.nominal, 1, "Nominal pencairan"),
    tanggalSah(m.tanggal, "Tanggal pembayaran"),
  );
}

export const periksaHapusPembayaranJual = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id pembayaran");

/**
 * Pencairan yang melampaui harga akad TIDAK ditolak — hanya diberi tahu.
 *
 * Kelebihan bisa datang dari biaya tambahan yang memang ditagihkan ke pembeli,
 * dan yang tahu duduk perkaranya adalah penggunanya. Berbeda dari pembayaran
 * kontrak vendor, uang di sini MASUK, jadi salah catat tidak menimbulkan
 * kerugian yang sulit ditarik kembali.
 */
export function peringatanPencairanLebih(
  sudahDiterima: number,
  nominalBaru: number,
  hargaJual: number,
): string | null {
  const lebih = sudahDiterima + nominalBaru - hargaJual;
  return lebih > 0 ? `Pencairan melebihi harga akad sebesar ${lebih}.` : null;
}
