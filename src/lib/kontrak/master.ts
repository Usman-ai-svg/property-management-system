/**
 * KONTRAK — Master Proyek: proyek, fase, lokasi, luas & biaya lahan,
 * legalitas, tipe unit, unit, dan sarpras.
 *
 * Modul paling "master data": sedikit uang, banyak identitas. Aturan yang
 * berulang di sini bukan soal nominal melainkan soal KODE — kode proyek, kode
 * fase, kode tipe, kode unit. Semuanya dipakai manusia untuk saling merujuk di
 * lapangan, jadi bentuk dan keunikannya ditegakkan, bukan disarankan.
 */

import { JENIS_HAK_ATAS_TANAH, JENIS_SARPRAS, STATUS_JUAL, STATUS_PROYEK } from "@/lib/domain/enums";
import {
  angkaMinimal,
  angkaRentang,
  pertamaGagal,
  pilihanSah,
  wajibTeks,
  type Galat,
} from "./dasar";

// ---------------------------------------------------------------------------
// Kode proyek
// ---------------------------------------------------------------------------

/** Bentuk kode proyek: huruf besar dan angka, 2–8 karakter. */
export const POLA_KODE_PROYEK = /^[A-Z0-9]{2,8}$/;

/**
 * Kode proyek muncul di kode unit ("NT2-F1-3"), nomor RAB, nomor SPK, dan URL
 * tiap halaman. Karena itu bentuknya dibatasi: spasi dan tanda baca akan
 * merusak semuanya sekaligus, dan memperbaikinya belakangan berarti mengubah
 * ribuan kode turunan.
 */
export function periksaKodeProyek(kode: string, bentrok: boolean): Galat {
  const kosong = wajibTeks(kode, "Kode proyek");
  if (kosong) return kosong;
  if (!POLA_KODE_PROYEK.test(kode)) {
    return "Kode proyek hanya boleh huruf dan angka, 2–8 karakter.";
  }
  return bentrok ? `Kode proyek "${kode}" sudah dipakai.` : null;
}

export interface MasukanProyek {
  kode: string;
  nama: string;
  lokasi: string;
  status: string;
}

export function periksaTambahProyek(m: MasukanProyek, konteks: { kodeBentrok: boolean }): Galat {
  return pertamaGagal(
    periksaKodeProyek(m.kode, konteks.kodeBentrok),
    wajibTeks(m.nama, "Nama proyek"),
    pilihanSah(m.status, STATUS_PROYEK, "status proyek"),
  );
}

export interface KonteksHapusProyek {
  jumlahUnit: number;
  jumlahSarpras: number;
  jumlahPengeluaran: number;
  nama: string;
}

/**
 * Proyek yang sudah punya isi tidak dihapus.
 *
 * Bukan sekadar melindungi data: menghapus proyek akan menghapus berantai unit,
 * BOQ, pengeluaran, dan jejak pembayarannya — termasuk baris yang sudah
 * dicocokkan dengan mutasi bank.
 */
export function periksaHapusProyek(m: { id: string }, konteks: KonteksHapusProyek): Galat {
  const id = wajibTeks(m.id, "Id proyek");
  if (id) return id;
  const isi = konteks.jumlahUnit + konteks.jumlahSarpras + konteks.jumlahPengeluaran;
  if (isi > 0) {
    return `Proyek "${konteks.nama}" masih berisi ${konteks.jumlahUnit} unit, ${konteks.jumlahSarpras} sarpras, dan ${konteks.jumlahPengeluaran} pengeluaran. Kosongkan lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fase
// ---------------------------------------------------------------------------

export interface MasukanFase {
  /** Kosong bila membuat baru. */
  id: string | null;
  projectId: string;
  kode: string;
  nama: string;
}

export function periksaSimpanFase(m: MasukanFase, konteks: { kodeBentrok: boolean }): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.kode, "Kode fase"),
  );
  if (dasar) return dasar;
  return konteks.kodeBentrok ? `Fase "${m.kode}" sudah ada pada proyek ini.` : null;
}

/** Batas atas jumlah fase yang bisa dibuat sekaligus. */
export const MAKS_FASE = 50;

/**
 * Membuat fase massal dibatasi 50.
 *
 * Bukan batas teknis: angka di atas itu hampir selalu salah ketik (misalnya
 * mengetik luas lahan di kolom jumlah fase), dan membersihkan 3.000 fase jauh
 * lebih mahal daripada mengulang pengisian.
 */
export function periksaAturJumlahFase(m: { projectId: string; jumlah: number }): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    angkaMinimal(m.jumlah, 1, "Jumlah fase"),
  );
  if (dasar) return dasar;
  return m.jumlah > MAKS_FASE ? `Jumlah fase terlalu banyak (maksimal ${MAKS_FASE}).` : null;
}

export interface KonteksHapusFase {
  jumlahUnit: number;
  kode: string;
}

export function periksaHapusFase(m: { id: string }, konteks: KonteksHapusFase): Galat {
  const id = wajibTeks(m.id, "Id fase");
  if (id) return id;
  if (konteks.jumlahUnit > 0) {
    return `Fase ${konteks.kode} masih berisi ${konteks.jumlahUnit} unit. Pindahkan atau hapus unitnya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lokasi
// ---------------------------------------------------------------------------

/**
 * Pin lokasi ditulis sebagai "lintang, bujur".
 *
 * Dikembalikan sebagai pasangan angka, atau pesan bila tidak terbaca. Bentuk
 * ini dipilih supaya pemanggilnya tidak perlu mengurai ulang — dan supaya
 * aturan penguraiannya tidak lahir dua kali.
 */
export function uraikanPin(pin: string): { lat: number; lng: number } | string {
  const bagian = pin.split(",").map((x) => Number(x.trim()));
  if (bagian.length !== 2 || bagian.some((n) => !Number.isFinite(n))) {
    return 'Pin lokasi harus berupa "lintang, bujur", mis. -6.4021, 106.7532';
  }
  return { lat: bagian[0], lng: bagian[1] };
}

export function periksaUbahLokasi(m: { id: string; pin: string | null }): Galat {
  const id = wajibTeks(m.id, "Id proyek");
  if (id) return id;
  if (m.pin === null || m.pin.trim() === "") return null;
  const hasil = uraikanPin(m.pin);
  return typeof hasil === "string" ? hasil : null;
}

// ---------------------------------------------------------------------------
// Legalitas
// ---------------------------------------------------------------------------

/** Satu baris legalitas: sebuah NIB beserta hak atas tanahnya. */
export interface BarisLegalitas {
  nib: string;
  jenisHak: string;
  nomorHak: string;
  luas: number;
}

/**
 * Tiap NIB wajib menyebut jenis DAN nomor hak atas tanahnya.
 *
 * Legalitas tanpa nomor hak tidak bisa dicek ke BPN, sehingga barisnya tidak
 * membuktikan apa pun — hanya membuat total luas bersertifikat tampak lebih
 * besar daripada yang sebenarnya bisa dipertanggungjawabkan.
 */
export function periksaUbahLegalitas(
  m: { projectId: string; baris: BarisLegalitas[] },
): Galat {
  const proyek = wajibTeks(m.projectId, "Proyek");
  if (proyek) return proyek;

  const berisi = m.baris.filter((b) => b.nib?.trim());
  if (berisi.length === 0) return "Isi minimal satu NIB.";

  for (const b of berisi) {
    if (!(JENIS_HAK_ATAS_TANAH as readonly string[]).includes(b.jenisHak)) {
      return `Jenis hak atas tanah "${b.jenisHak}" pada NIB ${b.nib} tidak sah.`;
    }
    if (!b.nomorHak?.trim()) {
      return `Nomor hak atas tanah pada NIB ${b.nib} wajib diisi.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tipe unit dan unit
// ---------------------------------------------------------------------------

export interface MasukanTipeUnit {
  id: string | null;
  projectId: string;
  kode: string;
  nama: string;
  luasBangunan: number;
  luasTanah: number;
}

/**
 * Luas bangunan dan luas tanah harus positif: keduanya dasar seluruh RAB
 * acuan, dan tipe berluas nol menghasilkan RAB nol pada tiap unit yang
 * memakainya.
 */
export function periksaSimpanTipeUnit(
  m: MasukanTipeUnit,
  konteks: { kodeBentrok: boolean },
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.kode, "Kode tipe"),
    wajibTeks(m.nama, "Nama tipe"),
    angkaMinimal(m.luasBangunan, 1, "Luas bangunan"),
    angkaMinimal(m.luasTanah, 1, "Luas tanah"),
  );
  if (dasar) return dasar;
  return konteks.kodeBentrok ? `Kode tipe "${m.kode}" sudah dipakai di proyek ini.` : null;
}

export interface KonteksHapusTipeUnit {
  jumlahUnit: number;
  kode: string;
}

export function periksaHapusTipeUnit(
  m: { id: string },
  konteks: KonteksHapusTipeUnit,
): Galat {
  const id = wajibTeks(m.id, "Id tipe unit");
  if (id) return id;
  if (konteks.jumlahUnit > 0) {
    return `Tipe ${konteks.kode} masih dipakai ${konteks.jumlahUnit} unit. Ubah tipe unitnya lebih dulu.`;
  }
  return null;
}

export interface MasukanUnit {
  projectId: string;
  phaseId: string;
  unitTypeId: string;
  nomor: number;
  luasTanah: number;
  statusJual: string;
  hargaJual: number;
}

export interface KonteksUnit {
  /** Sudah ada unit dengan fase dan nomor yang sama. */
  kodeBentrok: boolean;
  kodeUnit: string;
}

/**
 * Nomor unit harus positif dan unik di dalam fasenya — bersama kode fase, ia
 * membentuk kode unit yang dipakai di lapangan, di SPK, dan di kuitansi.
 */
export function periksaUnit(m: MasukanUnit, konteks: KonteksUnit): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.phaseId, "Fase"),
    wajibTeks(m.unitTypeId, "Tipe unit"),
    angkaMinimal(m.nomor, 1, "Nomor unit"),
    angkaMinimal(m.luasTanah, 1, "Luas tanah"),
    pilihanSah(m.statusJual, STATUS_JUAL, "status jual"),
    angkaMinimal(m.hargaJual, 0, "Harga jual"),
  );
  if (dasar) return dasar;
  return konteks.kodeBentrok
    ? `Unit ${konteks.kodeUnit} sudah ada. Pakai nomor atau fase lain.`
    : null;
}

// ---------------------------------------------------------------------------
// Sarpras
// ---------------------------------------------------------------------------

export interface MasukanSarpras {
  id: string | null;
  projectId: string;
  kode: string;
  nama: string;
  jenis: string;
  volume: string;
  progress: number;
}

export function periksaSimpanSarpras(
  m: MasukanSarpras,
  konteks: { kodeBentrok: boolean },
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.kode, "Kode sarpras"),
    wajibTeks(m.nama, "Nama sarpras"),
    pilihanSah(m.jenis, JENIS_SARPRAS, "jenis sarpras"),
    angkaRentang(m.progress, 0, 100, "Progres"),
  );
  if (dasar) return dasar;
  return konteks.kodeBentrok ? `Kode "${m.kode}" sudah dipakai di proyek ini.` : null;
}

// ---------------------------------------------------------------------------
// Baris BOQ dan RAP unit
// ---------------------------------------------------------------------------

export interface MasukanBarisTabel {
  id: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
}

/**
 * Baris BOQ dan RAP memakai aturan yang sama: volume dan harga tidak boleh
 * negatif, tetapi boleh nol — baris yang nilainya menyusul tetap perlu ada
 * supaya urutan pekerjaannya tidak berubah.
 */
export function periksaBarisTabel(m: MasukanBarisTabel): Galat {
  return pertamaGagal(
    wajibTeks(m.id, "Id baris"),
    wajibTeks(m.uraian, "Uraian"),
    angkaMinimal(m.volume, 0, "Volume"),
    angkaMinimal(m.hargaSatuan, 0, "Harga satuan"),
  );
}
