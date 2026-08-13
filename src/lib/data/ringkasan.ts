import { prisma } from "@/lib/db";
import { bolehLihat, filterProyek, type Pengguna } from "@/lib/auth/rbac";
import { totalRap } from "@/lib/calc/boq";

export interface RingkasProyek {
  id: string;
  kode: string;
  nama: string;
  status: string;
  jumlahUnit: number;
  unitProgress: number;
  unitSelesai: number;
  rataProgress: number;
  /** Hanya terisi bila peran berhak atas "keuangan". */
  anggaran: number | null;
  realisasi: number | null;
  /** Hanya terisi bila peran berhak atas "hargaRabRap". */
  nilaiJual: number | null;
}

/**
 * Ringkasan seluruh proyek yang boleh diakses pengguna.
 *
 * Perhatikan pola yang dipakai: angka keuangan hanya di-query bila pengguna
 * memang berhak. Bila tidak, field-nya bernilai null dan query-nya tidak
 * pernah dijalankan — bukan dijalankan lalu hasilnya dibuang.
 */
export async function ringkasanProyek(u: Pengguna): Promise<RingkasProyek[]> {
  const bolehKeuangan = bolehLihat(u, "keuangan");
  const bolehHarga = bolehLihat(u, "hargaRabRap");

  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, status: true,
      units: {
        select: {
          progress: true,
          ...(bolehHarga ? { hargaJual: true } : {}),
        },
      },
    },
  });

  // Realisasi diambil dari transaksi biaya, bukan dari faktor tebakan.
  const realisasiPerProyek = bolehKeuangan
    ? new Map(
        (
          await prisma.expense.groupBy({
            by: ["projectId"],
            _sum: { total: true },
            where: { project: filterProyek(u) },
          })
        ).map((r) => [r.projectId, r._sum.total ?? 0]),
      )
    : new Map<string, number>();

  // Anggaran = total RAP seluruh unit (material + upah).
  const anggaranPerProyek = bolehKeuangan
    ? await hitungAnggaran(u)
    : new Map<string, number>();

  return proyek.map((p) => {
    const unit = p.units;
    const jumlahUnit = unit.length;
    const rataProgress = jumlahUnit
      ? Math.round(unit.reduce((s, x) => s + x.progress, 0) / jumlahUnit)
      : 0;

    return {
      id: p.id,
      kode: p.kode,
      nama: p.nama,
      status: p.status,
      jumlahUnit,
      // Status pembangunan kini turunan; hitung langsung dari progres.
      unitProgress: unit.filter((x) => x.progress > 0 && x.progress < 100).length,
      unitSelesai: unit.filter((x) => x.progress >= 100).length,
      rataProgress,
      anggaran: bolehKeuangan ? (anggaranPerProyek.get(p.id) ?? 0) : null,
      realisasi: bolehKeuangan ? (realisasiPerProyek.get(p.id) ?? 0) : null,
      nilaiJual: bolehHarga
        ? unit.reduce((s, x) => s + ((x as { hargaJual?: number }).hargaJual ?? 0), 0)
        : null,
    };
  });
}

/** Total RAP per proyek (menghormati mode borongan & Lain-lain 5%). */
async function hitungAnggaran(u: Pengguna): Promise<Map<string, number>> {
  const unit = await prisma.unit.findMany({
    where: { project: filterProyek(u) },
    select: {
      projectId: true,
      rapUpahVolume: true,
      rapUpahHarga: true,
      rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
    },
  });

  const peta = new Map<string, number>();
  for (const x of unit) {
    peta.set(x.projectId, (peta.get(x.projectId) ?? 0) + totalRap(x));
  }
  return peta;
}
