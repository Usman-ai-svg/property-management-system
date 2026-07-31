import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { bolehAksesProyek, bolehLihat, filterProyek, type Pengguna } from "@/lib/auth/rbac";

/** Luas total = kavling efektif + sarana + prasarana + RTH. */
export const luasTotal = (l: {
  luasKavlingEfektif: number; luasSarana: number; luasPrasarana: number; luasRth: number;
}): number => l.luasKavlingEfektif + l.luasSarana + l.luasPrasarana + l.luasRth;

/**
 * Daftar proyek untuk Level 1, beserta angka yang ditampilkan di tabelnya:
 * luas total, jumlah unit, daftar fase, dan jumlah item sarpras.
 */
export async function daftarProyek(u: Pengguna) {
  return prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, status: true, statusLahan: true,
      kecamatan: true, kota: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      fases: { select: { kode: true }, orderBy: { urutan: "asc" } },
      _count: { select: { units: true, infrastructures: true, unitTypes: true } },
    },
  });
}

/** Angka KPI di kepala Level 1. */
export async function kpiMaster(u: Pengguna) {
  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    select: { _count: { select: { units: true, unitTypes: true, infrastructures: true } } },
  });

  return {
    proyek: proyek.length,
    unit: proyek.reduce((s, p) => s + p._count.units, 0),
    tipeUnit: proyek.reduce((s, p) => s + p._count.unitTypes, 0),
    sarpras: proyek.reduce((s, p) => s + p._count.infrastructures, 0),
  };
}

const pilihVersi = {
  select: { id: true, revisi: true, namaFile: true, ukuranByte: true, objectKey: true, diunggahPada: true },
  orderBy: { diunggahPada: "desc" as const },
};

/**
 * Detail satu proyek untuk Level 2.
 *
 * Dua penjagaan berlapis:
 *   1. Proyek di luar jangkauan akses dijawab notFound() — bukan "dilarang",
 *      supaya keberadaan proyek itu sendiri tidak bocor.
 *   2. Field harga hanya di-SELECT bila peran berhak.
 */
const pilihDokumen = { select: { id: true, kategori: true, versions: pilihVersi } };

export async function detailProyek(u: Pengguna, kode: string) {
  const bolehHarga = bolehLihat(u, "hargaRabRap");
  const bolehSarpras = bolehLihat(u, "daftarSarpras");
  const bolehUnit = bolehLihat(u, "daftarUnit");
  const bolehDokumen = bolehLihat(u, "dokumenTeknis");

  const proyek = await prisma.project.findUnique({
    where: { kode },
    select: {
      id: true, kode: true, nama: true, status: true, statusLahan: true,
      alamat: true, kelurahan: true, kecamatan: true, kota: true, provinsi: true,
      pinLat: true, pinLng: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      unitTypes: {
        select: {
          id: true, kode: true, nama: true, luasBangunan: true, luasTanah: true,
          _count: { select: { units: true } },
        },
        orderBy: { luasBangunan: "asc" as const },
      },
      fases: { select: { id: true, kode: true }, orderBy: { urutan: "asc" as const } },
    },
  });

  if (!proyek) notFound();
  if (!bolehAksesProyek(u, proyek.id)) notFound();

  // Legalitas diambil terpisah supaya relasi dokumennya hanya ikut bila peran
  // berhak atas dokumen teknis — riwayat revisi tidak dikirim ke peran lain.
  //
  // Ditulis sebagai dua cabang penuh, bukan satu query dengan select bersyarat:
  // menyisipkan relasi lewat spread membuat Prisma kehilangan tipe pastinya.
  const dasarLegalitas = {
    where: { projectId: proyek.id },
    orderBy: { nib: "asc" as const },
  };

  const legalitas = bolehDokumen
    ? await prisma.legality.findMany({
        ...dasarLegalitas,
        select: {
          id: true, nib: true, sertifikat: true, luas: true,
          dokumen: { select: { id: true, kategori: true, versions: pilihVersi } },
        },
      })
    : (
        await prisma.legality.findMany({
          ...dasarLegalitas,
          select: { id: true, nib: true, sertifikat: true, luas: true },
        })
      ).map((l) => ({ ...l, dokumen: null }));

  const unit = bolehUnit
    ? await prisma.unit.findMany({
        where: { projectId: proyek.id },
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: {
          id: true, kode: true, nomor: true, luasTanah: true,
          statusPembangunan: true, statusJual: true, progress: true,
          // Menentukan apakah progres unit ini turunan dari opname BOQ
          // Master, yang berarti isian satu-angka manualnya ditiadakan.
          _count: { select: { boqItems: true } },
          phase: { select: { kode: true } },
          unitType: { select: { kode: true, nama: true, luasBangunan: true } },
          customWorks: {
            select: {
              judul: true,
              boqItems: bolehHarga ? { select: { volume: true, hargaSatuan: true } } : false,
            },
          },
          ...(bolehHarga
            ? {
                hargaJual: true,
                rapUpah: true,
                boqItems: { select: { volume: true, hargaSatuan: true } },
                rapItems: { select: { volume: true, hargaSatuan: true } },
              }
            : {}),
        },
      })
    : [];

  const sarpras = bolehSarpras
    ? await prisma.infrastructure.findMany({
        where: { projectId: proyek.id },
        orderBy: { kode: "asc" },
        select: {
          id: true, kode: true, nama: true, jenis: true, volume: true,
          status: true, progress: true,
          _count: { select: { contractItems: true } },
          ...(bolehHarga
            ? { rab: true, boqItems: { select: { volume: true, hargaSatuan: true } } }
            : {}),
        },
      })
    : [];

  return {
    proyek: { ...proyek, legalitas },
    unit, sarpras,
    bolehHarga, bolehUnit, bolehSarpras, bolehDokumen,
  };
}

/** Hitung RAB & RAP sebuah unit dari baris snapshot-nya. */
export function nilaiUnit(u: {
  boqItems?: { volume: number; hargaSatuan: number }[];
  rapItems?: { volume: number; hargaSatuan: number }[];
  rapUpah?: number;
  customWorks?: { boqItems?: { volume: number; hargaSatuan: number }[] | false }[];
}) {
  const jumlah = (rows?: { volume: number; hargaSatuan: number }[] | false) =>
    (rows || []).reduce((s, r) => s + r.volume * r.hargaSatuan, 0);

  const rabStandar = jumlah(u.boqItems);
  const kerjaTambah = (u.customWorks ?? []).reduce((s, c) => s + jumlah(c.boqItems), 0);
  const rapMaterial = jumlah(u.rapItems);

  return {
    rabStandar,
    kerjaTambah,
    rab: rabStandar + kerjaTambah,
    rap: rapMaterial + (u.rapUpah ?? 0),
    rapMaterial,
    rapUpah: u.rapUpah ?? 0,
  };
}

/**
 * RAB & RAP satu item sarpras.
 *
 * Mengikuti artifact: RAB adalah jumlah baris BOQ-nya, dan RAP ditaksir
 * 90% dari RAB selama rincian RAP sarpras belum dibuat sendiri.
 */
export function nilaiSarpras(s: {
  rab?: number;
  boqItems?: { volume: number; hargaSatuan: number }[];
}) {
  const dariBoq = (s.boqItems ?? []).reduce((a, r) => a + r.volume * r.hargaSatuan, 0);
  const rab = dariBoq || s.rab || 0;
  return { rab, rap: Math.round(rab * 0.9) };
}

// ---------------------------------------------------------------------------
// Halaman rincian (Level 3 & 4) Master Proyek
//
// Dipindahkan dari halaman supaya lapisan tampilan tidak lagi tahu Prisma.
// Perhatikan blok `...(bolehHarga ? ... : {})`: kolom harga dan seluruh
// relasi BOQ/RAP hanya ikut di-SELECT bila peran berhak. Itulah aturan yang
// wajib ikut pindah saat modul ini diserap ERP.
// ---------------------------------------------------------------------------

/** Satu unit beserta tipe, dokumen teknis, kerja tambah, dan BOQ/RAP-nya. */
export async function detailUnit(unitKode: string, bolehHarga: boolean) {
  return prisma.unit.findUnique({
    where: { kode: decodeURIComponent(unitKode).toUpperCase() },
    select: {
      id: true, kode: true, nomor: true, luasTanah: true, projectId: true,
      phaseId: true, unitTypeId: true,
      statusPembangunan: true, statusJual: true, progress: true,
      // Jumlah baris BOQ Master menentukan apakah progres unit ini turunan
      // dari opname per baris atau masih diisi satu angka manual.
      _count: { select: { boqItems: true } },
      phase: { select: { kode: true } },
      project: {
        select: {
          kode: true, nama: true,
          fases: { select: { id: true, kode: true }, orderBy: { urutan: "asc" } },
          unitTypes: {
            select: { id: true, nama: true, luasBangunan: true },
            orderBy: { luasBangunan: "asc" },
          },
        },
      },
      unitType: {
        select: {
          kode: true, nama: true, luasBangunan: true,
          docModel3d: pilihDokumen,
          docGambarKerja: pilihDokumen,
          docRender: pilihDokumen,
          docSpek: pilihDokumen,
        },
      },
      ...(bolehHarga
        ? {
            hargaJual: true,
            rapUpah: true,
            boqItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, uraian: true, satuan: true,
                volume: true, hargaSatuan: true, spesifikasi: true,
              },
            },
            rapItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, nama: true, satuan: true,
                volume: true, hargaSatuan: true, keterangan: true,
              },
            },
          }
        : {}),
      customWorks: {
        orderBy: { judul: "asc" as const },
        select: {
          id: true, judul: true, rapUpah: true,
          docDesain: pilihDokumen,
          docModel3d: pilihDokumen,
          docGambarKerja: pilihDokumen,
          boqItems: {
            orderBy: { urutan: "asc" as const },
            select: {
              id: true, uraian: true, satuan: true, volume: true,
              hargaSatuan: true, spesifikasi: true,
            },
          },
          rapItems: {
            orderBy: { urutan: "asc" as const },
            select: {
              id: true, grup: true, nama: true, satuan: true,
              volume: true, hargaSatuan: true, keterangan: true,
            },
          },
        },
      },
    },
  });
}

/** Satu item sarpras beserta dokumen teknis dan BOQ/RAP-nya. */
export async function detailSarpras(kodeSarpras: string, bolehHarga: boolean) {
  return prisma.infrastructure.findUnique({
    where: { kode: decodeURIComponent(kodeSarpras).toUpperCase() },
    select: {
      id: true, kode: true, nama: true, jenis: true, volume: true,
      status: true, progress: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      docModel3d: pilihDokumen,
      docGambarKerja: pilihDokumen,
      ...(bolehHarga
        ? {
            rab: true,
            rapUpah: true,
            boqItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, uraian: true, satuan: true,
                volume: true, hargaSatuan: true, spesifikasi: true,
              },
            },
            rapItems: {
              orderBy: { urutan: "asc" as const },
              select: {
                id: true, grup: true, nama: true, satuan: true,
                volume: true, hargaSatuan: true, keterangan: true,
              },
            },
          }
        : {}),
    },
  });
}

/** Kontrak vendor yang mencakup sebuah unit. */
export async function kontrakUnit(unitId: string) {
  return prisma.contract.findMany({
    where: { units: { some: { unitId } } },
    select: {
      id: true, nominal: true, retensiPct: true, deskripsi: true,
      vendor: { select: { nama: true } },
      expenses: { select: { total: true } },
      variationOrders: { select: { nominal: true, status: true } },
    },
  });
}

/** Kontrak vendor yang mencakup sebuah item sarpras. */
export async function kontrakSarpras(infrastructureId: string) {
  return prisma.contract.findMany({
    where: { infrastructures: { some: { infrastructureId } } },
    select: {
      id: true, nominal: true, retensiPct: true, deskripsi: true,
      vendor: { select: { nama: true } },
      expenses: { select: { total: true } },
      variationOrders: { select: { nominal: true, status: true } },
    },
  });
}

/**
 * Riwayat perubahan sebuah objek, dibatasi ke proyek yang boleh diakses
 * pengguna — supaya log tidak menjadi celah untuk mengintip proyek lain.
 */
export async function riwayatObjek(u: Pengguna, projectId: string, namaObjek: string) {
  return prisma.auditLog.findMany({
    where: {
      project: filterProyek(u),
      projectId,
      objek: { contains: namaObjek },
    },
    orderBy: { waktu: "desc" },
    take: 8,
    select: {
      id: true, waktu: true, aksi: true, objek: true,
      nilaiDari: true, nilaiKe: true, peran: true,
      user: { select: { nama: true } },
    },
  });
}
