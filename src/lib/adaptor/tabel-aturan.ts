/**
 * ATURAN PEMBACAAN TABEL BOQ & RAP — bagian yang tidak boleh berubah saat
 * pustaka Excel-nya diganti.
 *
 * Masukannya sudah berbentuk kisi nilai biasa (`Sel[][]`), bukan objek
 * ExcelJS. Dengan begitu berkas ini murni — tanpa `exceljs`, tanpa framework —
 * dan bisa dipakai apa adanya di ERP yang memakai SheetJS.
 *
 * Prinsip yang dipegang: **impor tidak boleh separuh jadi**. Seluruh baris
 * divalidasi lebih dulu; kalau ada satu saja yang tidak sah, tidak ada yang
 * disimpan dan seluruh kesalahannya dilaporkan sekaligus. Impor yang berhenti
 * di tengah meninggalkan tabel dalam keadaan campur aduk yang lebih sulit
 * diperbaiki daripada mengulang dari awal.
 */

export class GagalImpor extends Error {
  constructor(
    message: string,
    /** Daftar kesalahan per baris, supaya bisa diperbaiki sekaligus. */
    readonly rincian: string[] = [],
  ) {
    super(message);
  }
}

/** Satu sel setelah diratakan dari pustaka Excel apa pun. */
export type Sel = string | number | null;

/** Kisi baris–kolom. Baris ke-0 adalah baris pertama berkas. */
export type Tabel = Sel[][];

/** Judul kolom yang dikenali. Pencocokan tidak peduli huruf besar-kecil. */
export const KOLOM_BOQ: Record<string, string[]> = {
  grup: ["grup", "kelompok", "group"],
  uraian: ["uraian", "uraian pekerjaan", "pekerjaan", "deskripsi"],
  satuan: ["satuan", "sat", "unit"],
  volume: ["volume", "vol", "qty", "kuantitas"],
  hargaSatuan: ["harga satuan", "harga", "harga_satuan", "unit price"],
  spesifikasi: ["spesifikasi", "spek", "keterangan teknis"],
};

export const KOLOM_RAP: Record<string, string[]> = {
  grup: ["kelompok", "grup", "group"],
  nama: ["material", "nama", "nama material", "uraian"],
  satuan: ["satuan", "sat", "unit"],
  volume: ["volume", "vol", "qty", "kuantitas"],
  hargaSatuan: ["harga", "harga satuan", "harga_satuan"],
  keterangan: ["keterangan", "ket", "catatan"],
};

const normal = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Baris yang bukan data: total, subtotal, dan sejenisnya. */
const BARIS_JUMLAH = /^(total|jumlah|sub\s*total|grand\s*total)/i;

/**
 * Baca angka dari sebuah sel.
 *
 * Sel bisa berisi angka asli atau teks berformat Indonesia seperti
 * "1.250.000" maupun "1.250,50" — semuanya harus terbaca benar, karena orang
 * menyusun BOQ di Excel dengan cara yang bermacam-macam. Awalan "Rp" ikut
 * dibuang.
 */
export function angkaDari(nilai: Sel): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  if (typeof nilai === "number") return Number.isFinite(nilai) ? nilai : null;

  const teks = String(nilai).trim().replace(/^Rp\s*/i, "");
  const bersih = teks.includes(",")
    ? teks.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(teks)
      ? teks.replace(/\./g, "")
      : teks;

  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}

/** Teks sebuah sel, sudah dipangkas. */
export const teksDari = (nilai: Sel): string =>
  nilai === null || nilai === undefined ? "" : String(nilai).trim();

export interface PetaKolom {
  /** Indeks baris judul, berbasis 0. */
  barisJudul: number;
  /** nama field → indeks kolom, berbasis 0. */
  kolom: Record<string, number>;
}

/**
 * Cari baris judul dan petakan nama kolom ke nomor kolomnya.
 *
 * Judul dicari sampai baris ke-10, karena berkas nyata sering diawali
 * beberapa baris kop atau judul laporan.
 */
export function petakanKolom(
  tabel: Tabel,
  peta: Record<string, string[]>,
  wajib: string[],
): PetaKolom {
  for (let r = 0; r < Math.min(10, tabel.length); r++) {
    const kolom: Record<string, number> = {};
    (tabel[r] ?? []).forEach((sel, c) => {
      const judul = normal(teksDari(sel));
      if (!judul) return;
      for (const [field, sinonim] of Object.entries(peta)) {
        if (kolom[field] === undefined && sinonim.includes(judul)) kolom[field] = c;
      }
    });

    if (wajib.every((w) => kolom[w] !== undefined)) return { barisJudul: r, kolom };
  }

  throw new GagalImpor("Baris judul tidak ditemukan pada sepuluh baris pertama.", [
    `Kolom yang wajib ada: ${wajib.join(", ")}.`,
  ]);
}

export interface BarisBoqImpor {
  grup: string | null;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  spesifikasi: string | null;
}

/** Susun baris BOQ dari kisi. Melempar `GagalImpor` bila ada baris tidak sah. */
export function bacaBoq(tabel: Tabel): BarisBoqImpor[] {
  const { barisJudul, kolom } = petakanKolom(tabel, KOLOM_BOQ, [
    "uraian", "volume", "hargaSatuan",
  ]);

  const hasil: BarisBoqImpor[] = [];
  const galat: string[] = [];
  const sel = (r: number, k: number | undefined): Sel =>
    k === undefined ? null : (tabel[r]?.[k] ?? null);

  for (let r = barisJudul + 1; r < tabel.length; r++) {
    const uraian = teksDari(sel(r, kolom.uraian));

    // Baris kosong dilewati diam-diam; baris total tidak ikut terbawa.
    if (!uraian) continue;
    if (BARIS_JUMLAH.test(uraian)) continue;

    const nomor = r + 1; // nomor baris seperti terlihat di Excel
    const volume = angkaDari(sel(r, kolom.volume));
    const harga = angkaDari(sel(r, kolom.hargaSatuan));

    if (volume === null) {
      galat.push(`Baris ${nomor}: volume "${teksDari(sel(r, kolom.volume))}" bukan angka.`);
    } else if (volume < 0) {
      galat.push(`Baris ${nomor}: volume tidak boleh negatif.`);
    }

    if (harga === null) {
      galat.push(`Baris ${nomor}: harga satuan "${teksDari(sel(r, kolom.hargaSatuan))}" bukan angka.`);
    } else if (harga < 0) {
      galat.push(`Baris ${nomor}: harga satuan tidak boleh negatif.`);
    }

    if (volume === null || harga === null || volume < 0 || harga < 0) continue;

    hasil.push({
      grup: teksDari(sel(r, kolom.grup)) || null,
      uraian,
      satuan: teksDari(sel(r, kolom.satuan)) || "ls",
      volume,
      hargaSatuan: harga,
      spesifikasi: teksDari(sel(r, kolom.spesifikasi)) || null,
    });
  }

  if (galat.length > 0) {
    throw new GagalImpor(
      `${galat.length} baris bermasalah — tidak ada yang diimpor.`,
      galat.slice(0, 15),
    );
  }
  if (hasil.length === 0) {
    throw new GagalImpor("Tidak ada baris data yang terbaca di bawah baris judul.");
  }

  return hasil;
}

export interface KelompokRapImpor {
  nama: string;
  items: {
    nama: string;
    satuan: string;
    volume: number;
    hargaSatuan: number;
    keterangan: string | null;
  }[];
}

/**
 * Susun kelompok RAP dari kisi, beserta nilai upah bila ada.
 *
 * Baris upah dikenali dari namanya dan diambil sebagai nilai tersendiri —
 * bukan sebagai item material — karena upah borongan tidak punya volume dan
 * harga satuan yang berarti.
 */
export function bacaRap(tabel: Tabel): { kelompok: KelompokRapImpor[]; upah: number | null } {
  const { barisJudul, kolom } = petakanKolom(tabel, KOLOM_RAP, [
    "nama", "volume", "hargaSatuan",
  ]);

  const peta = new Map<string, KelompokRapImpor>();
  const galat: string[] = [];
  let upah: number | null = null;
  let grupBerjalan = "Lain-lain";
  const sel = (r: number, k: number | undefined): Sel =>
    k === undefined ? null : (tabel[r]?.[k] ?? null);

  for (let r = barisJudul + 1; r < tabel.length; r++) {
    const nama = teksDari(sel(r, kolom.nama));
    if (!nama) continue;

    if (/upah\s*(tenaga\s*kerja)?/i.test(nama)) {
      const n = angkaDari(sel(r, kolom.hargaSatuan)) ?? angkaDari(sel(r, kolom.volume));
      if (n !== null && n >= 0) upah = n;
      continue;
    }

    if (/^(total|jumlah|sub\s*total|material)/i.test(nama)) continue;

    const g = teksDari(sel(r, kolom.grup));
    if (g) grupBerjalan = g;

    const nomor = r + 1;
    const volume = angkaDari(sel(r, kolom.volume));
    const harga = angkaDari(sel(r, kolom.hargaSatuan));

    if (volume === null || volume < 0) {
      galat.push(`Baris ${nomor}: volume "${teksDari(sel(r, kolom.volume))}" tidak sah.`);
      continue;
    }
    if (harga === null || harga < 0) {
      galat.push(`Baris ${nomor}: harga "${teksDari(sel(r, kolom.hargaSatuan))}" tidak sah.`);
      continue;
    }

    const item = {
      nama,
      satuan: teksDari(sel(r, kolom.satuan)) || "ls",
      volume,
      hargaSatuan: harga,
      keterangan: teksDari(sel(r, kolom.keterangan)) || null,
    };

    const ada = peta.get(grupBerjalan);
    if (ada) ada.items.push(item);
    else peta.set(grupBerjalan, { nama: grupBerjalan, items: [item] });
  }

  if (galat.length > 0) {
    throw new GagalImpor(
      `${galat.length} baris bermasalah — tidak ada yang diimpor.`,
      galat.slice(0, 15),
    );
  }

  const kelompok = [...peta.values()];
  if (kelompok.length === 0) {
    throw new GagalImpor("Tidak ada baris material yang terbaca di bawah baris judul.");
  }

  return { kelompok, upah };
}
