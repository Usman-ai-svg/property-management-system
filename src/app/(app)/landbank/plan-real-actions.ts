"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { catat, catatDiff, rpLog } from "@/lib/audit";
import {
  angka, GagalIzin, HasilAksi, izinkan, jalankan, teks, teksOpsional,
} from "@/lib/actions/guard";

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

    revalidatePath("/landbank");
  });
}

// ===========================================================================
// PEMBAYARAN PENJUALAN
// ===========================================================================

/**
 * Pencairan pembayaran dari pembeli sebuah unit.
 *
 * Diperiksa dengan izin `keuangan`, bukan `businessPlan`: ini uang masuk yang
 * sungguhan, bukan angka rencana. Unit yang belum akad tetap boleh menerima
 * pembayaran — booking fee dibayar sebelum akad.
 */
async function unitPembayaran(unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true, nomor: true, hargaJual: true, projectId: true,
      phase: { select: { kode: true } },
      project: { select: { kode: true } },
      penerimaan: { select: { nominal: true } },
    },
  });
  if (!unit) throw new GagalIzin("Unit tidak ditemukan.");
  const pengguna = await izinkan("keuangan", unit.projectId);
  return { unit, pengguna };
}

export async function simpanPembayaranJual(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "").trim();
    const uraian = teks(form, "uraian", true);
    const nominal = angka(form, "nominal", { min: 1, wajib: true });

    const isiTanggal = String(form.get("tanggal") ?? "").trim();
    const tanggal = isiTanggal ? new Date(isiTanggal) : new Date();
    if (Number.isNaN(tanggal.getTime())) throw new GagalIzin("Tanggal pembayaran tidak sah.");

    if (id) {
      const lama = await prisma.salesPayment.findUnique({
        where: { id },
        select: { id: true, unitId: true, uraian: true, nominal: true, tanggal: true },
      });
      if (!lama) throw new GagalIzin("Pembayaran tidak ditemukan.");
      const { unit, pengguna } = await unitPembayaran(lama.unitId);

      await prisma.salesPayment.update({ where: { id }, data: { uraian, nominal, tanggal } });

      const jml = await catatDiff({
        pengguna, projectId: unit.projectId,
        objek: `Penerimaan Unit ${unit.phase.kode}-${unit.nomor}`,
        sebelum: lama, sesudah: { uraian, nominal, tanggal },
        label: { uraian: "Keterangan", nominal: "Nominal", tanggal: "Tanggal" },
        format: { nominal: (v) => rpLog(Number(v)) },
      });

      revalidatePath("/landbank");
      revalidatePath(`/keuangan/${unit.project.kode}`);
      return jml === 0 ? "Tidak ada yang berubah." : `${jml} perubahan tersimpan.`;
    }

    const { unit, pengguna } = await unitPembayaran(teks(form, "unitId", true));

    // Peringatan, bukan penolakan: pencairan bisa melebihi harga akad karena
    // biaya tambahan, dan yang tahu duduk perkaranya adalah penggunanya.
    const sudah = unit.penerimaan.reduce((s, p) => s + p.nominal, 0);
    const lebih = sudah + nominal - unit.hargaJual;

    await prisma.salesPayment.create({
      data: { unitId: unit.id, uraian, nominal, tanggal },
    });

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Penerimaan Unit ${unit.phase.kode}-${unit.nomor}`,
      aksi: "Catat pembayaran penjualan",
      ke: `${uraian} — ${rpLog(nominal)}`,
    });

    revalidatePath("/landbank");
    revalidatePath(`/keuangan/${unit.project.kode}`);

    if (lebih > 0) {
      return `Tersimpan. Total penerimaan unit ini kini ${rpLog(lebih)} melebihi harga jualnya — periksa bila itu tidak disengaja.`;
    }
  });
}

export async function hapusPembayaranJual(_s: HasilAksi | null, form: FormData): Promise<HasilAksi> {
  return jalankan(async () => {
    const id = String(form.get("id") ?? "");
    const lama = await prisma.salesPayment.findUnique({
      where: { id },
      select: { id: true, unitId: true, uraian: true, nominal: true },
    });
    if (!lama) return;

    const { unit, pengguna } = await unitPembayaran(lama.unitId);
    await prisma.salesPayment.delete({ where: { id } });

    await catat({
      pengguna, projectId: unit.projectId,
      objek: `Penerimaan Unit ${unit.phase.kode}-${unit.nomor}`,
      aksi: "Hapus pembayaran penjualan",
      dari: `${lama.uraian} — ${rpLog(lama.nominal)}`,
      ke: "dihapus",
    });

    revalidatePath("/landbank");
    revalidatePath(`/keuangan/${unit.project.kode}`);
  });
}
