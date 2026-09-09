import { NextResponse } from "next/server";
import { ambilPengguna, bolehAksesProyek, bolehLihat } from "@/lib/auth/rbac";
import { proyekPemilikDokumen, versiDokumen } from "@/lib/data/dokumen";
import { alamatLuar, bacaBerkas, tipeDari } from "@/lib/storage";

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

  const versi = await versiDokumen(versiId);

  if (!versi) return new NextResponse("Dokumen tidak ditemukan.", { status: 404 });

  if (!versi.objectKey) {
    return new NextResponse(
      "Revisi ini tercatat sebelum penyimpanan berkas diaktifkan, jadi berkasnya tidak tersedia.",
      { status: 404 },
    );
  }

  const proyekTerkait = proyekPemilikDokumen(versi.document);

  // Dokumen yang tidak tertaut ke proyek mana pun ditolak, bukan diloloskan —
  // yatim piatu tidak boleh jadi celah untuk melewati pembatasan proyek.
  if (proyekTerkait.length === 0) {
    return new NextResponse("Dokumen ini tidak tertaut ke proyek mana pun.", { status: 403 });
  }

  if (!proyekTerkait.some((pid) => bolehAksesProyek(pengguna, pid))) {
    return new NextResponse("Anda tidak memiliki akses ke proyek pemilik dokumen ini.", { status: 403 });
  }

  // Berkas yang cuma dicatat alamatnya tidak punya isi untuk dikirim: arahkan
  // peramban ke sana. Pengarahannya SETELAH seluruh pemeriksaan izin di atas,
  // jadi alamat Drive tidak bocor ke orang yang tak berhak atas proyeknya.
  const luar = alamatLuar(versi.objectKey);
  if (luar) {
    return NextResponse.redirect(luar, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
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
