import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { bolehAksesProyek, bolehLihat, filterProyek, type Pengguna } from "@/lib/auth/rbac";

/** Daftar proyek yang boleh diakses pengguna. */
export async function daftarProyek(u: Pengguna) {
  return prisma.project.findMany({
    where: filterProyek(u),
    orderBy: { kode: "asc" },
    select: {
      id: true, kode: true, nama: true, status: true, statusLahan: true,
      kota: true, provinsi: true, kecamatan: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      _count: { select: { units: true, infrastructures: true } },
    },
  });
}

/**
 * Detail satu proyek.
 *
 * Dua penjagaan berlapis:
 *   1. Proyek harus berada dalam jangkauan akses pengguna — kalau tidak,
 *      halaman dianggap tidak ada (bukan "dilarang", supaya keberadaan
 *      proyek itu sendiri tidak bocor).
 *   2. Field harga hanya di-SELECT bila peran berhak.
 */
export async function detailProyek(u: Pengguna, kode: string) {
  const bolehHarga = bolehLihat(u, "hargaRabRap");
  const bolehSarpras = bolehLihat(u, "daftarSarpras");
  const bolehUnit = bolehLihat(u, "daftarUnit");

  const proyek = await prisma.project.findUnique({
    where: { kode },
    select: {
      id: true, kode: true, nama: true, status: true, statusLahan: true,
      alamat: true, kelurahan: true, kecamatan: true, kota: true, provinsi: true,
      pinLat: true, pinLng: true,
      luasKavlingEfektif: true, luasSarana: true, luasPrasarana: true, luasRth: true,
      ...(bolehHarga
        ? {
            hargaPerM2: true, biayaPembelian: true, biayaNotaris: true,
            biayaBalikNama: true, biayaLegalLain: true,
          }
        : {}),
      legalitas: {
        select: { id: true, nib: true, sertifikat: true, luas: true },
        orderBy: { nib: "asc" as const },
      },
      unitTypes: {
        select: { id: true, kode: true, nama: true, luasBangunan: true, luasTanah: true },
        orderBy: { luasBangunan: "asc" as const },
      },
    },
  });

  if (!proyek) notFound();
  if (!bolehAksesProyek(u, proyek.id)) notFound();

  const unit = bolehUnit
    ? await prisma.unit.findMany({
        where: { projectId: proyek.id },
        orderBy: [{ phase: { urutan: "asc" } }, { nomor: "asc" }],
        select: {
          id: true, kode: true, nomor: true, luasTanah: true,
          statusPembangunan: true, statusJual: true, progress: true,
          phase: { select: { kode: true } },
          unitType: { select: { kode: true, nama: true, luasBangunan: true } },
          // Judul kerja tambah boleh dilihat siapa pun yang boleh melihat unit;
          // nilainya hanya ikut bila peran berhak atas harga.
          customWorks: {
            select: {
              judul: true,
              boqItems: bolehHarga
                ? { select: { volume: true, hargaSatuan: true } }
                : false,
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
          ...(bolehHarga ? { rab: true } : {}),
        },
      })
    : [];

  return { proyek, unit, sarpras, bolehHarga, bolehUnit, bolehSarpras };
}

/** Hitung RAB & RAP sebuah unit dari baris snapshot-nya. */
export function nilaiUnit(u: {
  boqItems?: { volume: number; hargaSatuan: number }[];
  rapItems?: { volume: number; hargaSatuan: number }[];
  rapUpah?: number;
  customWorks?: { boqItems?: { volume: number; hargaSatuan: number }[] }[];
}) {
  const jumlah = (rows?: { volume: number; hargaSatuan: number }[]) =>
    (rows ?? []).reduce((s, r) => s + r.volume * r.hargaSatuan, 0);

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
