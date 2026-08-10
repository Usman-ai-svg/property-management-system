import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { bacaBerkas, tipeDari } from "@/lib/storage";

/**
 * Unduh berkas bukti sebuah pengeluaran.
 *
 * Sama seperti dokumen teknis, berkasnya TIDAK disajikan sebagai aset statis:
 * setiap permintaan memeriksa sesi, izin "keuangan", dan akses ke proyek pemilik
 * pengeluaran sebelum isinya dikirim. Menaruh nota & kwitansi di folder public
 * akan membuat tautannya bisa diteruskan ke siapa pun tanpa pemeriksaan.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pengguna = await ambilPengguna();
  if (!pengguna) return new NextResponse("Tidak terautentikasi.", { status: 401 });

  if (!bolehLihat(pengguna, "keuangan")) {
    return new NextResponse("Peran Anda tidak berhak mengakses berkas keuangan.", { status: 403 });
  }

  const { id } = await params;

  const expense = await prisma.expense.findUnique({
    where: { id },
    select: { projectId: true, bukti: true, buktiKey: true },
  });

  if (!expense) return new NextResponse("Pengeluaran tidak ditemukan.", { status: 404 });
  if (!expense.buktiKey) {
    return new NextResponse("Pengeluaran ini tidak memiliki berkas bukti.", { status: 404 });
  }
  if (!bolehAksesProyek(pengguna, expense.projectId)) {
    return new NextResponse("Anda tidak memiliki akses ke proyek pemilik berkas ini.", { status: 403 });
  }

  let isi: Buffer;
  try {
    isi = await bacaBerkas(expense.buktiKey);
  } catch {
    return new NextResponse("Berkas tidak ditemukan di penyimpanan.", { status: 404 });
  }

  const nama = expense.bukti ?? "bukti";
  return new NextResponse(new Uint8Array(isi), {
    headers: {
      "Content-Type": tipeDari(nama),
      "Content-Length": String(isi.byteLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(nama)}"`,
      // Berkas keuangan bersifat terbatas — jangan tersimpan di cache bersama.
      "Cache-Control": "private, no-store",
    },
  });
}
