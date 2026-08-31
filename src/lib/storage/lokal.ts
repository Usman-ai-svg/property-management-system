import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { GagalUnggah, kunciAman, kunciObjek } from "@/lib/adaptor/berkas-aturan";

/**
 * MESIN PENYIMPANAN — disk lokal.
 *
 * Dipakai demo dan pengembangan. Untuk produksi ERP, lihat `gdrive.ts`:
 * berkas .skp pada proyek ini berukuran 24–38 MB, dan menyimpan puluhan ribu
 * berkas sebesar itu di disk aplikasi bukan pilihan yang bertahan lama.
 *
 * Aturannya — jenis yang diterima, batas ukuran, pembersihan nama, bentuk
 * kunci objek — ada di `src/lib/adaptor/berkas-aturan.ts` dan TIDAK ikut
 * berubah saat mesinnya diganti.
 */

const AKAR = path.join(process.cwd(), "storage");

/** Jalur absolut sebuah kunci, atau null bila kuncinya tidak aman. */
function jalurAman(objectKey: string): string | null {
  if (!kunciAman(objectKey)) return null;
  const tujuan = path.resolve(AKAR, objectKey);
  // Diperiksa dua kali: `kunciAman` menolak `..` dan jalur absolut, lalu
  // perbandingan hasil resolve menangkap yang lolos darinya pada sistem
  // berkas tertentu.
  return tujuan.startsWith(AKAR + path.sep) ? tujuan : null;
}

export async function simpan(
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

export async function baca(objectKey: string): Promise<Buffer> {
  const tujuan = jalurAman(objectKey);
  if (!tujuan) throw new GagalUnggah("Kunci objek tidak sah.");
  return readFile(tujuan);
}

export async function hapus(objectKey: string): Promise<void> {
  const tujuan = jalurAman(objectKey);
  if (!tujuan) return;
  await unlink(tujuan).catch(() => {});
}
