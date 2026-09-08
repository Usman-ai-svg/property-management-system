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
 * Batas selisih yang masih dianggap "BOQ cocok dengan nilai SPK", dalam rupiah.
 *
 * Nilai SPK dan jumlah baris BOQ dihitung lewat jalur berbeda dan tiap baris
 * dibulatkan sendiri-sendiri, jadi selisih beberapa sen memang wajar. Selisih
 * satu rupiah ke atas tidak wajar: itu tanda ada baris yang belum terinci atau
 * volume yang keliru, dan harus terlihat oleh QS.
 */
export const TOLERANSI_SELISIH_BOQ = 1;

/**
 * Apakah rincian BOQ sudah menutup nilai SPK-nya.
 *
 * Dulu ditulis sebagai `Math.abs(selisih) < 1` di dalam komponen opname, tanpa
 * nama dan tanpa penjelasan kenapa angkanya satu.
 */
export const boqCocokDenganSpk = (nilaiBoq: number, nilaiKontrak: number): boolean =>
  Math.abs(nilaiBoq - nilaiKontrak) < TOLERANSI_SELISIH_BOQ;

/** Satu baris template BOQ SPK (level kontrak). */
export interface TemplateBoq {
  id: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  urutan?: number;
}

/** Override + opname sebuah baris template untuk satu objek. Field definisi
 * bernilai null berarti "ikut template". */
export interface OverrideBoq {
  grup?: string | null;
  uraian?: string | null;
  satuan?: string | null;
  volume?: number | null;
  hargaSatuan?: number | null;
  progress?: number | null;
  progressLalu?: number | null;
  progressLaluPada?: Date | null;
}

/** Baris BOQ efektif untuk satu objek: template dilebur dengan override-nya. */
export interface BarisEfektif {
  /** id baris TEMPLATE (bukan id override) — kunci opname & override.
   * Untuk baris VO diberi awalan "vo:" supaya opname mengarah ke ContractVoItem. */
  boqItemId: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  progress: number;
  /** true bila ada satu saja nilai definisi yang di-override untuk objek ini. */
  disesuaikan: boolean;
  /** Nomor VO asal baris ini (mis. "VO-01"); null/undefined untuk baris pokok. */
  voNomor?: string | null;
}

/** Baris VO satu objek — sudah "efektif" (tak perlu lebur template). */
export interface VoItemBoq {
  id: string;
  voNomor: string;
  unitId?: string | null;
  infrastructureId?: string | null;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  progress: number;
  progressLalu?: number;
  progressLaluPada?: Date | null;
}

/** Ubah baris VO menjadi BarisEfektif untuk digabung dengan baris template. */
export function barisVoEfektif(vo: VoItemBoq): BarisEfektif {
  return {
    boqItemId: `vo:${vo.id}`,
    grup: vo.grup,
    uraian: vo.uraian,
    satuan: vo.satuan,
    volume: vo.volume,
    hargaSatuan: vo.hargaSatuan,
    progress: vo.progress,
    disesuaikan: false,
    voNomor: vo.voNomor,
  };
}

/**
 * Lebur satu baris template dengan override objeknya menjadi baris efektif.
 * Field definisi memakai override bila terisi (bukan null), selain itu template
 * — inilah "warisan field-level" yang membuat perubahan template menurun ke
 * semua objek yang belum menyesuaikan field tersebut.
 */
export function barisEfektif(t: TemplateBoq, o?: OverrideBoq | null): BarisEfektif {
  const disesuaikan = Boolean(
    o && (o.grup != null || o.uraian != null || o.satuan != null || o.volume != null || o.hargaSatuan != null),
  );
  return {
    boqItemId: t.id,
    grup: o?.grup ?? t.grup,
    uraian: o?.uraian ?? t.uraian,
    satuan: o?.satuan ?? t.satuan,
    volume: o?.volume ?? t.volume,
    hargaSatuan: o?.hargaSatuan ?? t.hargaSatuan,
    progress: o?.progress ?? 0,
    disesuaikan,
  };
}

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
 * Nilai BOQ terinci SELURUH objek sebuah SPK — dasar "Nilai SPK".
 *
 * Model "satu BOQ berlaku untuk tiap unit": tiap objek (unit/sarpras) mewarisi
 * baris template, nilainya boleh di-override per objek. Nilai SPK adalah
 * penjumlahan nilai seluruh objek — Σ objek × Σ baris efektif — bukan nilai satu
 * template saja. Itulah definisi "3 unit × Rp20jt = Rp60jt": template Rp20jt
 * berlaku untuk tiap unit, jadi Nilai SPK ikut jumlah objek.
 *
 * Mengembalikan 0 bila belum ada baris template atau belum ada objek — pemanggil
 * memakai ini untuk memutuskan tetap memakai nilai manual (fallback).
 */
export function nilaiBoqSeluruhObjek(
  template: { id: string; volume: number; hargaSatuan: number }[],
  override: {
    boqItemId: string; unitId: string | null; infrastructureId: string | null;
    volume: number | null; hargaSatuan: number | null;
  }[],
  objekIds: string[],
): number {
  if (template.length === 0 || objekIds.length === 0) return 0;
  const peta = new Map(
    override.map((o) => [`${o.boqItemId}:${o.unitId ?? o.infrastructureId}`, o]),
  );
  let total = 0;
  for (const objId of objekIds) {
    for (const t of template) {
      const o = peta.get(`${t.id}:${objId}`);
      total += (o?.volume ?? t.volume) * (o?.hargaSatuan ?? t.hargaSatuan);
    }
  }
  return total;
}

/**
 * Progress Vendor sebuah SPK: progres tertimbang nilai seluruh baris efektif
 * dari semua objek yang dicakup. 0–100. Dasar tombol "Tandai Selesai" (aktif
 * saat mencapai 100%). Objek/baris yang belum diopname berkontribusi 0%.
 */
export function progresSpk(
  template: { id: string; volume: number; hargaSatuan: number }[],
  override: {
    boqItemId: string; unitId: string | null; infrastructureId: string | null;
    volume: number | null; hargaSatuan: number | null; progress: number;
  }[],
  objekIds: string[],
  /** Baris VO yang SUDAH DISETUJUI (semua objek) — ikut menimbang progres. */
  voItems: {
    unitId?: string | null; infrastructureId?: string | null;
    volume: number; hargaSatuan: number; progress: number;
  }[] = [],
): number {
  if (objekIds.length === 0) return 0;
  const objekSet = new Set(objekIds);
  const peta = new Map(
    override.map((o) => [`${o.boqItemId}:${o.unitId ?? o.infrastructureId}`, o]),
  );
  const baris: BarisBoqSpk[] = [];
  for (const objId of objekIds) {
    for (const t of template) {
      const o = peta.get(`${t.id}:${objId}`);
      baris.push({
        volume: o?.volume ?? t.volume,
        hargaSatuan: o?.hargaSatuan ?? t.hargaSatuan,
        progress: o?.progress ?? 0,
      });
    }
  }
  for (const v of voItems) {
    const objId = v.unitId ?? v.infrastructureId;
    if (!objId || !objekSet.has(objId)) continue;
    baris.push({ volume: v.volume, hargaSatuan: v.hargaSatuan, progress: v.progress });
  }
  if (baris.length === 0) return 0;
  return progresTertimbang(baris);
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
  uraian?: string;
  volume: number;
  hargaSatuan: number;
  progress?: number;
}): string | null {
  if (b.uraian !== undefined && b.uraian.trim() === "") {
    return "Uraian pekerjaan tidak boleh kosong.";
  }
  if (!Number.isFinite(b.volume) || b.volume < 0) {
    return "Volume harus berupa angka dan tidak boleh negatif.";
  }
  if (!Number.isFinite(b.hargaSatuan) || b.hargaSatuan < 0) {
    return "Harga satuan harus berupa angka dan tidak boleh negatif.";
  }
  if (b.progress !== undefined && (!Number.isFinite(b.progress) || b.progress < 0 || b.progress > 100)) {
    return "Progres tiap baris harus di antara 0 dan 100 persen.";
  }
  return null;
}

// Status pembangunan kini NILAI TURUNAN penuh — lihat src/lib/calc/status-bangun.ts
// (`statusBangunUnit` / `statusBangunSarpras`). Fungsi lama `statusDariProgres`
// dan `statusSelaras` dihapus: status tidak lagi diketik lalu "diselaraskan",
// melainkan disimpulkan seluruhnya dari progres + status jual + tanggal serah
// terima.

/**
 * Nominal sebuah Variation Order dari baris-barisnya, dibulatkan ke rupiah.
 *
 * Boleh negatif — VO juga dipakai untuk pekerjaan KURANG. Karena itu nol punya
 * arti khusus (tidak ada perubahan nilai sama sekali) dan pemanggilnya menolak
 * VO bernilai nol, bukan menyimpannya.
 */
export const nominalVo = (items: { volume: number; hargaSatuan: number }[]): number =>
  Math.round(items.reduce((s, it) => s + nilaiBaris(it), 0));
