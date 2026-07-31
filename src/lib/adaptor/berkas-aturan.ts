/**
 * ATURAN BERKAS — bagian yang tidak boleh berubah saat penyimpanannya diganti.
 *
 * Dipisahkan dari `src/lib/storage.ts` yang berisi mesinnya (disk lokal
 * sekarang, Supabase Storage nanti). Berkas ini murni: tanpa `node:fs`, tanpa
 * `node:path`, tanpa framework — jadi bisa dipakai apa adanya di ERP dan bisa
 * diuji tanpa menyentuh disk.
 *
 * Yang diamankan di sini bukan kerapian melainkan tiga hal:
 * daftar putih jenis berkas, batas ukuran, dan pembersihan nama.
 */

export class GagalUnggah extends Error {}

/** Batas ukuran unggahan. Berkas 3D terbesar pada data demo 38 MB. */
export const MAKS_UKURAN = 64 * 1024 * 1024;

/**
 * Jenis berkas yang diterima.
 *
 * Daftar putih, bukan daftar hitam: apa pun yang tidak disebutkan ditolak.
 * Membalik urutannya berarti setiap jenis berkas baru yang berbahaya harus
 * ditemukan lebih dulu sebelum bisa dicegah — dan itu selalu terlambat.
 */
export const JENIS_DITERIMA: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/octet-stream": [".skp", ".dwg", ".rvt"],
  "": [".skp", ".dwg", ".rvt"],
};

/** Ekstensi berhuruf kecil dari sebuah nama berkas, termasuk titiknya. */
export function ekstensiDari(nama: string): string {
  const i = nama.lastIndexOf(".");
  const j = Math.max(nama.lastIndexOf("/"), nama.lastIndexOf("\\"));
  if (i <= 0 || i < j) return "";
  return nama.slice(i).toLowerCase();
}

/** Nama berkas tanpa jalur direktori, apa pun pemisah yang dipakai. */
export function namaSaja(nama: string): string {
  const i = Math.max(nama.lastIndexOf("/"), nama.lastIndexOf("\\"));
  return i >= 0 ? nama.slice(i + 1) : nama;
}

/**
 * Nama berkas yang aman: tanpa jalur, tanpa karakter aneh, dibatasi panjangnya.
 *
 * Menerima pemisah gaya Windows maupun POSIX, karena berkas diunggah dari
 * kedua jenis mesin dan `path.basename` di server hanya mengenali salah satu.
 */
export function bersihkanNamaFile(nama: string): string {
  const dasar = namaSaja(nama).replace(/[^\w.\-() ]/g, "_").trim();
  if (!dasar || dasar === "." || dasar === "..") throw new GagalUnggah("Nama berkas tidak sah.");
  return dasar.slice(0, 180);
}

/** Periksa jenis dan ukuran SEBELUM apa pun ditulis ke penyimpanan. */
export function periksaBerkas(nama: string, tipe: string, ukuran: number): void {
  if (ukuran === 0) throw new GagalUnggah("Berkas kosong.");
  if (ukuran > MAKS_UKURAN) {
    throw new GagalUnggah(
      `Berkas ${(ukuran / 1024 / 1024).toFixed(1)} MB melebihi batas ${MAKS_UKURAN / 1024 / 1024} MB.`,
    );
  }

  const ext = ekstensiDari(nama);
  const diizinkan = JENIS_DITERIMA[tipe];

  if (!diizinkan || !diizinkan.includes(ext)) {
    throw new GagalUnggah(
      `Jenis berkas "${ext || "tanpa ekstensi"}" tidak diterima. ` +
        "Yang diterima: PDF, JPG, PNG, WEBP, XLSX, DOCX, SKP, DWG, RVT.",
    );
  }
}

/**
 * Kunci objek untuk sebuah unggahan baru.
 *
 * Memuat UUID, bukan nama asli, supaya dua unggahan bernama sama tidak saling
 * menimpa dan nama berkas tidak bisa dipakai menebak isi folder. Dikelompokkan
 * per tahun supaya satu folder tidak terus membesar tanpa batas.
 *
 * `uuid` dan `tahun` dioper masuk, tidak dibangkitkan di dalam, supaya
 * hasilnya bisa diuji.
 */
export function kunciObjek(namaAsli: string, uuid: string, tahun: number): string {
  return `${tahun}/${uuid}${ekstensiDari(namaAsli)}`;
}

/**
 * Apakah sebuah kunci objek aman dipakai.
 *
 * Menolak jalur absolut dan segmen `..`. Nilai kunci tersimpan di database,
 * dan database bisa saja diisi dari jalur lain — jadi kunci tetap diperiksa
 * saat dipakai, bukan hanya saat dibuat.
 */
export function kunciAman(objectKey: string): boolean {
  if (!objectKey || objectKey.startsWith("/") || objectKey.startsWith("\\")) return false;
  if (/^[A-Za-z]:/.test(objectKey)) return false;
  return !objectKey.split(/[/\\]/).some((seg) => seg === ".." || seg === "");
}

/** Tipe MIME untuk dikirim saat mengunduh. */
export function tipeDari(nama: string): string {
  const ext = ekstensiDari(nama);
  for (const [mime, daftar] of Object.entries(JENIS_DITERIMA)) {
    if (mime && daftar.includes(ext)) return mime;
  }
  return "application/octet-stream";
}
