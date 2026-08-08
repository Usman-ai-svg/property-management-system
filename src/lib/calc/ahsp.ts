/**
 * Perhitungan AHSP (Analisa Harga Satuan Pekerjaan) dan RAB Estimasi.
 *
 * Semua fungsi di sini murni: input → output, tanpa I/O, tanpa React, tanpa
 * Prisma. Sama seperti `boq.ts`, ini disengaja supaya rumusnya bisa dibaca
 * sebagai spesifikasi dan dipindahkan ke bahasa apa pun.
 *
 * Rumus intinya, seperti pada lembar AHSP standar Indonesia:
 *
 *   harga satuan pekerjaan
 *     = ( ΣA upah  +  ΣB bahan  +  ΣC alat ) × (1 + overhead%)
 *
 * dengan tiap komponen = koefisien × harga satuan dasar. Overhead & keuntungan
 * dikenakan atas jumlah biaya langsung, bukan per kelompok.
 */

/** Kelompok harga dasar. Menentukan komponen masuk ke ΣA, ΣB, atau ΣC. */
export type KelompokDasar = "UPAH" | "BAHAN" | "ALAT";

/**
 * Satu komponen analisa: sebuah harga dasar dengan koefisien pemakaiannya.
 * `hargaAcuan` adalah nilai yang dipakai perhitungan (dari `HargaDasar`).
 */
export interface KomponenAnalisa {
  kelompok: KelompokDasar;
  koefisien: number;
  hargaAcuan: number;
}

/** Sebuah analisa: overhead per-analisa (dalam persen) + komponen-komponennya. */
export interface Analisa {
  /** Overhead & keuntungan dalam persen. 13 berarti 13%. */
  overheadPct: number;
  komponen: KomponenAnalisa[];
}

/** Rincian biaya sebuah komponen. */
export const biayaKomponen = (k: Pick<KomponenAnalisa, "koefisien" | "hargaAcuan">): number =>
  k.koefisien * k.hargaAcuan;

/** Jumlah biaya komponen pada satu kelompok (UPAH / BAHAN / ALAT). */
export function biayaKelompok(komponen: KomponenAnalisa[], kelompok: KelompokDasar): number {
  return komponen
    .filter((k) => k.kelompok === kelompok)
    .reduce((s, k) => s + biayaKomponen(k), 0);
}

export interface RekapAnalisa {
  /** ΣA — jumlah upah tenaga kerja. */
  upah: number;
  /** ΣB — jumlah harga bahan. */
  bahan: number;
  /** ΣC — jumlah harga alat. */
  alat: number;
  /** Biaya langsung = upah + bahan + alat, sebelum overhead. */
  langsung: number;
  /** Overhead & keuntungan = langsung × overheadPct%. */
  overhead: number;
  /**
   * Harga satuan pekerjaan, DIBULATKAN ke rupiah penuh.
   *
   * Inilah angka yang di-snapshot ke `RabEstimasiItem.hargaSatuan`. Dibulatkan
   * di sini supaya nilai yang tersimpan sama persis dengan yang ditampilkan —
   * konsekuensinya `langsung + overhead` (keduanya tak dibulatkan) bisa selisih
   * pecahan rupiah dari `hargaSatuan`, dan itu memang diharapkan.
   */
  hargaSatuan: number;
}

/** Uraikan sebuah analisa menjadi rincian per kelompok beserta harga satuannya. */
export function rekapAnalisa(a: Analisa): RekapAnalisa {
  const upah = biayaKelompok(a.komponen, "UPAH");
  const bahan = biayaKelompok(a.komponen, "BAHAN");
  const alat = biayaKelompok(a.komponen, "ALAT");
  const langsung = upah + bahan + alat;
  const overhead = (langsung * a.overheadPct) / 100;

  return {
    upah,
    bahan,
    alat,
    langsung,
    overhead,
    hargaSatuan: Math.round(langsung + overhead),
  };
}

/** Harga satuan sebuah analisa (rupiah bulat) — dasar snapshot ke RAB. */
export const hargaSatuanAnalisa = (a: Analisa): number => rekapAnalisa(a).hargaSatuan;

// ---------------------------------------------------------------------------
// RAB Estimasi
// ---------------------------------------------------------------------------

export interface BarisRab {
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  urutan: number;
}

/** Nilai satu baris RAB = volume × harga satuan. */
export const nilaiBaris = (r: { volume: number; hargaSatuan: number }): number =>
  r.volume * r.hargaSatuan;

/** Jumlahkan nilai sekumpulan baris RAB. */
export const totalRab = (rows: { volume: number; hargaSatuan: number }[]): number =>
  rows.reduce((s, r) => s + nilaiBaris(r), 0);

export interface GrupRab<T> {
  nama: string;
  items: T[];
  total: number;
}

/**
 * Kelompokkan baris RAB per grup pekerjaan untuk ditampilkan.
 * Urutan grup mengikuti kemunculan pertama, bukan alfabetis — sama seperti
 * `kelompokkanRap` pada boq.ts, supaya susunan RAB terbaca sesuai urutan kerja.
 */
export function rekapRabPerGrup<T extends { grup: string; volume: number; hargaSatuan: number }>(
  rows: T[],
): GrupRab<T>[] {
  const peta = new Map<string, T[]>();
  for (const r of rows) {
    const list = peta.get(r.grup);
    if (list) list.push(r);
    else peta.set(r.grup, [r]);
  }
  return [...peta.entries()].map(([nama, items]) => ({
    nama,
    items,
    total: totalRab(items),
  }));
}
