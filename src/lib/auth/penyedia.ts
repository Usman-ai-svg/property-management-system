/**
 * PENYEDIA IDENTITAS — satu-satunya pintu ke sistem login.
 *
 * Repo ini punya tabel pengguna, hash sandi, dan JWT sendiri. ERP Nanoland
 * tidak memakai satu pun: identitas di sana datang dari Supabase Auth
 * (`auth.users`) dengan peran di `public.profiles.role`. Yang dikerjakan di
 * berkas ini bukan membuang mekanisme lama, melainkan mengisolasinya di balik
 * satu antarmuka — supaya di sisi ERP cukup implementasinya yang diganti.
 *
 * Antarmukanya sengaja cuma menjawab TIGA pertanyaan:
 *
 *   1. `siapa()`   — siapa yang sedang masuk?
 *   2. `peran()`   — peran apa yang sedang dipakainya, dan peran apa saja yang
 *                    dimilikinya?
 *   3. `boleh()`   — boleh apa dia pada sebuah sub-bagian?
 *
 * Tiga pertanyaan itu yang benar-benar ditanyakan aplikasi. Segala hal lain
 * tentang login — bentuk token, umur cookie, cara menyimpan sandi — tidak
 * pernah bocor keluar dari `src/lib/auth/`, dan itu dijaga tes
 * (`penyedia.test.ts`).
 *
 * CATATAN UNTUK ERP. Implementasi Supabase nanti mengisi `siapa()` dari
 * `sb.auth.getUser()`, `peran()` dari `profiles.role`, dan `boleh()` dari peta
 * di `peran-erp.ts` — atau dari matriks `RoleSectionPermission` bila mode
 * internal dinyalakan. Tak ada pemanggil yang perlu tahu bedanya.
 */

import type { Section } from "@/lib/domain/enums";
import type { Pengguna } from "@/lib/adaptor/identitas";

/** Apa yang boleh dilakukan pada sebuah sub-bagian. */
export type Kewenangan = "tidak" | "lihat" | "ubah";

/** Siapa yang sedang masuk — tanpa peran, tanpa izin. */
export interface Identitas {
  /**
   * Id pelaku.
   *
   * Di repo ini berupa cuid dari tabel `User`; di ERP berupa uuid dari
   * `auth.users`. Bentuknya sama-sama teks, dan itulah yang membuat kolom
   * "dicatat oleh" bisa ikut pindah tanpa konversi.
   */
  id: string;
  /** Nama tampilan pada saat ini. Bisa berubah; lihat catatan jepretan sejarah. */
  nama: string;
}

/** Peran yang dipegang seseorang. */
export interface PeranPengguna {
  /** Peran yang SEDANG dipakai. Satu, bukan daftar. */
  aktif: string;
  /** Seluruh peran yang dimiliki, untuk mengisi pemilih "Lihat sebagai". */
  dimiliki: string[];
}

/**
 * Sumber identitas yang bisa dipasang.
 *
 * Seluruh metodenya mengembalikan null/kosong bila belum masuk — bukan
 * melempar. Pemanggil yang butuh kepastian memakai `wajibLihat`/`wajibUbah` di
 * `rbac.ts`, yang memang melempar dengan pesan yang bisa dibaca pengguna.
 */
export interface PenyediaIdentitas {
  siapa(): Promise<Identitas | null>;
  peran(): Promise<PeranPengguna | null>;
  boleh(section: Section): Promise<Kewenangan>;
}

/**
 * Bangun penyedia dari satu fungsi pemuat `Pengguna`.
 *
 * Sengaja dibuat dari `Pengguna` yang sudah ada, bukan menggantikannya: bentuk
 * itu masih dipakai ratusan pemanggil (halaman, query, server action), dan
 * mengubahnya sekaligus bukan bagian dari pekerjaan penyiapan migrasi. Yang
 * dicapai di sini adalah menyediakan permukaan sempit yang stabil, supaya kode
 * baru — dan kode ERP — tidak perlu ikut bergantung pada bentuk lebarnya.
 */
export function penyediaDari(muat: () => Promise<Pengguna | null>): PenyediaIdentitas {
  return {
    async siapa() {
      const u = await muat();
      return u ? { id: u.id, nama: u.nama } : null;
    },

    async peran() {
      const u = await muat();
      return u ? { aktif: u.peranAktif, dimiliki: u.peran } : null;
    },

    async boleh(section) {
      const u = await muat();
      return kewenangan(u, section);
    },
  };
}

/**
 * Turunkan kewenangan dari peta izin seorang pengguna.
 *
 * Sub-bagian yang TIDAK ADA di peta berarti "tidak", bukan "lihat". Perbedaan
 * itu yang membuat sub-bagian baru tertutup secara bawaan: menambah section di
 * `enums.ts` tidak diam-diam membukanya untuk semua peran.
 */
export function kewenangan(u: Pengguna | null, section: Section): Kewenangan {
  if (!u || !u.izin.has(section)) return "tidak";
  return u.izin.get(section) === true ? "ubah" : "lihat";
}
