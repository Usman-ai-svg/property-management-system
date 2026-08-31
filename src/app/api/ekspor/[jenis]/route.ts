import { NextResponse } from "next/server";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { dataTabelEkspor } from "@/lib/data/ekspor";
import { excelBoq, excelRap } from "@/lib/ekspor-excel";

/**
 * Ekspor isi tabel BOQ/RAB atau RAP sebuah unit, kerja tambah, sarpras, atau
 * tipe unit ke berkas Excel — sebagai titik awal yang bisa disunting lalu
 * diimpor balik.
 *
 * Berisi angka harga, jadi dijaga persis seperti halaman: pengguna harus masuk,
 * berhak atas "hargaRabRap", dan berhak atas proyek pemilik objeknya. Objek di
 * luar jangkauan dijawab 404 — bukan 403 — agar keberadaannya tidak bocor.
 */
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

  const data = await dataTabelEkspor(sasaran, id);
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
