import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { bolehLihat, filterProjectId, type Pengguna } from "@/lib/auth/rbac";
import { saldoDana, totalLaporan } from "@/lib/calc/petty-cash";
import { tanggal } from "@/lib/format";
import type { StatusPettyCash } from "@/lib/domain/enums";

/**
 * Label sebuah batch dari rentang tanggal pengeluarannya, mis.
 * "18 Jun 2026 – 02 Jul 2026". Menggantikan penamaan per-bulan: satu bulan
 * boleh memuat lebih dari satu batch (frekuensi reimburse 2 minggu–1 bulan),
 * jadi rentang tanggal-lah yang membedakannya. Null bila batch masih kosong.
 */
export function rentangTanggal(pengeluaran: { tanggal: Date }[]): string | null {
  if (pengeluaran.length === 0) return null;
  const waktu = pengeluaran.map((e) => e.tanggal.getTime());
  const min = new Date(Math.min(...waktu));
  const max = new Date(Math.max(...waktu));
  return min.getTime() === max.getTime() ? tanggal(min) : `${tanggal(min)} – ${tanggal(max)}`;
}

/** Kolom sebuah dana + mutasi & laporannya — dipakai ulang di dua query. */
const PILIH_DANA = {
  id: true, plafon: true, aktif: true,
  pemegang: { select: { id: true, nama: true } },
  topUps: {
    orderBy: { tanggal: "asc" as const },
    select: {
      id: true, tanggal: true, nominal: true, jenis: true, reportId: true,
      oleh: { select: { nama: true } },
    },
  },
  laporan: {
    orderBy: { dibuatPada: "desc" as const },
    select: {
      id: true, periode: true, status: true, catatan: true,
      bukti: true, buktiKey: true,
      diajukanPada: true, diverifikasiQsPada: true,
      disetujuiOpsPada: true, direimbursePada: true,
      expenses: {
        orderBy: { tanggal: "asc" as const },
        select: {
          id: true, tanggal: true, jenis: true, uraian: true, total: true,
          pic: true, bukti: true, buktiKey: true,
        },
      },
    },
  },
} as const;

type DanaPayload = Prisma.PettyCashFundGetPayload<{ select: typeof PILIH_DANA }>;

/** Lengkapi dana mentah dengan saldo & total laporan turunan. */
function olahDana(f: DanaPayload) {
  // `laporan` dikeluarkan dari spread supaya versi ber-`total` di bawah
  // menggantikannya, bukan berpotongan dengannya.
  const { laporan, ...sisa } = f;
  return {
    ...sisa,
    saldo: saldoDana(f.topUps, laporan.flatMap((l) => l.expenses)),
    laporan: laporan.map((l) => ({
      ...l,
      total: totalLaporan(l.expenses),
      rentang: rentangTanggal(l.expenses),
    })),
    // Laporan Draft = batch berjalan tempat pengeluaran baru menempel; paling
    // banyak satu per dana.
    draftReportId: laporan.find((l) => l.status === "Draft")?.id ?? null,
  };
}

/**
 * Seluruh dana petty cash sebuah proyek beserta mutasi, laporan, dan saldo
 * turunannya. Dipakai kartu Petty Cash di halaman Keuangan Proyek.
 */
export async function pettyCashProyek(projectId: string) {
  const funds = await prisma.pettyCashFund.findMany({
    where: { projectId },
    orderBy: [{ aktif: "desc" }, { dibuatPada: "asc" }],
    select: PILIH_DANA,
  });
  return funds.map((f) => olahDana(f));
}

export type DanaPettyCash = Awaited<ReturnType<typeof pettyCashProyek>>[number];

/**
 * Dana petty cash yang relevan bagi seorang pengguna, dikelompokkan per proyek —
 * isi halaman menu "Petty Cash" tersendiri.
 *
 * Peran lapangan (tanpa izin `keuangan`, mis. Supervisor) hanya melihat dana
 * yang DIPEGANGNYA; peran pengawas keuangan (Finance/QS/Head Ops) melihat semua
 * dana di proyek yang boleh diaksesnya. Keduanya tetap dibatasi
 * `filterProjectId`, jadi tak ada dana lintas-proyek yang bocor.
 */
export async function pettyCashPengguna(pengguna: Pengguna) {
  const hanyaMilikSendiri = !bolehLihat(pengguna, "keuangan");
  const funds = await prisma.pettyCashFund.findMany({
    where: {
      ...filterProjectId(pengguna),
      ...(hanyaMilikSendiri ? { pemegangId: pengguna.id } : {}),
    },
    orderBy: [{ project: { kode: "asc" } }, { aktif: "desc" }, { dibuatPada: "asc" }],
    select: { ...PILIH_DANA, project: { select: { id: true, kode: true, nama: true } } },
  });

  // Kelompokkan per proyek, pertahankan urutan kemunculan.
  const grup: { project: { id: string; kode: string; nama: string }; funds: DanaPettyCash[] }[] = [];
  for (const f of funds) {
    const { project, ...sisa } = f;
    let g = grup.find((x) => x.project.id === project.id);
    if (!g) {
      g = { project, funds: [] };
      grup.push(g);
    }
    g.funds.push(olahDana(sisa));
  }
  return grup;
}

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
