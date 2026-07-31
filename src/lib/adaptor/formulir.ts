/**
 * ATURAN PEMBACAAN ISIAN FORMULIR.
 *
 * Murni: tidak menyentuh `FormData`, Next.js, maupun Prisma. Bekerja di atas
 * sebuah fungsi pembaca `(nama) => string | null`, sehingga sumber isiannya
 * bisa apa saja — `FormData` sekarang, `Object.fromEntries` atau parameter
 * RPC nanti.
 *
 * Dipisahkan karena dua alasan:
 *
 *   1. Fungsi-fungsi ini yang paling banyak dipanggil di seluruh basis kode
 *      (`teks` 57 kali, `angka` 34 kali). Kesalahan di sini menyebar ke 79
 *      Server Action sekaligus.
 *   2. Saat aksi menjadi RPC Postgres, validasi ini tidak boleh ikut ditulis
 *      ulang. Angka yang diterima form dan angka yang diterima RPC harus
 *      dibaca dengan cara yang sama persis.
 */

/** Galat yang pesannya memang untuk ditampilkan ke pengguna. */
export class GagalIsian extends Error {}

/** Sumber isian: kembalikan nilai mentah, atau null bila tidak ada. */
export type Pembaca = (nama: string) => string | null;

/**
 * Baca angka bergaya Indonesia.
 *
 * Aturannya, dan alasan tiap cabangnya:
 *
 *   - Ada koma  → titik adalah pemisah ribuan, koma pemisah desimal.
 *                 "1.250,5" berarti seribu dua ratus lima puluh koma lima.
 *   - Tanpa koma, tapi titik diikuti TEPAT tiga digit berulang → pemisah
 *                 ribuan. "1.250" berarti seribu dua ratus lima puluh,
 *                 karena orang mengetik harga begitu.
 *   - Selain itu → titik dianggap pemisah desimal gaya Inggris. "12.5"
 *                 berarti dua belas setengah, karena volume ditulis begitu.
 *
 * Cabang kedua yang membuatnya rumit dan tidak bisa disederhanakan: "1.250"
 * dan "12.5" harus dibaca berbeda meski sama-sama satu titik.
 */
export function angkaIndonesia(mentah: string, opsi: { terimaRp?: boolean } = {}): number | null {
  let teks = mentah.trim();
  if (teks === "") return null;
  if (opsi.terimaRp) teks = teks.replace(/^Rp\s*/i, "");

  const bersih = teks.includes(",")
    ? teks.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(teks)
      ? teks.replace(/\./g, "")
      : teks;

  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}

/** Teks yang sudah dipangkas. Melempar bila wajib tapi kosong. */
export function bacaTeks(baca: Pembaca, nama: string, wajib = false): string {
  const v = (baca(nama) ?? "").trim();
  if (wajib && !v) throw new GagalIsian(`Kolom "${nama}" wajib diisi.`);
  return v;
}

/** Teks, atau null bila kosong — bukan string kosong. */
export function bacaTeksOpsional(baca: Pembaca, nama: string): string | null {
  const v = (baca(nama) ?? "").trim();
  return v === "" ? null : v;
}

export interface OpsiAngka {
  min?: number;
  max?: number;
  wajib?: boolean;
  /**
   * Terima awalan "Rp".
   *
   * Sengaja tidak aktif secara bawaan: perilaku formulir sekarang menolak
   * "Rp 500.000", dan menyalakannya di semua tempat adalah perubahan
   * perilaku, bukan perapian. Impor Excel menyalakannya karena berkas nyata
   * memang memuat awalan itu.
   */
  terimaRp?: boolean;
}

/**
 * Baca angka dari isian.
 *
 * Isian kosong bernilai 0 bila tidak wajib — bukan null — karena hampir
 * seluruh pemanggil menyimpannya ke kolom bertipe angka.
 */
export function bacaAngka(baca: Pembaca, nama: string, opts: OpsiAngka = {}): number {
  const mentah = (baca(nama) ?? "").trim();

  if (mentah === "") {
    if (opts.wajib) throw new GagalIsian(`Kolom "${nama}" wajib diisi.`);
    return 0;
  }

  const n = angkaIndonesia(mentah, { terimaRp: opts.terimaRp });
  if (n === null) {
    throw new GagalIsian(`Nilai "${mentah}" pada kolom "${nama}" bukan angka yang sah.`);
  }
  if (opts.min != null && n < opts.min) {
    throw new GagalIsian(`Kolom "${nama}" tidak boleh kurang dari ${opts.min}.`);
  }
  if (opts.max != null && n > opts.max) {
    throw new GagalIsian(`Kolom "${nama}" tidak boleh lebih dari ${opts.max}.`);
  }

  return n;
}

/**
 * Baca pilihan yang harus termasuk daftar nilai sah.
 *
 * Daftar putih: nilai di luar daftar ditolak, bukan disimpan apa adanya.
 * Ini yang menahan nilai enum karangan masuk ke database lewat permintaan
 * yang dibuat manual.
 */
export function bacaPilihan<T extends string>(
  baca: Pembaca,
  nama: string,
  sah: readonly T[],
): T {
  const v = ((baca(nama) ?? "").trim()) as T;
  if (!sah.includes(v)) throw new GagalIsian(`Nilai "${v}" tidak sah untuk kolom "${nama}".`);
  return v;
}
