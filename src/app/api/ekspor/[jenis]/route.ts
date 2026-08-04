import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import {
  excelBoq, excelRap, type BarisBoqEks, type BarisRapEks,
} from "@/lib/ekspor-excel";

/**
 * Ekspor isi tabel BOQ/RAB atau RAP sebuah unit, kerja tambah, sarpras, atau
 * tipe unit ke berkas Excel — sebagai titik awal yang bisa disunting lalu
 * diimpor balik.
 *
 * Berisi angka harga, jadi dijaga persis seperti halaman: pengguna harus masuk,
 * berhak atas "hargaRabRap", dan berhak atas proyek pemilik objeknya. Objek di
 * luar jangkauan dijawab 404 — bukan 403 — agar keberadaannya tidak bocor.
 */

const pilihBoq = {
  orderBy: { urutan: "asc" as const },
  select: { grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, spesifikasi: true },
};
const pilihRap = {
  orderBy: { urutan: "asc" as const },
  select: { grup: true, nama: true, satuan: true, volume: true, hargaSatuan: true, keterangan: true },
};

interface DataTabel {
  projectId: string;
  label: string;
  boq: BarisBoqEks[];
  rap: BarisRapEks[];
  upah: number;
}

/** Ambil baris tabel + info pemilik sesuai sasaran, atau null bila tak ada. */
async function ambilData(sasaran: string, id: string): Promise<DataTabel | null> {
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

export async function GET(req: Request, { params }: { params: Promise<{ jenis: string }> }) {
  const pengguna = await ambilPengguna();
  if (!pengguna) return new NextResponse("Tidak terautentikasi.", { status: 401 });
  if (!bolehLihat(pengguna, "hargaRabRap")) {
    return new NextResponse("Peran Anda tidak berhak atas angka RAB/RAP.", { status: 403 });
  }

  const { jenis } = await params;
  const url = new URL(req.url);
  const sasaran = url.searchParams.get("sasaran") ?? "";
  const id = url.searchParams.get("id") ?? "";

  if (jenis !== "boq" && jenis !== "rap") {
    return new NextResponse(`Jenis "${jenis}" tidak dikenal.`, { status: 404 });
  }

  const data = await ambilData(sasaran, id);
  // Objek tak ditemukan maupun di luar akses dijawab sama — 404 — agar
  // keberadaannya tidak bisa disimpulkan dari beda pesan.
  if (!data || !bolehAksesProyek(pengguna, data.projectId)) {
    return new NextResponse("Objek tidak ditemukan.", { status: 404 });
  }

  const buffer =
    jenis === "boq"
      ? await excelBoq(data.label, data.boq)
      : await excelRap(data.label, data.rap, data.upah);

  const namaFile = `${jenis === "boq" ? "RAB" : "RAP"}-${data.label.replace(/[^A-Za-z0-9-]+/g, "-")}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="${namaFile}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
