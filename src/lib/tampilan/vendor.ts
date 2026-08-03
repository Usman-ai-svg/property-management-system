/**
 * Penyusunan angka halaman Vendor Management.
 *
 * Bebas framework dan bebas Prisma. Satu hal yang mudah salah dipindahkan:
 * "nilai kontrak" selalu berarti **nilai efektif** — nominal awal ditambah
 * VO yang sudah disetujui. Memakai `nominal` mentah akan melaporkan angka
 * yang lebih kecil daripada kewajiban yang sebenarnya.
 */

import { ringkasKontrak, type KontrakLike } from "@/lib/calc/keuangan";

export interface RingkasVendor {
  jumlahKontrak: number;
  proyek: string[];
  nilai: number;
  terbayar: number;
}

/** Ringkas posisi kontrak satu vendor: berapa kontrak, nilai, dan terbayar. */
export function ringkasVendor(
  kontrak: (KontrakLike & { project: { kode: string } })[],
): RingkasVendor {
  const ringkas = kontrak.map(ringkasKontrak);
  return {
    jumlahKontrak: kontrak.length,
    proyek: [...new Set(kontrak.map((k) => k.project.kode))],
    nilai: ringkas.reduce((s, r) => s + r.nilaiEfektif, 0),
    terbayar: ringkas.reduce((s, r) => s + r.terbayar, 0),
  };
}

/** Satu baris tabel vendor: data vendor apa adanya plus ringkasan kontraknya. */
export function susunBarisVendor<
  V extends { contracts: (KontrakLike & { project: { kode: string } })[] },
>(vendor: V[]): (V & RingkasVendor)[] {
  return vendor.map((v) => ({ ...v, ...ringkasVendor(v.contracts) }));
}

export interface KpiVendor {
  jumlahVendor: number;
  vendorAktif: number;
  jumlahKontrak: number;
  /** Kontrak yang belum lunas — terbayar masih di bawah nilai efektif. */
  kontrakBerjalan: number;
  totalNilai: number;
  totalTerbayar: number;
  belumTerbayar: number;
}

/**
 * Angka ringkas seluruh vendor.
 *
 * "Kontrak berjalan" ditentukan dari posisi pembayaran, bukan dari tanggal
 * atau status — kontrak yang pekerjaannya rampung tapi retensinya belum cair
 * tetap merupakan kewajiban yang berjalan.
 */
export function kpiVendor<
  V extends { status: string; contracts: (KontrakLike & { project: { kode: string } })[] },
>(vendor: V[]): KpiVendor {
  const semuaKontrak = vendor.flatMap((v) => v.contracts);
  const ringkas = semuaKontrak.map(ringkasKontrak);

  const totalNilai = ringkas.reduce((s, r) => s + r.nilaiEfektif, 0);
  const totalTerbayar = ringkas.reduce((s, r) => s + r.terbayar, 0);

  return {
    jumlahVendor: vendor.length,
    vendorAktif: vendor.filter((v) => v.status === "Aktif").length,
    jumlahKontrak: semuaKontrak.length,
    kontrakBerjalan: ringkas.filter((r) => r.terbayar < r.nilaiEfektif).length,
    totalNilai,
    totalTerbayar,
    belumTerbayar: totalNilai - totalTerbayar,
  };
}
