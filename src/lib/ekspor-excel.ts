import ExcelJS from "exceljs";

/**
 * PEMBUAT BERKAS EXCEL — sisi keluar (template & ekspor), pasangan dari
 * `impor-excel.ts` yang membaca berkas masuk.
 *
 * Judul kolomnya sengaja SAMA PERSIS dengan sinonim yang dikenali importir
 * (`KOLOM_BOQ`/`KOLOM_RAP` di `adaptor/tabel-aturan.ts`): apa pun yang diunduh
 * dari sini — template kosong maupun ekspor isi tabel — bisa langsung diisi dan
 * diimpor balik tanpa menyesuaikan header sama sekali.
 *
 * Satu-satunya tempat lain yang menyentuh ExcelJS adalah `impor-excel.ts`.
 */

export interface BarisBoqEks {
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  spesifikasi: string | null;
}

export interface BarisRapEks {
  grup: string;
  nama: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  keterangan: string | null;
}

const HEAD_BOQ = ["Grup", "Uraian Pekerjaan", "Satuan", "Volume", "Harga Satuan", "Spesifikasi"];
const HEAD_RAP = ["Kelompok", "Material", "Satuan", "Volume", "Harga Satuan", "Keterangan"];

/** Header tebal berlatar tipis, plus lebar kolom & format angka yang wajar. */
function rapikan(ws: ExcelJS.Worksheet, lebar: number[]) {
  const kepala = ws.getRow(1);
  kepala.font = { bold: true };
  kepala.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F2" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCBD5D2" } } };
  });
  lebar.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  // Kolom Volume (4) & Harga Satuan (5) diberi format angka ribuan.
  ws.getColumn(4).numFmt = "#,##0.##";
  ws.getColumn(5).numFmt = "#,##0";
}

async function keBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Berkas BOQ/RAB: satu baris judul kolom lalu baris datanya, dikelompokkan lewat kolom Grup. */
export async function excelBoq(namaSheet: string, baris: BarisBoqEks[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(namaSheet.slice(0, 31));
  ws.addRow(HEAD_BOQ);
  for (const b of baris) {
    ws.addRow([b.grup, b.uraian, b.satuan, b.volume, b.hargaSatuan, b.spesifikasi ?? ""]);
  }
  rapikan(ws, [22, 40, 8, 12, 16, 30]);
  return keBuffer(wb);
}

/**
 * Berkas RAP: sama seperti BOQ, ditutup satu baris "Upah" tersendiri — importir
 * mengenali baris ber-nama "Upah" sebagai nilai upah borongan, bukan material.
 */
export async function excelRap(namaSheet: string, baris: BarisRapEks[], upah: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(namaSheet.slice(0, 31));
  ws.addRow(HEAD_RAP);
  for (const b of baris) {
    ws.addRow([b.grup, b.nama, b.satuan, b.volume, b.hargaSatuan, b.keterangan ?? ""]);
  }
  // Baris upah: nama "Upah", nilainya di kolom Harga Satuan.
  ws.addRow(["", "Upah", "", "", upah, "Upah borongan tenaga kerja"]);
  rapikan(ws, [22, 40, 8, 12, 16, 30]);
  return keBuffer(wb);
}

// ---------------------------------------------------------------------------
// Template kosong (dengan contoh) — supaya pengguna melihat pola pengelompokan.
// ---------------------------------------------------------------------------

const CONTOH_BOQ: BarisBoqEks[] = [
  { grup: "Pekerjaan Persiapan", uraian: "Pembersihan lahan", satuan: "m2", volume: 100, hargaSatuan: 15000, spesifikasi: "" },
  { grup: "Pekerjaan Persiapan", uraian: "Bouwplank", satuan: "m1", volume: 40, hargaSatuan: 35000, spesifikasi: "Kayu meranti" },
  { grup: "Pekerjaan Struktur", uraian: "Beton sloof K-225", satuan: "m3", volume: 6, hargaSatuan: 1200000, spesifikasi: "Ready mix" },
];

const CONTOH_RAP: BarisRapEks[] = [
  { grup: "Material Struktur", nama: "Semen PC 50 kg", satuan: "sak", volume: 120, hargaSatuan: 62000, keterangan: "" },
  { grup: "Material Struktur", nama: "Besi beton D10", satuan: "batang", volume: 80, hargaSatuan: 78000, keterangan: "SNI" },
  { grup: "Material Finishing", nama: "Cat tembok interior", satuan: "pail", volume: 8, hargaSatuan: 320000, keterangan: "" },
];

export const excelTemplateBoq = () => excelBoq("Template RAB", CONTOH_BOQ);
export const excelTemplateRap = () => excelRap("Template RAP", CONTOH_RAP, 5000000);

// ---------------------------------------------------------------------------
// Template BOQ penawaran — dikirim ke vendor untuk diisi harga
// ---------------------------------------------------------------------------

export interface BarisTemplatePenawaran {
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
}

/**
 * Template penawaran vendor: daftar pekerjaan dengan kolom Harga Satuan KOSONG
 * untuk diisi vendor, dan kolom Jumlah sebagai formula Volume×Harga.
 *
 * HPS (harga acuan dari RAB) SENGAJA TIDAK disertakan — angka itu rahasia
 * internal dan tak boleh bocor ke vendor. Yang bocor lewat berkas ini hanyalah
 * lingkup pekerjaan dan volumenya.
 */
export async function excelTemplatePenawaran(
  info: { kode: string; pekerjaan: string; proyek: string },
  baris: BarisTemplatePenawaran[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Penawaran ${info.kode}`.slice(0, 31));

  ws.addRow([`FORMULIR PENAWARAN — ${info.kode}`]);
  ws.addRow([`Pekerjaan: ${info.pekerjaan}`]);
  ws.addRow([`Proyek: ${info.proyek}`]);
  ws.addRow(["Isi kolom Harga Satuan. Kolom Jumlah terisi otomatis."]);
  ws.addRow([]);

  const headIdx = ws.rowCount + 1;
  ws.addRow(["Grup", "Uraian Pekerjaan", "Satuan", "Volume", "Harga Satuan", "Jumlah"]);
  for (const b of baris) {
    const r = ws.addRow([b.grup, b.uraian, b.satuan, b.volume, null, null]);
    r.getCell(6).value = { formula: `D${r.number}*E${r.number}` };
  }

  const kepala = ws.getRow(headIdx);
  kepala.font = { bold: true };
  kepala.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F2" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCBD5D2" } } };
  });
  ws.getRow(1).font = { bold: true, size: 13 };
  [22, 40, 8, 12, 16, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(4).numFmt = "#,##0.##";
  ws.getColumn(5).numFmt = "#,##0";
  ws.getColumn(6).numFmt = "#,##0";

  return keBuffer(wb);
}
