/**
 * BOQ SPK dan progres per baris pekerjaan.
 *
 * Sebelum ini, progres sebuah unit adalah satu angka persen yang diketik
 * langsung, lalu `susunOpname()` memecahnya ke baris-baris BOQ dengan anggapan
 * pekerjaan diselesaikan berurutan dari baris pertama. Anggapan itu cukup
 * untuk peragaan, tetapi tidak untuk opname borongan yang jadi dasar
 * penagihan vendor: nilai tagihan tidak boleh disandarkan pada tebakan urutan
 * pekerjaan.
 *
 * Di sini arahnya dibalik. QS mengisi progres tiap baris BOQ SPK, lalu progres
 * unit DIHITUNG dari baris-baris itu — tertimbang nilai, bukan rata-rata
 * sederhana, karena pekerjaan pondasi dan pekerjaan cat tidak sama bobotnya.
 */

export interface BarisBoqSpk {
  unitId?: string | null;
  infrastructureId?: string | null;
  volume: number;
  hargaSatuan: number;
  /** Persentase penyelesaian baris ini, 0–100. */
  progress: number;
}

/** Nilai sebuah baris BOQ: volume dikali harga satuan. */
export const nilaiBaris = (b: { volume: number; hargaSatuan: number }): number =>
  b.volume * b.hargaSatuan;

/**
 * Progres gabungan sekumpulan baris, tertimbang nilai tiap baris.
 *
 * Mengembalikan persen 0–100, dibulatkan ke bilangan bulat supaya sama
 * bentuknya dengan `Unit.progress` yang lama.
 *
 * Baris tanpa nilai (volume atau harga nol) tidak ikut menimbang — kalau
 * dihitung, pekerjaan bernilai nol akan menarik progres ke bawah tanpa alasan.
 * Bila SELURUH baris bernilai nol, tidak ada dasar pembobotan sama sekali, dan
 * yang dipakai adalah rata-rata sederhana — lebih baik daripada mengembalikan
 * nol dan membuat pekerjaan yang jelas berjalan tampak belum dimulai.
 */
export function progresTertimbang(baris: BarisBoqSpk[]): number {
  if (baris.length === 0) return 0;

  const totalNilai = baris.reduce((s, b) => s + nilaiBaris(b), 0);

  if (totalNilai === 0) {
    const rata = baris.reduce((s, b) => s + jepitPersen(b.progress), 0) / baris.length;
    return Math.round(rata);
  }

  const tercapai = baris.reduce(
    (s, b) => s + nilaiBaris(b) * (jepitPersen(b.progress) / 100),
    0,
  );
  return Math.round((tercapai / totalNilai) * 100);
}

/** Batasi persen ke rentang 0–100; nilai bukan angka dianggap nol. */
function jepitPersen(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Progres per unit dari sekumpulan baris BOQ SPK.
 *
 * Baris dari BEBERAPA SPK atas unit yang sama dijumlahkan jadi satu — sebuah
 * unit bisa dikerjakan lebih dari satu vendor (mis. struktur dan finishing
 * dipisah), dan progres unit adalah gabungan seluruhnya, bukan milik salah
 * satu kontrak.
 */
export function progresPerUnit(baris: BarisBoqSpk[]): Map<string, number> {
  return kelompokLalu(baris, (b) => b.unitId);
}

/** Progres per item sarana & prasarana, dengan cara yang sama seperti unit. */
export function progresPerSarpras(baris: BarisBoqSpk[]): Map<string, number> {
  return kelompokLalu(baris, (b) => b.infrastructureId);
}

function kelompokLalu(
  baris: BarisBoqSpk[],
  ambilKunci: (b: BarisBoqSpk) => string | null | undefined,
): Map<string, number> {
  const kelompok = new Map<string, BarisBoqSpk[]>();
  for (const b of baris) {
    const kunci = ambilKunci(b);
    if (!kunci) continue;
    const daftar = kelompok.get(kunci);
    if (daftar) daftar.push(b);
    else kelompok.set(kunci, [b]);
  }

  const hasil = new Map<string, number>();
  for (const [kunci, daftar] of kelompok) hasil.set(kunci, progresTertimbang(daftar));
  return hasil;
}

/**
 * Nilai pekerjaan yang sudah terpasang — dasar opname untuk penagihan.
 *
 * Inilah angka yang dicari dari seluruh mekanisme ini: bukan persen, melainkan
 * rupiah pekerjaan yang benar-benar sudah dikerjakan.
 */
export function nilaiTerpasang(baris: BarisBoqSpk[]): number {
  return baris.reduce((s, b) => s + nilaiBaris(b) * (jepitPersen(b.progress) / 100), 0);
}

/**
 * Periksa satu baris BOQ SPK sebelum disimpan.
 *
 * Mengembalikan pesan galat berbahasa manusia, atau null bila baris sah.
 */
export function periksaBarisBoqSpk(b: {
  unitId?: string | null;
  infrastructureId?: string | null;
  uraian?: string;
  volume: number;
  hargaSatuan: number;
  progress: number;
}): string | null {
  if (b.unitId && b.infrastructureId) {
    return "Satu baris BOQ hanya boleh untuk unit ATAU sarana & prasarana, tidak keduanya.";
  }
  if (!b.unitId && !b.infrastructureId) {
    return "Tiap baris BOQ harus ditujukan ke satu unit atau satu item sarana & prasarana.";
  }
  if (b.uraian !== undefined && b.uraian.trim() === "") {
    return "Uraian pekerjaan tidak boleh kosong.";
  }
  if (!Number.isFinite(b.volume) || b.volume < 0) {
    return "Volume harus berupa angka dan tidak boleh negatif.";
  }
  if (!Number.isFinite(b.hargaSatuan) || b.hargaSatuan < 0) {
    return "Harga satuan harus berupa angka dan tidak boleh negatif.";
  }
  if (!Number.isFinite(b.progress) || b.progress < 0 || b.progress > 100) {
    return "Progres tiap baris harus di antara 0 dan 100 persen.";
  }
  return null;
}

/**
 * Status pembangunan yang mengikuti progres.
 *
 * Disamakan dengan aturan yang sudah dipakai `ubahProgresUnit` supaya sebuah
 * unit tidak berpindah status hanya karena progresnya datang dari jalur yang
 * berbeda.
 */
export function statusDariProgres(progress: number): string {
  if (progress >= 100) return "Selesai";
  return progress > 0 ? "Progress" : "Belum terbangun";
}
