import ExcelJS from "exceljs";

/**
 * Pembacaan tabel BOQ dan RAP dari berkas Excel.
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

/** Judul kolom yang dikenali. Pencocokan tidak peduli huruf besar-kecil. */
const KOLOM_BOQ: Record<string, string[]> = {
  grup: ["grup", "kelompok", "group"],
  uraian: ["uraian", "uraian pekerjaan", "pekerjaan", "deskripsi"],
  satuan: ["satuan", "sat", "unit"],
  volume: ["volume", "vol", "qty", "kuantitas"],
  hargaSatuan: ["harga satuan", "harga", "harga_satuan", "unit price"],
  spesifikasi: ["spesifikasi", "spek", "keterangan teknis"],
};

const KOLOM_RAP: Record<string, string[]> = {
  grup: ["kelompok", "grup", "group"],
  nama: ["material", "nama", "nama material", "uraian"],
  satuan: ["satuan", "sat", "unit"],
  volume: ["volume", "vol", "qty", "kuantitas"],
  hargaSatuan: ["harga", "harga satuan", "harga_satuan"],
  keterangan: ["keterangan", "ket", "catatan"],
};

const normal = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Baca angka dari sel Excel.
 *
 * Sel bisa berisi angka asli, rumus yang sudah dihitung, atau teks berformat
 * Indonesia seperti "1.250.000" — ketiganya harus dibaca benar, karena orang
 * menyusun BOQ di Excel dengan cara yang bermacam-macam.
 */
function angkaSel(nilai: ExcelJS.CellValue): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  if (typeof nilai === "number") return nilai;

  if (typeof nilai === "object" && nilai !== null) {
    // Sel rumus menyimpan hasilnya pada `result`.
    const hasil = (nilai as { result?: unknown }).result;
    if (typeof hasil === "number") return hasil;
    if (typeof hasil === "string") return angkaSel(hasil);
    return null;
  }

  const teks = String(nilai).trim().replace(/^Rp\s*/i, "");
  const bersih = teks.includes(",")
    ? teks.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(teks)
      ? teks.replace(/\./g, "")
      : teks;

  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}

function teksSel(nilai: ExcelJS.CellValue): string {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "object") {
    const o = nilai as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (typeof o.text === "string") return o.text.trim();
    if (o.result !== undefined) return String(o.result).trim();
    return "";
  }
  return String(nilai).trim();
}

/** Cari baris judul dan petakan nama kolom ke nomor kolomnya. */
function petakanKolom(
  sheet: ExcelJS.Worksheet,
  peta: Record<string, string[]>,
  wajib: string[],
): { barisJudul: number; kolom: Record<string, number> } {
  // Judul dicari sampai baris ke-10, karena berkas nyata sering diawali
  // beberapa baris kop atau judul laporan.
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const baris = sheet.getRow(r);
    const kolom: Record<string, number> = {};

    baris.eachCell((cell, c) => {
      const judul = normal(teksSel(cell.value));
      if (!judul) return;
      for (const [field, sinonim] of Object.entries(peta)) {
        if (kolom[field] === undefined && sinonim.includes(judul)) kolom[field] = c;
      }
    });

    if (wajib.every((w) => kolom[w] !== undefined)) return { barisJudul: r, kolom };
  }

  throw new GagalImpor(
    "Baris judul tidak ditemukan pada sepuluh baris pertama.",
    [`Kolom yang wajib ada: ${wajib.join(", ")}.`],
  );
}

export interface BarisBoqImpor {
  grup: string | null;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  spesifikasi: string | null;
}

export async function bacaBoqDariExcel(data: ArrayBuffer): Promise<BarisBoqImpor[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const sheet = wb.worksheets[0];
  if (!sheet) throw new GagalImpor("Berkas tidak memiliki lembar kerja.");

  const { barisJudul, kolom } = petakanKolom(sheet, KOLOM_BOQ, ["uraian", "volume", "hargaSatuan"]);

  const hasil: BarisBoqImpor[] = [];
  const galat: string[] = [];

  for (let r = barisJudul + 1; r <= sheet.rowCount; r++) {
    const baris = sheet.getRow(r);
    const uraian = teksSel(baris.getCell(kolom.uraian).value);

    // Baris kosong dilewati diam-diam; baris total tidak ikut terbawa.
    if (!uraian) continue;
    if (/^(total|jumlah|sub\s*total|grand\s*total)/i.test(uraian)) continue;

    const volume = angkaSel(baris.getCell(kolom.volume).value);
    const harga = angkaSel(baris.getCell(kolom.hargaSatuan).value);

    if (volume === null) galat.push(`Baris ${r}: volume "${teksSel(baris.getCell(kolom.volume).value)}" bukan angka.`);
    else if (volume < 0) galat.push(`Baris ${r}: volume tidak boleh negatif.`);

    if (harga === null) galat.push(`Baris ${r}: harga satuan "${teksSel(baris.getCell(kolom.hargaSatuan).value)}" bukan angka.`);
    else if (harga < 0) galat.push(`Baris ${r}: harga satuan tidak boleh negatif.`);

    if (volume === null || harga === null || volume < 0 || harga < 0) continue;

    hasil.push({
      grup: kolom.grup !== undefined ? teksSel(baris.getCell(kolom.grup).value) || null : null,
      uraian,
      satuan: (kolom.satuan !== undefined ? teksSel(baris.getCell(kolom.satuan).value) : "") || "ls",
      volume,
      hargaSatuan: harga,
      spesifikasi:
        kolom.spesifikasi !== undefined ? teksSel(baris.getCell(kolom.spesifikasi).value) || null : null,
    });
  }

  if (galat.length > 0) {
    throw new GagalImpor(`${galat.length} baris bermasalah — tidak ada yang diimpor.`, galat.slice(0, 15));
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

export async function bacaRapDariExcel(
  data: ArrayBuffer,
): Promise<{ kelompok: KelompokRapImpor[]; upah: number | null }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const sheet = wb.worksheets[0];
  if (!sheet) throw new GagalImpor("Berkas tidak memiliki lembar kerja.");

  const { barisJudul, kolom } = petakanKolom(sheet, KOLOM_RAP, ["nama", "volume", "hargaSatuan"]);

  const peta = new Map<string, KelompokRapImpor>();
  const galat: string[] = [];
  let upah: number | null = null;
  let grupBerjalan = "Lain-lain";

  for (let r = barisJudul + 1; r <= sheet.rowCount; r++) {
    const baris = sheet.getRow(r);
    const nama = teksSel(baris.getCell(kolom.nama).value);
    if (!nama) continue;

    // Baris upah dikenali dari namanya dan diambil sebagai nilai tersendiri.
    if (/upah\s*(tenaga\s*kerja)?/i.test(nama)) {
      const n = angkaSel(baris.getCell(kolom.hargaSatuan).value)
        ?? angkaSel(baris.getCell(kolom.volume).value);
      if (n !== null && n >= 0) upah = n;
      continue;
    }

    if (/^(total|jumlah|sub\s*total|material)/i.test(nama)) continue;

    if (kolom.grup !== undefined) {
      const g = teksSel(baris.getCell(kolom.grup).value);
      if (g) grupBerjalan = g;
    }

    const volume = angkaSel(baris.getCell(kolom.volume).value);
    const harga = angkaSel(baris.getCell(kolom.hargaSatuan).value);

    if (volume === null || volume < 0) {
      galat.push(`Baris ${r}: volume "${teksSel(baris.getCell(kolom.volume).value)}" tidak sah.`);
      continue;
    }
    if (harga === null || harga < 0) {
      galat.push(`Baris ${r}: harga "${teksSel(baris.getCell(kolom.hargaSatuan).value)}" tidak sah.`);
      continue;
    }

    const item = {
      nama,
      satuan: (kolom.satuan !== undefined ? teksSel(baris.getCell(kolom.satuan).value) : "") || "ls",
      volume,
      hargaSatuan: harga,
      keterangan:
        kolom.keterangan !== undefined ? teksSel(baris.getCell(kolom.keterangan).value) || null : null,
    };

    const ada = peta.get(grupBerjalan);
    if (ada) ada.items.push(item);
    else peta.set(grupBerjalan, { nama: grupBerjalan, items: [item] });
  }

  if (galat.length > 0) {
    throw new GagalImpor(`${galat.length} baris bermasalah — tidak ada yang diimpor.`, galat.slice(0, 15));
  }

  const kelompok = [...peta.values()];
  if (kelompok.length === 0) {
    throw new GagalImpor("Tidak ada baris material yang terbaca di bawah baris judul.");
  }

  return { kelompok, upah };
}
