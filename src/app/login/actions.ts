"use server";

import { redirect } from "next/navigation";
import { keluar, masuk } from "@/lib/auth/masuk";

/**
 * Aksi layar masuk.
 *
 * Ketiganya sengaja setipis mungkin: seluruh mekanisme sesi ada di
 * `src/lib/auth/`, dan berkas ini cuma menerjemahkan `FormData` menjadi
 * panggilan lalu mengarahkan halaman. Saat modul diserap ERP, isi tiga fungsi
 * ini diganti panggilan Supabase Auth tanpa menyentuh apa pun di luar sini.
 */

export interface HasilLogin {
  error?: string;
}

export async function login(_sebelumnya: HasilLogin, form: FormData): Promise<HasilLogin> {
  const hasil = await masuk(
    String(form.get("email") ?? ""),
    String(form.get("password") ?? ""),
  );
  if (!hasil.ok) return { error: hasil.error };
  redirect("/");
}

export async function logout() {
  await keluar();
  redirect("/login");
}
