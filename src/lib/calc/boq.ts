/**
 * Perhitungan BOQ / RAB / RAP.
 *
 * Semua fungsi di sini murni: input → output, tanpa I/O, tanpa React, tanpa
 * Prisma. Ini disengaja supaya tim ERP bisa membacanya sebagai spesifikasi dan
 * memindahkannya ke bahasa apa pun.
 */

import {
  TEMPLATE_BOQ,
  TEMPLATE_RAP,
  RASIO_RAP_TERHADAP_RAB,
  PORSI_MATERIAL_DALAM_RAP,
} from "../domain/templates";

export interface BarisBoq {
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  spesifikasi?: string | null;
  urutan: number;
}

export interface BarisRap {
  grup: string;
  nama: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  keterangan?: string | null;
  urutan: number;
}

/** Subtotal satu baris. */
export const subtotal = (r: { volume: number; hargaSatuan: number }): number =>
  r.volume * r.hargaSatuan;

/** Jumlahkan subtotal sekumpulan baris. */
export const totalBaris = (rows: { volume: number; hargaSatuan: number }[]): number =>
  rows.reduce((s, r) => s + subtotal(r), 0);

/**
 * Bangkitkan baris BOQ untuk sebuah unit berdasarkan luas bangunannya.
 *
 * Dipakai SEKALI saat unit dibuat. Hasilnya disimpan ke `unit_boq_items`;
 * sesudah itu unit membaca dari database, bukan dari template lagi.
 */
export function buatBoqDariTemplate(luasBangunan: number): BarisBoq[] {
  return TEMPLATE_BOQ.map((t, i) => ({
    grup: t.grup,
    uraian: t.uraian,
    satuan: t.satuan,
    // perM2 = 0 berarti lump sum: volumenya selalu 1, tidak diskalakan.
    volume: t.perM2 === 0 ? 1 : Math.round(luasBangunan * t.perM2 * 10) / 10,
    hargaSatuan: t.hargaSatuan,
    spesifikasi: t.spesifikasi,
    urutan: i,
  }));
}

/** RAB acuan untuk luas bangunan tertentu — dipakai untuk pratinjau sebelum unit dibuat. */
export const rabAcuan = (luasBangunan: number): number =>
  totalBaris(buatBoqDariTemplate(luasBangunan));

/** RAP acuan = 88% dari RAB acuan. */
export const rapAcuan = (luasBangunan: number): number =>
  Math.round(rabAcuan(luasBangunan) * RASIO_RAP_TERHADAP_RAB);

/**
 * Bangkitkan rincian material RAP untuk sebuah unit.
 *
 * Volume mentah dari template dikalibrasi dengan faktor K supaya total material
 * jatuh tepat pada porsi yang ditetapkan (65% dari RAP). Tanpa kalibrasi, total
 * material tidak akan pernah pas terhadap RAP.
 */
export function buatRapDariTemplate(luasBangunan: number): BarisRap[] {
  const mentah = TEMPLATE_RAP.flatMap((g) =>
    g.items.map((it) => ({ grup: g.nama, item: it, volumeMentah: it.perM2 * luasBangunan })),
  );

  const totalMentah = mentah.reduce((s, m) => s + m.volumeMentah * m.item.hargaSatuan, 0);
  if (totalMentah === 0) return [];

  const targetMaterial = rapAcuan(luasBangunan) * PORSI_MATERIAL_DALAM_RAP;
  const K = targetMaterial / totalMentah;

  return mentah.map((m, i) => ({
    grup: m.grup,
    nama: m.item.nama,
    satuan: m.item.satuan,
    volume: Math.round(m.volumeMentah * K * 100) / 100,
    hargaSatuan: m.item.hargaSatuan,
    keterangan: m.item.keterangan ?? null,
    urutan: i,
  }));
}

/** Upah tenaga kerja = RAP acuan dikurangi total material hasil kalibrasi. */
export function hitungUpahRap(luasBangunan: number): number {
  return Math.round(rapAcuan(luasBangunan) - totalBaris(buatRapDariTemplate(luasBangunan)));
}

/**
 * Kelompokkan baris RAP per grup untuk ditampilkan.
 * Urutan grup mengikuti kemunculan pertama, bukan alfabetis.
 */
export function kelompokkanRap<T extends { grup: string; volume: number; hargaSatuan: number }>(
  rows: T[],
): { nama: string; items: T[]; total: number }[] {
  const peta = new Map<string, T[]>();
  for (const r of rows) {
    const list = peta.get(r.grup);
    if (list) list.push(r);
    else peta.set(r.grup, [r]);
  }
  return [...peta.entries()].map(([nama, items]) => ({
    nama,
    items,
    total: totalBaris(items),
  }));
}

/**
 * BOQ standar untuk item sarana/prasarana yang belum punya rincian sendiri.
 * Dipecah proporsional dari nilai RAB-nya.
 */
export function boqSarprasDefault(nama: string, jenis: string, rab: number): BarisBoq[] {
  const porsi: [string, number][] = [
    ["Pek. Persiapan & pengukuran", 0.04],
    [`Pek. Utama ${nama}`, 0.78],
    ["Pek. Finishing & pelengkap", 0.13],
    ["Pek. Pembersihan akhir", 0.05],
  ];
  const spek: Record<string, string> = {
    "Pek. Persiapan & pengukuran": "Pengukuran, bouwplank, mobilisasi alat",
    [`Pek. Utama ${nama}`]: "Pekerjaan pokok sesuai gambar kerja & spesifikasi teknis",
    "Pek. Finishing & pelengkap": "Finishing permukaan, aksesoris & kelengkapan",
    "Pek. Pembersihan akhir": "Pembersihan area & serah terima",
  };
  return porsi.map(([uraian, p], i) => ({
    grup: jenis,
    uraian,
    satuan: "ls",
    volume: 1,
    hargaSatuan: Math.round(rab * p),
    spesifikasi: spek[uraian],
    urutan: i,
  }));
}
