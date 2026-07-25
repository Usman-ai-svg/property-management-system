"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { STATUS_BAYAR } from "@/lib/domain/enums";

/**
 * Catat biaya operasional proyek — pemasaran, umum & administrasi, bunga &
 * pajak. Terpisah dari pengeluaran konstruksi karena berada di luar HPP.
 *
 * Kategori dipilih dari pos yang memang ada pada business plan proyek itu,
 * bukan diketik bebas: kalau namanya tidak persis sama, realisasinya tidak
 * akan pernah ketemu dengan rencananya di Plan vs Realisasi.
 */
export async function catatBiayaOperasional(
  _s: HasilAksi | null,
  form: FormData,
): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan("businessPlan", projectId);

    const proyek = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true, kode: true,
        businessPlan: { select: { operasional: { select: { nama: true } } } },
      },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const posSah = proyek.businessPlan?.operasional.map((o) => o.nama) ?? [];
    if (posSah.length === 0) {
      throw new GagalIzin("Proyek ini belum punya pos biaya operasional pada business plan-nya.");
    }

    const kategori = teks(form, "kategori", true);
    if (!posSah.includes(kategori)) {
      throw new GagalIzin(`Pos "${kategori}" tidak ada pada business plan proyek ini.`);
    }

    const nominal = angka(form, "nominal", { min: 1, wajib: true });
    const uraian = teks(form, "uraian", true);

    await prisma.operationalCost.create({
      data: {
        projectId, tanggal: new Date(), kategori, uraian, nominal,
        status: pilihan(form, "status", STATUS_BAYAR),
        pic: pengguna.nama,
        bukti: teksOpsional(form, "bukti"),
      },
    });

    await catat({
      pengguna, projectId,
      objek: `Biaya operasional · ${kategori}`,
      aksi: "Catat biaya operasional",
      ke: `${uraian} — ${rpLog(nominal)}`,
    });

    revalidatePath("/plan-realisasi");
  });
}
