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
  // Omset kini "hidup" dari tabel Unit: totalnya Σ harga dasar seluruh unit
  // (default hargaJual, kecuali di-override di BpOmzetUnit). Karena itu unit
  // dan override-nya diambil terpisah lalu dirakit jadi bentuk RencanaBisnis.
  if (!bolehBp) return { proyek, rencana: [] };

  const [plans, units, overrides] = await Promise.all([
    prisma.businessPlan.findMany({
      where: { project: filterProyek(u) },
      select: {
        projectId: true,
        hpp: { select: { rows: { select: { volume: true, harga: true } } } },
        operasional: { select: { rows: { select: { volume: true, harga: true } } } },
      },
    }),
    prisma.unit.findMany({
      where: { project: filterProyek(u) },
      select: { id: true, projectId: true, hargaJual: true },
    }),
    prisma.bpOmzetUnit.findMany({
      where: { businessPlan: { project: filterProyek(u) } },
      select: { unitId: true, hargaDasar: true },
    }),
  ]);

  const hargaDasarUnit = new Map(overrides.map((o) => [o.unitId, o.hargaDasar]));
  const unitPerProyek = new Map<string, { hargaDasar: number }[]>();
  for (const un of units) {
    const list = unitPerProyek.get(un.projectId) ?? [];
    list.push({ hargaDasar: hargaDasarUnit.get(un.id) ?? un.hargaJual });
    unitPerProyek.set(un.projectId, list);
  }

  const rencana = plans.map((p) => ({
    projectId: p.projectId,
    hpp: p.hpp,
    operasional: p.operasional,
    omzet: unitPerProyek.get(p.projectId) ?? [],
  }));

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
 * Rencana omset sebuah proyek: daftar SELURUH unitnya.
 *
 * Daftar ini "hidup" dari tabel Unit (No, Tipe, LB, LT diambil apa adanya),
 * sedangkan HARGA DASAR rencana disimpan terpisah di BpOmzetUnit supaya bisa
 * disunting peran Business Plan tanpa menyentuh `Unit.hargaJual`. Unit yang
 * belum punya override memakai hargaJual sebagai default.
 */
export async function omzetUnitProyek(projectId: string, businessPlanId: string) {
  const units = await prisma.unit.findMany({
    where: { projectId },
    orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
    select: {
      id: true, nomor: true, luasTanah: true, hargaJual: true,
      phase: { select: { kode: true } },
      unitType: { select: { nama: true, luasBangunan: true } },
      bpOmzet: { select: { id: true, hargaDasar: true } },
    },
  });

  return units.map((u) => ({
    unitId: u.id,
    businessPlanId,
    omzetId: u.bpOmzet?.id ?? null,
    no: `${u.phase.kode}-${u.nomor}`,
    tipe: u.unitType.nama,
    lb: u.unitType.luasBangunan,
    lt: u.luasTanah,
    hargaJual: u.hargaJual,
    hargaDasar: u.bpOmzet?.hargaDasar ?? u.hargaJual,
    dioverride: !!u.bpOmzet,
  }));
}

/**
 * Business plan sebuah proyek.
 *
 * Diambil terpisah, dan hanya bila peran berhak — menyisipkan relasi lewat
 * select bersyarat membuat Prisma kehilangan tipe pastinya. HPP & operasional
 * kini dua tingkat (kategori induk berisi baris rincian); omset dirakit dari
 * daftar unit lewat `omzetUnitProyek`.
 */
export async function businessPlanProyek(projectId: string) {
  const bp = await prisma.businessPlan.findUnique({
    where: { projectId },
    select: {
      id: true,
      hpp: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, nama: true, urutan: true,
          rows: {
            orderBy: { urutan: "asc" },
            select: { id: true, uraian: true, satuan: true, volume: true, harga: true },
          },
        },
      },
      operasional: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, nama: true, urutan: true,
          rows: {
            orderBy: { urutan: "asc" },
            select: { id: true, nama: true, satuan: true, volume: true, harga: true },
          },
        },
      },
      // Diurut kronologis: periode disimpan "YYYY-MM" sehingga urut string = urut waktu.
      cashflow: { orderBy: { periode: "asc" }, select: { id: true, periode: true, masuk: true, keluar: true } },
    },
  });

  if (!bp) return null;

  const omzet = await omzetUnitProyek(projectId, bp.id);
  return { ...bp, omzet };
}
