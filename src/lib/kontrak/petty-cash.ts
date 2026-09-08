/**
 * KONTRAK — Petty Cash.
 *
 * Dana talangan lapangan beserta alur pertanggungjawabannya. Yang membedakan
 * modul ini dari Keuangan biasa: hampir semua aturannya soal SIAPA dan KAPAN,
 * bukan berapa. Karena itu banyak pemeriksaan di sini menerima konteks berupa
 * status laporan dan identitas pemegang dana.
 *
 * Transisi status sendiri sudah punya rumahnya di `calc/petty-cash.ts`
 * (`cariTransisi`); yang di sini adalah pembungkusnya menjadi pesan yang bisa
 * dibaca pengguna, plus syarat lain yang menyertainya.
 */

import { JENIS_BIAYA_SWAKELOLA, PERUNTUKAN_BIAYA, type StatusPettyCash } from "@/lib/domain/enums";
import { cariTransisi } from "@/lib/calc/petty-cash";
import {
  angkaMinimal,
  pertamaGagal,
  pilihanSah,
  wajibTeks,
  type Galat,
} from "./dasar";

// ---------------------------------------------------------------------------
// beriDanaPetty
// ---------------------------------------------------------------------------

export interface MasukanBeriDanaPetty {
  projectId: string;
  pemegangId: string;
  plafon: number;
  nominal: number;
  keterangan: string | null;
}

/** Fakta yang harus dibaca server: apakah calon pemegang memang sah. */
export interface KonteksBeriDanaPetty {
  /** Pemegang harus Supervisor yang masih aktif pada proyek ini. */
  pemegangSah: boolean;
}

/**
 * Plafon boleh nol (dana tanpa batas atas), tapi nominal pemberiannya tidak —
 * memberi dana nol tidak menghasilkan apa pun selain baris kosong di riwayat.
 */
export function periksaBeriDanaPetty(
  m: MasukanBeriDanaPetty,
  konteks: KonteksBeriDanaPetty,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.pemegangId, "Pemegang dana"),
    angkaMinimal(m.plafon, 0, "Plafon"),
    angkaMinimal(m.nominal, 1, "Nominal dana"),
  );
  if (dasar) return dasar;
  return konteks.pemegangSah ? null : "Pemegang dana harus seorang Supervisor yang aktif.";
}

// ---------------------------------------------------------------------------
// catatPengeluaranPetty
// ---------------------------------------------------------------------------

export interface MasukanCatatPengeluaranPetty {
  fundId: string;
  peruntukan: string;
  jenis: string;
  uraian: string;
  total: number;
}

export interface KonteksCatatPengeluaranPetty {
  /** Dana yang sudah ditutup tidak menerima pengeluaran baru. */
  danaAktif: boolean;
  /** Hanya pemegang dana yang boleh mencatat pengeluarannya. */
  pelakuPemegang: boolean;
}

/**
 * Pembatasan "hanya pemegang dana" bukan sekadar tata tertib: saldo petty cash
 * adalah uang fisik yang ada di tangan satu orang, dan catatan yang ditulis
 * orang lain membuat selisih kas tidak bisa ditanyakan ke siapa pun.
 */
export function periksaCatatPengeluaranPetty(
  m: MasukanCatatPengeluaranPetty,
  konteks: KonteksCatatPengeluaranPetty,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.fundId, "Dana petty cash"),
    pilihanSah(m.peruntukan, PERUNTUKAN_BIAYA, "peruntukan"),
    pilihanSah(m.jenis, JENIS_BIAYA_SWAKELOLA, "jenis biaya"),
    wajibTeks(m.uraian, "Keterangan"),
    angkaMinimal(m.total, 1, "Total"),
  );
  if (dasar) return dasar;
  if (!konteks.danaAktif) return "Dana ini sudah ditutup.";
  if (!konteks.pelakuPemegang) {
    return "Hanya pemegang dana yang boleh mencatat pengeluaran petty cash-nya.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// ajukanLaporanPetty
// ---------------------------------------------------------------------------

export interface KonteksAjukanLaporan {
  status: StatusPettyCash;
  pelakuPemegang: boolean;
  /** Banyaknya pengeluaran yang sudah tercatat pada laporan ini. */
  jumlahPengeluaran: number;
  /** Nota gabungan sudah terunggah (baru, atau sudah ada sebelumnya). */
  adaNota: boolean;
}

/**
 * Nota gabungan wajib. Laporan petty cash adalah dasar penggantian uang yang
 * sudah keluar dari kantong seseorang; tanpa bukti fisik, yang tersisa hanya
 * pengakuan.
 */
export function periksaAjukanLaporanPetty(
  m: { reportId: string },
  konteks: KonteksAjukanLaporan,
): Galat {
  const id = wajibTeks(m.reportId, "Id laporan");
  if (id) return id;
  if (!konteks.pelakuPemegang) return "Hanya pemegang dana yang boleh mengajukan laporannya.";
  if (!cariTransisi(konteks.status, "Diajukan")) {
    return "Laporan ini bukan Draft, jadi tidak bisa diajukan.";
  }
  if (konteks.jumlahPengeluaran === 0) {
    return "Laporan masih kosong — catat pengeluaran dulu sebelum diajukan.";
  }
  if (!konteks.adaNota) return "Nota gabungan (PDF) wajib diunggah saat mengajukan laporan.";
  return null;
}

// ---------------------------------------------------------------------------
// transisiLaporanPetty
// ---------------------------------------------------------------------------

export interface MasukanTransisiLaporan {
  reportId: string;
  ke: string;
}

export interface KonteksTransisiLaporan {
  status: StatusPettyCash;
  /** Transisi ini memang tahap verifikasi/persetujuan, bukan reimburse. */
  tahapVerifikasi: boolean;
}

export function periksaTransisiLaporanPetty(
  m: MasukanTransisiLaporan,
  konteks: KonteksTransisiLaporan,
): Galat {
  const id = wajibTeks(m.reportId, "Id laporan");
  if (id) return id;
  if (!cariTransisi(konteks.status, m.ke as StatusPettyCash)) {
    return `Transisi ${konteks.status} → ${m.ke} tidak sah.`;
  }
  if (!konteks.tahapVerifikasi) {
    return "Transisi ini bukan wewenang tahap verifikasi/persetujuan.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// reimburseLaporanPetty
// ---------------------------------------------------------------------------

export interface KonteksReimburse {
  status: StatusPettyCash;
  /** Nilai seluruh pengeluaran pada laporan ini. */
  total: number;
}

/**
 * Reimburse adalah kas KELUAR yang mengganti uang pemegang dana, jadi laporan
 * bernilai nol tidak punya yang perlu diganti.
 */
export function periksaReimburseLaporanPetty(
  m: { reportId: string },
  konteks: KonteksReimburse,
): Galat {
  const id = wajibTeks(m.reportId, "Id laporan");
  if (id) return id;
  if (!cariTransisi(konteks.status, "Direimburse")) {
    return "Laporan ini belum disetujui, jadi belum bisa direimburse.";
  }
  if (konteks.total <= 0) return "Laporan kosong — tak ada yang perlu direimburse.";
  return null;
}
