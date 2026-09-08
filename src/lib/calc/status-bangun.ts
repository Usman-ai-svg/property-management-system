/**
 * Status pembangunan sebagai NILAI TURUNAN.
 *
 * Sama sifatnya dengan `statusAset()` (src/lib/calc/aset.ts): status tidak lagi
 * diketik pengguna melainkan disimpulkan dari keadaan objek. Fungsi ini murni
 * (input → output, tanpa I/O) supaya bisa dipakai sama persis di lapisan data
 * (saat menampilkan) maupun di server action (saat menyimpan cache-nya).
 *
 * Aturan unit (STATUS_PEMBANGUNAN):
 *   - progres 0                                   → "Belum Terbangun"
 *   - 0 < progres < 100                           → "Progress"
 *   - progres 100, jual belum "Serah Terima"      → "Terbangun"
 *   - progres 100, "Serah Terima", < 3 bulan      → "Masa Garansi"
 *   - progres 100, "Serah Terima", ≥ 3 bulan      → "Selesai"
 *
 * Aturan sarpras (STATUS_SARPRAS) — tak punya status jual, jadi hanya progres:
 *   - progres 0        → "Belum Terbangun"
 *   - 0 < progres < 100 → "Progress"
 *   - progres 100       → "Selesai"
 */

import type { StatusPembangunan, StatusSarpras } from "@/lib/domain/enums";

/** Lama masa garansi (bulan) sebelum unit yang diserahterimakan menjadi "Selesai". */
export const BULAN_GARANSI = 3;

/** Apakah `sejak` sudah berlalu ≥ `bulan` bulan dihitung sampai `pada`. */
export function sudahLewatBulan(sejak: Date, bulan: number, pada: Date = new Date()): boolean {
  const batas = new Date(sejak);
  batas.setMonth(batas.getMonth() + bulan);
  return pada.getTime() >= batas.getTime();
}

export function statusBangunUnit(
  u: { progress: number; statusJual: string; tanggalSerahTerima?: Date | null },
  pada: Date = new Date(),
): StatusPembangunan {
  if (u.progress <= 0) return "Belum Terbangun";
  if (u.progress < 100) return "Progress";

  // progres 100% — bergantung pada serah terima.
  if (u.statusJual !== "Serah Terima") return "Terbangun";

  // Sudah serah terima. Tanpa tanggal, anggap masih dalam masa garansi
  // (baru saja diserahkan) sampai tanggalnya diisi.
  if (u.tanggalSerahTerima && sudahLewatBulan(u.tanggalSerahTerima, BULAN_GARANSI, pada)) {
    return "Selesai";
  }
  return "Masa Garansi";
}

export function statusBangunSarpras(progress: number): StatusSarpras {
  if (progress <= 0) return "Belum Terbangun";
  return progress < 100 ? "Progress" : "Selesai";
}

/** Sebaran progres sekumpulan objek beserta rata-ratanya. */
export interface SebaranProgres {
  total: number;
  belum: number;
  dikerjakan: number;
  selesai: number;
  /** Rata-rata progres, dibulatkan ke persen bulat. Tanpa objek: nol. */
  rata: number;
}

/**
 * Kelompokkan sekumpulan angka progres jadi belum / dikerjakan / selesai.
 *
 * Ambangnya sama persis dengan `statusBangunSarpras`: 0 ke bawah belum mulai,
 * 100 ke atas selesai, sisanya sedang dikerjakan. Kesamaan itu bukan kebetulan
 * dan tidak boleh berbeda — sebuah unit tidak boleh terhitung "dikerjakan" di
 * kartu ringkasan sementara statusnya "Selesai" di tabel.
 */
export function sebaranProgres(nilai: number[]): SebaranProgres {
  const total = nilai.length;
  const belum = nilai.filter((p) => p <= 0).length;
  const selesai = nilai.filter((p) => p >= 100).length;
  return {
    total,
    belum,
    selesai,
    dikerjakan: total - belum - selesai,
    rata: total ? Math.round(nilai.reduce((s, p) => s + p, 0) / total) : 0,
  };
}

/** Porsi `n` terhadap `total` dalam persen bulat. Total nol menghasilkan nol. */
export function porsiPersen(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}
