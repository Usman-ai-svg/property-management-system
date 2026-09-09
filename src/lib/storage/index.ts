import {
  bersihkanNamaFile, ekstensiDari, GagalUnggah, JENIS_DITERIMA, MAKS_UKURAN,
  periksaBerkas, tipeDari,
} from "@/lib/adaptor/berkas-aturan";
import { buatMesinGdrive, konfigDariEnv, type Env, type OpsiGdrive } from "./gdrive";
import * as lokal from "./lokal";
import {
  AWALAN_TAUTAN, penyediaTautan, type HasilSimpan, type Penyedia, type PenyediaIsi,
} from "./penyedia";

/**
 * PENYIMPANAN BERKAS — pemilihan penyedia.
 *
 * Tanda tangannya sengaja tidak berubah dari versi disk-lokal sebelumnya:
 * sebelas pemanggil di halaman, aksi, dan rute tidak perlu tahu berkas
 * disimpan di mana. Aturannya (jenis diterima, batas ukuran, pembersihan
 * nama, bentuk kunci) tetap di `src/lib/adaptor/berkas-aturan.ts`.
 *
 * Tiga penyedia, bentuknya di `penyedia.ts`:
 *
 *   lokal   — disk aplikasi. Bawaan; demo jalan tanpa kredensial apa pun.
 *   gdrive  — Google Drive lewat service account. Untuk .skp 24–38 MB.
 *   tautan  — cuma mencatat URL berkas yang sudah ada di Drive.
 *
 * Mesin untuk berkas BARU yang isinya diunggah dipilih lewat `STORAGE_ENGINE`.
 * Penyedia tautan tidak ikut saklar itu: ia dipakai kalau pengguna menempelkan
 * alamat alih-alih memilih berkas, jadi pemilihannya ada pada bentuk masukan.
 *
 * ------------------------------------------------------------------------
 * KENAPA PEMBACAAN DIRUTE PER KUNCI, BUKAN PER KONFIGURASI
 * ------------------------------------------------------------------------
 * Kunci berkas Drive diberi awalan `gdrive:`, tautan luar `tautan:`. Pembacaan
 * melihat awalan itu, bukan mesin yang sedang dikonfigurasi. Akibatnya berkas
 * yang sudah telanjur tersimpan di disk TETAP terbaca setelah organisasi pindah
 * ke Drive, dan perpindahannya tidak perlu sekali jalan.
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
export { AWALAN_TAUTAN, HOST_TAUTAN } from "./penyedia";
export type { HasilSimpan, Penyedia, PenyediaAlamat, PenyediaIsi } from "./penyedia";

/** Mesin yang sedang aktif untuk penulisan berkas BARU. */
export function mesinAktif(env: Env = process.env): "lokal" | "gdrive" {
  return env.STORAGE_ENGINE === "gdrive" ? "gdrive" : "lokal";
}

/** Benar bila kunci menunjuk berkas di Google Drive. */
export const diGdrive = (objectKey: string): boolean => objectKey.startsWith(AWALAN_GDRIVE);

/** Benar bila kunci cuma mencatat alamat, bukan berkas yang kita pegang. */
export const diTautanLuar = (objectKey: string): boolean => objectKey.startsWith(AWALAN_TAUTAN);

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

const penyediaLokal: PenyediaIsi = {
  nama: "lokal",
  bentuk: "isi",
  // Kunci disk tidak berawalan: itu bentuk kunci warisan, dan berkas lama tidak
  // ditulis ulang hanya supaya routing di sini lebih rapi.
  awalan: "",
  simpan: lokal.simpan,
  baca: lokal.baca,
  hapus: lokal.hapus,
};

function penyediaGdrive(env: Env = process.env, opsi: OpsiGdrive = {}): PenyediaIsi {
  const mesin = mesinGdrive(env, opsi);
  const idDari = (kunci: string) => kunci.slice(AWALAN_GDRIVE.length);
  return {
    nama: "gdrive",
    bentuk: "isi",
    awalan: AWALAN_GDRIVE,
    simpan: (data, namaAsli) => mesin.simpan(data, namaAsli),
    baca: (kunci) => mesin.baca(idDari(kunci)),
    hapus: (kunci) => mesin.hapus(idDari(kunci)),
  };
}

/**
 * Penyedia pemilik sebuah kunci.
 *
 * Dibangun saat dipakai, bukan didaftarkan di awal: penyedia Drive melempar
 * kalau kredensialnya belum ada, dan itu tidak boleh menjatuhkan aplikasi yang
 * cuma membaca berkas dari disk.
 */
export function penyediaKunci(objectKey: string): Penyedia {
  if (diTautanLuar(objectKey)) return penyediaTautan;
  if (diGdrive(objectKey)) return penyediaGdrive();
  return penyediaLokal;
}

/** Simpan berkas dan kembalikan kunci objeknya. */
export async function simpanBerkas(
  data: ArrayBuffer,
  namaAsli: string,
): Promise<HasilSimpan> {
  if (mesinAktif() === "gdrive") return penyediaGdrive().simpan(data, namaAsli);
  return penyediaLokal.simpan(data, namaAsli);
}

/** Catat berkas yang sudah ada di Drive, tanpa memindahkan isinya. */
export function catatTautan(alamat: string): HasilSimpan {
  return penyediaTautan.catat(alamat);
}

/** Alamat yang bisa dibuka peramban, atau null bila isinya kita pegang sendiri. */
export function alamatLuar(objectKey: string): string | null {
  const p = penyediaKunci(objectKey);
  return p.bentuk === "alamat" ? p.alamat(objectKey) : null;
}

/** Baca berkas berdasarkan kunci objeknya, di mana pun ia tersimpan. */
export async function bacaBerkas(objectKey: string): Promise<Buffer> {
  const p = penyediaKunci(objectKey);
  if (p.bentuk === "alamat") {
    // Bukan berkas kosong dan bukan 404: pemanggilnya salah pintu. Yang benar
    // adalah `alamatLuar`, lalu mengarahkan peramban ke sana.
    throw new GagalUnggah(
      "Berkas ini tersimpan di luar aplikasi; bukalah alamatnya, jangan isinya.",
    );
  }
  return p.baca(objectKey);
}

export async function hapusBerkas(objectKey: string): Promise<void> {
  return penyediaKunci(objectKey).hapus(objectKey);
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
 * ------------------------------------------------------------------------
 * BERAT DAN RINGAN
 * ------------------------------------------------------------------------
 * Dua jenis berkas di sistem ini berperilaku sangat berbeda, dan sebelumnya
 * diperlakukan sama:
 *
 *   BERAT — model SketchUp (.skp) 24–38 MB dan gambar kerja DWG. Jumlahnya
 *   ribuan, isinya jarang dibuka lewat aplikasi, dan biayanya ditagih per GB
 *   kalau ditaruh di object storage. Tempatnya di Drive, atau cukup dicatat
 *   alamatnya lewat penyedia tautan.
 *
 *   RINGAN — nota, kwitansi, foto progres, PDF gambar kerja, spek Excel.
 *   Ukurannya kecil, dibuka lewat halaman, dan harus melewati pemeriksaan izin
 *   setiap kali dibuka. Tempatnya di object storage yang kita kendalikan.
 *
 * Aturannya ditulis di sini, bukan di kode halaman, karena tiap halaman yang
 * menebak sendiri berarti satu tempat lagi yang bisa keliru — dan kekeliruannya
 * baru terasa sebagai tagihan penyimpanan, berbulan-bulan kemudian.
 */
export type KelasBerkas = "berat" | "ringan";

/** Kategori yang isinya besar. Sisanya ringan. */
export const KATEGORI_BERAT: readonly string[] = ["model3d", "gambarKerjaDwg"];

/**
 * Batas ukuran berkas ringan. Jauh di bawah `MAKS_UKURAN` yang berlaku untuk
 * yang berat: nota 16 MB adalah hasil pindai yang belum dikecilkan, bukan
 * kebutuhan — dan seribu di antaranya adalah tagihan yang tidak ada gunanya.
 */
export const BATAS_RINGAN = 16 * 1024 * 1024;

/** Kelas sebuah kategori dokumen. Kategori tak dikenal dianggap ringan. */
export function kelasKategori(kategori: string): KelasBerkas {
  return KATEGORI_BERAT.includes(kategori) ? "berat" : "ringan";
}

/** Batas ukuran yang berlaku untuk sebuah kategori. */
export function batasKategori(kategori: string): number {
  return kelasKategori(kategori) === "berat" ? MAKS_UKURAN : BATAS_RINGAN;
}

/**
 * Periksa berkas terhadap batasan kategori dokumennya, di atas pemeriksaan
 * umum `periksaBerkas`. Kategori yang tidak terdaftar (mis. "analisa",
 * "lain", "bukti") tidak dibatasi ekstensinya di sini, tapi tetap kena batas
 * ukuran kelas ringan.
 */
export function periksaBerkasKategori(
  nama: string,
  kategori: string,
  ukuranByte?: number,
): void {
  const diizinkan = KATEGORI_EKSTENSI[kategori];
  if (diizinkan) {
    const ext = ekstensiDari(nama);
    if (!diizinkan.includes(ext)) {
      throw new GagalUnggah(
        `Dokumen ini hanya menerima berkas ${diizinkan.join(" atau ")}, bukan "${ext || "tanpa ekstensi"}".`,
      );
    }
  }

  if (ukuranByte === undefined) return;
  const batas = batasKategori(kategori);
  if (ukuranByte > batas) {
    const mb = Math.round(batas / 1024 / 1024);
    throw new GagalUnggah(
      kelasKategori(kategori) === "berat"
        ? `Berkas melebihi batas ${mb} MB.`
        : `Berkas jenis ini dibatasi ${mb} MB. Kecilkan dulu, atau unggah sebagai model/gambar kerja bila memang berkas berat.`,
    );
  }
}
