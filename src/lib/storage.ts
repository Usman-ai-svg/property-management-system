import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bersihkanNamaFile, ekstensiDari, GagalUnggah, JENIS_DITERIMA, kunciAman,
  kunciObjek, MAKS_UKURAN, periksaBerkas, tipeDari,
} from "@/lib/adaptor/berkas-aturan";

/**
 * MESIN PENYIMPANAN BERKAS — disk lokal.
 *
 * Aturannya (jenis yang diterima, batas ukuran, pembersihan nama, bentuk
 * kunci objek) ada di `src/lib/adaptor/berkas-aturan.ts` dan tidak boleh ikut
 * berubah saat mesinnya diganti. Berkas ini hanya berisi cara menulis dan
 * membacanya.
 *
 * Untuk ERP: ganti isi `simpanBerkas`, `bacaBerkas`, dan `hapusBerkas` dengan
 * pemanggilan Supabase Storage. Tanda tangan ketiganya sudah berbentuk object
 * storage — kunci objek masuk, isi keluar — jadi pemanggilnya tidak perlu
 * disentuh.
 *
 * Berkas TIDAK disimpan di dalam database: berkas .skp pada proyek ini
 * berukuran 24–38 MB, dan menyimpan biner sebesar itu di baris tabel membuat
 * setiap query yang menyentuhnya jadi mahal.
 */

const AKAR = path.join(process.cwd(), "storage");

export {
  bersihkanNamaFile, GagalUnggah, JENIS_DITERIMA, MAKS_UKURAN, periksaBerkas, tipeDari,
};

/** Simpan berkas dan kembalikan kunci objeknya. */
export async function simpanBerkas(
  data: ArrayBuffer,
  namaAsli: string,
): Promise<{ objectKey: string; ukuranByte: number; sha256: string }> {
  const buf = Buffer.from(data);
  const objectKey = kunciObjek(namaAsli, randomUUID(), new Date().getUTCFullYear());
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
 * Kunci diperiksa dua kali: lewat `kunciAman()` yang menolak `..` dan jalur
 * absolut, lalu lewat perbandingan jalur hasil resolve terhadap akar
 * penyimpanan. Yang kedua menangkap kasus yang lolos dari yang pertama pada
 * sistem berkas tertentu.
 */
export async function bacaBerkas(objectKey: string): Promise<Buffer> {
  if (!kunciAman(objectKey)) throw new GagalUnggah("Kunci objek tidak sah.");
  const tujuan = path.resolve(AKAR, objectKey);
  if (!tujuan.startsWith(AKAR + path.sep)) {
    throw new GagalUnggah("Kunci objek tidak sah.");
  }
  return readFile(tujuan);
}

export async function hapusBerkas(objectKey: string): Promise<void> {
  if (!kunciAman(objectKey)) return;
  const tujuan = path.resolve(AKAR, objectKey);
  if (!tujuan.startsWith(AKAR + path.sep)) return;
  await unlink(tujuan).catch(() => {});
}

/** Dipakai hanya oleh tes; diekspor supaya aturan ekstensi punya satu rumah. */
export { ekstensiDari };
