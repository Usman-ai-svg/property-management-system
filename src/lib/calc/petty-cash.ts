/**
 * Aturan hitung & alur petty cash — bebas Prisma, bebas framework.
 *
 * Dipisah dari data & UI supaya saldo dan transisi status bisa diuji sebagai
 * angka murni, dan supaya penulisan ulang tampilan ke ERP tidak menyentuh
 * aturannya.
 */

import type { StatusPettyCash } from "@/lib/domain/enums";
import {
  JABATAN_DIRECTOR, JABATAN_FINANCE_TAX, JABATAN_HEAD_OF_OPERATION,
  JABATAN_QS_ASST, JABATAN_STAFF_ADMINISTRATION,
} from "@/lib/domain/jabatan";

/**
 * Saldo berjalan sebuah dana: `Σ topUp − Σ pengeluaran`.
 *
 * BOLEH negatif — pemegang dana boleh menalangi pengeluaran melebihi kas di
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
 * Ditulis sebagai DATA, bukan sebagai cabang `if` yang tersebar di action dan
 * komponen. Di ERP alur ini jadi satu RPC PL/pgSQL; kalau transisinya masih
 * tersebar, penerjemahannya adalah menebak.
 */
export interface TransisiPetty {
  dari: StatusPettyCash;
  ke: StatusPettyCash;
  /** Label tombol aksi. */
  aksi: string;
  /**
   * Hanya pemegang dana itu sendiri. Bukan jabatan: saldo petty cash adalah
   * uang fisik di tangan satu orang.
   */
  olehPemegang?: boolean;
  /** Jabatan yang boleh menggerakkan. */
  jabatan?: readonly string[];
  /**
   * Selain jabatan, menuntut hak ubah sub-bagian "keuangan" — pada tahap ini
   * uang benar-benar keluar dari kas perusahaan.
   */
  perluIzinKeuangan?: boolean;
  /** true bila transisi ini "mundur" (kembalikan/tolak) — untuk pewarnaan UI. */
  mundur?: boolean;
}

/**
 * Alur pertanggungjawaban laporan petty cash.
 *
 * Draft -> Diajukan -> DiverifikasiQS -> Disetujui -> Direimburse, dengan dua
 * jalan mundur (verifikator mengembalikan, Head of Operation menolak) yang
 * membuka kunci baris lagi.
 */
export const TRANSISI_PETTY: readonly TransisiPetty[] = [
  { dari: "Draft", ke: "Diajukan", aksi: "Ajukan", olehPemegang: true },
  {
    dari: "Diajukan", ke: "DiverifikasiQS", aksi: "Verifikasi",
    jabatan: [JABATAN_QS_ASST, JABATAN_HEAD_OF_OPERATION],
  },
  {
    dari: "Diajukan", ke: "Draft", aksi: "Kembalikan", mundur: true,
    jabatan: [JABATAN_QS_ASST, JABATAN_HEAD_OF_OPERATION],
  },
  {
    dari: "DiverifikasiQS", ke: "Disetujui", aksi: "Setujui",
    jabatan: [JABATAN_HEAD_OF_OPERATION],
  },
  {
    dari: "DiverifikasiQS", ke: "Draft", aksi: "Tolak", mundur: true,
    jabatan: [JABATAN_HEAD_OF_OPERATION],
  },
  {
    dari: "Disetujui", ke: "Direimburse", aksi: "Reimburse",
    jabatan: [JABATAN_FINANCE_TAX, JABATAN_STAFF_ADMINISTRATION],
    perluIzinKeuangan: true,
  },
];

/** Keadaan pelaku yang menentukan boleh-tidaknya sebuah transisi. */
export interface PelakuPetty {
  /** Kunci jabatan yang dipegang pelaku. */
  jabatan: readonly string[];
  /** Apakah pelaku adalah pemegang dana laporan ini. */
  pemegangDana: boolean;
  /** Apakah pelaku boleh mengubah sub-bagian "keuangan". */
  bolehKeuangan: boolean;
}

/**
 * Dua aturan yang berlaku di SELURUH transisi, ditulis sekali di sini.
 *
 * 1. Pemegang dana hanya boleh mengajukan. Tahap sesudahnya harus digerakkan
 *    orang lain — tidak ada yang memeriksa pertanggungjawabannya sendiri.
 *    Inilah satu-satunya hal yang memisahkan laporan petty cash dari selembar
 *    catatan pribadi.
 *
 * 2. `director` menembus batas jabatan, supaya laporan yang tersangkut karena
 *    pemegang tahapnya berhalangan tetap bisa didorong sampai selesai. Tapi
 *    penembusan itu TIDAK berlaku atas dana yang ia pegang sendiri: aturan 1
 *    diperiksa lebih dulu, dan sengaja tidak bisa dilangkahi.
 */
export function bolehTransisi(t: TransisiPetty, pelaku: PelakuPetty): boolean {
  if (t.olehPemegang) return pelaku.pemegangDana;
  if (pelaku.pemegangDana) return false;
  if (pelaku.jabatan.includes(JABATAN_DIRECTOR)) return true;
  if (t.perluIzinKeuangan && !pelaku.bolehKeuangan) return false;
  return pelaku.jabatan.some((j) => (t.jabatan ?? []).includes(j));
}

/** Transisi yang tersedia dari sebuah status. */
export function transisiDari(status: StatusPettyCash): TransisiPetty[] {
  return TRANSISI_PETTY.filter((t) => t.dari === status);
}

/** Transisi dari sebuah status yang boleh digerakkan pelaku tertentu. */
export function transisiUntuk(
  status: StatusPettyCash,
  pelaku: PelakuPetty,
): TransisiPetty[] {
  return transisiDari(status).filter((t) => bolehTransisi(t, pelaku));
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
