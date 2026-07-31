import { prisma } from "@/lib/db";
import { bolehUbah, filterProyek, type Pengguna } from "@/lib/auth/rbac";

/**
 * Pengambilan data untuk modul Equipment & Asset.
 *
 * Halaman tidak lagi memanggil Prisma sendiri. Bentuk datanya ditetapkan di
 * sini, sehingga saat modul ini diserap ERP cukup berkas ini yang berganti
 * isi menjadi pemanggilan RPC — halamannya tidak perlu disentuh.
 */

export async function dataAset(u: Pengguna) {
  const bolehKelola = bolehUbah(u, "aset");

  const aset = await prisma.equipment.findMany({
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, kategori: true, merk: true,
      jumlah: true, jumlahRusak: true, satuan: true, kepemilikan: true, status: true,
      satuanPakai: true, pemakaian: true, nilai: true,
      servisTerakhir: true, servisBerikut: true, penanggungJawab: true,
      vendorId: true, projectId: true,
      vendor: { select: { nama: true } },
      project: { select: { kode: true } },
    },
  });

  // Riwayat penyesuaian terbaru — kehilangan, kerusakan, dan koreksi opname.
  // Diambil terpisah karena inilah jawaban atas "kenapa stoknya berkurang",
  // yang tidak terbaca dari daftar aset saja.
  const penyesuaian = await prisma.equipmentAdjustment.findMany({
    orderBy: { tanggal: "desc" },
    take: 50,
    select: {
      id: true, tanggal: true, jenis: true, banyak: true,
      jumlahSebelum: true, jumlahSesudah: true,
      rusakSebelum: true, rusakSesudah: true,
      keterangan: true, penanggungJawab: true, dicatatOleh: true,
      equipment: { select: { kode: true, nama: true, satuan: true } },
    },
  });

  // Pilihan untuk formulir. Vendor tidak dibatasi proyek karena satu vendor
  // bisa menyewakan alat ke proyek mana pun.
  const [daftarVendor, daftarProyek] = bolehKelola
    ? await Promise.all([
        prisma.vendor.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
        prisma.project.findMany({
          where: filterProyek(u),
          orderBy: { kode: "asc" },
          select: { id: true, nama: true },
        }),
      ])
    : [[], []];

  return { aset, penyesuaian, daftarVendor, daftarProyek };
}
