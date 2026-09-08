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

/**
 * Jepit sebuah angka progres ke rentang sah 0–100.
 *
 * Nilai bukan-angka jadi 0, bukan NaN yang menular ke seluruh penjumlahan.
 * Diekspor karena form opname perlu menjepit ketikan pengguna dengan aturan
 * yang sama persis — dulu tiap komponen menuliskannya sendiri.
 */
export const jepitProgres = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;

const jepit = jepitProgres;

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

/** Ringkasan sebuah form opname yang sedang diisi. */
export interface RingkasOpnamePersen {
  /** Nilai seluruh baris: Σ volume × harga satuan. */
  total: number;
  /** Nilai yang sudah terpasang menurut persen tiap baris. */
  terpasang: number;
  /** Terpasang terhadap total, dalam persen. Total nol menghasilkan nol. */
  persen: number;
}

/**
 * Ringkasan nilai sebuah opname dari persen per baris yang sedang diketik.
 *
 * Berbeda dari `ringkasOpname`, yang meringkas laporan jadi. Ini untuk form
 * yang belum tersimpan: penggunanya mengetik persen tiap baris, dan angka di
 * bawah tabel harus ikut bergerak. Rumusnya dulu disalin utuh di dua komponen
 * (opname BOQ unit dan opname SPK vendor), keduanya tanpa tes.
 *
 * `persenBaris` mengembalikan capaian sebuah baris (0–100); nilai di luar
 * rentang dijepit, jadi ketikan "150" tidak membuat nilai terpasang melebihi
 * nilai kontrak.
 */
export function ringkasOpnamePersen<T extends { volume: number; hargaSatuan: number }>(
  baris: T[],
  persenBaris: (b: T) => number,
): RingkasOpnamePersen {
  const total = baris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
  const terpasang = baris.reduce(
    (s, b) => s + b.volume * b.hargaSatuan * (jepitProgres(persenBaris(b)) / 100),
    0,
  );
  return { total, terpasang, persen: total ? (terpasang / total) * 100 : 0 };
}

/**
 * Grup pekerjaan yang SEDANG berjalan, diturunkan dari progres per baris BOQ
 * Master — bukan lagi ditebak dari satu angka persen unit.
 *
 * Syaratnya per grup: progres tertimbang grup itu 0 < x < 100. Bisa mengembalikan
 * LEBIH DARI SATU grup — mis. Struktur dan Arsitektur berjalan bersamaan asal
 * masing-masing progresnya di antara 0 dan 100. Grup yang seluruhnya 0% (belum
 * mulai) atau 100% (selesai) tidak ikut. Unit tanpa baris BOQ → daftar kosong.
 */
export function grupBerjalan(
  rows: { grup: string; volume: number; hargaSatuan: number; progress: number }[],
): string[] {
  const peta = new Map<string, { nilai: number; terpasang: number }>();
  for (const r of rows) {
    const nilai = r.volume * r.hargaSatuan;
    const g = peta.get(r.grup) ?? { nilai: 0, terpasang: 0 };
    g.nilai += nilai;
    g.terpasang += nilai * (r.progress / 100);
    peta.set(r.grup, g);
  }
  return [...peta.entries()]
    .filter(([, v]) => {
      const p = v.nilai > 0 ? (v.terpasang / v.nilai) * 100 : 0;
      return p > 0 && p < 100;
    })
    .map(([grup]) => grup);
}

/**
 * Apakah sebuah angka progres yang diketik pengguna sah untuk disimpan.
 *
 * Sengaja MENOLAK, bukan menjepit seperti `jepitProgres`. Bedanya penting:
 * di form yang sedang diketik, angka nyeleneh cukup dijepit supaya
 * ringkasannya tidak kacau; tapi pada saat menyimpan, angka nyeleneh berarti
 * ada yang salah — dan opname adalah dasar penagihan vendor, jadi lebih baik
 * ditolak dengan pesan daripada diam-diam diperbaiki.
 */
export const progresSah = (p: number): boolean => Number.isFinite(p) && p >= 0 && p <= 100;

/**
 * Progres yang disimpan selalu bilangan bulat persen.
 *
 * `UnitBoqItem.progress` bertipe Int, jadi pembulatan ini bukan pilihan
 * tampilan melainkan syarat penyimpanan.
 */
export const bulatkanProgres = (p: number): number => Math.round(p);
