/**
 * Aturan "minggu berjalan" untuk opname mingguan.
 *
 * Masalah yang dipecahkan: sebelumnya `progressLalu` DIGESER setiap kali opname
 * disimpan. Bila QS salah input lalu memperbaikinya di hari yang sama (atau
 * masih dalam minggu yang sama), rekap "minggu lalu" jadi ikut tertimpa nilai
 * yang baru saja dimasukkan — padahal itu koreksi minggu ini, bukan capaian
 * minggu lalu.
 *
 * Aturannya: `progressLalu` hanya bergeser bila opname baru berjarak minimal
 * satu minggu kerja (5 hari kerja) dari awal minggu berjalan. Di bawah itu,
 * opname dianggap KOREKSI dan `progressLalu` dibiarkan.
 *
 * Hari kerja = Senin–Sabtu; Minggu libur.
 */

/** Ambang minggu baru, dalam hari kerja. */
export const AMBANG_MINGGU_KERJA = 5;

/**
 * Jumlah hari kerja (Senin–Sabtu, Minggu dilewati) yang berlalu SETELAH `dari`
 * sampai dengan `sampai`. Hanya bagian tanggalnya yang dibandingkan — jam
 * diabaikan. Mengembalikan 0 bila `sampai` tidak setelah `dari`.
 */
export function hariKerja(dari: Date, sampai: Date): number {
  const a = new Date(dari.getFullYear(), dari.getMonth(), dari.getDate());
  const b = new Date(sampai.getFullYear(), sampai.getMonth(), sampai.getDate());
  if (b <= a) return 0;

  let n = 0;
  const cur = new Date(a);
  while (cur < b) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0) n++; // 0 = Minggu
  }
  return n;
}

/**
 * Apakah opname pada `sekarang` masuk MINGGU BARU relatif terhadap awal minggu
 * berjalan `baseline`? Baseline `null` (belum pernah diopname) selalu dianggap
 * minggu baru, sehingga opname pertama menggeser `progressLalu` dari 0.
 */
export function mingguBaru(baseline: Date | null | undefined, sekarang: Date): boolean {
  if (!baseline) return true;
  return hariKerja(baseline, sekarang) >= AMBANG_MINGGU_KERJA;
}
