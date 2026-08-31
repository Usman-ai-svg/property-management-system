import { prisma } from "@/lib/db";
import type { BarisBoqEks, BarisRapEks } from "@/lib/ekspor-excel";

/**
 * Pengambilan baris BOQ/RAP untuk ekspor Excel.
 *
 * Dipindahkan dari `src/app/api/ekspor/[jenis]/route.ts` supaya rute tidak lagi
 * menyentuh Prisma. Empat sasaran — unit, kerja tambah, sarpras, tipe unit —
 * bentuk barisnya sama persis, hanya tabel induknya yang berbeda.
 *
 * `projectId` selalu ikut karena pemanggilnya wajib memeriksa akses proyek
 * sebelum mengirim isinya; angka RAB/RAP tidak boleh menyeberang proyek.
 */

const pilihBoq = {
  orderBy: { urutan: "asc" as const },
  select: { grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, spesifikasi: true },
};
const pilihRap = {
  orderBy: { urutan: "asc" as const },
  select: { grup: true, nama: true, satuan: true, volume: true, hargaSatuan: true, keterangan: true },
};

export interface DataTabelEkspor {
  projectId: string;
  label: string;
  boq: BarisBoqEks[];
  rap: BarisRapEks[];
  upah: number;
}

/** Baris tabel + info pemilik sesuai sasaran, atau null bila tak ada. */
export async function dataTabelEkspor(
  sasaran: string,
  id: string,
): Promise<DataTabelEkspor | null> {
  if (sasaran === "unit") {
    const u = await prisma.unit.findUnique({
      where: { id },
      select: {
        projectId: true, kode: true, rapUpahVolume: true, rapUpahHarga: true,
        boqItems: pilihBoq, rapItems: pilihRap,
      },
    });
    if (!u) return null;
    return { projectId: u.projectId, label: `Unit ${u.kode}`, boq: u.boqItems, rap: u.rapItems, upah: u.rapUpahVolume * u.rapUpahHarga };
  }
  if (sasaran === "kerjaTambah") {
    const k = await prisma.customWork.findUnique({
      where: { id },
      select: {
        judul: true, rapUpahVolume: true, rapUpahHarga: true,
        unit: { select: { projectId: true } },
        boqItems: pilihBoq, rapItems: pilihRap,
      },
    });
    if (!k) return null;
    return { projectId: k.unit.projectId, label: `Kerja Tambah ${k.judul}`, boq: k.boqItems, rap: k.rapItems, upah: k.rapUpahVolume * k.rapUpahHarga };
  }
  if (sasaran === "sarpras") {
    const s = await prisma.infrastructure.findUnique({
      where: { id },
      select: {
        projectId: true, kode: true, rapUpahVolume: true, rapUpahHarga: true,
        boqItems: pilihBoq, rapItems: pilihRap,
      },
    });
    if (!s) return null;
    return { projectId: s.projectId, label: `Sarpras ${s.kode}`, boq: s.boqItems, rap: s.rapItems, upah: s.rapUpahVolume * s.rapUpahHarga };
  }
  if (sasaran === "tipeUnit") {
    const t = await prisma.unitType.findUnique({
      where: { id },
      select: {
        projectId: true, kode: true, rapUpahVolume: true, rapUpahHarga: true,
        boqItems: pilihBoq, rapItems: pilihRap,
      },
    });
    if (!t) return null;
    return { projectId: t.projectId, label: `Tipe ${t.kode}`, boq: t.boqItems, rap: t.rapItems, upah: t.rapUpahVolume * t.rapUpahHarga };
  }
  return null;
}
