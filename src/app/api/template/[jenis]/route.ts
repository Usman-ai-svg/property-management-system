import { NextResponse } from "next/server";
import { ambilPengguna } from "@/lib/auth/rbac";
import { excelTemplateBoq, excelTemplateRap } from "@/lib/ekspor-excel";

/**
 * Unduh template Excel kosong (berisi contoh) untuk impor BOQ/RAB atau RAP.
 *
 * Templatenya tidak memuat data proyek mana pun — hanya struktur kolom dan baris
 * contoh — jadi cukup memastikan pengguna sudah masuk. Judul kolomnya identik
 * dengan yang dikenali importir, sehingga berkas ini bisa diisi lalu diimpor
 * balik tanpa penyesuaian.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ jenis: string }> }) {
  const pengguna = await ambilPengguna();
  if (!pengguna) return new NextResponse("Tidak terautentikasi.", { status: 401 });

  const { jenis } = await params;

  const buffer =
    jenis === "boq" ? await excelTemplateBoq()
    : jenis === "rap" ? await excelTemplateRap()
    : null;

  if (!buffer) return new NextResponse(`Jenis template "${jenis}" tidak dikenal.`, { status: 404 });

  const namaFile = jenis === "boq" ? "Template-Impor-RAB.xlsx" : "Template-Impor-RAP.xlsx";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="${namaFile}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
