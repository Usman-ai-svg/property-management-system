"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat } from "@/lib/audit";
import { ambilPengguna, bolehUbah } from "@/lib/auth/rbac";
import { GagalIzin, HasilAksi, jalankan, teks } from "@/lib/actions/guard";
import { SECTION_LABELS, SECTIONS, type Section } from "@/lib/domain/enums";

/**
 * Pengubahan matriks hak akses.
 *
 * Matriks ini menentukan siapa boleh melihat dan mengubah apa, jadi
 * mengubahnya sendiri harus dijaga: hanya peran yang boleh mengubah
 * "deskripsi" — dalam praktiknya BOD, Business Development, dan Head
 * Operation Office — yang diizinkan. Tanpa penjagaan itu, siapa pun yang
 * bisa membuka halaman Admin bisa menaikkan haknya sendiri.
 */
async function izinkanKelolaAkses() {
  const pengguna = await ambilPengguna();
  if (!pengguna) throw new GagalIzin("Sesi Anda sudah berakhir. Silakan masuk kembali.");
  if (!bolehUbah(pengguna, "deskripsi")) {
    throw new GagalIzin(`Peran "${pengguna.peranAktif}" tidak berhak mengubah matriks hak akses.`);
  }
  return pengguna;
}

export async function ubahIzin(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkanKelolaAkses();

    const roleId = teks(form, "roleId", true);
    const section = teks(form, "section", true) as Section;
    /** tidak | lihat | ubah */
    const tingkat = teks(form, "tingkat", true);

    if (!SECTIONS.includes(section)) throw new GagalIzin("Sub-bagian tidak dikenal.");
    if (!["tidak", "lihat", "ubah"].includes(tingkat)) throw new GagalIzin("Tingkat izin tidak sah.");

    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true, nama: true } });
    if (!role) throw new GagalIzin("Peran tidak ditemukan.");

    const lama = await prisma.roleSectionPermission.findUnique({
      where: { roleId_section: { roleId, section } },
      select: { bolehUbah: true },
    });
    const tingkatLama = !lama ? "tidak" : lama.bolehUbah ? "ubah" : "lihat";

    if (tingkatLama === tingkat) return "Tidak ada perubahan.";

    // Mencabut hak akses diri sendiri atas "deskripsi" akan mengunci pengguna
    // keluar dari halaman ini — dan pada demo tanpa akses database langsung,
    // itu tidak bisa dipulihkan lewat aplikasi.
    if (
      section === "deskripsi" &&
      tingkat !== "ubah" &&
      pengguna.peranAktif === role.nama
    ) {
      throw new GagalIzin(
        `Tidak bisa mencabut hak ubah "Deskripsi Proyek" dari peran Anda sendiri (${role.nama}) — Anda akan terkunci dari halaman ini.`,
      );
    }

    if (tingkat === "tidak") {
      await prisma.roleSectionPermission.deleteMany({ where: { roleId, section } });
    } else {
      await prisma.roleSectionPermission.upsert({
        where: { roleId_section: { roleId, section } },
        create: { roleId, section, bolehUbah: tingkat === "ubah" },
        update: { bolehUbah: tingkat === "ubah" },
      });
    }

    await catat({
      pengguna,
      objek: `Hak akses · ${role.nama} · ${SECTION_LABELS[section]}`,
      aksi: "Ubah hak akses",
      dari: tingkatLama, ke: tingkat,
    });

    revalidatePath("/admin");
    // Menu dan isi halaman ikut berubah begitu izin berubah.
    revalidatePath("/", "layout");
  });
}

/** Aktifkan atau nonaktifkan seorang pengguna. */
export async function ubahStatusUser(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const pengguna = await izinkanKelolaAkses();
    const userId = teks(form, "userId", true);

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nama: true, aktif: true },
    });
    if (!target) throw new GagalIzin("Pengguna tidak ditemukan.");

    if (target.id === pengguna.id) {
      throw new GagalIzin("Tidak bisa menonaktifkan akun Anda sendiri.");
    }

    await prisma.user.update({ where: { id: userId }, data: { aktif: !target.aktif } });

    await catat({
      pengguna,
      objek: `Pengguna · ${target.nama}`,
      aksi: "Ubah status akun",
      dari: target.aktif ? "Aktif" : "Nonaktif",
      ke: target.aktif ? "Nonaktif" : "Aktif",
    });

    revalidatePath("/admin");
  });
}
