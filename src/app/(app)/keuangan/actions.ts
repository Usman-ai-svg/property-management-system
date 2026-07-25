"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks, teksOpsional,
} from "@/lib/actions/guard";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";

const POS_HPP: Record<string, string> = {
  "Unit (rumah dijual)": "E — Konstruksi",
  "Prasarana & Sarana": "D — Prasarana",
  "Perijinan & Ormas": "C — Perijinan",
  "Pengolahan Lahan": "B — Pengolahan Lahan",
};

/**
 * Catat pengeluaran baru.
 *
 * Pos HPP tidak diminta ke pengguna melainkan diturunkan dari peruntukannya,
 * supaya perbandingan dengan business plan pada Plan vs Realisasi tidak
 * bergantung pada ketelitian pengisian.
 */
export async function catatPengeluaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const projectId = teks(form, "projectId", true);
    const pengguna = await izinkan("keuangan", projectId);

    const proyek = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, kode: true },
    });
    if (!proyek) throw new GagalIzin("Proyek tidak ditemukan.");

    const peruntukan = pilihan(form, "peruntukan", PERUNTUKAN_BIAYA);
    const unitId = teksOpsional(form, "unitId");

    // Unit hanya boleh ditautkan bila memang milik proyek ini.
    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: { projectId: true },
      });
      if (!unit || unit.projectId !== projectId) throw new GagalIzin("Unit tidak sah untuk proyek ini.");
    }

    const total = angka(form, "total", { min: 1, wajib: true });

    await prisma.expense.create({
      data: {
        projectId,
        unitId: unitId || null,
        tanggal: new Date(),
        peruntukan,
        jenis: pilihan(form, "jenis", JENIS_BIAYA),
        metode: pilihan(form, "metode", METODE_BAYAR),
        uraian: teks(form, "uraian", true),
        total,
        status: pilihan(form, "status", STATUS_BAYAR),
        pic: pengguna.nama,
        bukti: teksOpsional(form, "bukti"),
        posHpp: POS_HPP[peruntukan],
      },
    });

    await catat({
      pengguna, projectId,
      objek: `Pengeluaran · ${peruntukan}`,
      aksi: "Catat pengeluaran",
      ke: `${teks(form, "uraian")} — ${rpLog(total)}`,
    });

    revalidatePath("/keuangan");
    revalidatePath(`/keuangan/${proyek.kode}`);
    revalidatePath("/");
  });
}
