import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { excelTemplatePenawaran } from "@/lib/ekspor-excel";

/**
 * Unduh template BOQ penawaran (.xlsx) untuk dikirim ke vendor pembanding.
 *
 * Dijaga izin `hargaRabRap` seperti seluruh detail RAB. Template TIDAK memuat
 * HPS (harga satuan RAB) — lihat `excelTemplatePenawaran`.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pengguna = await ambilPengguna();
  if (!pengguna) return new Response("Sesi berakhir.", { status: 401 });
  if (!bolehLihat(pengguna, "hargaRabRap")) return new Response("Akses ditolak.", { status: 403 });

  const rab = await prisma.rabEstimasi.findUnique({
    where: { id },
    select: {
      nomor: true, nama: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      items: {
        orderBy: { urutan: "asc" },
        select: { grup: true, uraian: true, satuan: true, volume: true },
      },
    },
  });
  if (!rab) return new Response("RAB tidak ditemukan.", { status: 404 });
  if (!bolehAksesProyek(pengguna, rab.projectId)) return new Response("Akses ditolak.", { status: 403 });

  const buf = await excelTemplatePenawaran(
    { kode: rab.nomor, pekerjaan: rab.nama, proyek: `${rab.project.kode} — ${rab.project.nama}` },
    rab.items,
  );

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Template-BOQ-${rab.nomor}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
