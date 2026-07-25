import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, wajibUbah, type Pengguna } from "@/lib/auth/rbac";
import type { Section } from "@/lib/domain/enums";

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
    if (e instanceof GagalIzin) return { ok: false, error: e.message };
    // redirect() dan notFound() melempar error khusus yang harus diteruskan.
    if (e instanceof Error && /NEXT_(REDIRECT|NOT_FOUND)/.test(e.message)) throw e;
    console.error("Aksi gagal:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Terjadi kesalahan tak terduga." };
  }
}

/** Cari projectId dari kode proyek, sekaligus memastikan proyeknya ada. */
export async function idProyekDariKode(kode: string): Promise<string> {
  const p = await prisma.project.findUnique({ where: { kode }, select: { id: true } });
  if (!p) throw new GagalIzin("Proyek tidak ditemukan.");
  return p.id;
}

// ---------------------------------------------------------------------------
// Pembacaan FormData
// ---------------------------------------------------------------------------

export function teks(form: FormData, nama: string, wajib = false): string {
  const v = String(form.get(nama) ?? "").trim();
  if (wajib && !v) throw new GagalIzin(`Kolom "${nama}" wajib diisi.`);
  return v;
}

export function teksOpsional(form: FormData, nama: string): string | null {
  const v = String(form.get(nama) ?? "").trim();
  return v === "" ? null : v;
}

/**
 * Baca angka dari form.
 *
 * Menerima format Indonesia ("1.250.000" dan "12,5") maupun format polos,
 * karena pengguna terbiasa mengetik pemisah ribuan.
 */
export function angka(form: FormData, nama: string, opts: { min?: number; max?: number; wajib?: boolean } = {}): number {
  const mentah = String(form.get(nama) ?? "").trim();

  if (mentah === "") {
    if (opts.wajib) throw new GagalIzin(`Kolom "${nama}" wajib diisi.`);
    return 0;
  }

  // Bila ada koma, titik dianggap pemisah ribuan dan koma pemisah desimal.
  // Bila tidak ada koma, titik yang diikuti tepat 3 digit juga dianggap
  // pemisah ribuan — "1.250" berarti seribu dua ratus lima puluh.
  const bersih = mentah.includes(",")
    ? mentah.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(mentah)
      ? mentah.replace(/\./g, "")
      : mentah;

  const n = Number(bersih);
  if (!Number.isFinite(n)) throw new GagalIzin(`Nilai "${mentah}" pada kolom "${nama}" bukan angka yang sah.`);
  if (opts.min != null && n < opts.min) throw new GagalIzin(`Kolom "${nama}" tidak boleh kurang dari ${opts.min}.`);
  if (opts.max != null && n > opts.max) throw new GagalIzin(`Kolom "${nama}" tidak boleh lebih dari ${opts.max}.`);

  return n;
}

/** Baca pilihan yang harus termasuk daftar nilai sah. */
export function pilihan<T extends string>(form: FormData, nama: string, sah: readonly T[]): T {
  const v = String(form.get(nama) ?? "").trim() as T;
  if (!sah.includes(v)) throw new GagalIzin(`Nilai "${v}" tidak sah untuk kolom "${nama}".`);
  return v;
}
