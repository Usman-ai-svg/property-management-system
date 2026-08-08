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

// --- Pemasok -----------------------------------------------------------------
const PEMASOK = [
  { nama: "Toko Bangunan Sejahtera", kategori: "Material", kontak: "0812-1000-2001", alamat: "Jl. Raya Serpong No. 21, Tangerang" },
  { nama: "CV Mitra Material Utama", kategori: "Material", kontak: "0813-2000-3002", alamat: "Jl. Industri Blok C7, Bekasi" },
  { nama: "Nusantara Sewa Alat", kategori: "Alat", kontak: "0811-3000-4003", alamat: "Jl. Cakung Cilincing KM 3, Jakarta" },
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

const HARGA_DASAR: HargaDasarSeed[] = [
  // Upah (OH = orang-hari)
  { kode: "L.01", kategori: "UPAH", uraian: "Pekerja", satuan: "OH", acuan: 110_000 },
  { kode: "L.02", kategori: "UPAH", uraian: "Tukang batu", satuan: "OH", acuan: 150_000 },
  { kode: "L.03", kategori: "UPAH", uraian: "Tukang kayu", satuan: "OH", acuan: 150_000 },
  { kode: "L.05", kategori: "UPAH", uraian: "Kepala tukang", satuan: "OH", acuan: 170_000 },
  { kode: "L.06", kategori: "UPAH", uraian: "Mandor", satuan: "OH", acuan: 180_000 },
  // Bahan
  { kode: "M.01", kategori: "BAHAN", uraian: "Semen Portland (PC)", satuan: "kg", acuan: 1_600, penawaran: [
    { pemasok: "Toko Bangunan Sejahtera", harga: 1_600 },
    { pemasok: "CV Mitra Material Utama", harga: 1_650 },
  ] },
  { kode: "M.02", kategori: "BAHAN", uraian: "Pasir pasang", satuan: "m3", acuan: 250_000, penawaran: [
    { pemasok: "Toko Bangunan Sejahtera", harga: 250_000 },
    { pemasok: "CV Mitra Material Utama", harga: 265_000 },
  ] },
  { kode: "M.03", kategori: "BAHAN", uraian: "Pasir beton (cor)", satuan: "m3", acuan: 300_000, penawaran: [
    { pemasok: "CV Mitra Material Utama", harga: 300_000 },
  ] },
  { kode: "M.04", kategori: "BAHAN", uraian: "Batu belah/kali 15/20", satuan: "m3", acuan: 350_000, penawaran: [
    { pemasok: "Toko Bangunan Sejahtera", harga: 350_000 },
    { pemasok: "CV Mitra Material Utama", harga: 340_000, ket: "Franco lokasi, minimal 6 m³" },
  ] },
  { kode: "M.05", kategori: "BAHAN", uraian: "Kerikil/split beton", satuan: "m3", acuan: 400_000, penawaran: [
    { pemasok: "Toko Bangunan Sejahtera", harga: 400_000 },
  ] },
  { kode: "M.06", kategori: "BAHAN", uraian: "Besi beton polos", satuan: "kg", acuan: 15_000, penawaran: [
    { pemasok: "CV Mitra Material Utama", harga: 15_000 },
    { pemasok: "Toko Bangunan Sejahtera", harga: 15_500 },
  ] },
  { kode: "M.07", kategori: "BAHAN", uraian: "Kawat beton (bendrat)", satuan: "kg", acuan: 25_000 },
  { kode: "M.08", kategori: "BAHAN", uraian: "Kayu bekisting/papan", satuan: "m3", acuan: 3_500_000 },
  { kode: "M.09", kategori: "BAHAN", uraian: "Paku 5–10 cm", satuan: "kg", acuan: 22_000 },
  { kode: "M.10", kategori: "BAHAN", uraian: "Bata ringan (hebel)", satuan: "m3", acuan: 650_000, penawaran: [
    { pemasok: "Toko Bangunan Sejahtera", harga: 650_000 },
    { pemasok: "CV Mitra Material Utama", harga: 640_000 },
  ] },
  { kode: "M.11", kategori: "BAHAN", uraian: "Semen instan (mortar)", satuan: "sak", acuan: 62_000 },
  { kode: "M.12", kategori: "BAHAN", uraian: "Keramik lantai 40×40", satuan: "m2", acuan: 65_000 },
  { kode: "M.13", kategori: "BAHAN", uraian: "Cat tembok interior", satuan: "kg", acuan: 35_000 },
  { kode: "M.14", kategori: "BAHAN", uraian: "Pipa PVC AW 1/2\"", satuan: "btg", acuan: 45_000 },
  { kode: "M.15", kategori: "BAHAN", uraian: "Kabel NYM 3×2,5", satuan: "m", acuan: 22_000 },
  { kode: "M.16", kategori: "BAHAN", uraian: "Saklar/stopkontak + aksesoris", satuan: "titik", acuan: 45_000 },
  // Alat
  { kode: "E.01", kategori: "ALAT", uraian: "Sewa concrete mixer (molen)", satuan: "hari", acuan: 350_000, penawaran: [
    { pemasok: "Nusantara Sewa Alat", harga: 350_000, ket: "Termasuk operator" },
  ] },
];

// --- Analisa harga satuan pekerjaan -----------------------------------------
interface AnalisaSeed {
  kode: string;
  uraian: string;
  satuan: string;
  kelompok: string;
  overheadPct?: number; // bawaan 13
  komponen: { kode: string; koef: number }[];
}

const ANALISA: AnalisaSeed[] = [
  {
    kode: "A.01", uraian: "Pembersihan lapangan & perataan", satuan: "m2", kelompok: "Pekerjaan Persiapan",
    komponen: [
      { kode: "L.01", koef: 0.1 },
      { kode: "L.06", koef: 0.005 },
    ],
  },
  {
    kode: "A.02", uraian: "Pengukuran & pemasangan bouwplank", satuan: "m'", kelompok: "Pekerjaan Persiapan",
    komponen: [
      { kode: "L.01", koef: 0.1 },
      { kode: "L.03", koef: 0.1 },
      { kode: "L.05", koef: 0.01 },
      { kode: "L.06", koef: 0.005 },
      { kode: "M.08", koef: 0.012 },
      { kode: "M.09", koef: 0.02 },
    ],
  },
  {
    kode: "A.03", uraian: "Galian tanah biasa sedalam ≤ 1 m", satuan: "m3", kelompok: "Pekerjaan Tanah",
    komponen: [
      { kode: "L.01", koef: 0.75 },
      { kode: "L.06", koef: 0.025 },
    ],
  },
  {
    kode: "A.04", uraian: "Urugan kembali & pemadatan", satuan: "m3", kelompok: "Pekerjaan Tanah",
    komponen: [
      { kode: "L.01", koef: 0.25 },
      { kode: "L.06", koef: 0.008 },
    ],
  },
  {
    kode: "A.05", uraian: "Pasangan pondasi batu kali camp. 1:4", satuan: "m3", kelompok: "Pekerjaan Struktur",
    komponen: [
      { kode: "M.04", koef: 1.2 },
      { kode: "M.01", koef: 163 },
      { kode: "M.02", koef: 0.52 },
      { kode: "L.01", koef: 1.5 },
      { kode: "L.02", koef: 0.75 },
      { kode: "L.05", koef: 0.075 },
      { kode: "L.06", koef: 0.075 },
    ],
  },
  {
    kode: "A.06", uraian: "Beton bertulang K-225 (cor, besi & bekisting)", satuan: "m3", kelompok: "Pekerjaan Struktur",
    komponen: [
      { kode: "M.01", koef: 371 },
      { kode: "M.03", koef: 0.499 },
      { kode: "M.05", koef: 0.776 },
      { kode: "M.06", koef: 105 },
      { kode: "M.07", koef: 1.5 },
      { kode: "M.08", koef: 0.04 },
      { kode: "M.09", koef: 0.4 },
      { kode: "L.01", koef: 5.3 },
      { kode: "L.02", koef: 1.0 },
      { kode: "L.05", koef: 0.1 },
      { kode: "L.06", koef: 0.265 },
      { kode: "E.01", koef: 0.1 },
    ],
  },
  {
    kode: "A.07", uraian: "Pasangan dinding bata ringan", satuan: "m2", kelompok: "Pekerjaan Arsitektur",
    komponen: [
      { kode: "M.10", koef: 0.1 },
      { kode: "M.11", koef: 0.12 },
      { kode: "L.01", koef: 0.3 },
      { kode: "L.02", koef: 0.15 },
      { kode: "L.05", koef: 0.015 },
      { kode: "L.06", koef: 0.015 },
    ],
  },
  {
    kode: "A.08", uraian: "Plesteran & acian dinding", satuan: "m2", kelompok: "Pekerjaan Arsitektur",
    komponen: [
      { kode: "M.11", koef: 0.2 },
      { kode: "L.01", koef: 0.3 },
      { kode: "L.02", koef: 0.15 },
      { kode: "L.05", koef: 0.015 },
      { kode: "L.06", koef: 0.015 },
    ],
  },
  {
    kode: "A.09", uraian: "Pasang keramik lantai 40×40", satuan: "m2", kelompok: "Pekerjaan Arsitektur",
    komponen: [
      { kode: "M.12", koef: 1.05 },
      { kode: "M.11", koef: 0.1 },
      { kode: "L.01", koef: 0.35 },
      { kode: "L.02", koef: 0.175 },
      { kode: "L.05", koef: 0.018 },
      { kode: "L.06", koef: 0.018 },
    ],
  },
  {
    kode: "A.10", uraian: "Pengecatan tembok interior", satuan: "m2", kelompok: "Pekerjaan Arsitektur",
    komponen: [
      { kode: "M.13", koef: 0.26 },
      { kode: "L.01", koef: 0.02 },
      { kode: "L.02", koef: 0.063 },
      { kode: "L.05", koef: 0.006 },
      { kode: "L.06", koef: 0.003 },
    ],
  },
  {
    kode: "A.11", uraian: "Instalasi titik listrik", satuan: "titik", kelompok: "Pekerjaan MEP",
    komponen: [
      { kode: "M.15", koef: 12 },
      { kode: "M.16", koef: 1 },
      { kode: "L.01", koef: 0.4 },
      { kode: "L.02", koef: 0.4 },
      { kode: "L.05", koef: 0.04 },
      { kode: "L.06", koef: 0.02 },
    ],
  },
  {
    kode: "A.12", uraian: "Pemasangan pipa air bersih PVC 1/2\"", satuan: "m'", kelompok: "Pekerjaan MEP",
    komponen: [
      { kode: "M.14", koef: 0.3 },
      { kode: "L.01", koef: 0.036 },
      { kode: "L.02", koef: 0.06 },
      { kode: "L.05", koef: 0.006 },
      { kode: "L.06", koef: 0.003 },
    ],
  },
];

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
