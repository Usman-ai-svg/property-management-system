/**
 * KONTRAK — Estimasi RAB: pemasok, pustaka harga dasar, analisa AHSP, dan
 * dokumen RAB Estimasi beserta alur persetujuannya.
 *
 * Modul dengan aksi terbanyak (28). Satu aturan berulang di hampir separuhnya:
 * **RAB yang sudah diajukan atau final tidak boleh disunting**. Diletakkan di
 * satu fungsi, `periksaRabDapatDiubah`, supaya di ERP ia jadi satu pemeriksaan
 * yang dipanggil banyak RPC — bukan dua puluh salinan yang bisa hanyut
 * sendiri-sendiri.
 */

import { KATEGORI_HARGA_DASAR, KATEGORI_PEMASOK, STATUS_PEMASOK } from "@/lib/domain/enums";
import {
  angkaMinimal,
  pertamaGagal,
  pilihanSah,
  wajibTeks,
  type Galat,
} from "./dasar";

// ---------------------------------------------------------------------------
// Gerbang status RAB — dipakai banyak aksi
// ---------------------------------------------------------------------------

/** Status yang masih boleh disunting. */
export const STATUS_RAB_TERBUKA = ["Draft", "Ditolak"] as const;

/**
 * RAB hanya bisa diubah saat Draft atau Ditolak.
 *
 * Begitu Diajukan, isinya jadi dasar keputusan orang lain; begitu Final, ia
 * jadi dasar SPK dan penagihan. Menyuntingnya setelah itu berarti mengubah
 * dokumen yang sudah dipakai memutuskan sesuatu.
 */
export function periksaRabDapatDiubah(status: string, nomor: string): Galat {
  return (STATUS_RAB_TERBUKA as readonly string[]).includes(status)
    ? null
    : `RAB ${nomor} berstatus ${status} — hanya bisa diubah saat Draft atau Ditolak.`;
}

// ---------------------------------------------------------------------------
// Pemasok
// ---------------------------------------------------------------------------

export interface MasukanPemasok {
  nama: string;
  kategori: string;
  status: string;
  kontakNama: string | null;
  kontakTelepon: string | null;
  alamat: string | null;
  kecamatan: string | null;
  provinsi: string | null;
}

export function periksaPemasok(m: MasukanPemasok): Galat {
  return pertamaGagal(
    wajibTeks(m.nama, "Nama pemasok"),
    pilihanSah(m.kategori, KATEGORI_PEMASOK, "kategori pemasok"),
    pilihanSah(m.status, STATUS_PEMASOK, "status pemasok"),
  );
}

export interface KonteksHapusPemasok {
  jumlahPenawaran: number;
  nama: string;
}

/**
 * Pemasok yang pernah menawar atau menjual tidak dihapus melainkan
 * dinonaktifkan: penawaran dan PO lamanya adalah riwayat harga yang dipakai
 * membandingkan penawaran berikutnya.
 */
export function periksaHapusPemasok(
  m: { id: string },
  konteks: KonteksHapusPemasok,
): Galat {
  const id = wajibTeks(m.id, "Id pemasok");
  if (id) return id;
  if (konteks.jumlahPenawaran > 0) {
    return `Pemasok "${konteks.nama}" masih punya ${konteks.jumlahPenawaran} penawaran harga. Hapus penawarannya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Harga dasar (pustaka)
// ---------------------------------------------------------------------------

export interface MasukanHargaDasar {
  kode: string;
  kategori: string;
  uraian: string;
  satuan: string;
  hargaAcuan: number;
}

export interface KonteksKode {
  kodeBentrok: boolean;
}

/**
 * Kode harga dasar unik, dan harga acuan boleh nol — item yang harganya belum
 * diketahui tetap perlu didaftarkan supaya bisa dipakai menyusun analisa,
 * lalu diisi begitu penawaran pertama masuk.
 */
export function periksaHargaDasar(m: MasukanHargaDasar, konteks: KonteksKode): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.kode, "Kode harga dasar"),
    pilihanSah(m.kategori, KATEGORI_HARGA_DASAR, "kategori harga dasar"),
    wajibTeks(m.uraian, "Uraian"),
    wajibTeks(m.satuan, "Satuan"),
    angkaMinimal(m.hargaAcuan, 0, "Harga acuan"),
  );
  if (dasar) return dasar;
  return konteks.kodeBentrok ? `Kode harga dasar "${m.kode}" sudah dipakai.` : null;
}

export interface KonteksHapusHargaDasar {
  jumlahPemakaian: number;
  kode: string;
}

export function periksaHapusHargaDasar(
  m: { id: string },
  konteks: KonteksHapusHargaDasar,
): Galat {
  const id = wajibTeks(m.id, "Id harga dasar");
  if (id) return id;
  if (konteks.jumlahPemakaian > 0) {
    return `Harga dasar ${konteks.kode} masih dipakai ${konteks.jumlahPemakaian} komponen analisa. Lepaskan dari analisanya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penawaran pemasok
// ---------------------------------------------------------------------------

export interface MasukanPenawaran {
  hargaDasarId: string;
  pemasokId: string;
  harga: number;
  keterangan: string | null;
}

/**
 * Harga penawaran boleh nol — barang bonus atau contoh memang ditawarkan
 * gratis, dan menolaknya memaksa orang mengarang angka.
 */
export function periksaTambahPenawaran(m: MasukanPenawaran): Galat {
  return pertamaGagal(
    wajibTeks(m.hargaDasarId, "Harga dasar"),
    wajibTeks(m.pemasokId, "Pemasok"),
    angkaMinimal(m.harga, 0, "Harga penawaran"),
  );
}

export const periksaJadikanAcuan = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id penawaran");

export const periksaHapusPenawaran = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id penawaran");

// ---------------------------------------------------------------------------
// Analisa AHSP
// ---------------------------------------------------------------------------

/** Satu komponen analisa: sebuah harga dasar dengan koefisien pemakaiannya. */
export interface KomponenAnalisaMasuk {
  hargaDasarId: string;
  koefisien: number;
}

export interface MasukanAnalisa {
  /** Kosong bila membuat baru. */
  id: string | null;
  kode: string;
  uraian: string;
  satuan: string;
  kelompok: string;
  overheadPct: number;
  komponen: KomponenAnalisaMasuk[];
}

/**
 * Koefisien harus lebih dari nol.
 *
 * Berbeda dari harga: koefisien nol berarti komponen itu tidak dipakai sama
 * sekali, dan barisnya cuma menambah panjang analisa tanpa memengaruhi harga
 * satuannya — hampir selalu sisa suntingan yang lupa dihapus.
 */
export function periksaSimpanAnalisa(m: MasukanAnalisa, konteks: KonteksKode): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.kode, "Kode analisa"),
    wajibTeks(m.uraian, "Uraian pekerjaan"),
    wajibTeks(m.satuan, "Satuan"),
    angkaMinimal(m.overheadPct, 0, "Overhead"),
  );
  if (dasar) return dasar;

  if (m.komponen.length === 0) return "Analisa harus punya minimal satu komponen.";
  for (const k of m.komponen) {
    if (!k.hargaDasarId.trim()) return "Ada komponen tanpa harga dasar.";
    if (!Number.isFinite(k.koefisien) || k.koefisien <= 0) {
      return "Setiap koefisien komponen harus berupa angka lebih dari nol.";
    }
  }
  return konteks.kodeBentrok ? `Kode analisa "${m.kode}" sudah dipakai.` : null;
}

export interface KonteksHapusAnalisa {
  jumlahPemakaian: number;
  kode: string;
}

export function periksaHapusAnalisa(
  m: { id: string },
  konteks: KonteksHapusAnalisa,
): Galat {
  const id = wajibTeks(m.id, "Id analisa");
  if (id) return id;
  if (konteks.jumlahPemakaian > 0) {
    return `Analisa "${konteks.kode}" masih dipakai ${konteks.jumlahPemakaian} baris RAB. Hapus pemakaiannya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dokumen RAB Estimasi
// ---------------------------------------------------------------------------

export interface MasukanRabEstimasi {
  projectId: string;
  nama: string;
}

export function periksaTambahRabEstimasi(m: MasukanRabEstimasi): Galat {
  return pertamaGagal(wajibTeks(m.projectId, "Proyek"), wajibTeks(m.nama, "Nama RAB"));
}

export function periksaUbahRabEstimasi(
  m: { id: string; nama: string },
  konteks: { status: string; nomor: string },
): Galat {
  return pertamaGagal(
    wajibTeks(m.id, "Id RAB"),
    wajibTeks(m.nama, "Nama RAB"),
    periksaRabDapatDiubah(konteks.status, konteks.nomor),
  );
}

export interface KonteksAlurRab {
  status: string;
  nomor: string;
  /** Banyaknya baris pekerjaan pada RAB ini. */
  jumlahBaris: number;
}

/** RAB kosong tidak bisa diajukan — tidak ada yang bisa disetujui. */
export function periksaAjukanRab(m: { id: string }, konteks: KonteksAlurRab): Galat {
  const id = wajibTeks(m.id, "Id RAB");
  if (id) return id;
  if (konteks.status !== "Draft" && konteks.status !== "Ditolak") {
    return `RAB ${konteks.nomor} berstatus ${konteks.status} — tak bisa diajukan.`;
  }
  if (konteks.jumlahBaris === 0) return "RAB belum punya baris pekerjaan.";
  return null;
}

export function periksaSetujuiRab(
  m: { id: string },
  konteks: { status: string; nomor: string },
): Galat {
  const id = wajibTeks(m.id, "Id RAB");
  if (id) return id;
  return konteks.status === "Diajukan"
    ? null
    : `RAB ${konteks.nomor} berstatus ${konteks.status} — hanya yang Diajukan bisa disetujui.`;
}

export function periksaTolakRab(
  m: { id: string; catatan: string | null },
  konteks: { status: string; nomor: string },
): Galat {
  const id = wajibTeks(m.id, "Id RAB");
  if (id) return id;
  return konteks.status === "Diajukan"
    ? null
    : `RAB ${konteks.nomor} berstatus ${konteks.status} — hanya yang Diajukan bisa ditolak.`;
}

// ---------------------------------------------------------------------------
// Baris RAB
// ---------------------------------------------------------------------------

export interface MasukanBarisRab {
  rabEstimasiId: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  /** Diisi bila barisnya memakai analisa dari pustaka. */
  analisaId: string | null;
  /** Diisi bila harganya diketik langsung. */
  hargaSatuan: number | null;
}

/**
 * Sebuah baris mengambil harga dari analisa ATAU dari ketikan, tidak keduanya
 * dan tidak satu pun. Baris tanpa keduanya tidak punya nilai sama sekali.
 */
export function periksaBarisRab(
  m: MasukanBarisRab,
  konteks: { status: string; nomor: string },
): Galat {
  const gerbang = periksaRabDapatDiubah(konteks.status, konteks.nomor);
  if (gerbang) return gerbang;

  const dasar = pertamaGagal(
    wajibTeks(m.rabEstimasiId, "Id RAB"),
    wajibTeks(m.uraian, "Uraian pekerjaan"),
    wajibTeks(m.satuan, "Satuan"),
    angkaMinimal(m.volume, 0, "Volume"),
  );
  if (dasar) return dasar;

  if (!m.analisaId && m.hargaSatuan === null) {
    return "Baris harus memakai analisa atau mengisi harga satuannya sendiri.";
  }
  if (m.hargaSatuan !== null) {
    return angkaMinimal(m.hargaSatuan, 0, "Harga satuan");
  }
  return null;
}

/** Satu kelompok pekerjaan beserta barisnya, pada penyimpanan tabel RAB utuh. */
export interface GrupRabMasuk {
  nama: string;
  items: { uraian: string; volume: number; hargaSatuan: number }[];
}

/**
 * Penyimpanan tabel RAB secara utuh (bukan per baris).
 *
 * Tabel kosong ditolak: menyimpan RAB tanpa satu baris pun akan menghapus
 * seluruh isinya, dan itu hampir selalu kecelakaan — bukan maksud pengguna.
 */
export function periksaSimpanTabelRab(
  grup: GrupRabMasuk[],
  konteks: { status: string; nomor: string },
): Galat {
  const gerbang = periksaRabDapatDiubah(konteks.status, konteks.nomor);
  if (gerbang) return gerbang;

  if (grup.length === 0) return "Tabel RAB tidak boleh kosong.";
  for (const g of grup) {
    if (!g.nama?.trim()) return "Setiap kelompok pekerjaan harus punya nama.";
    for (const it of g.items) {
      if (!it.uraian?.trim()) {
        return `Ada baris tanpa uraian pekerjaan pada kelompok "${g.nama}".`;
      }
    }
  }
  return null;
}
