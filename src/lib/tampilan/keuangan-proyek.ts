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
  /**
   * Dipakai HANYA untuk memilah biaya level proyek (alokasi tanpa unit/sarpras)
   * ke sisi unit, sarpras, atau umum. Opsional: tanpa peruntukan → dihitung umum.
   */
  peruntukan?: string;
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
  /** Total biaya yang tidak dibebankan ke unit/sarpras mana pun. */
  levelProyek: number;
  /** Bagian level proyek berperuntukan Unit (belum dialokasi ke unit tertentu). */
  levelUnit: number;
  /** Bagian level proyek berperuntukan Prasarana & Sarana. */
  levelSarpras: number;
  /** Biaya level proyek umum: perijinan & ormas, pengolahan lahan. */
  levelUmum: number;
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
  // Biaya level proyek dipilah menurut peruntukan pengeluarannya: sisi unit,
  // sisi sarpras, atau umum (perijinan & pengolahan lahan yang bukan keduanya).
  let levelUnit = 0;
  let levelSarpras = 0;
  let levelUmum = 0;

  for (const e of pengeluaran) {
    for (const a of e.alokasi) {
      if (a.unitId) {
        perUnit.set(a.unitId, (perUnit.get(a.unitId) ?? 0) + a.nominal);
      } else if (a.infrastructureId) {
        perSarpras.set(
          a.infrastructureId,
          (perSarpras.get(a.infrastructureId) ?? 0) + a.nominal,
        );
      } else if (e.peruntukan === "Prasarana & Sarana") {
        levelSarpras += a.nominal;
      } else if (e.peruntukan === "Unit (rumah dijual)") {
        levelUnit += a.nominal;
      } else {
        levelUmum += a.nominal;
      }
    }
  }

  return {
    perUnit,
    perSarpras,
    levelProyek: levelUnit + levelSarpras + levelUmum,
    levelUnit,
    levelSarpras,
    levelUmum,
  };
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

// ---------------------------------------------------------------------------
// Rakitan angka halaman Keuangan Proyek
//
// Yang di bawah ini bukan rumus baru, melainkan perakitan: "angka apa saja yang
// dibutuhkan layar ini". Sebelumnya dirakit di dalam `page.tsx`, sehingga satu-
// satunya cara menyalinnya ke ERP adalah membaca JSX-nya.
// ---------------------------------------------------------------------------

/** Objek yang punya nilai RAB & RAP (unit atau sarpras, sudah dihitung). */
export interface NilaiObjek {
  rab: number;
  rap: number;
}

/** RAB, RAP, dan realisasi seluruh proyek. */
export interface TotalProyek {
  rab: number;
  rap: number;
  realisasi: number;
}

/**
 * Total RAB & RAP proyek beserta realisasinya.
 *
 * RAB dan RAP mencakup unit (termasuk kerja tambah) DAN sarpras — memakai
 * angka yang sama dengan Master Proyek dan dashboard, supaya nilai proyek tidak
 * berbeda antar halaman. Realisasi adalah seluruh pengeluaran apa adanya, tanpa
 * penyaringan jenis: ini uang yang benar-benar keluar.
 */
export function totalProyek(
  nilaiUnit: NilaiObjek[],
  nilaiSarpras: NilaiObjek[],
  pengeluaran: { total: number }[],
): TotalProyek {
  const jumlah = (xs: NilaiObjek[], ambil: (o: NilaiObjek) => number) =>
    xs.reduce((s, o) => s + ambil(o), 0);
  return {
    rab: jumlah(nilaiUnit, (o) => o.rab) + jumlah(nilaiSarpras, (o) => o.rab),
    rap: jumlah(nilaiUnit, (o) => o.rap) + jumlah(nilaiSarpras, (o) => o.rap),
    realisasi: pengeluaran.reduce((s, e) => s + e.total, 0),
  };
}

/** Satu baris tabel anggaran per kategori RAP. */
export interface BarisAnggaranKategori<K extends string = string> {
  kategori: K;
  rap: number;
  realisasi: number;
}

/**
 * Realisasi swakelola per kategori RAP.
 *
 * Pengeluaran yang jenisnya TIDAK punya padanan kategori RAP sengaja
 * dilewatkan, bukan dimasukkan ke "Lain-lain". Yang terpenting di antaranya
 * "Kontraktor": itu pekerjaan borongan yang tidak pernah masuk basis RAP, dan
 * memasukkannya akan membuat realisasi tampak melampaui anggaran pada proyek
 * yang sebagian besar diborongkan.
 */
export function realisasiPerKategori(
  pengeluaran: { jenis: string; total: number }[],
  kategoriDariJenis: Record<string, string>,
): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const e of pengeluaran) {
    const kategori = kategoriDariJenis[e.jenis];
    if (!kategori) continue;
    hasil[kategori] = (hasil[kategori] ?? 0) + e.total;
  }
  return hasil;
}

/**
 * Susun baris "anggaran vs realisasi" per kategori, urut sesuai daftar kategori.
 *
 * Kategori yang belum ada realisasinya tetap muncul dengan nol — barisnya
 * hilang akan membuat pembaca mengira kategori itu tidak dianggarkan.
 */
export function anggaranPerKategori<K extends string>(
  urutKategori: readonly K[],
  rapPerKategori: Record<K, number>,
  realisasi: Record<string, number>,
): BarisAnggaranKategori<K>[] {
  return urutKategori.map((kategori) => ({
    kategori,
    rap: rapPerKategori[kategori] ?? 0,
    realisasi: realisasi[kategori] ?? 0,
  }));
}

/** Subtotal satu sisi tabel biaya: RAP, biaya langsung, dan alokasi kontrak. */
export interface SubtotalBiaya {
  rap: number;
  langsung: number;
  alokasi: number;
}

/**
 * Subtotal baris SUM tabel biaya per objek.
 *
 * Alokasi kontrak sudah dibagi ke tiap objek sebelum sampai ke sini, jadi yang
 * dijumlahkan adalah bagian tiap objek — BUKAN nilai kontrak utuh. Menjumlahkan
 * nilai kontrak akan menghitung ganda kontrak yang mencakup beberapa objek.
 */
export function subtotalBiaya<T>(
  objek: T[],
  ambilId: (o: T) => string,
  ambilRap: (o: T) => number,
  langsungPerObjek: Map<string, number>,
  alokasiPerObjek: Map<string, number>,
): SubtotalBiaya {
  return objek.reduce<SubtotalBiaya>(
    (a, o) => {
      const id = ambilId(o);
      return {
        rap: a.rap + ambilRap(o),
        langsung: a.langsung + (langsungPerObjek.get(id) ?? 0),
        alokasi: a.alokasi + (alokasiPerObjek.get(id) ?? 0),
      };
    },
    { rap: 0, langsung: 0, alokasi: 0 },
  );
}

/** Total kolom tabel anggaran per kategori, beserta penanda melampaui. */
export function totalAnggaranKategori(baris: BarisAnggaranKategori[]): {
  rap: number;
  realisasi: number;
  melampaui: boolean;
} {
  const rap = baris.reduce((s, d) => s + d.rap, 0);
  const realisasi = baris.reduce((s, d) => s + d.realisasi, 0);
  return { rap, realisasi, melampaui: realisasi > rap };
}

/**
 * Pengeluaran dalam `hari` terakhir terhitung dari `sekarang`.
 *
 * Jendela waktunya dihitung mundur dari waktu yang diberikan, bukan dari
 * `new Date()` di dalam fungsi — supaya bisa diuji dan supaya seluruh angka
 * satu halaman memakai satu titik waktu yang sama.
 */
export function pengeluaranTerakhir(
  pengeluaran: { tanggal: Date; total: number }[],
  hari: number,
  sekarang: Date,
): number {
  const batas = new Date(sekarang.getTime() - hari * 864e5);
  return pengeluaran.filter((e) => e.tanggal >= batas).reduce((s, e) => s + e.total, 0);
}

/** Total sisa seluruh hutang berjalan — angka KPI, bukan rincian. */
export const totalSisaHutang = (hutang: { sisa: number }[]): number =>
  hutang.reduce((s, h) => s + h.sisa, 0);

/** Subtotal satu kelompok baris hutang. */
export interface SubtotalHutang {
  total: number;
  terbayar: number;
  sisa: number;
}

/** Jumlahkan baris hutang untuk baris TOTAL tabelnya. */
export function subtotalHutang(rows: SubtotalHutang[]): SubtotalHutang {
  return {
    total: rows.reduce((s, h) => s + h.total, 0),
    terbayar: rows.reduce((s, h) => s + h.terbayar, 0),
    sisa: rows.reduce((s, h) => s + h.sisa, 0),
  };
}
