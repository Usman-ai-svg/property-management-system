/**
 * KONTRAK — Equipment & Asset: inventaris alat, penyesuaian stok, servis, dan
 * penggunaan alat di proyek.
 *
 * Aturan paling penting di modul ini bukan soal uang melainkan soal STOK:
 * jumlah alat yang tersedia adalah angka turunan, dan satu-satunya cara
 * mengubahnya adalah lewat baris penyesuaian yang punya penanggung jawab.
 * Akibat tiap jenis penyesuaian pada angka stok sudah dihitung
 * `terapkanPenyesuaian` di `calc/aset.ts`; yang di sini hanya bentuk masukannya.
 */

import {
  JENIS_ASET,
  JENIS_PENYESUAIAN_ASET,
  KEPEMILIKAN_ASET,
} from "@/lib/domain/enums";
import {
  angkaMinimal,
  pertamaGagal,
  pilihanSah,
  tanggalSah,
  wajibTeks,
  type Galat,
} from "./dasar";

// ---------------------------------------------------------------------------
// Inventaris
// ---------------------------------------------------------------------------

export interface MasukanAset {
  /** Kosong bila membuat baru. */
  id: string | null;
  kode: string;
  nama: string;
  jenis: string;
  kategori: string;
  kepemilikan: string;
  jumlah: number;
  vendorId: string | null;
}

export interface KonteksAset {
  kodeBentrok: boolean;
}

/**
 * Kode alat unik dan jumlah minimal satu.
 *
 * Alat berjumlah nol tidak bisa dipakai maupun disesuaikan — kalau memang
 * habis, yang benar adalah mencatat penyesuaian "Hilang", bukan mendaftarkan
 * barisnya bernilai nol sejak awal.
 */
export function periksaAset(m: MasukanAset, konteks: KonteksAset): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.kode, "Kode alat"),
    wajibTeks(m.nama, "Nama alat"),
    pilihanSah(m.jenis, JENIS_ASET, "jenis inventaris"),
    pilihanSah(m.kepemilikan, KEPEMILIKAN_ASET, "kepemilikan"),
    angkaMinimal(m.jumlah, 1, "Jumlah"),
  );
  if (dasar) return dasar;

  if (m.kepemilikan === "Sewa" && !m.vendorId) {
    return "Alat berstatus Sewa harus menyebut vendor pemiliknya.";
  }
  return konteks.kodeBentrok ? `Kode "${m.kode}" sudah dipakai aset lain.` : null;
}

export interface KonteksHapusAset {
  jumlahPenggunaan: number;
  kode: string;
}

export function periksaHapusAset(m: { id: string }, konteks: KonteksHapusAset): Galat {
  const id = wajibTeks(m.id, "Id aset");
  if (id) return id;
  if (konteks.jumlahPenggunaan > 0) {
    return `Alat ${konteks.kode} masih punya ${konteks.jumlahPenggunaan} catatan penggunaan. Hapus penggunaannya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penyesuaian stok
// ---------------------------------------------------------------------------

export interface MasukanPenyesuaianAset {
  assetId: string;
  jenis: string;
  jumlah: number;
  catatan: string | null;
}

/**
 * Stok hanya berubah lewat baris penyesuaian, dan tiap baris menyebut ALASANNYA
 * (Hilang / Rusak / Perbaikan Selesai / Koreksi Stok). Akibat tiap jenis pada
 * angka berbeda, dan `terapkanPenyesuaian` di calc yang menghitungnya —
 * termasuk menolak penyesuaian yang membuat stok jadi negatif.
 */
export function periksaCatatPenyesuaianAset(m: MasukanPenyesuaianAset): Galat {
  return pertamaGagal(
    wajibTeks(m.assetId, "Alat"),
    pilihanSah(m.jenis, JENIS_PENYESUAIAN_ASET, "jenis penyesuaian"),
    angkaMinimal(m.jumlah, 1, "Jumlah penyesuaian"),
  );
}

// ---------------------------------------------------------------------------
// Servis
// ---------------------------------------------------------------------------

export interface MasukanServis {
  assetId: string;
  tanggal: string;
  berikutnya: string | null;
  biaya: number;
  catatan: string | null;
}

/**
 * Jadwal servis berikutnya tidak boleh lebih awal daripada servis yang baru
 * saja dicatat — jadwal yang sudah lewat sejak dibuat tidak akan pernah muncul
 * sebagai pengingat.
 */
export function periksaCatatServis(m: MasukanServis): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.assetId, "Alat"),
    tanggalSah(m.tanggal, "Tanggal servis"),
    angkaMinimal(m.biaya, 0, "Biaya servis"),
    m.berikutnya === null ? null : tanggalSah(m.berikutnya, "Jadwal servis berikutnya"),
  );
  if (dasar) return dasar;

  if (m.berikutnya && new Date(m.berikutnya) < new Date(m.tanggal)) {
    return "Jadwal servis berikutnya tidak boleh lebih awal daripada tanggal servis.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penggunaan alat
// ---------------------------------------------------------------------------

export interface MasukanPenggunaan {
  assetId: string;
  projectId: string;
  jumlah: number;
  mulai: string;
  selesai: string | null;
  penanggungJawab: string | null;
  catatan: string | null;
}

export interface KonteksPenggunaan {
  /** Banyaknya unit alat yang masih tersedia (belum dipakai proyek lain). */
  tersedia: number;
  kode: string;
}

/**
 * Satu alat bisa dipakai beberapa proyek sekaligus, tapi tidak melebihi
 * stoknya.
 *
 * Inilah sebabnya penggunaan dicatat sebagai ledger, bukan sebagai kolom
 * "sedang dipakai di proyek X": lima scaffolding bisa terbagi tiga proyek, dan
 * yang harus dijaga adalah jumlahnya — bukan boleh-tidaknya dipakai bersamaan.
 */
export function periksaTambahPenggunaan(
  m: MasukanPenggunaan,
  konteks: KonteksPenggunaan,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.assetId, "Alat"),
    wajibTeks(m.projectId, "Proyek"),
    angkaMinimal(m.jumlah, 1, "Jumlah alat yang dipakai"),
    tanggalSah(m.mulai, "Tanggal mulai"),
    m.selesai === null ? null : tanggalSah(m.selesai, "Tanggal selesai"),
  );
  if (dasar) return dasar;

  if (m.selesai && new Date(m.selesai) < new Date(m.mulai)) {
    return "Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.";
  }
  if (m.jumlah > konteks.tersedia) {
    return `Alat ${konteks.kode} hanya tersedia ${konteks.tersedia} unit.`;
  }
  return null;
}

export function periksaSelesaikanPenggunaan(
  m: { id: string; selesai: string | null },
  konteks: { mulai: string; sudahSelesai: boolean },
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.id, "Id penggunaan"),
    m.selesai === null ? null : tanggalSah(m.selesai, "Tanggal selesai"),
  );
  if (dasar) return dasar;

  if (konteks.sudahSelesai) return "Penggunaan ini sudah ditandai selesai.";
  if (m.selesai && new Date(m.selesai) < new Date(konteks.mulai)) {
    return "Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.";
  }
  return null;
}

export const periksaHapusPenggunaan = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id penggunaan");
