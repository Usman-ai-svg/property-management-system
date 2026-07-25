import { prisma } from "@/lib/db";
import { filterProyek, type Pengguna } from "@/lib/auth/rbac";

/**
 * Data untuk modul Konstruksi.
 *
 * Berbeda dari prototipe yang menebak progres minggu lalu dengan
 * `progres − 7`, di sini pembandingnya diambil dari catatan progres
 * sebelumnya yang sebenarnya.
 */

export async function dashboardKonstruksi(u: Pengguna) {
  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, statusLahan: true,
      fases: { select: { kode: true }, orderBy: { urutan: "asc" } },
      units: { select: { progress: true } },
      infrastructures: { select: { progress: true } },
    },
  });

  return proyek.map((p) => {
    const rataUnit = p.units.length
      ? Math.round(p.units.reduce((s, x) => s + x.progress, 0) / p.units.length)
      : 0;
    const rataSarpras = p.infrastructures.length
      ? Math.round(p.infrastructures.reduce((s, x) => s + x.progress, 0) / p.infrastructures.length)
      : 0;

    return {
      id: p.id, kode: p.kode, nama: p.nama, statusLahan: p.statusLahan,
      fases: p.fases.map((f) => f.kode),
      jumlahUnit: p.units.length,
      dikerjakan: p.units.filter((x) => x.progress > 0 && x.progress < 100).length,
      rataUnit,
      jumlahSarpras: p.infrastructures.length,
      rataSarpras,
    };
  });
}

/**
 * Ambil dua titik progres terakhir sebuah entitas.
 *
 * Mengembalikan progres sekarang dan progres pada opname sebelumnya. Bila
 * riwayatnya baru satu titik, pembanding minggu lalu dianggap nol — bukan
 * ditebak mundur, karena menebak akan memunculkan kemajuan yang tidak pernah
 * benar-benar dilaporkan.
 */
export async function duaTitikProgres(
  where: { unitId: string } | { infrastructureId: string },
  progresSekarang: number,
): Promise<{ lalu: number; kini: number }> {
  const catatan = await prisma.progressRecord.findMany({
    where,
    orderBy: { tanggal: "desc" },
    take: 2,
    select: { progress: true },
  });

  if (catatan.length === 0) return { lalu: 0, kini: progresSekarang };
  if (catatan.length === 1) return { lalu: 0, kini: progresSekarang };
  return { lalu: catatan[1].progress, kini: progresSekarang };
}
