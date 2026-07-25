/**
 * Opname / laporan progres mingguan.
 *
 * Model penyelesaian yang dipakai: baris-baris pekerjaan diasumsikan selesai
 * berurutan. Pada progres p%, baris ke-i (dari n baris) memiliki fraksi selesai
 *
 *     f(p, i) = clamp( (p/100 − i/n) · n , 0 , 1 )
 *
 * Artinya baris 1 selesai lebih dulu, baru baris 2, dan seterusnya — bukan
 * semua baris maju bersamaan. Ini mendekati urutan kerja konstruksi nyata
 * (struktur dulu, finishing belakangan).
 *
 * Berbeda dari prototipe yang menebak progres minggu lalu dengan `progres − 7`,
 * fungsi di sini menerima kedua nilai progres secara eksplisit supaya bisa diisi
 * dari riwayat `progress_records` yang sebenarnya.
 */

export interface BarisOpnameInput {
  grup?: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
}

export interface BarisOpname extends BarisOpnameInput {
  subtotal: number;
  /** Bobot baris terhadap keseluruhan pekerjaan (%). */
  bobot: number;
  /** Progres, bobot terpakai, dan nilai — sampai dengan minggu lalu. */
  progresLalu: number;
  bobotLalu: number;
  nilaiLalu: number;
  /** Penambahan minggu ini. */
  deltaProgres: number;
  deltaBobot: number;
  deltaNilai: number;
  /** Kumulatif sampai dengan minggu ini. */
  progresKini: number;
  bobotKini: number;
  nilaiKini: number;
}

/** Fraksi penyelesaian baris ke-`i` dari `n` baris pada progres `persen`. */
export function fraksiBaris(persen: number, i: number, n: number): number {
  if (n <= 0) return 0;
  return Math.max(0, Math.min(1, (persen / 100 - i / n) * n));
}

/**
 * Susun laporan opname dari sekumpulan baris pekerjaan.
 *
 * @param rows          baris BOQ (unit, sarpras, atau kerja tambah)
 * @param progresLalu   progres kumulatif pada opname sebelumnya (%)
 * @param progresKini   progres kumulatif saat ini (%)
 */
export function susunOpname(
  rows: BarisOpnameInput[],
  progresLalu: number,
  progresKini: number,
): BarisOpname[] {
  const n = rows.length;
  const total = rows.reduce((s, r) => s + r.volume * r.hargaSatuan, 0);
  if (n === 0 || total === 0) return [];

  return rows.map((r, i) => {
    const sub = r.volume * r.hargaSatuan;
    const bobot = (sub / total) * 100;
    const fL = fraksiBaris(progresLalu, i, n);
    const fN = fraksiBaris(progresKini, i, n);

    return {
      ...r,
      subtotal: sub,
      bobot,
      progresLalu: Math.round(fL * 100),
      bobotLalu: bobot * fL,
      nilaiLalu: sub * fL,
      deltaProgres: Math.round((fN - fL) * 100),
      deltaBobot: bobot * (fN - fL),
      deltaNilai: sub * (fN - fL),
      progresKini: Math.round(fN * 100),
      bobotKini: bobot * fN,
      nilaiKini: sub * fN,
    };
  });
}

/** Ringkasan total sebuah laporan opname. */
export function ringkasOpname(rows: BarisOpname[]) {
  return rows.reduce(
    (acc, r) => ({
      nilaiKontrak: acc.nilaiKontrak + r.subtotal,
      bobotLalu: acc.bobotLalu + r.bobotLalu,
      nilaiLalu: acc.nilaiLalu + r.nilaiLalu,
      deltaBobot: acc.deltaBobot + r.deltaBobot,
      deltaNilai: acc.deltaNilai + r.deltaNilai,
      bobotKini: acc.bobotKini + r.bobotKini,
      nilaiKini: acc.nilaiKini + r.nilaiKini,
    }),
    { nilaiKontrak: 0, bobotLalu: 0, nilaiLalu: 0, deltaBobot: 0, deltaNilai: 0, bobotKini: 0, nilaiKini: 0 },
  );
}

/**
 * Keterangan pekerjaan yang sedang berjalan pada suatu tingkat progres.
 * Dipakai sebagai label ringkas di daftar unit.
 */
export function keteranganPekerjaan(progres: number): string[] {
  if (progres <= 0) return ["Belum mulai"];
  if (progres >= 100) return ["Selesai"];
  if (progres < 25) return ["Pek. Struktur"];
  if (progres < 40) return ["Pek. Struktur", "Pek. Arsitektur"];
  if (progres < 55) return ["Pek. Arsitektur"];
  if (progres < 70) return ["Pek. Kusen & Pintu", "Pek. Kanopi"];
  if (progres < 85) return ["Pek. Kanopi", "Pek. Taman"];
  return ["Pek. Taman"];
}
