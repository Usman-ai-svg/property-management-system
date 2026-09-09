import analisaJson from "./analisa.json";
import hargaDasarJson from "./harga-dasar.json";
import peranJson from "./peran.json";

/**
 * DATA ACUAN — isi yang harus ada SEBELUM sistem bisa dipakai sama sekali.
 *
 * Dipisahkan dari data peragaan karena nasibnya berbeda. Proyek contoh, unit
 * contoh, dan pengeluaran contoh berhenti di demo; tiga berkas di sebelah ini
 * ikut ke produksi ERP. Selama keduanya tercampur di `seed.ts`, tidak ada cara
 * memisahkannya selain membaca 1.300 baris satu per satu.
 *
 * Bentuknya JSON, bukan TypeScript, supaya bisa dibaca dua pihak yang tidak
 * saling kenal: `seed.ts` di sini, dan `scripts/acuan-sql.mjs` yang memancarkan
 * INSERT untuk schema `proyek` di Supabase. Satu sumber, dua keluaran — kalau
 * masing-masing punya salinan sendiri, keduanya akan berbeda dalam sebulan.
 *
 * Yang TIDAK ada di sini:
 *
 *   - Pengguna dan peran-per-pengguna. Identitas milik ERP; lihat
 *     `docs/jahitan-identitas.md`.
 *   - Kategori dan status. Semuanya enum di `src/lib/domain/enums.ts`, dan
 *     sudah jadi CHECK constraint di `prisma/proyek.sql` — bukan baris data.
 *   - Satuan. Teks bebas; tidak ada tabelnya, dan memaksakan daftar tertutup
 *     akan menolak satuan sah yang belum terpikirkan.
 */

export interface HargaDasarAcuan {
  kode: string;
  kategori: string;
  uraian: string;
  satuan: string;
  hargaAcuan: number;
}

export interface AnalisaAcuan {
  kode: string;
  uraian: string;
  satuan: string;
  kelompok: string;
  overheadPct: number;
  komponen: { kode: string; koefisien: number }[];
}

export interface PeranAcuan {
  peran: { nama: string; grup: string }[];
  /** Satu baris per sub-bagian. `"*"` berarti seluruh peran. */
  akses: { section: string; lihat: string[] | "*"; ubah: string[] | "*" }[];
}

export const HARGA_DASAR_ACUAN = hargaDasarJson as HargaDasarAcuan[];
export const ANALISA_ACUAN = analisaJson as AnalisaAcuan[];
export const PERAN_ACUAN = peranJson as PeranAcuan;

export const SEMUA_PERAN_ACUAN = PERAN_ACUAN.peran.map((p) => p.nama);

/** Bentangkan `"*"` menjadi daftar peran yang sebenarnya. */
export function daftarPeran(nilai: string[] | "*"): string[] {
  return nilai === "*" ? [...SEMUA_PERAN_ACUAN] : nilai;
}
