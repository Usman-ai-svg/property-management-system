/**
 * Penyusunan angka halaman Keuangan Proyek.
 *
 * Bebas framework dan bebas Prisma: masuk data mentah, keluar angka siap
 * gambar. Halaman tinggal menggambar hasilnya.
 *
 * Inilah yang membuat penulisan ulang tampilan ke ERP menjadi pekerjaan
 * mekanis, bukan berisiko — aturan pembagian biaya di bawah ini tidak ikut
 * ditulis ulang, hanya dipanggil.
 */

import { alokasiKontrak, ringkasKontrak, type KontrakLike } from "@/lib/calc/keuangan";

export interface KontrakUnitLike extends KontrakLike {
  units: { unitId: string; nilaiOverride?: number | null }[];
}

export interface KontrakSarprasLike extends KontrakLike {
  infrastructures: { infrastructureId: string; nilaiOverride?: number | null }[];
}

export interface AlokasiLike {
  unitId: string | null;
  infrastructureId: string | null;
  nominal: number;
}

export interface PengeluaranLike {
  total: number;
  alokasi: AlokasiLike[];
}

/**
 * Bagian sebuah unit dari kontrak borongan yang SUDAH terbayar.
 *
 * Dua langkah yang mudah tertukar: `alokasiKontrak` membagi NILAI kontrak ke
 * tiap unit, lalu hasilnya dikalikan porsi yang sudah dibayar. Membalik
 * urutannya — membagi yang terbayar — menghasilkan angka berbeda ketika
 * sebuah unit punya `nilaiOverride`.
 */
export function alokasiKontrakTerbayar<T extends { unitId: string; nilaiOverride?: number | null }>(
  kontrak: (KontrakLike & { units: T[] })[],
): Map<string, number> {
  const peta = new Map<string, number>();
  for (const k of kontrak) {
    const r = ringkasKontrak(k);
    const porsiTerbayar = r.nilaiEfektif ? r.terbayar / r.nilaiEfektif : 0;
    for (const a of alokasiKontrak(r.nilaiEfektif, k.units)) {
      peta.set(a.unitId, (peta.get(a.unitId) ?? 0) + a.alokasi * porsiTerbayar);
    }
  }
  return peta;
}

/** Versi sarpras dari `alokasiKontrakTerbayar`, dihitung dengan cara yang sama. */
export function alokasiKontrakSarprasTerbayar<
  T extends { infrastructureId: string; nilaiOverride?: number | null },
>(kontrak: (KontrakLike & { infrastructures: T[] })[]): Map<string, number> {
  const peta = new Map<string, number>();
  for (const k of kontrak) {
    const r = ringkasKontrak(k);
    const porsiTerbayar = r.nilaiEfektif ? r.terbayar / r.nilaiEfektif : 0;
    for (const a of alokasiKontrak(r.nilaiEfektif, k.infrastructures)) {
      peta.set(
        a.infrastructureId,
        (peta.get(a.infrastructureId) ?? 0) + a.alokasi * porsiTerbayar,
      );
    }
  }
  return peta;
}

export interface BiayaLangsung {
  perUnit: Map<string, number>;
  perSarpras: Map<string, number>;
  /** Biaya yang tidak dibebankan ke unit mana pun: perijinan, pengolahan lahan. */
  levelProyek: number;
}

/**
 * Bagi pengeluaran ke unit, sarpras, dan level proyek.
 *
 * Dijumlahkan dari baris ALOKASI, bukan dari `Expense.total` — satu
 * pembayaran boleh menanggung beberapa unit sekaligus. Memakai totalnya akan
 * menghitung transfer yang sama berkali-kali.
 */
export function biayaLangsung(pengeluaran: PengeluaranLike[]): BiayaLangsung {
  const perUnit = new Map<string, number>();
  const perSarpras = new Map<string, number>();
  let levelProyek = 0;

  for (const e of pengeluaran) {
    for (const a of e.alokasi) {
      if (a.unitId) {
        perUnit.set(a.unitId, (perUnit.get(a.unitId) ?? 0) + a.nominal);
      } else if (a.infrastructureId) {
        perSarpras.set(
          a.infrastructureId,
          (perSarpras.get(a.infrastructureId) ?? 0) + a.nominal,
        );
      } else {
        levelProyek += a.nominal;
      }
    }
  }

  return { perUnit, perSarpras, levelProyek };
}

/**
 * Transaksi yang punya alokasi ke sebuah unit atau item sarpras.
 *
 * `nominalDibebankan` adalah bagian transaksi itu untuk objek yang diminta —
 * bukan total transaksinya. `jumlahTujuan` menunjukkan transaksi itu terbagi
 * ke berapa objek, supaya pembaca tahu angka yang dilihatnya sebagian.
 */
export function transaksiUntukObjek<T extends PengeluaranLike>(
  pengeluaran: T[],
  kunci: { unitId?: string; sarprasId?: string },
): (T & { nominalDibebankan: number; jumlahTujuan: number })[] {
  return pengeluaran
    .map((e) => {
      const a = e.alokasi.find((x) =>
        kunci.unitId ? x.unitId === kunci.unitId : x.infrastructureId === kunci.sarprasId,
      );
      return a ? { ...e, nominalDibebankan: a.nominal, jumlahTujuan: e.alokasi.length } : null;
    })
    .filter((x): x is T & { nominalDibebankan: number; jumlahTujuan: number } => x !== null);
}

/**
 * Komposisi biaya sebuah objek per jenis, hanya jenis yang benar-benar terpakai.
 *
 * Dihitung dari `nominalDibebankan` — bagian transaksi untuk objek ini, bukan
 * total transaksinya. Blok ini tampil dua kali di halaman (rincian unit dan
 * rincian sarpras); disatukan supaya keduanya tidak bisa bergeser sendiri.
 */
export function komposisiObjek(
  transaksi: { jenis: string; nominalDibebankan: number }[],
  urutanJenis: string[],
): { jenis: string; nilai: number }[] {
  return urutanJenis
    .map((j) => ({
      jenis: j,
      nilai: transaksi
        .filter((e) => e.jenis === j)
        .reduce((s, e) => s + e.nominalDibebankan, 0),
    }))
    .filter((x) => x.nilai > 0)
    .sort((a, b) => b.nilai - a.nilai);
}

/** Total yang dibebankan ke sebuah objek dari daftar transaksinya. */
export const totalDibebankan = (
  transaksi: { nominalDibebankan: number }[],
): number => transaksi.reduce((s, e) => s + e.nominalDibebankan, 0);
