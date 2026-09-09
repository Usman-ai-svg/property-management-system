import { NextResponse } from "next/server";
import { buktiLaporanPetty } from "@/lib/data/petty-cash";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { alamatLuar, bacaBerkas, tipeDari } from "@/lib/storage";

/**
 * Unduh PDF nota gabungan sebuah laporan petty cash.
 *
 * Terpisah dari `/api/bukti/[id]` (yang melayani bukti sebuah Expense dan
 * dijaga izin "keuangan") karena berkas ini menempel pada PettyCashReport dan
 * audiensnya berbeda: Supervisor pemegang yang mengunggahnya, QS & Head Ops yang
 * mereviewnya — semuanya lewat izin "pettyCash", bukan "keuangan". Seperti bukti
 * lain, berkasnya tidak disajikan statis: tiap permintaan memeriksa sesi, izin,
 * dan akses ke proyek pemilik dana lebih dulu.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pengguna = await ambilPengguna();
  if (!pengguna) return new NextResponse("Tidak terautentikasi.", { status: 401 });

  if (!bolehLihat(pengguna, "pettyCash")) {
    return new NextResponse("Peran Anda tidak berhak mengakses berkas petty cash.", { status: 403 });
  }

  const { id } = await params;

  const laporan = await buktiLaporanPetty(id);

  if (!laporan) return new NextResponse("Laporan tidak ditemukan.", { status: 404 });
  if (!laporan.buktiKey) {
    return new NextResponse("Laporan ini belum memiliki berkas nota.", { status: 404 });
  }
  if (!bolehAksesProyek(pengguna, laporan.fund.projectId)) {
    return new NextResponse("Anda tidak memiliki akses ke proyek pemilik berkas ini.", { status: 403 });
  }

  // Berkas yang cuma dicatat alamatnya tidak punya isi untuk dikirim: arahkan
  // peramban ke sana. Pengarahannya SETELAH seluruh pemeriksaan izin di atas,
  // jadi alamat Drive tidak bocor ke orang yang tak berhak atas proyeknya.
  const luar = alamatLuar(laporan.buktiKey);
  if (luar) {
    return NextResponse.redirect(luar, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let isi: Buffer;
  try {
    isi = await bacaBerkas(laporan.buktiKey);
  } catch {
    return new NextResponse("Berkas tidak ditemukan di penyimpanan.", { status: 404 });
  }

  const nama = laporan.bukti ?? "nota-petty-cash";
  return new NextResponse(new Uint8Array(isi), {
    headers: {
      "Content-Type": tipeDari(nama),
      "Content-Length": String(isi.byteLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(nama)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
