/**
 * Aturan pengelompokan baris tabel. Murni — tanpa React, tanpa DOM.
 *
 * Dipisah dari komponen tabelnya karena urutan kelompok adalah keputusan yang
 * harus sama di semua tampilan: BOQ yang dikelompokkan per tahap pekerjaan
 * harus muncul dalam urutan pelaksanaan (Persiapan sebelum Struktur sebelum
 * Finishing), bukan alfabetis. Di ERP tabelnya digambar ulang dengan cara lain,
 * tapi urutan ini harus ikut.
 */

export interface KelompokBaris<T> {
  nama: string;
  rows: T[];
}

/** Nama kelompok untuk baris yang tidak menyebutkan kelompoknya. */
export const GRUP_LAINNYA = "Lainnya";

/**
 * Kelompokkan baris menurut `grup`, urut sesuai `urutanGrup`.
 *
 * Tiga aturan yang berlaku, dan ketiganya disengaja:
 *
 *   1. Baris tanpa nama kelompok masuk ke "Lainnya" — tidak dibuang.
 *   2. Kelompok yang tidak ada di `urutanGrup` ditaruh SESUDAH yang terdaftar.
 *      Kelompok buatan pengguna muncul di bawah daftar baku, bukan menyelip di
 *      tengahnya.
 *   3. Sesama kelompok tak terdaftar diurutkan alfabetis, supaya urutannya
 *      tidak bergantung pada baris mana yang kebetulan tersimpan lebih dulu.
 */
export function kelompokkanBaris<T>(
  rows: T[],
  grup: (t: T) => string,
  urutanGrup?: readonly string[],
): KelompokBaris<T>[] {
  const peta = new Map<string, T[]>();
  for (const t of rows) {
    const g = grup(t) || GRUP_LAINNYA;
    const list = peta.get(g);
    if (list) list.push(t);
    else peta.set(g, [t]);
  }

  const posisi = (n: string) => {
    const i = urutanGrup?.indexOf(n) ?? -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  return [...peta.entries()]
    .map(([nama, r]) => ({ nama, rows: r }))
    .sort((a, b) => posisi(a.nama) - posisi(b.nama) || a.nama.localeCompare(b.nama));
}
