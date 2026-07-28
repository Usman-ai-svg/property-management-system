import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Penyimpanan berkas.
 *
 * Untuk demo, berkas disimpan di disk lokal pada folder `storage/`. Bentuk
 * antarmukanya sengaja dibuat seperti object storage — kunci objek, simpan,
 * baca, hapus — supaya penggantian ke S3/R2 nanti hanya menyentuh berkas ini.
 *
 * Berkas TIDAK disimpan di dalam database: berkas .skp pada proyek ini
 * berukuran 24–38 MB, dan menyimpan biner sebesar itu di baris tabel membuat
 * setiap query yang menyentuhnya jadi mahal.
 */

const AKAR = path.join(process.cwd(), "storage");

/** Batas ukuran unggahan. Berkas 3D terbesar pada data demo 38 MB. */
export const MAKS_UKURAN = 64 * 1024 * 1024;

/**
 * Jenis berkas yang diterima.
 *
 * Daftar putih, bukan daftar hitam: apa pun yang tidak disebutkan ditolak.
 * Membalik urutannya berarti setiap jenis berkas baru yang berbahaya harus
 * ditemukan lebih dulu sebelum bisa dicegah.
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

export class GagalUnggah extends Error {}

/** Nama berkas yang aman: tanpa path, tanpa karakter aneh. */
export function bersihkanNamaFile(nama: string): string {
  const dasar = path.basename(nama).replace(/[^\w.\-() ]/g, "_").trim();
  if (!dasar || dasar === "." || dasar === "..") throw new GagalUnggah("Nama berkas tidak sah.");
  return dasar.slice(0, 180);
}

/** Periksa jenis dan ukuran sebelum apa pun ditulis ke disk. */
export function periksaBerkas(nama: string, tipe: string, ukuran: number): void {
  if (ukuran === 0) throw new GagalUnggah("Berkas kosong.");
  if (ukuran > MAKS_UKURAN) {
    throw new GagalUnggah(
      `Berkas ${(ukuran / 1024 / 1024).toFixed(1)} MB melebihi batas ${MAKS_UKURAN / 1024 / 1024} MB.`,
    );
  }

  const ext = path.extname(nama).toLowerCase();
  const diizinkan = JENIS_DITERIMA[tipe];

  if (!diizinkan || !diizinkan.includes(ext)) {
    throw new GagalUnggah(
      `Jenis berkas "${ext || "tanpa ekstensi"}" tidak diterima. ` +
        "Yang diterima: PDF, JPG, PNG, WEBP, XLSX, DOCX, SKP, DWG, RVT.",
    );
  }
}

/**
 * Simpan berkas dan kembalikan kunci objeknya.
 *
 * Kunci memuat UUID, bukan nama asli, supaya dua unggahan bernama sama tidak
 * saling menimpa dan nama berkas tidak bisa dipakai menebak isi folder.
 */
export async function simpanBerkas(
  data: ArrayBuffer,
  namaAsli: string,
): Promise<{ objectKey: string; ukuranByte: number; sha256: string }> {
  const buf = Buffer.from(data);
  const ext = path.extname(namaAsli).toLowerCase();
  const tahun = new Date().getUTCFullYear();
  const objectKey = `${tahun}/${randomUUID()}${ext}`;
  const tujuan = path.join(AKAR, objectKey);

  await mkdir(path.dirname(tujuan), { recursive: true });
  await writeFile(tujuan, buf);

  return {
    objectKey,
    ukuranByte: buf.byteLength,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

/**
 * Baca berkas berdasarkan kunci objeknya.
 *
 * Kunci divalidasi terhadap akar penyimpanan supaya `../` pada nilai yang
 * tersimpan tidak bisa dipakai membaca berkas di luar folder storage.
 */
export async function bacaBerkas(objectKey: string): Promise<Buffer> {
  const tujuan = path.resolve(AKAR, objectKey);
  if (!tujuan.startsWith(AKAR + path.sep)) {
    throw new GagalUnggah("Kunci objek tidak sah.");
  }
  return readFile(tujuan);
}

export async function hapusBerkas(objectKey: string): Promise<void> {
  const tujuan = path.resolve(AKAR, objectKey);
  if (!tujuan.startsWith(AKAR + path.sep)) return;
  await unlink(tujuan).catch(() => {});
}

/**
 * Ekstensi yang diterima per kategori dokumen — lebih sempit daripada
 * `JENIS_DITERIMA` di atas, yang hanya menyaring jenis berkas secara umum.
 * Tiap kategori dokumen (3D Model, Gambar Kerja PDF, dsb.) hanya menerima
 * SATU jenis berkas, supaya salah unggah (mis. DWG ke slot PDF) ditolak
 * sebelum tersimpan.
 */
export const KATEGORI_EKSTENSI: Record<string, string[]> = {
  model3d: [".skp"],
  gambarKerjaPdf: [".pdf"],
  gambarKerjaDwg: [".dwg"],
  render: [".pdf"],
  spek: [".xlsx", ".xls"],
  desain: [".pdf"],
  rab: [".pdf"],
  legalitas: [".pdf"],
};

/**
 * Periksa berkas terhadap batasan kategori dokumennya, di atas pemeriksaan
 * umum `periksaBerkas`. Kategori yang tidak terdaftar di `KATEGORI_EKSTENSI`
 * (mis. "analisa", "lain") tidak dibatasi lebih lanjut di sini.
 */
export function periksaBerkasKategori(nama: string, kategori: string): void {
  const diizinkan = KATEGORI_EKSTENSI[kategori];
  if (!diizinkan) return;

  const ext = path.extname(nama).toLowerCase();
  if (!diizinkan.includes(ext)) {
    throw new GagalUnggah(
      `Dokumen ini hanya menerima berkas ${diizinkan.join(" atau ")}, bukan "${ext || "tanpa ekstensi"}".`,
    );
  }
}

/** Tipe MIME untuk dikirim saat mengunduh. */
export function tipeDari(nama: string): string {
  const ext = path.extname(nama).toLowerCase();
  for (const [mime, daftar] of Object.entries(JENIS_DITERIMA)) {
    if (mime && daftar.includes(ext)) return mime;
  }
  return "application/octet-stream";
}
