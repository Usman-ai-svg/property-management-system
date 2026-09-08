/**
 * KONTRAK — Landbank: business plan sebuah proyek.
 *
 * Empat belas aksi yang seluruhnya menyunting RENCANA, bukan realisasi. Karena
 * itu hampir tak ada yang ditolak selain bentuk masukannya: rencana memang
 * dibuat untuk diubah-ubah, dan angka yang terlihat aneh hari ini bisa jadi
 * memang skenario yang sedang dijajaki.
 *
 * Yang tetap ditegakkan cuma dua: kategori harus punya nama (tanpa nama, pos
 * biayanya tidak bisa dijajarkan dengan realisasi di Plan vs Realisasi), dan
 * nilai uang tidak boleh negatif kecuali memang pos pengurang.
 */

import { angkaMinimal, pertamaGagal, wajibTeks, type Galat } from "./dasar";

// ---------------------------------------------------------------------------
// Kategori dan baris HPP / operasional
// ---------------------------------------------------------------------------

export interface MasukanKategoriRencana {
  /** Kosong bila membuat baru. */
  id: string | null;
  projectId: string;
  nama: string;
}

export function periksaSimpanKategoriRencana(m: MasukanKategoriRencana): Galat {
  return pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.nama, "Nama kategori"),
  );
}

export interface KonteksHapusKategori {
  /** Banyaknya baris di dalam kategori ini. */
  jumlahBaris: number;
  nama: string;
}

/**
 * Kategori yang masih berisi baris TIDAK ditolak — barisnya ikut terhapus.
 *
 * Berbeda dari data realisasi: rencana yang dibuang tidak meninggalkan
 * kewajiban apa pun, dan memaksa pengguna mengosongkan kategori satu per satu
 * hanya membuat penyusunan rencana jadi pekerjaan administratif.
 */
export const periksaHapusKategoriRencana = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id kategori");

export interface MasukanBarisRencana {
  id: string | null;
  kategoriId: string;
  nama: string;
  volume: number;
  harga: number;
  satuan: string | null;
}

/**
 * Volume dan harga boleh nol — baris rencana sering dibuat lebih dulu sebagai
 * kerangka, lalu diisi angkanya setelah survei. Yang tidak boleh negatif:
 * rencana biaya bertanda minus akan mengurangi total HPP tanpa terlihat.
 */
export function periksaSimpanBarisRencana(m: MasukanBarisRencana): Galat {
  return pertamaGagal(
    wajibTeks(m.kategoriId, "Kategori"),
    wajibTeks(m.nama, "Nama baris"),
    angkaMinimal(m.volume, 0, "Volume"),
    angkaMinimal(m.harga, 0, "Harga"),
  );
}

export const periksaHapusBarisRencana = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id baris");

// ---------------------------------------------------------------------------
// Harga dasar unit pada rencana omzet
// ---------------------------------------------------------------------------

export interface MasukanHargaDasarUnit {
  projectId: string;
  unitId: string;
  hargaDasar: number;
}

export function periksaSimpanHargaDasarUnit(m: MasukanHargaDasarUnit): Galat {
  return pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.unitId, "Unit"),
    angkaMinimal(m.hargaDasar, 0, "Harga dasar"),
  );
}

export const periksaResetHargaDasarUnit = (m: { unitId: string }): Galat =>
  wajibTeks(m.unitId, "Unit");

// ---------------------------------------------------------------------------
// Cashflow
// ---------------------------------------------------------------------------

export interface MasukanCashflow {
  id: string | null;
  projectId: string;
  periode: string;
  masuk: number;
  keluar: number;
}

/**
 * Kas masuk dan keluar dicatat sebagai dua angka positif, bukan satu angka
 * bertanda. Bentuk ini yang membuat grafik cashflow bisa menggambar batang naik
 * dan turun terpisah, dan membuat "nol keluar" berbeda artinya dari "belum
 * diisi".
 */
export function periksaSimpanCashflow(m: MasukanCashflow): Galat {
  return pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.periode, "Periode"),
    angkaMinimal(m.masuk, 0, "Kas masuk"),
    angkaMinimal(m.keluar, 0, "Kas keluar"),
  );
}

export const periksaHapusCashflow = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id baris cashflow");

// ---------------------------------------------------------------------------
// Pembanding harga
// ---------------------------------------------------------------------------

export interface MasukanPembanding {
  id: string | null;
  projectId: string;
  nama: string;
  hargaPerM2: number;
  keterangan: string | null;
}

export function periksaSimpanPembanding(m: MasukanPembanding): Galat {
  return pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.nama, "Nama pembanding"),
    angkaMinimal(m.hargaPerM2, 0, "Harga per m²"),
  );
}

export const periksaHapusPembanding = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id pembanding");
