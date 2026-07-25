"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, pilihan, teks,
} from "@/lib/actions/guard";
import { STATUS_VO } from "@/lib/domain/enums";

/**
 * Tambah Variation Order pada sebuah kontrak.
 *
 * Nominal boleh negatif untuk pekerjaan kurang. VO hanya menggeser nilai
 * kontrak setelah statusnya "Disetujui" — yang masih diajukan ditampilkan
 * terpisah agar tidak dikira sudah mengikat.
 */
export async function tambahVo(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);

    const kontrak = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true, kode: true, deskripsi: true, projectId: true,
        project: { select: { kode: true } },
        vendor: { select: { id: true, nama: true } },
        _count: { select: { variationOrders: true } },
      },
    });
    if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");

    const pengguna = await izinkan("progress", kontrak.projectId);

    const nominal = angka(form, "nominal", { wajib: true });
    if (nominal === 0) throw new GagalIzin("Nominal VO tidak boleh nol.");

    const nomor = `VO-${String(kontrak._count.variationOrders + 1).padStart(2, "0")}`;
    const status = pilihan(form, "status", STATUS_VO);
    const uraian = teks(form, "uraian", true);

    await prisma.variationOrder.create({
      data: { contractId, nomor, tanggal: new Date(), uraian, nominal, status },
    });

    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `Kontrak ${kontrak.kode} · ${kontrak.vendor.nama}`,
      aksi: "Tambah Variation Order",
      ke: `${nomor} — ${uraian} · ${nominal >= 0 ? "+" : "−"}${rpLog(Math.abs(nominal))} (${status})`,
    });

    revalidatePath(`/vendor/${kontrak.vendor.id}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${kontrak.project.kode}`);
  });
}

/** Catat pembayaran termin pada sebuah kontrak. */
export async function tambahPembayaran(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const contractId = teks(form, "contractId", true);

    const kontrak = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true, kode: true, nominal: true, retensiPct: true, projectId: true,
        project: { select: { kode: true } },
        vendor: { select: { id: true, nama: true } },
        pembayaran: { select: { nominal: true } },
        variationOrders: { select: { nominal: true, status: true } },
      },
    });
    if (!kontrak) throw new GagalIzin("Kontrak tidak ditemukan.");

    const pengguna = await izinkan("keuangan", kontrak.projectId);

    const nominal = angka(form, "nominal", { min: 1, wajib: true });
    const uraian = teks(form, "uraian", true);

    // Pembayaran yang melampaui nilai kontrak ditolak — kelebihan bayar pada
    // kontrak borongan jauh lebih sulit ditarik kembali daripada dicegah.
    const voDisetujui = kontrak.variationOrders
      .filter((v) => v.status === "Disetujui")
      .reduce((s, v) => s + v.nominal, 0);
    const nilaiEfektif = kontrak.nominal + voDisetujui;
    const sudah = kontrak.pembayaran.reduce((s, p) => s + p.nominal, 0);

    if (sudah + nominal > nilaiEfektif) {
      throw new GagalIzin(
        `Pembayaran melebihi nilai kontrak. Sisa yang bisa dibayar: ${rpLog(nilaiEfektif - sudah)}.`,
      );
    }

    await prisma.contractPayment.create({
      data: { contractId, tanggal: new Date(), uraian, nominal },
    });

    await catat({
      pengguna, projectId: kontrak.projectId,
      objek: `Kontrak ${kontrak.kode} · ${kontrak.vendor.nama}`,
      aksi: "Catat pembayaran",
      dari: rpLog(sudah), ke: rpLog(sudah + nominal),
    });

    revalidatePath(`/vendor/${kontrak.vendor.id}`);
    revalidatePath("/vendor");
    revalidatePath(`/keuangan/${kontrak.project.kode}`);
  });
}
