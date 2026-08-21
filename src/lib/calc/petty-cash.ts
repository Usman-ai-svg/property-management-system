/**
 * Aturan hitung & alur petty cash — bebas Prisma, bebas framework.
 *
 * Dipisah dari data & UI supaya saldo dan transisi status bisa diuji sebagai
 * angka murni, dan supaya penulisan ulang tampilan ke ERP tidak menyentuh
 * aturannya.
 */

import type { StatusPettyCash } from "@/lib/domain/enums";

/**
 * Saldo berjalan sebuah dana: `Σ topUp − Σ pengeluaran`.
 *
 * BOLEH negatif — Supervisor boleh menalangi pengeluaran melebihi kas di
 * tangan, dan reimburse yang mengembalikannya. Plafon tidak ikut membatasi di
 * sini; ia hanya nilai acuan imprest.
 */
export function saldoDana(
  topUps: { nominal: number }[],
  pengeluaran: { total: number }[],
): number {
  const masuk = topUps.reduce((s, t) => s + t.nominal, 0);
  const keluar = pengeluaran.reduce((s, e) => s + e.total, 0);
  return masuk - keluar;
}

/** Total sebuah laporan = Σ total pengeluaran yang dibungkusnya. */
export function totalLaporan(pengeluaran: { total: number }[]): number {
  return pengeluaran.reduce((s, e) => s + e.total, 0);
}

/**
 * Siapa yang boleh menggerakkan sebuah transisi.
 *
 * "Pemegang" bukan nama peran melainkan pemegang dana itu sendiri (dicek lewat
 * id di action); sisanya nama peran persis. Reimburse memakai izin keuangan,
 * diwakili "Finance" di sini dan ditegakkan lewat `bolehUbah("keuangan")`.
 */
export type PelakuPetty = "Pemegang" | "Quantity Surveyor" | "Head Operation Project" | "Finance";

export interface TransisiPetty {
  dari: StatusPettyCash;
  ke: StatusPettyCash;
  /** Label tombol aksi. */
  aksi: string;
  oleh: PelakuPetty;
  /** true bila transisi ini "mundur" (kembalikan/tolak) — untuk pewarnaan UI. */
  mundur?: boolean;
}

/**
 * Alur pertanggungjawaban laporan petty cash.
 *
 * Draft → Diajukan → DiverifikasiQS → Disetujui → Direimburse, dengan dua jalan
 * mundur (QS mengembalikan, Head Ops menolak) yang membuka kunci baris lagi.
 */
export const TRANSISI_PETTY: readonly TransisiPetty[] = [
  { dari: "Draft", ke: "Diajukan", aksi: "Ajukan", oleh: "Pemegang" },
  { dari: "Diajukan", ke: "DiverifikasiQS", aksi: "Verifikasi", oleh: "Quantity Surveyor" },
  { dari: "Diajukan", ke: "Draft", aksi: "Kembalikan", oleh: "Quantity Surveyor", mundur: true },
  { dari: "DiverifikasiQS", ke: "Disetujui", aksi: "Setujui", oleh: "Head Operation Project" },
  { dari: "DiverifikasiQS", ke: "Draft", aksi: "Tolak", oleh: "Head Operation Project", mundur: true },
  { dari: "Disetujui", ke: "Direimburse", aksi: "Reimburse", oleh: "Finance" },
];

/** Transisi yang tersedia dari sebuah status. */
export function transisiDari(status: StatusPettyCash): TransisiPetty[] {
  return TRANSISI_PETTY.filter((t) => t.dari === status);
}

/** Cari transisi tertentu, atau undefined bila tak sah. */
export function cariTransisi(
  dari: StatusPettyCash,
  ke: StatusPettyCash,
): TransisiPetty | undefined {
  return TRANSISI_PETTY.find((t) => t.dari === dari && t.ke === ke);
}

/** Baris laporan terkunci (tak boleh disunting pemegang) sejak diajukan. */
export function laporanTerkunci(status: StatusPettyCash): boolean {
  return status !== "Draft";
}

/** Label ramah-baca tiap status untuk badge UI. */
export const LABEL_STATUS_PETTY: Record<StatusPettyCash, string> = {
  Draft: "Draft",
  Diajukan: "Diajukan",
  DiverifikasiQS: "Diverifikasi QS",
  Disetujui: "Disetujui",
  Direimburse: "Direimburse",
};
