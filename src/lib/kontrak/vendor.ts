/**
 * KONTRAK — Vendor, kontrak (SPK), variation order, dan pembayarannya.
 *
 * Modul dengan uang paling besar per transaksi: satu pembayaran termin bisa
 * ratusan juta, dan kelebihan bayar pada kontrak borongan jauh lebih sulit
 * ditarik kembali daripada dicegah. Karena itu hampir semua pemeriksaan di sini
 * bersifat menolak, bukan memperingatkan.
 */

import {
  JENIS_BIAYA_KONTRAK,
  JENIS_KONTRAK,
  METODE_TUNAI,
  STATUS_VENDOR,
  STATUS_VO,
} from "@/lib/domain/enums";
import {
  angkaMinimal,
  angkaRentang,
  pertamaGagal,
  pilihanSah,
  tanggalSah,
  wajibTeks,
  type Galat,
} from "./dasar";

// ---------------------------------------------------------------------------
// Vendor
// ---------------------------------------------------------------------------

export interface MasukanVendor {
  nama: string;
  bidang: string;
  kontak: string;
  alamat: string;
  /** Tahun vendor mulai bekerja sama. */
  sejak: number;
  status: string;
}

export interface KonteksNamaVendor {
  /** Sudah ada vendor lain bernama sama. */
  namaBentrok: boolean;
}

/**
 * Nama vendor unik. Bukan kerapian: pembayaran ditelusuri lewat nama vendor di
 * jejak audit dan laporan, dan dua "CV Karya Mandiri" membuat penelusuran itu
 * berhenti pada tebakan.
 */
export function periksaVendor(
  m: MasukanVendor,
  konteks: KonteksNamaVendor,
  tahunIni: number,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.nama, "Nama vendor"),
    wajibTeks(m.bidang, "Bidang"),
    wajibTeks(m.kontak, "Kontak"),
    wajibTeks(m.alamat, "Alamat"),
    angkaRentang(m.sejak, 1900, tahunIni, "Tahun mulai"),
    pilihanSah(m.status, STATUS_VENDOR, "status vendor"),
  );
  if (dasar) return dasar;
  return konteks.namaBentrok ? `Vendor bernama "${m.nama}" sudah terdaftar.` : null;
}

export interface KonteksHapusVendor {
  jumlahKontrak: number;
  nama: string;
}

export function periksaHapusVendor(
  m: { id: string },
  konteks: KonteksHapusVendor,
): Galat {
  const id = wajibTeks(m.id, "Id vendor");
  if (id) return id;
  if (konteks.jumlahKontrak > 0) {
    return `Vendor "${konteks.nama}" masih punya ${konteks.jumlahKontrak} kontrak. Hapus kontraknya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Kontrak (SPK)
// ---------------------------------------------------------------------------

export interface MasukanKontrak {
  jenis: string;
  deskripsi: string;
  jenisBiaya: string;
  mulai: string | null;
  retensiPct: number;
  jatuhTempoBln: number;
  /** Id unit atau sarpras yang tercakup. Boleh kosong. */
  cakupan: string[];
}

export interface KonteksTambahKontrak {
  /** Vendor Nonaktif tidak boleh menerima kontrak baru. */
  statusVendor: string;
  namaVendor: string;
  /** Dokumen SPK sudah terunggah. */
  adaDokumen: boolean;
}

/**
 * Kontrak TANPA cakupan tetap sah — nilainya lalu tidak dialokasikan ke objek
 * mana pun dan muncul sebagai biaya level proyek. Yang tidak boleh justru
 * sebaliknya: dokumen SPK-nya hilang. SPK adalah dasar hukum pembayaran;
 * kontrak tanpa dokumen berarti tagihan tanpa perjanjian.
 */
export function periksaTambahKontrak(
  m: MasukanKontrak,
  konteks: KonteksTambahKontrak,
): Galat {
  const dasar = periksaIsiKontrak(m);
  if (dasar) return dasar;
  if (konteks.statusVendor === "Nonaktif") {
    return `Vendor "${konteks.namaVendor}" berstatus Nonaktif — aktifkan dulu sebelum membuat kontrak.`;
  }
  if (!konteks.adaDokumen) return "Dokumen SPK wajib diunggah saat membuat kontrak.";
  return null;
}

/** Bagian isi kontrak yang berlaku untuk pembuatan maupun penyuntingan. */
export function periksaIsiKontrak(m: MasukanKontrak): Galat {
  return pertamaGagal(
    pilihanSah(m.jenis, JENIS_KONTRAK, "lingkup kontrak"),
    pilihanSah(m.jenisBiaya, JENIS_BIAYA_KONTRAK, "jenis biaya kontrak"),
    wajibTeks(m.deskripsi, "Deskripsi pekerjaan"),
    m.mulai === null ? null : tanggalSah(m.mulai, "Tanggal mulai"),
    angkaRentang(m.retensiPct, 0, 100, "Persentase retensi"),
    angkaMinimal(m.jatuhTempoBln, 0, "Masa pemeliharaan (bulan)"),
  );
}

export interface MasukanUbahKontrak extends MasukanKontrak {
  id: string;
  /** Diisi bila pekerjaannya sudah ditandai selesai. */
  tanggalSelesai: string | null;
}

export function periksaUbahKontrak(m: MasukanUbahKontrak): Galat {
  return pertamaGagal(
    wajibTeks(m.id, "Id kontrak"),
    periksaIsiKontrak(m),
    m.tanggalSelesai === null ? null : tanggalSah(m.tanggalSelesai, "Tanggal selesai"),
  );
}

export interface KonteksTandaiSelesai {
  /** Progres tertimbang seluruh baris BOQ SPK, 0–100. */
  progres: number;
  sudahSelesai: boolean;
}

/**
 * Sebuah SPK hanya boleh ditandai selesai pada progres 100%.
 *
 * Tanggal selesai itulah yang memulai hitungan masa pemeliharaan dan jatuh
 * tempo retensi. Menandainya lebih awal berarti retensi cair sebelum
 * pekerjaannya benar-benar rampung.
 */
export function periksaTandaiSelesai(
  m: { id: string; tanggalSelesai: string | null },
  konteks: KonteksTandaiSelesai,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.id, "Id kontrak"),
    m.tanggalSelesai === null ? null : tanggalSah(m.tanggalSelesai, "Tanggal selesai"),
  );
  if (dasar) return dasar;
  if (konteks.sudahSelesai) return "Kontrak ini sudah ditandai selesai.";
  if (konteks.progres < 100) {
    return `Progres SPK baru ${konteks.progres}% — tandai selesai hanya bila seluruh pekerjaan sudah 100%.`;
  }
  return null;
}

export interface KonteksHapusKontrak {
  jumlahPembayaran: number;
  kode: string;
}

export function periksaHapusKontrak(
  m: { id: string },
  konteks: KonteksHapusKontrak,
): Galat {
  const id = wajibTeks(m.id, "Id kontrak");
  if (id) return id;
  if (konteks.jumlahPembayaran > 0) {
    return `Kontrak ${konteks.kode} masih punya ${konteks.jumlahPembayaran} pembayaran tercatat. Hapus pembayarannya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Variation Order
// ---------------------------------------------------------------------------

/** Satu baris pekerjaan pada sebuah VO. */
export interface BarisVo {
  unitId: string | null;
  infrastructureId: string | null;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
}

export interface MasukanTambahVo {
  contractId: string;
  uraian: string;
  status: string;
  items: BarisVo[];
}

export interface KonteksTambahVo {
  /** Id unit yang tercakup kontraknya. */
  unitCakupan: string[];
  /** Id sarpras yang tercakup kontraknya. */
  sarprasCakupan: string[];
}

/**
 * VO dipakai untuk pekerjaan TAMBAH maupun KURANG, jadi harga satuan boleh
 * negatif — tetapi tidak boleh nol: baris bernilai nol tidak mengubah apa pun
 * dan hanya membuat nilai kontrak tampak berubah padahal tidak.
 *
 * Tiap baris wajib menyebut objeknya, dan objek itu harus ada di dalam cakupan
 * kontraknya. VO untuk unit di luar cakupan berarti pekerjaan yang tidak pernah
 * disepakati dalam SPK ini.
 */
export function periksaTambahVo(m: MasukanTambahVo, konteks: KonteksTambahVo): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.contractId, "Id kontrak"),
    wajibTeks(m.uraian, "Uraian VO"),
    pilihanSah(m.status, STATUS_VO, "status VO"),
  );
  if (dasar) return dasar;

  if (m.items.length === 0) return "Tambahkan minimal satu baris pekerjaan VO.";

  const unit = new Set(konteks.unitCakupan);
  const sarpras = new Set(konteks.sarprasCakupan);
  for (const b of m.items) {
    if (!b.unitId && !b.infrastructureId) {
      return "Setiap baris VO harus memilih objek (unit/sarpras).";
    }
    if (b.unitId && !unit.has(b.unitId)) {
      return "Ada baris VO untuk unit di luar cakupan kontrak.";
    }
    if (b.infrastructureId && !sarpras.has(b.infrastructureId)) {
      return "Ada baris VO untuk sarpras di luar cakupan kontrak.";
    }
    const uraian = wajibTeks(b.uraian, "Uraian baris VO");
    if (uraian) return "Uraian baris VO tidak boleh kosong.";
    if (!Number.isFinite(b.volume) || b.volume <= 0) {
      return `Volume baris "${b.uraian}" harus lebih dari nol.`;
    }
    if (!Number.isFinite(b.hargaSatuan) || b.hargaSatuan === 0) {
      return `Harga satuan baris "${b.uraian}" tidak boleh nol (pakai negatif untuk pekerjaan kurang).`;
    }
  }
  return null;
}

/**
 * Nilai keseluruhan VO tidak boleh nol.
 *
 * Baris tambah dan kurang yang kebetulan saling meniadakan menghasilkan
 * dokumen VO yang tidak mengubah nilai kontrak sepeser pun — hampir selalu
 * tanda ada baris yang salah tanda.
 */
export const periksaNilaiVo = (nominal: number): Galat =>
  nominal === 0 ? "Total nilai VO nol — periksa baris tambah/kurang." : null;

export function periksaUbahStatusVo(m: { id: string; status: string }): Galat {
  return pertamaGagal(
    wajibTeks(m.id, "Id VO"),
    pilihanSah(m.status, STATUS_VO, "status VO"),
  );
}

// ---------------------------------------------------------------------------
// Pembayaran kontrak
// ---------------------------------------------------------------------------

export interface MasukanPembayaranKontrak {
  contractId: string;
  nominal: number;
  uraian: string;
  metode: string;
  tanggal: string | null;
}

export interface KonteksPembayaranKontrak {
  /** Nilai kontrak setelah VO disetujui. */
  nilaiEfektif: number;
  /** Yang sudah dibayarkan sebelum pembayaran ini. */
  sudahTerbayar: number;
}

/**
 * Pembayaran yang melampaui nilai kontrak ditolak, bukan diperingatkan.
 *
 * Pembandingnya nilai EFEKTIF — nilai kontrak ditambah VO yang sudah disetujui.
 * Memakai nilai awal akan menolak pembayaran yang sah atas pekerjaan tambah
 * yang sudah dikerjakan.
 */
export function periksaPembayaranKontrak(
  m: MasukanPembayaranKontrak,
  konteks: KonteksPembayaranKontrak,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.contractId, "Id kontrak"),
    wajibTeks(m.uraian, "Keterangan pembayaran"),
    pilihanSah(m.metode, METODE_TUNAI, "metode pembayaran"),
    angkaMinimal(m.nominal, 1, "Nominal pembayaran"),
    m.tanggal === null ? null : tanggalSah(m.tanggal, "Tanggal pembayaran"),
  );
  if (dasar) return dasar;

  const sisa = konteks.nilaiEfektif - konteks.sudahTerbayar;
  if (m.nominal > sisa) {
    return `Pembayaran melebihi nilai kontrak. Sisa yang bisa dibayar: ${sisa}.`;
  }
  return null;
}

export function periksaHapusPembayaranKontrak(
  m: { id: string },
  konteks: { contractId: string | null },
): Galat {
  const id = wajibTeks(m.id, "Id pembayaran");
  if (id) return id;
  return konteks.contractId ? null : "Pengeluaran ini bukan pembayaran kontrak.";
}
