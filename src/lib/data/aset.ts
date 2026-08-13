import { prisma } from "@/lib/db";
import { bolehUbah, filterProyek, type Pengguna } from "@/lib/auth/rbac";
import { biayaPenggunaan, durasiHari, statusAset, unitTersedia } from "@/lib/calc/aset";

/**
 * Pengambilan data untuk modul Equipment & Asset.
 *
 * Halaman tidak lagi memanggil Prisma sendiri. Bentuk datanya ditetapkan di
 * sini, sehingga saat modul ini diserap ERP cukup berkas ini yang berganti
 * isi menjadi pemanggilan RPC — halamannya tidak perlu disentuh.
 *
 * Daftar induk (Equipment) hanya berisi identitas & stok. Ketersediaan dan
 * status Tersedia/Digunakan TIDAK disimpan — keduanya dihitung di sini dari
 * penggunaan (EquipmentUsage) yang sedang aktif, sehingga satu alat bisa
 * terbagi ke beberapa proyek tanpa saling menimpa.
 */

export async function dataAset(u: Pengguna) {
  const bolehKelola = bolehUbah(u, "aset");

  const [induk, dipakaiPerAlat, penggunaanMentah, penyesuaian, servis] = await Promise.all([
    prisma.equipment.findMany({
      orderBy: { kode: "asc" },
      select: {
        id: true, kode: true, jenis: true, nama: true, kategori: true, merk: true,
        jumlah: true, jumlahRusak: true, satuan: true, kepemilikan: true, nilai: true,
        servisTerakhir: true, servisBerikut: true, vendorId: true,
        vendor: { select: { nama: true } },
      },
    }),

    // Jumlah unit yang sedang tertahan penggunaan aktif, per alat. Dipakai untuk
    // menghitung stok tersedia dan menurunkan status tiap baris.
    prisma.equipmentUsage.groupBy({
      by: ["equipmentId"],
      where: { status: "Aktif" },
      _sum: { jumlah: true },
    }),

    // Ledger penggunaan untuk ditampilkan: yang aktif lebih dulu, lalu terbaru.
    prisma.equipmentUsage.findMany({
      orderBy: [{ status: "asc" }, { tanggalMulai: "desc" }],
      take: 100,
      select: {
        id: true, jumlah: true, tanggalMulai: true, tanggalSelesai: true,
        tarif: true, penanggungJawab: true, catatan: true, status: true, dicatatOleh: true,
        equipment: { select: { kode: true, nama: true, satuan: true } },
        project: { select: { kode: true, nama: true } },
      },
    }),

    // Riwayat penyesuaian terbaru — kehilangan, kerusakan, dan koreksi opname.
    prisma.equipmentAdjustment.findMany({
      orderBy: { tanggal: "desc" },
      take: 50,
      select: {
        id: true, tanggal: true, jenis: true, banyak: true,
        jumlahSebelum: true, jumlahSesudah: true,
        rusakSebelum: true, rusakSesudah: true,
        keterangan: true, penanggungJawab: true, dicatatOleh: true,
        equipment: { select: { kode: true, nama: true, satuan: true } },
      },
    }),

    // Riwayat servis/perawatan alat — kapan, oleh siapa, berapa biayanya.
    prisma.equipmentService.findMany({
      orderBy: { tanggal: "desc" },
      take: 50,
      select: {
        id: true, tanggal: true, servisBerikut: true, biaya: true,
        catatan: true, dicatatOleh: true,
        equipment: { select: { kode: true, nama: true } },
      },
    }),
  ]);

  const dipakaiMap = new Map<string, number>(
    dipakaiPerAlat.map((g) => [g.equipmentId, g._sum.jumlah ?? 0]),
  );

  // Perkaya tiap alat dengan angka turunan: dipakai, tersedia, status.
  const semua = induk.map((a) => {
    const dipakai = dipakaiMap.get(a.id) ?? 0;
    return {
      ...a,
      dipakai,
      tersedia: unitTersedia(a, dipakai),
      status: statusAset(a, dipakai),
    };
  });

  const peralatan = semua.filter((a) => a.jenis !== "Aset");
  const aset = semua.filter((a) => a.jenis === "Aset");

  // Lengkapi ledger dengan lama hari dan estimasi biayanya.
  const kini = new Date();
  const penggunaan = penggunaanMentah.map((p) => {
    const hari = durasiHari(p.tanggalMulai, p.tanggalSelesai, kini);
    return { ...p, hari, biaya: biayaPenggunaan(p.tarif, p.jumlah, hari) };
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

  return { peralatan, aset, penggunaan, penyesuaian, servis, daftarVendor, daftarProyek };
}
