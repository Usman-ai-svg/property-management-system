import {
  bersihkanNamaFile, ekstensiDari, GagalUnggah, JENIS_DITERIMA, MAKS_UKURAN,
  periksaBerkas, tipeDari,
} from "@/lib/adaptor/berkas-aturan";
import { buatMesinGdrive, konfigDariEnv, type Env, type OpsiGdrive } from "./gdrive";
import * as lokal from "./lokal";

/**
 * PENYIMPANAN BERKAS — pemilihan mesin.
 *
 * Tanda tangannya sengaja tidak berubah dari versi disk-lokal sebelumnya:
 * sebelas pemanggil di halaman, aksi, dan rute tidak perlu tahu berkas
 * disimpan di mana. Aturannya (jenis diterima, batas ukuran, pembersihan
 * nama, bentuk kunci) tetap di `src/lib/adaptor/berkas-aturan.ts`.
 *
 * Mesin dipilih lewat `STORAGE_ENGINE`:
 *
 *   lokal   — disk aplikasi. Bawaan; demo jalan tanpa kredensial apa pun.
 *   gdrive  — Google Drive lewat service account. Untuk .skp 24–38 MB.
 *
 * ------------------------------------------------------------------------
 * KENAPA PEMBACAAN DIRUTE PER KUNCI, BUKAN PER KONFIGURASI
 * ------------------------------------------------------------------------
 * Kunci berkas Drive diberi awalan `gdrive:`. Pembacaan melihat awalan itu,
 * bukan mesin yang sedang dikonfigurasi. Akibatnya berkas yang sudah telanjur
 * tersimpan di disk TETAP terbaca setelah organisasi pindah ke Drive, dan
 * perpindahannya tidak perlu sekali jalan.
 *
 * Kalau routing mengikuti konfigurasi, hari peralihan berubah menjadi migrasi
 * besar yang harus berhasil seluruhnya — dan setiap dokumen lama menjadi
 * tautan mati sampai migrasi itu selesai.
 */

const AWALAN_GDRIVE = "gdrive:";

export {
  bersihkanNamaFile, ekstensiDari, GagalUnggah, JENIS_DITERIMA, MAKS_UKURAN,
  periksaBerkas, tipeDari,
};

/** Mesin yang sedang aktif untuk penulisan berkas BARU. */
export function mesinAktif(env: Env = process.env): "lokal" | "gdrive" {
  return env.STORAGE_ENGINE === "gdrive" ? "gdrive" : "lokal";
}

/** Benar bila kunci menunjuk berkas di Google Drive. */
export const diGdrive = (objectKey: string): boolean => objectKey.startsWith(AWALAN_GDRIVE);

/** Id berkas Drive dari sebuah kunci. */
const idGdrive = (objectKey: string): string => objectKey.slice(AWALAN_GDRIVE.length);

function mesinGdrive(env: Env = process.env, opsi: OpsiGdrive = {}) {
  const konfig = konfigDariEnv(env);
  if (!konfig) {
    throw new GagalUnggah(
      "Penyimpanan Google Drive belum dikonfigurasi. Isi GDRIVE_CLIENT_EMAIL, " +
        "GDRIVE_PRIVATE_KEY, dan GDRIVE_FOLDER_ID — lihat .env.example.",
    );
  }
  return buatMesinGdrive(konfig, opsi);
}

/** Simpan berkas dan kembalikan kunci objeknya. */
export async function simpanBerkas(
  data: ArrayBuffer,
  namaAsli: string,
): Promise<{ objectKey: string; ukuranByte: number; sha256: string }> {
  if (mesinAktif() === "gdrive") return mesinGdrive().simpan(data, namaAsli);
  return lokal.simpan(data, namaAsli);
}

/** Baca berkas berdasarkan kunci objeknya, di mana pun ia tersimpan. */
export async function bacaBerkas(objectKey: string): Promise<Buffer> {
  if (diGdrive(objectKey)) return mesinGdrive().baca(idGdrive(objectKey));
  return lokal.baca(objectKey);
}

export async function hapusBerkas(objectKey: string): Promise<void> {
  if (diGdrive(objectKey)) return mesinGdrive().hapus(idGdrive(objectKey));
  return lokal.hapus(objectKey);
}

/**
 * Ekstensi yang diterima per kategori dokumen — lebih sempit daripada
 * `JENIS_DITERIMA`, yang hanya menyaring jenis berkas secara umum. Tiap
 * kategori dokumen hanya menerima SATU jenis berkas, supaya salah unggah
 * (mis. DWG ke slot PDF) ditolak sebelum tersimpan.
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
 * umum `periksaBerkas`. Kategori yang tidak terdaftar (mis. "analisa",
 * "lain") tidak dibatasi lebih lanjut di sini.
 */
export function periksaBerkasKategori(nama: string, kategori: string): void {
  const diizinkan = KATEGORI_EKSTENSI[kategori];
  if (!diizinkan) return;

  const ext = ekstensiDari(nama);
  if (!diizinkan.includes(ext)) {
    throw new GagalUnggah(
      `Dokumen ini hanya menerima berkas ${diizinkan.join(" atau ")}, bukan "${ext || "tanpa ekstensi"}".`,
    );
  }
}
