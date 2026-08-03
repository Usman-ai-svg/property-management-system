import ExcelJS from "exceljs";
import {
  bacaBoq, bacaRap, GagalImpor, type BarisBoqImpor, type KelompokRapImpor,
  type Sel, type Tabel,
} from "@/lib/adaptor/tabel-aturan";

/**
 * ADAPTOR EXCEL — satu-satunya tempat yang tahu soal pustaka ExcelJS.
 *
 * Tugasnya hanya satu: mengubah berkas .xlsx menjadi kisi nilai biasa. Aturan
 * pembacaannya — pencarian baris judul, sinonim nama kolom, pembacaan angka
 * berformat Indonesia, validasi baris, dan prinsip "impor tidak boleh separuh
 * jadi" — ada di `src/lib/adaptor/tabel-aturan.ts` dan tidak menyentuh pustaka
 * apa pun.
 *
 * Untuk ERP: di sana dipakai SheetJS (xlsx 0.18) di browser. Yang perlu
 * ditulis ulang hanya `kisiDariExcel()` di bawah —
 * `XLSX.utils.sheet_to_json(sheet, { header: 1 })` sudah menghasilkan bentuk
 * `Tabel` yang sama. Seluruh aturannya dipakai ulang apa adanya.
 */

export { GagalImpor, type BarisBoqImpor, type KelompokRapImpor };

/**
 * Ratakan satu sel ExcelJS menjadi nilai biasa.
 *
 * Sel bisa berupa angka, teks, teks berformat (`richText`), atau rumus yang
 * hasilnya tersimpan di `result`. Semua bentuk itu khas ExcelJS; setelah
 * lewat fungsi ini, lapisan aturan tidak perlu tahu apa-apa tentangnya.
 */
function ratakanSel(nilai: ExcelJS.CellValue): Sel {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai === "number") return nilai;
  if (typeof nilai === "string") return nilai;

  if (typeof nilai === "object") {
    const o = nilai as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (typeof o.text === "string") return o.text;
    if (typeof o.result === "number") return o.result;
    if (o.result !== undefined) return String(o.result);
    return null;
  }
  return String(nilai);
}

/** Ubah lembar pertama sebuah berkas .xlsx menjadi kisi baris–kolom. */
async function kisiDariExcel(data: ArrayBuffer): Promise<Tabel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const sheet = wb.worksheets[0];
  if (!sheet) throw new GagalImpor("Berkas tidak memiliki lembar kerja.");

  const tabel: Tabel = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const baris = sheet.getRow(r);
    const isi: Sel[] = [];
    // Sel kosong diisi eksplisit supaya posisi kolom tetap sejajar dengan
    // yang terlihat di Excel — kalau dilewati, kolom bergeser ke kiri.
    baris.eachCell({ includeEmpty: true }, (cell, c) => {
      isi[c - 1] = ratakanSel(cell.value);
    });
    tabel.push(isi);
  }
  return tabel;
}

export async function bacaBoqDariExcel(data: ArrayBuffer): Promise<BarisBoqImpor[]> {
  return bacaBoq(await kisiDariExcel(data));
}

export async function bacaRapDariExcel(
  data: ArrayBuffer,
): Promise<{ kelompok: KelompokRapImpor[]; upah: number | null }> {
  return bacaRap(await kisiDariExcel(data));
}
