/**
 * MASUK, KELUAR, DAN GANTI PERAN.
 *
 * Tiga operasi yang menyentuh sesi secara langsung. Dikumpulkan di sini supaya
 * `src/lib/auth/` benar-benar jadi satu-satunya tempat yang tahu bentuk token,
 * nama cookie, dan umurnya — dijaga tes `penyedia.test.ts`.
 *
 * Sebelumnya ketiganya tinggal di `src/app/login/actions.ts`, yang berarti
 * lapisan halaman ikut mengimpor `simpanSession`/`ambilSession`. Selama itu
 * masih terjadi, mengganti mesin login berarti menyunting berkas di luar
 * lapisan auth — persis yang ingin dihindari saat modul diserap ERP.
 *
 * Di ERP ketiganya menghilang: `masuk`/`keluar` jadi `sb.auth.signInWithPassword`
 * dan `signOut`, dan `gantiPeranAktif` jadi penyetelan kolom di `profiles`
 * atau state klien. Yang penting mekanismenya sudah terpisah, bukan tersebar.
 */

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { ambilSession, hapusSession, simpanSession } from "@/lib/auth/session";
import { periksaGantiPeran, periksaLogin } from "@/lib/kontrak/admin";

export type HasilMasuk = { ok: true } | { ok: false; error: string };

/**
 * Verifikasi kredensial lalu mulai sesi.
 *
 * Pesan galat sengaja SAMA untuk email tak dikenal maupun sandi salah, dan
 * verifikasi tetap dijalankan terhadap hash palsu bila emailnya tak ada —
 * supaya waktu responsnya serupa. Membedakan keduanya, lewat pesan maupun lewat
 * lama jawaban, memberi tahu penebak email mana yang terdaftar.
 */
export async function masuk(email: string, sandi: string): Promise<HasilMasuk> {
  const galatIsian = periksaLogin({ email, sandi });
  if (galatIsian) return { ok: false, error: galatIsian };

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true, nama: true, passwordHash: true, aktif: true,
      roles: { select: { role: { select: { nama: true } } } },
    },
  });

  const gagal = { ok: false, error: "Email atau kata sandi salah." } as const;

  if (!user || !user.aktif) {
    await verifyPassword(sandi, "scrypt$00$00");
    return gagal;
  }
  if (!(await verifyPassword(sandi, user.passwordHash))) return gagal;

  const peran = user.roles.map((r) => r.role.nama);
  if (peran.length === 0) {
    return { ok: false, error: "Akun ini belum diberi peran. Hubungi administrator." };
  }

  await simpanSession({ userId: user.id, nama: user.nama, peranAktif: peran[0], peran });
  return { ok: true };
}

/** Akhiri sesi. */
export async function keluar(): Promise<void> {
  await hapusSession();
}

/**
 * Ganti peran yang sedang dipakai.
 *
 * Hanya ke peran yang memang dimiliki — inilah sebabnya pemilih peran tidak
 * bisa dipakai menaikkan hak akses. Mengembalikan pesan bila ditolak, supaya
 * pemanggil tidak perlu menangkap lemparan.
 */
export async function gantiPeranAktif(peranBaru: string): Promise<string | null> {
  const session = await ambilSession();
  if (!session) return "Sesi Anda sudah berakhir. Silakan masuk kembali.";

  const galat = periksaGantiPeran(
    { peran: peranBaru },
    { peranDimiliki: session.peran.includes(peranBaru) },
  );
  if (galat) return galat;

  await simpanSession({ ...session, peranAktif: peranBaru });
  return null;
}

/** Apakah ada sesi yang sedang berjalan. Dipakai halaman login. */
export async function adaSesi(): Promise<boolean> {
  return (await ambilSession()) !== null;
}
