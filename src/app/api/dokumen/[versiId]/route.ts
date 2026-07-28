import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { bacaBerkas, tipeDari } from "@/lib/storage";

/**
 * Unduh berkas dokumen.
 *
 * Berkas TIDAK disajikan sebagai aset statis. Setiap permintaan melewati
 * pemeriksaan yang sama dengan halaman: pengguna harus masuk, berhak atas
 * dokumen teknis, dan berhak atas proyek pemilik dokumennya.
 *
 * Menaruh berkas di folder public akan membuat tautan gambar kerja dan
 * dokumen legal bisa diteruskan ke siapa pun tanpa pemeriksaan apa-apa.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ versiId: string }> },
) {
  const pengguna = await ambilPengguna();
  if (!pengguna) return new NextResponse("Tidak terautentikasi.", { status: 401 });

  if (!bolehLihat(pengguna, "dokumenTeknis")) {
    return new NextResponse("Peran Anda tidak berhak mengakses dokumen.", { status: 403 });
  }

  const { versiId } = await params;

  const versi = await prisma.documentVersion.findUnique({
    where: { id: versiId },
    select: {
      namaFile: true, objectKey: true, ukuranByte: true,
      document: {
        select: {
          legality: { select: { projectId: true } },
          projectAnalisa: { select: { id: true } },
          unitTypeModel3d: { select: { projectId: true } },
          unitTypeGambarKerjaPdf: { select: { projectId: true } },
          unitTypeGambarKerjaDwg: { select: { projectId: true } },
          unitTypeRender: { select: { projectId: true } },
          unitTypeSpek: { select: { projectId: true } },
          infraModel3d: { select: { projectId: true } },
          infraGambarKerjaPdf: { select: { projectId: true } },
          infraGambarKerjaDwg: { select: { projectId: true } },
          ktDesain: { select: { unit: { select: { projectId: true } } } },
          ktModel3d: { select: { unit: { select: { projectId: true } } } },
          ktGambarKerjaPdf: { select: { unit: { select: { projectId: true } } } },
          ktGambarKerjaDwg: { select: { unit: { select: { projectId: true } } } },
          ktRab: { select: { unit: { select: { projectId: true } } } },
        },
      },
    },
  });

  if (!versi) return new NextResponse("Dokumen tidak ditemukan.", { status: 404 });

  if (!versi.objectKey) {
    return new NextResponse(
      "Revisi ini tercatat sebelum penyimpanan berkas diaktifkan, jadi berkasnya tidak tersedia.",
      { status: 404 },
    );
  }

  // Kumpulkan proyek pemilik dokumen dari relasi mana pun yang terisi.
  const d = versi.document;
  const proyekTerkait = [
    d.legality?.projectId,
    d.projectAnalisa?.id,
    d.unitTypeModel3d?.projectId,
    d.unitTypeGambarKerjaPdf?.projectId,
    d.unitTypeGambarKerjaDwg?.projectId,
    d.unitTypeRender?.projectId,
    d.unitTypeSpek?.projectId,
    ...d.infraModel3d.map((x) => x.projectId),
    ...d.infraGambarKerjaPdf.map((x) => x.projectId),
    ...d.infraGambarKerjaDwg.map((x) => x.projectId),
    ...d.ktDesain.map((x) => x.unit.projectId),
    ...d.ktModel3d.map((x) => x.unit.projectId),
    ...d.ktGambarKerjaPdf.map((x) => x.unit.projectId),
    ...d.ktGambarKerjaDwg.map((x) => x.unit.projectId),
    ...d.ktRab.map((x) => x.unit.projectId),
  ].filter((x): x is string => !!x);

  // Dokumen yang tidak tertaut ke proyek mana pun ditolak, bukan diloloskan —
  // yatim piatu tidak boleh jadi celah untuk melewati pembatasan proyek.
  if (proyekTerkait.length === 0) {
    return new NextResponse("Dokumen ini tidak tertaut ke proyek mana pun.", { status: 403 });
  }

  if (!proyekTerkait.some((pid) => bolehAksesProyek(pengguna, pid))) {
    return new NextResponse("Anda tidak memiliki akses ke proyek pemilik dokumen ini.", { status: 403 });
  }

  let isi: Buffer;
  try {
    isi = await bacaBerkas(versi.objectKey);
  } catch {
    return new NextResponse("Berkas tidak ditemukan di penyimpanan.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(isi), {
    headers: {
      "Content-Type": tipeDari(versi.namaFile),
      "Content-Length": String(isi.byteLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(versi.namaFile)}"`,
      // Dokumen ini terbatas — jangan sampai tersimpan di cache bersama.
      "Cache-Control": "private, no-store",
    },
  });
}
