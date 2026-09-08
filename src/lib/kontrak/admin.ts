/**
 * KONTRAK — Admin: pengguna, peran, dan matriks hak akses.
 *
 * PERHATIAN UNTUK MIGRASI. Modul inilah yang paling banyak berubah di ERP:
 * identitas di sana datang dari Supabase Auth, dan pengelolaan pengguna sudah
 * ada di modul lain. Yang TIDAK ikut hilang adalah **matriks hak akses per
 * sub-bagian** — di ERP ia dibiarkan terbuka penuh, tetapi mekanismenya harus
 * utuh supaya bisa diperketat tanpa membongkar RPC satu per satu.
 *
 * Karena itu kontrak di sini tetap ditulis lengkap meski sebagian aksinya tidak
 * akan punya RPC: ia dokumentasi aturan yang berlaku, bukan cuma persiapan
 * penyalinan.
 */

import { SECTIONS } from "@/lib/domain/enums";
import { pertamaGagal, pilihanSah, wajibTeks, type Galat } from "./dasar";

/** Tingkat izin sebuah sub-bagian untuk sebuah peran. */
export const TINGKAT_IZIN = ["tidak", "lihat", "ubah"] as const;

export interface MasukanUbahIzin {
  roleId: string;
  section: string;
  tingkat: string;
}

export function periksaUbahIzin(m: MasukanUbahIzin): Galat {
  const dasar = wajibTeks(m.roleId, "Peran");
  if (dasar) return dasar;
  if (!(SECTIONS as readonly string[]).includes(m.section)) return "Sub-bagian tidak dikenal.";
  if (!(TINGKAT_IZIN as readonly string[]).includes(m.tingkat)) return "Tingkat izin tidak sah.";
  return null;
}

export interface KonteksUbahStatusUser {
  /** Target adalah akun pelakunya sendiri. */
  targetDiriSendiri: boolean;
  aktif: boolean;
}

/**
 * Seseorang tidak bisa menonaktifkan akunnya sendiri.
 *
 * Bukan basa-basi: administrator terakhir yang menonaktifkan dirinya sendiri
 * mengunci seluruh sistem, dan memulihkannya butuh akses langsung ke database.
 */
export function periksaUbahStatusUser(
  m: { id: string },
  konteks: KonteksUbahStatusUser,
): Galat {
  const id = wajibTeks(m.id, "Id pengguna");
  if (id) return id;
  if (konteks.targetDiriSendiri && !konteks.aktif) {
    return "Tidak bisa menonaktifkan akun Anda sendiri.";
  }
  return null;
}

/** Bentuk alamat surel yang diterima. Sengaja longgar — yang ketat itu unik. */
export const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Panjang minimum kata sandi. */
export const MIN_SANDI = 8;

export interface MasukanUser {
  /** Kosong bila membuat baru. */
  id: string | null;
  nama: string;
  email: string;
  /** Kosong saat menyunting berarti sandi tidak diganti. */
  sandi: string | null;
  peranIds: string[];
  proyekIds: string[];
}

export interface KonteksUser {
  emailBentrok: boolean;
  /** Seluruh peran yang dikirim memang ada. */
  peranDikenal: boolean;
  /** Seluruh proyek yang dikirim memang ada. */
  proyekDikenal: boolean;
}

/**
 * Pengguna wajib punya setidaknya satu peran.
 *
 * Peran adalah satu-satunya sumber hak akses di repo ini; akun tanpa peran bisa
 * masuk tetapi tidak bisa melihat apa pun — keadaan yang tampak seperti
 * kerusakan sistem, bukan seperti pengaturan yang disengaja.
 */
export function periksaUser(m: MasukanUser, konteks: KonteksUser): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.nama, "Nama"),
    wajibTeks(m.email, "Email"),
  );
  if (dasar) return dasar;

  if (!POLA_EMAIL.test(m.email)) return "Format email tidak sah.";
  if (konteks.emailBentrok) return `Email "${m.email}" sudah dipakai akun lain.`;

  // Saat membuat akun baru sandi wajib; saat menyunting, kosong berarti tetap.
  const sandiWajib = m.id === null;
  if (sandiWajib && (m.sandi ?? "").length < MIN_SANDI) {
    return `Kata sandi minimal ${MIN_SANDI} karakter.`;
  }
  if (!sandiWajib && m.sandi && m.sandi.length < MIN_SANDI) {
    return `Kata sandi minimal ${MIN_SANDI} karakter.`;
  }

  if (m.peranIds.length === 0) return "Pengguna harus punya setidaknya satu peran.";
  if (!konteks.peranDikenal) return "Ada peran yang tidak dikenali.";
  if (!konteks.proyekDikenal) return "Ada proyek yang tidak dikenali.";
  return null;
}

// ---------------------------------------------------------------------------
// Masuk dan ganti peran
// ---------------------------------------------------------------------------

export interface MasukanLogin {
  email: string;
  sandi: string;
}

/**
 * Sengaja TIDAK memeriksa bentuk email di sini.
 *
 * Pada layar masuk, membedakan "format email salah" dari "email tidak
 * terdaftar" memberi tahu penebak bahwa alamat itu ada. Yang diperiksa hanya
 * kelengkapan isian; benar-tidaknya dijawab satu pesan yang sama.
 */
export function periksaLogin(m: MasukanLogin): Galat {
  return pertamaGagal(wajibTeks(m.email, "Email"), wajibTeks(m.sandi, "Kata sandi"));
}

export interface KonteksGantiPeran {
  /** Peran yang dituju memang dimiliki pengguna ini. */
  peranDimiliki: boolean;
}

/**
 * Ganti peran aktif hanya ke peran yang memang dimiliki.
 *
 * Tanpa ini, seorang Supervisor bisa berpindah ke peran Finance hanya dengan
 * mengirim permintaannya langsung — dan seluruh matriks hak akses jadi hiasan.
 */
export function periksaGantiPeran(
  m: { peran: string },
  konteks: KonteksGantiPeran,
): Galat {
  const nama = wajibTeks(m.peran, "Peran");
  if (nama) return nama;
  return konteks.peranDimiliki ? null : "Anda tidak memegang peran itu.";
}

/** Daftar sub-bagian yang hak aksesnya diatur — diteruskan untuk dipakai RPC. */
export { SECTIONS };

/** Penjaga bahwa tiap sub-bagian punya tingkat izin yang sah. */
export const periksaTingkat = (tingkat: string): Galat =>
  pilihanSah(tingkat, TINGKAT_IZIN, "tingkat izin");
