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
  select: { revisi: true, namaFile: true, ukuranByte: true, diunggahPada: true },
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
