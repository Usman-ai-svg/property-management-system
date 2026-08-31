import { bacaSegmen } from "@/lib/adaptor/rute";
import { prisma } from "@/lib/db";
import { filterProyek, type Pengguna } from "@/lib/auth/rbac";
import { barisEfektif, progresTertimbang } from "@/lib/calc/kontrak-boq";
import { statusBangunSarpras, statusBangunUnit } from "@/lib/calc/status-bangun";
import { petaOverrideBoq } from "@/lib/data/vendor";

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
      id: true, kode: true, nama: true, status: true,
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
      id: p.id, kode: p.kode, nama: p.nama, status: p.status,
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
      id: true, kode: true, nama: true, status: true,
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
          id: true, kode: true, nomor: true, progress: true,
          statusJual: true, tanggalSerahTerima: true,
          phase: { select: { kode: true } },
          unitType: { select: { nama: true } },
          // Untuk "Keterangan Pekerjaan": grup BOQ yang sedang berjalan diturunkan
          // dari progres tertimbang per grup, bukan lagi ditebak dari angka persen.
          boqItems: { select: { grup: true, volume: true, hargaSatuan: true, progress: true } },
          // Untuk laporan meeting: kapan unit ini terakhir diopname.
          progressRecords: { orderBy: { tanggal: "desc" }, take: 1, select: { tanggal: true } },
        },
      })
    : [];

  const sarpras = opsi.bolehSarpras
    ? await prisma.infrastructure.findMany({
        where: { projectId },
        orderBy: { kode: "asc" },
        select: {
          id: true, kode: true, nama: true, jenis: true, volume: true, progress: true,
        },
      })
    : [];

  // Status pembangunan & status sarpras = nilai turunan.
  return {
    unit: unit.map((u) => ({ ...u, statusPembangunan: statusBangunUnit(u) })),
    sarpras: sarpras.map((s) => ({ ...s, status: statusBangunSarpras(s.progress) })),
  };
}

/** Satu unit beserta BOQ Master-nya, untuk halaman opname konstruksi. */
export async function unitKonstruksi(unitKode: string) {
  const unit = await prisma.unit.findUnique({
    where: { kode: bacaSegmen(unitKode).toUpperCase() },
    select: {
      id: true, kode: true, nomor: true, progress: true,
      statusJual: true, tanggalSerahTerima: true,
      projectId: true,
      phase: { select: { kode: true } },
      project: { select: { kode: true, nama: true } },
      unitType: { select: { nama: true } },
      // Catatan progres terakhir → "update terakhir" di kepala halaman, supaya
      // penghentian sementara pembangunan bisa terlacak dari kapan terakhir diisi.
      progressRecords: {
        orderBy: { tanggal: "desc" },
        take: 1,
        select: { tanggal: true, dicatatOleh: true },
      },
      boqItems: {
        orderBy: { urutan: "asc" },
        select: {
          id: true, grup: true, uraian: true, satuan: true,
          volume: true, hargaSatuan: true, progress: true, progressLalu: true,
        },
      },
    },
  });

  if (!unit) return null;
  return { ...unit, statusPembangunan: statusBangunUnit(unit) };
}

/**
 * Daftar ringkas seluruh unit sebuah proyek, untuk penyeleksi navigasi antar
 * unit di halaman Detail Progress Unit. Urutannya sama dengan tabel proyek.
 */
export async function daftarUnitKonstruksi(projectId: string) {
  return prisma.unit.findMany({
    where: { projectId },
    orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
    select: {
      kode: true, nomor: true,
      phase: { select: { kode: true } },
      unitType: { select: { nama: true } },
    },
  });
}

/** Daftar ringkas sarpras sebuah proyek, untuk penyeleksi navigasi antar item. */
export async function daftarSarprasKonstruksi(projectId: string) {
  return prisma.infrastructure.findMany({
    where: { projectId },
    orderBy: { kode: "asc" },
    select: { kode: true, nama: true, jenis: true },
  });
}

/**
 * Progress Vendor per proyek: daftar SPK proyek ini beserta baris BOQ
 * kontraknya (untuk menghitung capaian tertimbang) dan jumlah objek tercakup.
 *
 * Progress Vendor SENGAJA terpisah dari Progress Konstruksi — lihat
 * `lib/data/progres-konstruksi.ts`. Yang dihitung di sini hanya lingkup SPK.
 */
export async function vendorKonstruksiProyek(projectId: string) {
  const kontrak = await prisma.contract.findMany({
    where: { projectId },
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, jenis: true, deskripsi: true, nominal: true,
      vendor: { select: { id: true, nama: true } },
      boqItems: {
        orderBy: { urutan: "asc" },
        select: { id: true, grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, urutan: true },
      },
      boqUnit: {
        select: {
          boqItemId: true, unitId: true, infrastructureId: true,
          grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true,
          progress: true, progressLalu: true, progressLaluPada: true,
        },
      },
      units: { select: { unitId: true } },
      infrastructures: { select: { infrastructureId: true } },
      _count: { select: { units: true, infrastructures: true } },
    },
  });

  // Progress Vendor SPK = tertimbang atas SELURUH baris efektif (template ⊕
  // override) di semua objek yang dicakup — objek tanpa opname ikut sebagai 0.
  return kontrak.map((c) => {
    const peta = petaOverrideBoq(c.boqUnit);
    const objekIds = [
      ...c.units.map((u) => u.unitId),
      ...c.infrastructures.map((s) => s.infrastructureId),
    ];
    const efektif = objekIds.flatMap((oid) =>
      c.boqItems.map((t) => barisEfektif(t, peta.get(`${t.id}:${oid}`))),
    );
    return {
      id: c.id, kode: c.kode, jenis: c.jenis, deskripsi: c.deskripsi, nominal: c.nominal,
      vendor: c.vendor,
      objek: c._count.units + c._count.infrastructures,
      progres: efektif.length ? progresTertimbang(efektif) : 0,
    };
  });
}

/** Satu item sarpras beserta BOQ Master-nya. */
export async function sarprasKonstruksi(kodeSarpras: string) {
  const item = await prisma.infrastructure.findUnique({
    where: { kode: bacaSegmen(kodeSarpras).toUpperCase() },
    select: {
      id: true, kode: true, nama: true, jenis: true, volume: true,
      progress: true, projectId: true,
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

  if (!item) return null;
  return { ...item, status: statusBangunSarpras(item.progress) };
}
