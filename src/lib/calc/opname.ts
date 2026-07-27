/**
 * Opname / laporan progres mingguan.
 *
 * Sumber angkanya adalah progres yang DIISI QS per baris BOQ Master Proyek —
 * `UnitBoqItem.progress` untuk capaian sekarang dan `UnitBoqItem.progressLalu`
 * untuk capaian pada opname sebelumnya.
 *
 * Sebelumnya baris-baris ini tidak punya angka sendiri: satu persen di tingkat
 * unit disebar ke tiap baris dengan anggapan pekerjaan selesai berurutan
 * (`fraksiBaris`). Anggapan itu memadai untuk peragaan, tetapi tidak untuk
 * opname yang jadi dasar penagihan — dan meleset makin jauh ketika bobot antar
 * pekerjaan timpang, karena ia menganggap tiap baris berbobot sama.
 *
 * `fraksiBaris` dipertahankan hanya untuk unit lama yang baris BOQ-nya belum
 * pernah diopname sama sekali; lihat `susunOpnameDariPersen`.
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

/** Baris BOQ yang sudah punya angka opname sendiri. */
export interface BarisOpnameTerisi extends BarisOpnameInput {
  /** Capaian sekarang, 0–100. */
  progress: number;
  /** Capaian pada opname sebelumnya, 0–100. */
  progressLalu: number;
}

const jepit = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);

/**
 * Susun laporan opname dari baris pekerjaan yang progresnya sudah diisi.
 *
 * @param rows baris BOQ Master beserta `progress` dan `progressLalu`-nya
 */
export function susunOpname(rows: BarisOpnameTerisi[]): BarisOpname[] {
  const total = rows.reduce((s, r) => s + r.volume * r.hargaSatuan, 0);
  if (rows.length === 0 || total === 0) return [];

  return rows.map((r) => {
    const sub = r.volume * r.hargaSatuan;
    const bobot = (sub / total) * 100;
    const fL = jepit(r.progressLalu) / 100;
    const fN = jepit(r.progress) / 100;

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

/**
 * Versi lama: sebarkan satu angka persen ke baris-baris pekerjaan.
 *
 * Hanya untuk unit yang baris BOQ-nya belum pernah diopname — angkanya adalah
 * taksiran, bukan catatan lapangan, jadi jangan dipakai menagih.
 */
export function susunOpnameDariPersen(
  rows: BarisOpnameInput[],
  progresLalu: number,
  progresKini: number,
): BarisOpname[] {
  const n = rows.length;
  return susunOpname(
    rows.map((r, i) => ({
      ...r,
      progressLalu: Math.round(fraksiBaris(progresLalu, i, n) * 100),
      progress: Math.round(fraksiBaris(progresKini, i, n) * 100),
    })),
  );
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
