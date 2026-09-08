/**
 * KONTRAK — Keuangan Proyek.
 *
 * Sebelas aksi, dan hampir semuanya menulis uang. Inilah modul yang paling
 * rugi kalau aturannya harus ditebak ulang saat jadi RPC.
 *
 * Sebagian pemeriksaan butuh fakta yang hanya ada di database — sisa sebuah PO,
 * berapa yang sudah dicicil, apakah pengeluaran ini tertaut ke kontrak. Fakta
 * seperti itu TIDAK dibaca di sini; ia diminta sebagai parameter `konteks`.
 * Bentuk itu disengaja: daftar field pada `konteks` adalah daftar persis
 * apa yang harus dibaca sebuah RPC sebelum memvalidasi, dan fungsinya tetap
 * murni sehingga bisa diuji tanpa database.
 */

import {
  JENIS_BIAYA_SWAKELOLA,
  METODE_BAYAR,
  METODE_TUNAI,
  PERUNTUKAN_BIAYA,
  SASARAN_PERUNTUKAN,
} from "@/lib/domain/enums";
import { periksaAlokasi } from "@/lib/calc/keuangan";
import {
  angkaMinimal,
  pertamaGagal,
  pilihanSah,
  tanggalSah,
  wajibTeks,
  type Galat,
} from "./dasar";

// ---------------------------------------------------------------------------
// Pembebanan biaya — dipakai bersama oleh catat dan ubah pengeluaran
// ---------------------------------------------------------------------------

/** Satu baris pembebanan sebuah pengeluaran. */
export interface BarisPembebanan {
  unitId: string | null;
  infrastructureId: string | null;
  nominal: number;
}

/**
 * Aturan pembebanan yang berlaku untuk catat maupun ubah pengeluaran.
 *
 * Tiga hal yang diperiksa, dan ketiganya pernah jadi sumber angka keliru:
 *
 *   1. Jumlah pembebanan harus sama PERSIS dengan total (lewat
 *      `periksaAlokasi`). Selisih satu rupiah membuat biaya per unit tidak bisa
 *      dijumlahkan balik ke mutasi banknya.
 *   2. Satu tujuan tidak boleh muncul dua kali. Itu selalu salah ketik, dan
 *      hasilnya angka per unit yang ganda tanpa terlihat.
 *   3. Sasarannya harus cocok dengan peruntukan (`SASARAN_PERUNTUKAN`).
 *      Peruntukan "Prasarana & Sarana" tidak boleh dibebankan ke unit rumah.
 *
 * Daftar pembebanan yang KOSONG adalah sah: itu berarti biaya level proyek,
 * mis. perijinan yang tidak menempel ke objek mana pun.
 */
export function periksaPembebanan(
  total: number,
  peruntukan: string,
  baris: BarisPembebanan[],
): Galat {
  if (baris.length === 0) return null;

  const jumlahnya = periksaAlokasi(total, baris);
  if (jumlahnya) return jumlahnya;

  const kunci = baris.map((b) => b.unitId ?? b.infrastructureId ?? "proyek");
  if (new Set(kunci).size !== kunci.length) {
    return "Ada tujuan pembebanan yang tercantum lebih dari sekali.";
  }

  const sasaran = SASARAN_PERUNTUKAN[peruntukan as keyof typeof SASARAN_PERUNTUKAN];
  if (!sasaran) return null; // peruntukan non-standar (data lama) dilewati

  for (const b of baris) {
    if (b.unitId && !sasaran.unit) {
      return `Peruntukan "${peruntukan}" tidak bisa dibebankan ke unit.`;
    }
    if (b.infrastructureId && !sasaran.sarpras) {
      return `Peruntukan "${peruntukan}" tidak bisa dibebankan ke sarana & prasarana.`;
    }
  }
  return null;
}

/**
 * Isian tambahan yang hanya bermakna pada pengeluaran-hutang.
 *
 * Pada metode kas keduanya harus kosong; pada metode "Hutang" keduanya wajib —
 * merekalah yang menghidupi pengingat hutang, dan hutang tanpa tenggat tidak
 * akan pernah muncul di daftar jatuh tempo.
 */
export function periksaIsianHutang(
  metode: string,
  kreditur: string | null,
  tenggat: string | null,
): Galat {
  if (metode !== "Hutang") return null;
  return pertamaGagal(
    wajibTeks(kreditur, "Kreditur"),
    tanggalSah(tenggat, "Tenggat hutang"),
  );
}

// ---------------------------------------------------------------------------
// catatPengeluaran
// ---------------------------------------------------------------------------

export interface MasukanCatatPengeluaran {
  projectId: string;
  peruntukan: string;
  jenis: string;
  metode: string;
  uraian: string;
  total: number;
  pembebanan: BarisPembebanan[];
  /** Hanya untuk metode "Hutang". */
  kreditur: string | null;
  /** Hanya untuk metode "Hutang", dalam bentuk teks tanggal. */
  tenggat: string | null;
}

/**
 * `jenis` dibatasi JENIS_BIAYA_SWAKELOLA, bukan seluruh JENIS_BIAYA: nilai
 * "Kontraktor" hanya sah lahir dari sebuah SPK, tak pernah dari pengeluaran
 * yang diketik manual di sini.
 */
export function periksaCatatPengeluaran(m: MasukanCatatPengeluaran): Galat {
  return pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    pilihanSah(m.peruntukan, PERUNTUKAN_BIAYA, "peruntukan"),
    pilihanSah(m.jenis, JENIS_BIAYA_SWAKELOLA, "jenis biaya"),
    pilihanSah(m.metode, METODE_BAYAR, "metode pembayaran"),
    wajibTeks(m.uraian, "Keterangan"),
    angkaMinimal(m.total, 1, "Total"),
    periksaIsianHutang(m.metode, m.kreditur, m.tenggat),
    periksaPembebanan(m.total, m.peruntukan, m.pembebanan),
  );
}

// ---------------------------------------------------------------------------
// ubahPengeluaran
// ---------------------------------------------------------------------------

export interface MasukanUbahPengeluaran extends Omit<MasukanCatatPengeluaran, "projectId"> {
  id: string;
}

/** Fakta pengeluaran lama yang harus dibaca server sebelum memvalidasi. */
export interface KonteksUbahPengeluaran {
  /** Metode yang tersimpan. Pengeluaran-hutang tak bisa berganti kelas. */
  metodeLama: string;
  /** Jumlah yang sudah dicicil atas hutang ini. */
  terbayarCicilan: number;
  /** Terisi bila baris ini pembayaran kontrak vendor. */
  contractId: string | null;
  /** Terisi bila baris ini pembayaran PO. */
  pembelianId: string | null;
}

/**
 * Tiga aturan yang tidak bisa diputuskan tanpa membaca baris lamanya:
 *
 *   - Baris yang tertaut kontrak atau PO tidak boleh disunting dari sini.
 *     Keduanya punya invarian sendiri (sisa kontrak, sisa PO) yang hanya
 *     dijaga di modulnya masing-masing.
 *   - Pengeluaran-hutang tetap bermetode "Hutang". Mengubahnya jadi kas akan
 *     membuat cicilan yang sudah tercatat menggantung tanpa induk.
 *   - Total baru tak boleh turun di bawah yang sudah dicicil; sisa hutang
 *     negatif bukan keadaan yang punya arti.
 */
export function periksaUbahPengeluaran(
  m: MasukanUbahPengeluaran,
  konteks: KonteksUbahPengeluaran,
): Galat {
  if (konteks.contractId) {
    return "Ini pembayaran kontrak — ubah atau hapus lewat modul Vendor.";
  }
  if (konteks.pembelianId) {
    return "Ini pembayaran PO — ubah atau hapus lewat kartu Pembelian Material.";
  }

  const hutang = konteks.metodeLama === "Hutang";
  if (hutang && m.metode !== "Hutang") {
    return "Pengeluaran-hutang tidak bisa diubah menjadi pembayaran tunai.";
  }
  if (!hutang && m.metode === "Hutang") {
    return "Pengeluaran tunai tidak bisa diubah menjadi hutang.";
  }
  if (hutang && m.total < konteks.terbayarCicilan) {
    return `Total tak boleh kurang dari yang sudah dicicil (${konteks.terbayarCicilan}).`;
  }

  return pertamaGagal(
    wajibTeks(m.id, "Id pengeluaran"),
    pilihanSah(m.peruntukan, PERUNTUKAN_BIAYA, "peruntukan"),
    pilihanSah(m.jenis, JENIS_BIAYA_SWAKELOLA, "jenis biaya"),
    pilihanSah(m.metode, hutang ? METODE_BAYAR : METODE_TUNAI, "metode pembayaran"),
    wajibTeks(m.uraian, "Keterangan"),
    angkaMinimal(m.total, 1, "Total"),
    periksaIsianHutang(m.metode, m.kreditur, m.tenggat),
    periksaPembebanan(m.total, m.peruntukan, m.pembebanan),
  );
}

// ---------------------------------------------------------------------------
// hapusPengeluaran
// ---------------------------------------------------------------------------

export interface KonteksHapusPengeluaran {
  contractId: string | null;
  pembelianId: string | null;
  /** Banyaknya cicilan yang sudah tercatat atas hutang ini. */
  jumlahCicilan: number;
}

/**
 * Hutang yang sudah dicicil tidak boleh langsung dihapus: cicilannya adalah
 * catatan kas keluar yang benar-benar terjadi. Menghapus induknya lebih dulu
 * akan menghilangkan catatan itu tanpa ada yang memutuskannya.
 */
export function periksaHapusPengeluaran(
  m: { id: string },
  konteks: KonteksHapusPengeluaran,
): Galat {
  const id = wajibTeks(m.id, "Id pengeluaran");
  if (id) return id;
  if (konteks.contractId) {
    return "Ini pembayaran kontrak — ubah atau hapus lewat modul Vendor.";
  }
  if (konteks.pembelianId) {
    return "Ini pembayaran PO — ubah atau hapus lewat kartu Pembelian Material.";
  }
  if (konteks.jumlahCicilan > 0) {
    return `Hutang ini punya ${konteks.jumlahCicilan} cicilan tercatat. Hapus cicilannya lebih dulu.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// bagikanBiayaUnitRata
// ---------------------------------------------------------------------------

export interface KonteksBagikanBiaya {
  jumlahUnit: number;
  /** Banyaknya baris pembebanan yang masih level proyek dan berperuntukan unit. */
  jumlahBiayaLevelProyek: number;
}

export function periksaBagikanBiayaUnitRata(
  m: { projectId: string },
  konteks: KonteksBagikanBiaya,
): Galat {
  const p = wajibTeks(m.projectId, "Proyek");
  if (p) return p;
  if (konteks.jumlahUnit === 0) return "Proyek ini belum punya unit.";
  if (konteks.jumlahBiayaLevelProyek === 0) {
    return "Tidak ada biaya level-proyek (unit) yang bisa dibagikan.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pembelian material (PO)
// ---------------------------------------------------------------------------

/** Satu baris barang pada sebuah PO. */
export interface BarisPembelian {
  uraian: string;
  satuan: string;
  qty: number;
  harga: number;
  hargaDasarId: string | null;
}

export interface MasukanBuatPembelian {
  projectId: string;
  pemasokId: string;
  nomor: string;
  tanggal: string | null;
  keterangan: string | null;
  items: BarisPembelian[];
}

/**
 * Harga BOLEH nol (barang bonus atau contoh), tetapi kuantitas tidak — baris
 * ber-qty nol tidak menambah apa pun pada nilai PO dan hanya membingungkan saat
 * penerimaan barang.
 */
export function periksaBuatPembelian(m: MasukanBuatPembelian): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.projectId, "Proyek"),
    wajibTeks(m.pemasokId, "Pemasok"),
    wajibTeks(m.nomor, "Nomor PO"),
  );
  if (dasar) return dasar;

  if (m.items.length === 0) return "Pembelian harus punya minimal satu barang.";
  for (const b of m.items) {
    const uraian = wajibTeks(b.uraian, "Nama barang");
    if (uraian) return uraian;
    if (!Number.isFinite(b.qty) || b.qty <= 0) return `Qty "${b.uraian}" harus lebih dari nol.`;
    if (!Number.isFinite(b.harga) || b.harga < 0) return `Harga "${b.uraian}" tidak sah.`;
  }
  return null;
}

export interface MasukanTerimaPembelian {
  id: string;
  penerima: string;
  tanggalTerima: string;
}

export function periksaTerimaPembelian(m: MasukanTerimaPembelian): Galat {
  return pertamaGagal(
    wajibTeks(m.id, "Id pembelian"),
    wajibTeks(m.penerima, "Nama penerima"),
    tanggalSah(m.tanggalTerima, "Tanggal penerimaan"),
  );
}

export interface KonteksHapusPembelian {
  jumlahPembayaran: number;
  nomor: string;
}

export function periksaHapusPembelian(
  m: { id: string },
  konteks: KonteksHapusPembelian,
): Galat {
  const id = wajibTeks(m.id, "Id pembelian");
  if (id) return id;
  if (konteks.jumlahPembayaran > 0) {
    return `Pembelian ${konteks.nomor} sudah punya ${konteks.jumlahPembayaran} pembayaran. Hapus pembayarannya lebih dulu.`;
  }
  return null;
}

export interface MasukanBayarPembelian {
  pembelianId: string;
  total: number;
  peruntukan: string;
  metode: string;
  unitId: string | null;
  infrastructureId: string | null;
}

export interface KonteksBayarPembelian {
  /** Sisa yang belum dibayar atas PO ini. */
  sisa: number;
  nomor: string;
}

/**
 * Metodenya dibatasi METODE_TUNAI: membayar PO dengan metode "Hutang" akan
 * mencatat biaya dua kali — sekali sebagai hutang PO, sekali sebagai
 * pengeluaran-hutang tersendiri.
 */
export function periksaBayarPembelian(
  m: MasukanBayarPembelian,
  konteks: KonteksBayarPembelian,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.pembelianId, "Id pembelian"),
    pilihanSah(m.peruntukan, PERUNTUKAN_BIAYA, "peruntukan"),
    pilihanSah(m.metode, METODE_TUNAI, "metode pembayaran"),
    angkaMinimal(m.total, 1, "Nominal pembayaran"),
  );
  if (dasar) return dasar;

  if (konteks.sisa <= 0) return `Pembelian ${konteks.nomor} sudah lunas.`;
  if (m.total > konteks.sisa) {
    return `Pembayaran ${m.total} melebihi sisa ${konteks.sisa}.`;
  }
  return periksaPembebanan(m.total, m.peruntukan, [
    { unitId: m.unitId, infrastructureId: m.infrastructureId, nominal: m.total },
  ]);
}

export function periksaHapusPembayaranPembelian(
  m: { id: string },
  konteks: { pembelianId: string | null },
): Galat {
  const id = wajibTeks(m.id, "Id pembayaran");
  if (id) return id;
  return konteks.pembelianId ? null : "Pengeluaran ini bukan pembayaran pembelian.";
}

// ---------------------------------------------------------------------------
// Cicilan hutang
// ---------------------------------------------------------------------------

export interface MasukanBayarHutang {
  expenseId: string;
  nominal: number;
  metode: string;
  tanggal: string;
}

export interface KonteksBayarHutang {
  /** Metode pengeluaran induknya — harus "Hutang". */
  metodeInduk: string;
  /** Sisa hutang yang belum dicicil. */
  sisa: number;
}

export function periksaBayarHutang(
  m: MasukanBayarHutang,
  konteks: KonteksBayarHutang,
): Galat {
  const dasar = pertamaGagal(
    wajibTeks(m.expenseId, "Id hutang"),
    pilihanSah(m.metode, METODE_TUNAI, "metode pembayaran"),
    angkaMinimal(m.nominal, 1, "Nominal pembayaran"),
    tanggalSah(m.tanggal, "Tanggal pembayaran"),
  );
  if (dasar) return dasar;

  if (konteks.metodeInduk !== "Hutang") return "Pengeluaran ini bukan hutang.";
  if (konteks.sisa <= 0) return "Hutang ini sudah lunas.";
  if (m.nominal > konteks.sisa) {
    return `Pembayaran ${m.nominal} melebihi sisa ${konteks.sisa}.`;
  }
  return null;
}

export const periksaHapusCicilanHutang = (m: { id: string }): Galat =>
  wajibTeks(m.id, "Id cicilan");
