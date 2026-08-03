/**
 * Penyusunan angka halaman Equipment & Asset.
 *
 * Bebas framework dan bebas Prisma. `nilai` bertipe opsional karena peran
 * tanpa izin "hargaRabRap" memang tidak menerima kolom itu dari database.
 */

export interface AsetLike {
  kepemilikan: string;
  status: string;
  servisBerikut: Date | null;
  nilai?: number;
}

export interface KpiAset {
  jumlahJenis: number;
  milikSendiri: number;
  sewa: number;
  /** Aset berstatus Rusak atau Pemeliharaan — tidak siap dipakai. */
  perluPerhatian: number;
  nilaiMilikSendiri: number;
  /** Servis yang jatuh tempo dalam 30 hari ke depan, ATAU sudah terlewat. */
  servisDekat: number;
}

/**
 * Angka ringkas seluruh aset.
 *
 * `sekarang` dioper sebagai parameter, bukan diambil dari `Date.now()` di
 * dalam, supaya hasilnya bisa diuji tanpa bergantung pada tanggal berjalan.
 */
export function kpiAset(aset: AsetLike[], sekarang = new Date()): KpiAset {
  const milikSendiri = aset.filter((a) => a.kepemilikan === "Milik Sendiri");
  const ambang = new Date(sekarang.getTime() + 30 * 864e5);

  return {
    jumlahJenis: aset.length,
    milikSendiri: milikSendiri.length,
    sewa: aset.length - milikSendiri.length,
    perluPerhatian: aset.filter((a) => a.status === "Rusak" || a.status === "Pemeliharaan").length,
    nilaiMilikSendiri: milikSendiri.reduce((s, a) => s + (a.nilai ?? 0), 0),
    servisDekat: aset.filter((a) => a.servisBerikut && a.servisBerikut <= ambang).length,
  };
}
