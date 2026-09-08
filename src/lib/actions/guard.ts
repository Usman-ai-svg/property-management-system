import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, wajibUbah, type Pengguna } from "@/lib/auth/rbac";
import type { Section } from "@/lib/domain/enums";
import {
  bacaAngka, bacaPilihan, bacaPilihanOpsional, bacaTeks, bacaTeksOpsional, GagalIsian, type OpsiAngka,
} from "@/lib/adaptor/formulir";

/**
 * Penjagaan untuk Server Action.
 *
 * Setiap aksi yang mengubah data memanggil `izinkan()` di baris pertama.
 * Pola ini disengaja: penyaringan di UI (tombol "Ubah" yang tidak digambar)
 * tidak menghalangi siapa pun memanggil Server Action langsung, sehingga
 * pemeriksaan di sini adalah satu-satunya yang benar-benar menahan.
 */

export type HasilAksi = { ok: true; pesan?: string } | { ok: false; error: string };

export class GagalIzin extends Error {}

/**
 * Pastikan pengguna boleh mengubah `section`, dan — bila `projectId` diberikan —
 * bahwa proyek itu memang dalam jangkauan aksesnya.
 */
export async function izinkan(section: Section, projectId?: string): Promise<Pengguna> {
  const pengguna = await ambilPengguna();
  if (!pengguna) throw new GagalIzin("Sesi Anda sudah berakhir. Silakan masuk kembali.");

  wajibUbah(pengguna, section);

  if (projectId && !bolehAksesProyek(pengguna, projectId)) {
    throw new GagalIzin("Anda tidak memiliki akses ke proyek ini.");
  }

  return pengguna;
}

/**
 * Bungkus badan aksi supaya galat berubah jadi pesan yang bisa ditampilkan,
 * bukan halaman error.
 */
export async function jalankan(fn: () => Promise<string | void>): Promise<HasilAksi> {
  try {
    const pesan = await fn();
    return { ok: true, pesan: pesan ?? undefined };
  } catch (e) {
    // GagalIzin dan GagalIsian sama-sama membawa pesan yang memang untuk
    // dibaca pengguna. Melewatkan salah satunya membuat pesan "Kolom harga
    // wajib diisi" berubah jadi "Terjadi kesalahan tak terduga".
    if (e instanceof GagalIzin || e instanceof GagalIsian) {
      return { ok: false, error: e.message };
    }
    // redirect() dan notFound() melempar error khusus yang harus diteruskan.
    if (e instanceof Error && /NEXT_(REDIRECT|NOT_FOUND)/.test(e.message)) throw e;
    console.error("Aksi gagal:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Terjadi kesalahan tak terduga." };
  }
}

/**
 * Tolak permintaan bila kontraknya tidak lolos.
 *
 * Jembatan antara lapisan kontrak yang murni (mengembalikan pesan atau null)
 * dan aksi yang melempar. Dipisah supaya tiap aksi cukup satu baris:
 * `wajibLolos(periksaX(masukan))`.
 */
export function wajibLolos(galat: string | null): void {
  if (galat) throw new GagalIzin(galat);
}

/** Cari projectId dari kode proyek, sekaligus memastikan proyeknya ada. */
export async function idProyekDariKode(kode: string): Promise<string> {
  const p = await prisma.project.findUnique({ where: { kode }, select: { id: true } });
  if (!p) throw new GagalIzin("Proyek tidak ditemukan.");
  return p.id;
}

// ---------------------------------------------------------------------------
// Pembacaan FormData
//
// Aturannya ada di `src/lib/adaptor/formulir.ts` — murni dan bertes. Di sini
// hanya jembatan dari `FormData` ke fungsi pembaca yang dipakainya, supaya
// aturan yang sama bisa dipakai lagi saat isian datang sebagai parameter RPC.
// ---------------------------------------------------------------------------

/** `GagalIsian` diperlakukan sama seperti `GagalIzin` oleh `jalankan()`. */
export { GagalIsian };

const dari = (form: FormData) => (nama: string) => {
  const v = form.get(nama);
  return v === null ? null : String(v);
};

export const teks = (form: FormData, nama: string, wajib = false): string =>
  bacaTeks(dari(form), nama, wajib);

export const teksOpsional = (form: FormData, nama: string): string | null =>
  bacaTeksOpsional(dari(form), nama);

export const angka = (form: FormData, nama: string, opts: OpsiAngka = {}): number =>
  bacaAngka(dari(form), nama, opts);

export const pilihan = <T extends string>(form: FormData, nama: string, sah: readonly T[]): T =>
  bacaPilihan(dari(form), nama, sah);

export const pilihanOpsional = <T extends string>(
  form: FormData, nama: string, sah: readonly T[], bawaan: T,
): T => bacaPilihanOpsional(dari(form), nama, sah, bawaan);
