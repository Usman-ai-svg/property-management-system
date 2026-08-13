import { prisma } from "@/lib/db";
import { bolehLihat, filterProyek, type Pengguna } from "@/lib/auth/rbac";

const pilihVersi = {
  select: { id: true, revisi: true, namaFile: true, ukuranByte: true, objectKey: true, diunggahPada: true },
  orderBy: { diunggahPada: "desc" as const },
};

/**
 * Pengambilan data untuk modul Landbank.
 *
 * Perhatikan dua kolom bersyarat: biaya perolehan hanya ikut di-SELECT bila
 * peran berhak atas "hargaRabRap", dan business plan hanya di-query bila
 * berhak atas "businessPlan". Bukan diambil lalu disembunyikan — memang tidak
 * diambil. Aturan itu harus ikut pindah saat modul ini diserap ERP.
 */
export async function dataLandbank(u: Pengguna) {
  const bolehHarga = bolehLihat(u, "hargaRabRap");
  const bolehBp = bolehLihat(u, "businessPlan");

  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, status: true,
      kecamatan: true, kota: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      analisaDocId: true,
      _count: { select: { units: true } },
      ...(bolehHarga
        ? {
            hargaPerM2: true, biayaPembelian: true, biayaNotaris: true,
            biayaBalikNama: true, biayaLegalLain: true,
          }
        : {}),
    },
  });

  // Business plan diambil terpisah dan hanya bila peran berhak — sekaligus
  // menghindari pelebaran tipe akibat relasi bersyarat di dalam select.
  const rencana = bolehBp
    ? await prisma.businessPlan.findMany({
        where: { project: filterProyek(u) },
        select: {
          projectId: true,
          hpp: { select: { nilai: true } },
          omzet: { select: { jumlah: true, harga: true } },
          operasional: { select: { nilai: true } },
        },
      })
    : [];

  return { proyek, rencana };
}

/** Satu proyek landbank beserta dokumen analisa dan pembanding pasarnya. */
export async function detailLandbank(kodeProyek: string, bolehHarga: boolean) {
  return prisma.project.findUnique({
    where: { kode: kodeProyek },
    select: {
      id: true, kode: true, nama: true, status: true,
      kecamatan: true, kota: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      analisaDoc: { select: { id: true, kategori: true, versions: pilihVersi } },
      marketComparables: {
        orderBy: { jarak: "asc" },
        select: {
          id: true, nama: true, jarak: true,
          tipe: { select: { id: true, tipe: true, jumlah: true, luasUnit: true, luasLahan: true, harga: true } },
        },
      },
      ...(bolehHarga
        ? {
            hargaPerM2: true, biayaPembelian: true, biayaNotaris: true,
            biayaBalikNama: true, biayaLegalLain: true,
          }
        : {}),
    },
  });
}

/**
 * Business plan sebuah proyek.
 *
 * Diambil terpisah, dan hanya bila peran berhak — menyisipkan relasi lewat
 * select bersyarat membuat Prisma kehilangan tipe pastinya.
 */
export async function businessPlanProyek(projectId: string) {
  return prisma.businessPlan.findUnique({
    where: { projectId },
    select: {
      id: true,
      hpp: { orderBy: { urutan: "asc" }, select: { id: true, nama: true, nilai: true } },
      omzet: { orderBy: { urutan: "asc" }, select: { id: true, tipe: true, jumlah: true, harga: true } },
      operasional: { orderBy: { urutan: "asc" }, select: { id: true, nama: true, nilai: true } },
      cashflow: { orderBy: { urutan: "asc" }, select: { id: true, periode: true, masuk: true, keluar: true } },
    },
  });
}
