import { prisma } from "@/lib/db";
import { filterProyek, type Pengguna } from "@/lib/auth/rbac";

/**
 * Pengambilan data untuk modul Vendor Management.
 *
 * Satu aturan berulang di seluruh berkas ini: relasi `contracts` selalu
 * disaring `filterProyek` — vendor yang sama bisa mengerjakan proyek di luar
 * jangkauan pengguna, dan kontrak itu tidak boleh ikut terhitung. Penyaring
 * inilah yang harus ikut pindah saat modul ini diserap ERP.
 */

/** Daftar vendor beserta ringkasan kontraknya. */
export async function dataVendor(u: Pengguna, bolehKelola: boolean) {
  const vendor = await prisma.vendor.findMany({
    orderBy: { nama: "asc" },
    select: {
      id: true, nama: true, bidang: true, kontak: true, alamat: true, status: true, sejak: true,
      contracts: {
        where: { project: filterProyek(u) },
        select: {
          id: true, nominal: true, retensiPct: true,
          project: { select: { kode: true } },
          expenses: { select: { total: true } },
          variationOrders: { select: { nominal: true, status: true } },
        },
      },
    },
  });

  // Proyek untuk formulir kontrak, hanya bila boleh mengelola.
  const daftarProyek = bolehKelola
    ? await prisma.project.findMany({
        where: filterProyek(u),
        orderBy: { kode: "asc" },
        select: { kode: true, nama: true },
      })
    : [];

  return { vendor, daftarProyek };
}

/** Satu vendor beserta seluruh kontrak dan keikutsertaan tendernya. */
export async function vendorDetail(u: Pengguna, id: string) {
  return prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true, nama: true, bidang: true, kontak: true, alamat: true, sejak: true, status: true,
      contracts: {
        where: { project: filterProyek(u) },
        orderBy: { mulai: "desc" },
        select: {
          id: true, kode: true, jenis: true, jenisBiaya: true, deskripsi: true, nominal: true,
          retensiPct: true, jatuhTempoBln: true, mulai: true,
          project: { select: { kode: true, nama: true } },
          expenses: {
            orderBy: { tanggal: "asc" },
            select: { id: true, tanggal: true, uraian: true, total: true },
          },
          variationOrders: {
            orderBy: { tanggal: "asc" },
            select: { id: true, nomor: true, tanggal: true, uraian: true, nominal: true, status: true },
          },
          units: {
            select: {
              nilaiOverride: true,
              unit: {
                select: {
                  id: true, nomor: true, progress: true, statusPembangunan: true,
                  phase: { select: { kode: true } },
                  unitType: { select: { nama: true } },
                },
              },
            },
          },
          infrastructures: {
            select: {
              infrastructure: {
                select: { id: true, nama: true, jenis: true, progress: true, status: true },
              },
            },
          },
        },
      },
    },
  });
}

/** Proyek beserta unit dan sarprasnya, untuk memilih cakupan kontrak baru. */
export async function proyekUntukKontrak(u: Pengguna) {
  return prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      kode: true, nama: true,
      units: {
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: {
          id: true, nomor: true,
          phase: { select: { kode: true } },
          unitType: { select: { nama: true } },
        },
      },
      infrastructures: { orderBy: { kode: "asc" }, select: { id: true, nama: true, jenis: true } },
    },
  });
}

/** Satu kontrak (SPK) beserta dokumen, cakupan, dan seluruh baris BOQ-nya. */
export async function kontrakDetail(kode: string) {
  return prisma.contract.findUnique({
    where: { kode: decodeURIComponent(kode).toUpperCase() },
    select: {
      id: true, kode: true, jenis: true, deskripsi: true, nominal: true,
      retensiPct: true, jatuhTempoBln: true, mulai: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      vendor: { select: { id: true, nama: true, bidang: true } },
      docSpk: {
        select: {
          id: true, kategori: true,
          versions: {
            orderBy: { diunggahPada: "desc" },
            select: {
              id: true, revisi: true, namaFile: true, ukuranByte: true,
              objectKey: true, diunggahPada: true,
            },
          },
        },
      },
      expenses: { select: { total: true } },
      variationOrders: { select: { nominal: true, status: true } },
      units: {
        select: {
          unit: {
            select: {
              id: true, nomor: true, progress: true, statusPembangunan: true,
              phase: { select: { kode: true } },
              unitType: { select: { nama: true } },
            },
          },
        },
      },
      infrastructures: {
        select: {
          infrastructure: {
            select: { id: true, nama: true, jenis: true, progress: true, status: true },
          },
        },
      },
      // Template BOQ level-SPK (satu definisi untuk semua objek).
      boqItems: {
        orderBy: [{ urutan: "asc" }],
        select: {
          id: true, grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true, urutan: true,
        },
      },
      // Override + opname per objek. Dilebur dengan template lewat `barisEfektif`.
      boqUnit: {
        select: {
          id: true, boqItemId: true, unitId: true, infrastructureId: true,
          grup: true, uraian: true, satuan: true, volume: true, hargaSatuan: true,
          progress: true, progressLalu: true, progressLaluPada: true,
        },
      },
    },
  });
}

/**
 * Peta override per (baris template × objek), untuk melebur dengan template.
 * Kunci: `${boqItemId}:${unitId|infrastructureId}`.
 */
export function petaOverrideBoq(
  boqUnit: {
    boqItemId: string; unitId: string | null; infrastructureId: string | null;
    grup: string | null; uraian: string | null; satuan: string | null;
    volume: number | null; hargaSatuan: number | null;
    progress: number; progressLalu: number; progressLaluPada: Date | null;
  }[],
) {
  return new Map(
    boqUnit.map((o) => [`${o.boqItemId}:${o.unitId ?? o.infrastructureId}`, o]),
  );
}
