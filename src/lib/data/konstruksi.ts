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

// ---------------------------------------------------------------------------
// Pengambilan data per halaman
//
// Halaman tidak lagi memanggil Prisma sendiri. Bentuk datanya ditetapkan di
// sini, sehingga saat modul ini diserap ERP cukup berkas ini yang berganti isi
// menjadi pemanggilan RPC — halamannya tidak perlu disentuh.
// ---------------------------------------------------------------------------

/** Kepala halaman Konstruksi per proyek: identitas proyek dan daftar fasenya. */
export async function proyekKonstruksi(kodeProyek: string) {
  return prisma.project.findUnique({
    where: { kode: kodeProyek },
    select: {
      id: true, kode: true, nama: true, statusLahan: true,
      fases: { select: { kode: true }, orderBy: { urutan: "asc" } },
    },
  });
}

/**
 * Isi halaman Konstruksi per proyek: unit dan sarpras.
 *
 * Keduanya hanya di-query bila peran berhak melihatnya — bukan diambil lalu
 * disembunyikan. Penyaring fase dikerjakan di database; pencarian teks
 * dikerjakan pemanggil, karena yang dicari gabungan "F2-3 Galileo" yang tidak
 * tersimpan sebagai satu kolom.
 */
export async function isiKonstruksiProyek(
  projectId: string,
  opsi: { fase: string; bolehUnit: boolean; bolehSarpras: boolean },
) {
  const unit = opsi.bolehUnit
    ? await prisma.unit.findMany({
        where: {
          projectId,
          ...(opsi.fase !== "Semua" ? { phase: { kode: opsi.fase } } : {}),
        },
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: {
          id: true, kode: true, nomor: true, progress: true, statusPembangunan: true,
          phase: { select: { kode: true } },
          unitType: { select: { nama: true } },
        },
      })
    : [];

  const sarpras = opsi.bolehSarpras
    ? await prisma.infrastructure.findMany({
        where: { projectId },
        orderBy: { kode: "asc" },
        select: {
          id: true, kode: true, nama: true, jenis: true, volume: true,
          status: true, progress: true,
        },
      })
    : [];

  return { unit, sarpras };
}

/** Satu unit beserta BOQ Master-nya, untuk halaman opname konstruksi. */
export async function unitKonstruksi(unitKode: string) {
  return prisma.unit.findUnique({
    where: { kode: decodeURIComponent(unitKode).toUpperCase() },
    select: {
      id: true, kode: true, nomor: true, progress: true, statusPembangunan: true,
      projectId: true,
      phase: { select: { kode: true } },
      project: { select: { kode: true, nama: true } },
      unitType: { select: { nama: true } },
      boqItems: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, grup: true, uraian: true, satuan: true,
          volume: true, hargaSatuan: true, progress: true, progressLalu: true,
        },
      },
    },
  });
}

/** Satu item sarpras beserta BOQ Master-nya. */
export async function sarprasKonstruksi(kodeSarpras: string) {
  return prisma.infrastructure.findUnique({
    where: { kode: decodeURIComponent(kodeSarpras).toUpperCase() },
    select: {
      id: true, kode: true, nama: true, jenis: true, volume: true,
      status: true, progress: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      boqItems: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, grup: true, uraian: true, satuan: true,
          volume: true, hargaSatuan: true, progress: true, progressLalu: true,
        },
      },
    },
  });
}
