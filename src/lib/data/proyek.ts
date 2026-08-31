import { bacaSegmen } from "@/lib/adaptor/rute";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { bolehAksesProyek, bolehLihat, filterProyek, type Pengguna } from "@/lib/auth/rbac";
import { rapKategori, totalRap } from "@/lib/calc/boq";
import { statusBangunSarpras, statusBangunUnit } from "@/lib/calc/status-bangun";

/** Luas total = kavling efektif + sarana + prasarana + RTH. */

/**
 * Daftar proyek untuk Level 1, beserta angka yang ditampilkan di tabelnya:
 * luas total, jumlah unit, daftar fase, dan jumlah item sarpras.
 */
export async function daftarProyek(u: Pengguna) {
  // Total RAB & RAP per proyek hanya ikut bila peran berhak atas harga: baris
  // BOQ/RAP tiap unit & sarpras di-SELECT lalu dijumlah dengan rumus yang sama
  // dengan tabelnya (nilaiUnit/nilaiSarpras).
  const bolehHarga = bolehLihat(u, "hargaRabRap");

  const rapItemSel = { select: { grup: true, kategori: true, volume: true, hargaSatuan: true } } as const;
  const boqItemSel = { select: { volume: true, hargaSatuan: true } } as const;

  const proyek = await prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, status: true,
      kelurahan: true, kecamatan: true, kota: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      fases: { select: { kode: true }, orderBy: { urutan: "asc" } },
      _count: { select: { units: true, infrastructures: true, unitTypes: true } },
      ...(bolehHarga
        ? {
            units: {
              select: {
                boqItems: boqItemSel,
                rapItems: rapItemSel,
                rapUpahVolume: true, rapUpahHarga: true,
                customWorks: {
                  select: {
                    boqItems: boqItemSel,
                    rapItems: rapItemSel,
                    rapUpahVolume: true, rapUpahHarga: true,
                  },
                },
              },
            },
            infrastructures: {
              select: {
                rab: true,
                boqItems: boqItemSel,
                rapItems: rapItemSel,
                rapUpahVolume: true, rapUpahHarga: true,
              },
            },
          }
        : {}),
    },
  });

  return proyek.map((p) => {
    const punyaHarga = "units" in p;
    const units = punyaHarga ? (p as unknown as { units: Parameters<typeof nilaiUnit>[0][] }).units : [];
    const sarpras = punyaHarga
      ? (p as unknown as { infrastructures: Parameters<typeof nilaiSarpras>[0][] }).infrastructures
      : [];
    return {
      ...p,
      totalRab: bolehHarga
        ? units.reduce((s, x) => s + nilaiUnit(x).rab, 0) + sarpras.reduce((s, x) => s + nilaiSarpras(x).rab, 0)
        : null,
      totalRap: bolehHarga
        ? units.reduce((s, x) => s + nilaiUnit(x).rap, 0) + sarpras.reduce((s, x) => s + nilaiSarpras(x).rap, 0)
        : null,
    };
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
      id: true, kode: true, nama: true, status: true,
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
      fases: {
        select: { id: true, kode: true, nama: true, urutan: true, _count: { select: { units: true } } },
        orderBy: { urutan: "asc" as const },
      },
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
          id: true, nib: true, jenisHak: true, nomorHak: true, sertifikat: true, luas: true,
          dokumen: { select: { id: true, kategori: true, versions: pilihVersi } },
        },
      })
    : (
        await prisma.legality.findMany({
          ...dasarLegalitas,
          select: { id: true, nib: true, jenisHak: true, nomorHak: true, sertifikat: true, luas: true },
        })
      ).map((l) => ({ ...l, dokumen: null }));

  const unit = bolehUnit
    ? await prisma.unit.findMany({
        where: { projectId: proyek.id },
        // Diurutkan berdasarkan nomor unit saja (bukan per fase).
        orderBy: { nomor: "asc" },
        select: {
          id: true, kode: true, nomor: true, luasTanah: true, phaseId: true,
          statusJual: true, tanggalSerahTerima: true, progress: true,
          // Menentukan apakah progres unit ini turunan dari opname BOQ
          // Master, yang berarti isian satu-angka manualnya ditiadakan.
          _count: { select: { boqItems: true } },
          phase: { select: { kode: true } },
          unitType: { select: { kode: true, nama: true, luasBangunan: true } },
          customWorks: {
            select: {
              judul: true,
              boqItems: bolehHarga ? { select: { volume: true, hargaSatuan: true } } : false,
              rapItems: bolehHarga ? { select: { volume: true, hargaSatuan: true } } : false,
              rapUpahVolume: bolehHarga,
              rapUpahHarga: bolehHarga,
            },
          },
          ...(bolehHarga
            ? {
                hargaJual: true,
                rapUpahVolume: true,
                rapUpahHarga: true,
                boqItems: { select: { volume: true, hargaSatuan: true } },
                rapItems: { select: { grup: true, volume: true, hargaSatuan: true } },
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
          _count: { select: { contractItems: true, boqItems: true } },
          ...(bolehHarga
            ? { rab: true, boqItems: { select: { volume: true, hargaSatuan: true } } }
            : {}),
        },
      })
    : [];

  return {
    proyek: { ...proyek, legalitas },
    // Status pembangunan & status sarpras dihitung ulang di sini (nilai turunan),
    // supaya transisi Masa Garansi → Selesai (3 bulan) selalu mutakhir.
    unit: unit.map((u) => ({ ...u, statusPembangunan: statusBangunUnit(u) })),
    sarpras: sarpras.map((s) => ({ ...s, status: statusBangunSarpras(s.progress) })),
    bolehHarga, bolehUnit, bolehSarpras, bolehDokumen,
  };
}

/**
 * Hitung RAB & RAP "unit ini" dari baris snapshot-nya — dasar Tipe DITAMBAH
 * seluruh Kerja Tambah, disatukan jadi satu angka. Berlaku sama untuk unit
 * default (tanpa kerja tambah, sehingga sama dengan RAB/RAP tipe) maupun
 * unit custom.
 */
export function nilaiUnit(u: {
  boqItems?: { volume: number; hargaSatuan: number }[];
  rapItems?: { grup?: string | null; volume: number; hargaSatuan: number }[];
  rapUpahVolume?: number;
  rapUpahHarga?: number;
  customWorks?: {
    boqItems?: { volume: number; hargaSatuan: number }[] | false;
    rapItems?: { grup?: string | null; volume: number; hargaSatuan: number }[] | false;
    rapUpahVolume?: number | false;
    rapUpahHarga?: number | false;
  }[];
}) {
  const jumlah = (rows?: { volume: number; hargaSatuan: number }[] | false) =>
    (rows || []).reduce((s, r) => s + r.volume * r.hargaSatuan, 0);

  const rabStandar = jumlah(u.boqItems);
  const kerjaTambah = (u.customWorks ?? []).reduce((s, c) => s + jumlah(c.boqItems), 0);

  // RAP: Material + Tenaga + Subkon + Lain-lain 5% (lewat `rapKategori`).
  // rapMaterial/rapUpah tetap dikembalikan sebagai rincian mentah untuk tampilan.
  const rincianStandar = rapKategori({
    rapUpahVolume: u.rapUpahVolume ?? 0, rapUpahHarga: u.rapUpahHarga ?? 0,
    rapItems: u.rapItems ?? [],
  });
  const rapKerjaTambah = (u.customWorks ?? []).reduce(
    (s, c) =>
      s +
      totalRap({
        rapUpahVolume: c.rapUpahVolume || 0, rapUpahHarga: c.rapUpahHarga || 0,
        rapItems: c.rapItems || [],
      }),
    0,
  );

  return {
    rabStandar,
    kerjaTambah,
    rab: rabStandar + kerjaTambah,
    rap: rincianStandar.total + rapKerjaTambah,
    rapMaterial: rincianStandar.material + rincianStandar.subkon,
    rapUpah: rincianStandar.tenaga,
    rapKerjaTambah,
    // Rincian RAP dasar (Tipe) per 4 kategori — dipakai kartu Ringkasan agar
    // angkanya identik dengan tabel RAP (yang juga memakai rumus rapKategori).
    rap4: rincianStandar,
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
  rapItems?: { grup?: string | null; volume: number; hargaSatuan: number }[];
  rapUpahVolume?: number | null;
  rapUpahHarga?: number | null;
}) {
  const dariBoq = (s.boqItems ?? []).reduce((a, r) => a + r.volume * r.hargaSatuan, 0);
  const rab = dariBoq || s.rab || 0;

  // RAP nyata (dari rincian material/upah + Lain-lain 5%) dipakai bila ada;
  // bila sarpras belum punya rincian RAP, jatuh ke taksiran lama 90% dari RAB
  // supaya angkanya tidak tiba-tiba nol.
  const rapRinci = totalRap({
    rapUpahVolume: s.rapUpahVolume ?? 0, rapUpahHarga: s.rapUpahHarga ?? 0,
    rapItems: s.rapItems ?? [],
  });
  return { rab, rap: rapRinci > 0 ? rapRinci : Math.round(rab * 0.9) };
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
  const unit = await prisma.unit.findUnique({
    where: { kode: bacaSegmen(unitKode).toUpperCase() },
    select: {
      id: true, kode: true, nomor: true, luasTanah: true, projectId: true,
      phaseId: true, unitTypeId: true,
      statusJual: true, tanggalSerahTerima: true, progress: true,
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
          docGambarKerjaPdf: pilihDokumen,
          docGambarKerjaDwg: pilihDokumen,
          docRender: pilihDokumen,
          docSpek: pilihDokumen,
        },
      },
      ...(bolehHarga
        ? {
            hargaJual: true,
            rapUpahVolume: true,
            rapUpahHarga: true,
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
                id: true, grup: true, kategori: true, nama: true, satuan: true,
                volume: true, hargaSatuan: true, keterangan: true,
              },
            },
          }
        : {}),
      customWorks: {
        orderBy: { judul: "asc" as const },
        select: {
          id: true, judul: true, rapUpahVolume: true, rapUpahHarga: true,
          docDesain: pilihDokumen,
          docModel3d: pilihDokumen,
          docGambarKerjaPdf: pilihDokumen,
          docGambarKerjaDwg: pilihDokumen,
          docRab: pilihDokumen,
          boqItems: {
            orderBy: { urutan: "asc" as const },
            select: {
              id: true, grup: true, uraian: true, satuan: true, volume: true,
              hargaSatuan: true, spesifikasi: true,
            },
          },
          rapItems: {
            orderBy: { urutan: "asc" as const },
            select: {
              id: true, grup: true, kategori: true, nama: true, satuan: true,
              volume: true, hargaSatuan: true, keterangan: true,
            },
          },
        },
      },
    },
  });

  if (!unit) return null;
  // Status pembangunan = nilai turunan (lihat statusBangunUnit).
  return { ...unit, statusPembangunan: statusBangunUnit(unit) };
}

/** Satu item sarpras beserta dokumen teknis dan BOQ/RAP-nya. */
export async function detailSarpras(kodeSarpras: string, bolehHarga: boolean) {
  const item = await prisma.infrastructure.findUnique({
    where: { kode: bacaSegmen(kodeSarpras).toUpperCase() },
    select: {
      id: true, kode: true, nama: true, jenis: true, volume: true,
      status: true, progress: true, projectId: true,
      // Jumlah baris BOQ menentukan apakah progres item ini turunan dari
      // opname per baris (halaman Konstruksi) atau masih diisi satu angka
      // manual — sama seperti pada unit.
      _count: { select: { boqItems: true } },
      project: { select: { kode: true, nama: true } },
      docModel3d: pilihDokumen,
      docGambarKerjaPdf: pilihDokumen,
      docGambarKerjaDwg: pilihDokumen,
      ...(bolehHarga
        ? {
            rab: true,
            rapUpahVolume: true,
            rapUpahHarga: true,
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
                id: true, grup: true, kategori: true, nama: true, satuan: true,
                volume: true, hargaSatuan: true, keterangan: true,
              },
            },
          }
        : {}),
    },
  });

  if (!item) return null;
  // Status sarpras = nilai turunan dari progres (lihat statusBangunSarpras).
  return { ...item, status: statusBangunSarpras(item.progress) };
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

/**
 * Satu tipe unit beserta dokumen teknis dan BOQ/RAP masternya.
 *
 * Kode tipe dicari dalam lingkup proyeknya — kode tipe hanya unik per proyek,
 * jadi mencarinya global akan menyerempet tipe bernama sama milik proyek lain.
 */
export async function detailTipeUnit(
  tipeKode: string,
  kodeProyek: string,
  bolehHarga: boolean,
) {
  return prisma.unitType.findFirst({
    where: { kode: bacaSegmen(tipeKode).toUpperCase(), project: { kode: kodeProyek } },
    select: {
      id: true, kode: true, nama: true, luasBangunan: true, luasTanah: true,
      rapUpahVolume: true, rapUpahHarga: true, projectId: true,
      project: { select: { kode: true, nama: true } },
      _count: { select: { units: true } },
      docModel3d: pilihDokumen,
      docGambarKerjaPdf: pilihDokumen,
      docGambarKerjaDwg: pilihDokumen,
      docRender: pilihDokumen,
      docSpek: pilihDokumen,
      ...(bolehHarga
        ? {
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
                id: true, grup: true, kategori: true, nama: true, satuan: true,
                volume: true, hargaSatuan: true, keterangan: true,
              },
            },
          }
        : {}),
    },
  });
}
