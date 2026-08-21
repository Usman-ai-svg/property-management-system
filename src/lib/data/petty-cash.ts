import { prisma } from "@/lib/db";
import { saldoDana, totalLaporan } from "@/lib/calc/petty-cash";
import type { StatusPettyCash } from "@/lib/domain/enums";

/**
 * Seluruh dana petty cash sebuah proyek beserta mutasi, laporan, dan saldo
 * turunannya. Saldo & total laporan dihitung di sini dari data mentah (lewat
 * `saldoDana`/`totalLaporan`) supaya halaman tinggal menggambar.
 */
export async function pettyCashProyek(projectId: string) {
  const funds = await prisma.pettyCashFund.findMany({
    where: { projectId },
    orderBy: [{ aktif: "desc" }, { dibuatPada: "asc" }],
    select: {
      id: true, plafon: true, aktif: true,
      pemegang: { select: { id: true, nama: true } },
      topUps: {
        orderBy: { tanggal: "asc" },
        select: {
          id: true, tanggal: true, nominal: true, jenis: true, reportId: true,
          oleh: { select: { nama: true } },
        },
      },
      laporan: {
        orderBy: { dibuatPada: "desc" },
        select: {
          id: true, periode: true, status: true, catatan: true,
          bukti: true, buktiKey: true,
          diajukanPada: true, diverifikasiQsPada: true,
          disetujuiOpsPada: true, direimbursePada: true,
          expenses: {
            orderBy: { tanggal: "asc" },
            select: {
              id: true, tanggal: true, jenis: true, uraian: true, total: true,
              pic: true, bukti: true, buktiKey: true,
            },
          },
        },
      },
    },
  });

  return funds.map((f) => {
    const semuaPengeluaran = f.laporan.flatMap((l) => l.expenses);
    return {
      ...f,
      saldo: saldoDana(f.topUps, semuaPengeluaran),
      laporan: f.laporan.map((l) => ({ ...l, total: totalLaporan(l.expenses) })),
      // Laporan Draft = batch berjalan tempat pengeluaran baru menempel; paling
      // banyak satu per dana.
      draftReportId: f.laporan.find((l) => l.status === "Draft")?.id ?? null,
    };
  });
}

export type DanaPettyCash = Awaited<ReturnType<typeof pettyCashProyek>>[number];

/**
 * Kandidat pemegang dana: Supervisor yang berhak atas proyek ini (atau semua
 * proyek). Dipakai form "Beri Dana" milik Finance untuk memilih pemegang.
 */
export async function pemegangKandidat(projectId: string) {
  return prisma.user.findMany({
    where: {
      aktif: true,
      roles: { some: { role: { nama: "Supervisor" } } },
      OR: [{ semuaProyek: true }, { aksesProyek: { some: { projectId } } }],
    },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });
}

/** Satu laporan lengkap + konteks dananya — untuk panel rincian & transisi. */
export async function laporanPetty(reportId: string) {
  const r = await prisma.pettyCashReport.findUnique({
    where: { id: reportId },
    select: {
      id: true, periode: true, status: true, catatan: true, buktiKey: true,
      diajukanPada: true, diverifikasiQsPada: true, disetujuiOpsPada: true, direimbursePada: true,
      fund: {
        select: {
          id: true, projectId: true, pemegangId: true,
          project: { select: { kode: true } },
          pemegang: { select: { nama: true } },
        },
      },
      expenses: {
        orderBy: { tanggal: "asc" },
        select: { id: true, tanggal: true, jenis: true, uraian: true, total: true, pic: true, buktiKey: true },
      },
    },
  });
  if (!r) return null;
  return { ...r, status: r.status as StatusPettyCash, total: totalLaporan(r.expenses) };
}
