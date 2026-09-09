/**
 * Penyemaian subset pustaka AHSP, pemasok, dan satu RAB Estimasi contoh.
 *
 * Dipisah dari seed.ts karena berdiri sendiri: modul RAB Estimasi tidak
 * bergantung pada unit/kontrak, hanya pada proyek sebagai wadah. Subsetnya
 * sengaja kecil — beberapa pemasok, belasan harga dasar, enam analisa
 * (Persiapan/Tanah/Struktur) — cukup untuk memperagakan alurnya tanpa menjadi
 * salinan penuh lembar AHSP.
 *
 * Angka koefisien bergaya SNI AHSP; harga dasar memakai kisaran wajar 2026.
 * Harga satuan tiap analisa TIDAK ditulis tangan di sini — dihitung lewat
 * `hargaSatuanAnalisa()` supaya angka seed selalu konsisten dengan mesin hitung.
 */

import type { PrismaClient } from "../src/generated/prisma/client";
import { hargaSatuanAnalisa, type KelompokDasar } from "../src/lib/calc/ahsp";
import { ANALISA_ACUAN, HARGA_DASAR_ACUAN } from "./acuan/muat";

// --- Pemasok -----------------------------------------------------------------
const PEMASOK = [
  { nama: "Toko Bangunan Sejahtera", kategori: "Material", kontakNama: "Hendra", kontakTelepon: "0812-1000-2001", alamat: "Jl. Raya Serpong No. 21", kecamatan: "Serpong", provinsi: "Banten" },
  { nama: "CV Mitra Material Utama", kategori: "Material", kontakNama: "Sutrisno", kontakTelepon: "0813-2000-3002", alamat: "Jl. Industri Blok C7", kecamatan: "Bekasi Selatan", provinsi: "Jawa Barat" },
  { nama: "Nusantara Sewa Alat", kategori: "Alat", kontakNama: "Bpk. Wahyu", kontakTelepon: "0811-3000-4003", alamat: "Jl. Cakung Cilincing KM 3", kecamatan: "Cilincing", provinsi: "DKI Jakarta" },
] as const;

// --- Harga dasar (price book) ------------------------------------------------
// `acuan` = harga yang dipakai perhitungan; `penawaran` mencatat pembanding.
// Upah tidak punya penawaran pemasok — diisi manual sesuai standar upah daerah.
interface HargaDasarSeed {
  kode: string;
  kategori: KelompokDasar;
  uraian: string;
  satuan: string;
  acuan: number;
  penawaran?: { pemasok: string; harga: number; ket?: string }[];
}

/**
 * Penawaran pemasok — DATA PERAGAAN, bukan acuan.
 *
 * Harga acuannya sendiri ada di prisma/acuan/harga-dasar.json karena ikut ke
 * produksi; siapa menawar berapa adalah cerita demo yang berhenti di sini.
 */
const PENAWARAN: Record<string, { pemasok: string; harga: number; ket?: string }[]> = {
  "M.01": [
    { pemasok: "Toko Bangunan Sejahtera", harga: 1_600 },
    { pemasok: "CV Mitra Material Utama", harga: 1_650 },
  ],
  "M.02": [
    { pemasok: "Toko Bangunan Sejahtera", harga: 250_000 },
    { pemasok: "CV Mitra Material Utama", harga: 265_000 },
  ],
  "M.03": [{ pemasok: "CV Mitra Material Utama", harga: 300_000 }],
  "M.04": [
    { pemasok: "Toko Bangunan Sejahtera", harga: 350_000 },
    { pemasok: "CV Mitra Material Utama", harga: 340_000, ket: "Franco lokasi, minimal 6 m³" },
  ],
  "M.05": [{ pemasok: "Toko Bangunan Sejahtera", harga: 400_000 }],
  "M.06": [
    { pemasok: "CV Mitra Material Utama", harga: 15_000 },
    { pemasok: "Toko Bangunan Sejahtera", harga: 15_500 },
  ],
  "M.10": [
    { pemasok: "Toko Bangunan Sejahtera", harga: 650_000 },
    { pemasok: "CV Mitra Material Utama", harga: 640_000 },
  ],
  "E.01": [{ pemasok: "Nusantara Sewa Alat", harga: 350_000, ket: "Termasuk operator" }],
};

/** Price book dari data acuan, ditempeli penawaran peragaan. */
const HARGA_DASAR: HargaDasarSeed[] = HARGA_DASAR_ACUAN.map((h) => ({
  kode: h.kode,
  kategori: h.kategori as KelompokDasar,
  uraian: h.uraian,
  satuan: h.satuan,
  acuan: h.hargaAcuan,
  penawaran: PENAWARAN[h.kode],
}));

// --- Analisa harga satuan pekerjaan -----------------------------------------
interface AnalisaSeed {
  kode: string;
  uraian: string;
  satuan: string;
  kelompok: string;
  overheadPct?: number; // bawaan 13
  komponen: { kode: string; koef: number }[];
}

/** Analisa harga satuan dari data acuan. Koefisiennya bergaya SNI AHSP. */
const ANALISA: AnalisaSeed[] = ANALISA_ACUAN.map((a) => ({
  kode: a.kode,
  uraian: a.uraian,
  satuan: a.satuan,
  kelompok: a.kelompok,
  overheadPct: a.overheadPct,
  komponen: a.komponen.map((k) => ({ kode: k.kode, koef: k.koefisien })),
}));

// --- RAB Estimasi contoh (volume diisi peran QS) -----------------------------
const RAB_ITEMS: { kodeAnalisa: string; volume: number }[] = [
  { kodeAnalisa: "A.01", volume: 250 },
  { kodeAnalisa: "A.03", volume: 45 },
  { kodeAnalisa: "A.05", volume: 22 },
  { kodeAnalisa: "A.06", volume: 18 },
  { kodeAnalisa: "A.07", volume: 210 },
  { kodeAnalisa: "A.09", volume: 60 },
  { kodeAnalisa: "A.10", volume: 320 },
  { kodeAnalisa: "A.11", volume: 24 },
  { kodeAnalisa: "A.12", volume: 85 },
];

/**
 * Semai pustaka AHSP + pemasok, lalu satu RAB Estimasi pada proyek pertama.
 * Dipanggil dari seed.ts setelah proyek dibuat.
 */
export async function seedAhsp(prisma: PrismaClient, projectId: Map<string, string>) {
  // 1. Pemasok
  const pemasokId = new Map<string, string>();
  for (const P of PEMASOK) {
    const p = await prisma.pemasok.create({ data: P });
    pemasokId.set(P.nama, p.id);
  }

  // 2. Harga dasar + penawaran pemasok
  const hargaDasarId = new Map<string, string>();
  const hargaAcuan = new Map<string, number>();
  const kategoriDasar = new Map<string, KelompokDasar>();
  for (const H of HARGA_DASAR) {
    hargaAcuan.set(H.kode, H.acuan);
    kategoriDasar.set(H.kode, H.kategori);
    const h = await prisma.hargaDasar.create({
      data: {
        kode: H.kode, kategori: H.kategori, uraian: H.uraian, satuan: H.satuan, hargaAcuan: H.acuan,
        penawaran: {
          create: (H.penawaran ?? []).map((t) => ({
            pemasokId: pemasokId.get(t.pemasok)!,
            harga: t.harga,
            keterangan: t.ket ?? null,
          })),
        },
      },
    });
    hargaDasarId.set(H.kode, h.id);
  }

  // 3. Analisa + komponen. Harga satuan dihitung, bukan disimpan.
  const analisaId = new Map<string, string>();
  const hargaSatuan = new Map<string, number>();
  for (const A of ANALISA) {
    const a = await prisma.analisaHarga.create({
      data: {
        kode: A.kode, uraian: A.uraian, satuan: A.satuan, kelompok: A.kelompok,
        overheadPct: A.overheadPct ?? 13,
        komponen: {
          create: A.komponen.map((k, i) => ({
            hargaDasarId: hargaDasarId.get(k.kode)!,
            koefisien: k.koef,
            urutan: i,
          })),
        },
      },
    });
    analisaId.set(A.kode, a.id);

    // Snapshot harga satuan lewat mesin hitung yang sama dengan aplikasi.
    hargaSatuan.set(
      A.kode,
      hargaSatuanAnalisa({
        overheadPct: A.overheadPct ?? 13,
        komponen: A.komponen.map((k) => ({
          kelompok: kategoriDasar.get(k.kode)!,
          koefisien: k.koef,
          hargaAcuan: hargaAcuan.get(k.kode)!,
        })),
      }),
    );
  }

  // 4. Satu RAB Estimasi pada proyek pertama
  const proyekPertama = [...projectId.values()][0];
  if (proyekPertama) {
    await prisma.rabEstimasi.create({
      data: {
        projectId: proyekPertama,
        nomor: "RAB-EST-001",
        nama: "RAB Estimasi Awal — Pematangan & Struktur Bawah",
        status: "Draft",
        items: {
          create: RAB_ITEMS.map((it, i) => {
            const A = ANALISA.find((x) => x.kode === it.kodeAnalisa)!;
            return {
              analisaId: analisaId.get(it.kodeAnalisa)!,
              grup: A.kelompok,
              uraian: A.uraian,
              satuan: A.satuan,
              volume: it.volume,
              hargaSatuan: hargaSatuan.get(it.kodeAnalisa)!,
              urutan: i,
            };
          }),
        },
      },
    });
  }

  console.log(
    `  ${PEMASOK.length} pemasok, ${HARGA_DASAR.length} harga dasar, ${ANALISA.length} analisa AHSP, 1 RAB estimasi`,
  );
}
