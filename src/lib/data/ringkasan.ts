import { prisma } from "@/lib/db";
import { bolehLihat, filterProyek, type Pengguna } from "@/lib/auth/rbac";

export interface RingkasProyek {
  id: string;
  kode: string;
  nama: string;
  status: string;
  statusLahan: string;
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
      id: true, kode: true, nama: true, status: true, statusLahan: true,
      units: {
        select: {
          progress: true,
          statusPembangunan: true,
          ...(bolehHarga ? { hargaJual: true, rapUpah: true } : {}),
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
      statusLahan: p.statusLahan,
      jumlahUnit,
      unitProgress: unit.filter((x) => x.statusPembangunan === "Progress").length,
      unitSelesai: unit.filter((x) =>
        ["Selesai", "Serah Terima", "Habis Masa Garansi"].includes(x.statusPembangunan),
      ).length,
      rataProgress,
      anggaran: bolehKeuangan ? (anggaranPerProyek.get(p.id) ?? 0) : null,
      realisasi: bolehKeuangan ? (realisasiPerProyek.get(p.id) ?? 0) : null,
      nilaiJual: bolehHarga
        ? unit.reduce((s, x) => s + ((x as { hargaJual?: number }).hargaJual ?? 0), 0)
        : null,
    };
  });
}

/** Total RAP (material hasil snapshot + upah) per proyek. */
async function hitungAnggaran(u: Pengguna): Promise<Map<string, number>> {
  const unit = await prisma.unit.findMany({
    where: { project: filterProyek(u) },
    select: {
      projectId: true,
      rapUpah: true,
      rapItems: { select: { volume: true, hargaSatuan: true } },
    },
  });

  const peta = new Map<string, number>();
  for (const x of unit) {
    const material = x.rapItems.reduce((s, r) => s + r.volume * r.hargaSatuan, 0);
    peta.set(x.projectId, (peta.get(x.projectId) ?? 0) + material + x.rapUpah);
  }
  return peta;
}
