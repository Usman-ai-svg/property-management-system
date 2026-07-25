"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { simpanSession, hapusSession } from "@/lib/auth/session";

export interface HasilLogin {
  error?: string;
}

export async function login(_sebelumnya: HasilLogin, form: FormData): Promise<HasilLogin> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) return { error: "Email dan kata sandi wajib diisi." };

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, nama: true, passwordHash: true, aktif: true,
      roles: { select: { role: { select: { nama: true } } } },
    },
  });

  // Pesan galat sengaja dibuat sama untuk email tidak dikenal maupun sandi
  // salah — membedakannya akan memberi tahu penyerang email mana yang terdaftar.
  const gagal = { error: "Email atau kata sandi salah." };

  if (!user || !user.aktif) {
    // Tetap jalankan verifikasi terhadap hash palsu supaya waktu respons
    // untuk email tidak dikenal serupa dengan email yang ada.
    await verifyPassword(password, "scrypt$00$00");
    return gagal;
  }

  if (!(await verifyPassword(password, user.passwordHash))) return gagal;

  const peran = user.roles.map((r) => r.role.nama);
  if (peran.length === 0) return { error: "Akun ini belum diberi peran. Hubungi administrator." };

  await simpanSession({
    userId: user.id,
    nama: user.nama,
    peranAktif: peran[0],
    peran,
  });

  redirect("/");
}

export async function logout() {
  await hapusSession();
  redirect("/login");
}

/**
 * Ganti peran aktif. Hanya boleh memilih peran yang memang dimiliki —
 * inilah sebabnya pemilih peran tidak bisa dipakai untuk menaikkan hak akses.
 */
export async function gantiPeran(form: FormData) {
  const { ambilSession } = await import("@/lib/auth/session");
  const session = await ambilSession();
  if (!session) redirect("/login");

  const peranBaru = String(form.get("peran") ?? "");
  if (!session.peran.includes(peranBaru)) {
    throw new Error("Peran tersebut tidak dimiliki oleh akun ini.");
  }

  await simpanSession({ ...session, peranAktif: peranBaru });
}
