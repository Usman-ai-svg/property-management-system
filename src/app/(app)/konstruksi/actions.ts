"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat } from "@/lib/audit";
import { angka, GagalIzin, HasilAksi, izinkan, jalankan, teks } from "@/lib/actions/guard";

/**
 * Pembaruan progres dari modul Konstruksi.
 *
 * Selain memperbarui angka pada entitas, tiap perubahan ditulis sebagai
 * catatan ProgressRecord baru. Catatan itulah yang menjadi pembanding
 * "minggu lalu" pada opname berikutnya — sehingga laporan mingguan
 * mencerminkan pelaporan yang benar-benar terjadi.
 */

export async function ubahProgresUnit(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const progress = angka(form, "progress", { min: 0, max: 100 });

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true, nomor: true, progress: true, projectId: true,
        phase: { select: { kode: true } }, project: { select: { kode: true } },
      },
    });
    if (!unit) throw new GagalIzin("Unit tidak ditemukan.");

    const pengguna = await izinkan("progress", unit.projectId);

    if (progress === unit.progress) return "Progres tidak berubah.";

    // Status bangun mengikuti progres, seperti pada artifact.
    const statusPembangunan =
      progress >= 100 ? "Selesai" : progress > 0 ? "Progress" : "Belum terbangun";

    await prisma.$transaction([
      prisma.unit.update({ where: { id }, data: { progress, statusPembangunan } }),
      prisma.progressRecord.create({
        data: {
          unitId: id, tanggal: new Date(), progress,
          catatan: "Opname konstruksi", dicatatOleh: pengguna.nama,
        },
      }),
    ]);

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Unit ${unit.phase.kode}-${unit.nomor}`,
      aksi: "Ubah progress konstruksi",
      dari: `${unit.progress}%`, ke: `${progress}%`,
    });

    revalidatePath(`/konstruksi/${unit.project.kode}`);
    revalidatePath(`/master/${unit.project.kode}`);
    revalidatePath("/");
  });
}

export async function ubahProgresSarpras(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = teks(form, "id", true);
    const progress = angka(form, "progress", { min: 0, max: 100 });

    const item = await prisma.infrastructure.findUnique({
      where: { id },
      select: {
        id: true, nama: true, progress: true, projectId: true,
        project: { select: { kode: true } },
      },
    });
    if (!item) throw new GagalIzin("Item sarpras tidak ditemukan.");

    const pengguna = await izinkan("progress", item.projectId);

    if (progress === item.progress) return "Progres tidak berubah.";

    const status = progress >= 100 ? "Selesai" : progress > 0 ? "Progress" : "Belum terbangun";

    await prisma.$transaction([
      prisma.infrastructure.update({ where: { id }, data: { progress, status } }),
      prisma.progressRecord.create({
        data: {
          infrastructureId: id, tanggal: new Date(), progress,
          catatan: "Opname konstruksi", dicatatOleh: pengguna.nama,
        },
      }),
    ]);

    await catat({
      pengguna, projectId: item.projectId,
      objek: `Sarpras · ${item.nama}`,
      aksi: "Ubah progress konstruksi",
      dari: `${item.progress}%`, ke: `${progress}%`,
    });

    revalidatePath(`/konstruksi/${item.project.kode}`);
    revalidatePath(`/master/${item.project.kode}`);
    revalidatePath("/");
  });
}
