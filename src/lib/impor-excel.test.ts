import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { bacaBoqDariExcel, bacaRapDariExcel, GagalImpor } from "./impor-excel";

/**
 * Berkas uji dibangun di memori, bukan disimpan sebagai lampiran biner.
 * Isinya jadi terbaca langsung dari berkas uji ini, dan tidak ada berkas
 * .xlsx yang harus ikut dirawat di dalam repositori.
 */
async function buatBerkas(baris: unknown[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  for (const b of baris) sheet.addRow(b as ExcelJS.CellValue[]);
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

/** Menjalankan pembacaan dan mengembalikan galatnya, bukan melemparkannya. */
async function galatDari(jalan: () => Promise<unknown>): Promise<GagalImpor> {
  try {
    await jalan();
  } catch (e) {
    assert.ok(e instanceof GagalImpor, `galat bukan GagalImpor: ${e}`);
    return e;
  }
  assert.fail("seharusnya gagal, tapi berhasil");
}

describe("bacaBoqDariExcel", () => {
  it("membaca baris lengkap beserta grup dan spesifikasinya", async () => {
    const berkas = await buatBerkas([
      ["Grup", "Uraian Pekerjaan", "Satuan", "Volume", "Harga Satuan", "Spesifikasi"],
      ["Struktur", "Pondasi batu kali", "m3", 24, 950_000, "Batu belah 15/20"],
      ["Arsitektur", "Keramik lantai", "m2", 96, 285_000, "60x60 Granito"],
    ]);

    const hasil = await bacaBoqDariExcel(berkas);

    assert.equal(hasil.length, 2);
    assert.deepEqual(hasil[0], {
      grup: "Struktur",
      uraian: "Pondasi batu kali",
      satuan: "m3",
      volume: 24,
      hargaSatuan: 950_000,
      spesifikasi: "Batu belah 15/20",
    });
    assert.equal(hasil[1].hargaSatuan, 285_000);
  });

  it("menemukan baris judul walau berkas diawali beberapa baris kop", async () => {
    const berkas = await buatBerkas([
      ["PT NANOLAND SEJAHTERA"],
      ["Bill of Quantity — Unit NT4-F1-1"],
      [],
      ["Uraian", "Sat", "Vol", "Harga"],
      ["Pekerjaan tanah", "m3", 12, 185_000],
    ]);

    const hasil = await bacaBoqDariExcel(berkas);
    assert.equal(hasil.length, 1);
    assert.equal(hasil[0].uraian, "Pekerjaan tanah");
    assert.equal(hasil[0].satuan, "m3");
  });

  it("menerima sinonim judul kolom", async () => {
    const berkas = await buatBerkas([
      ["Deskripsi", "Unit", "Qty", "Unit Price"],
      ["Plesteran dinding", "m2", 140, 78_000],
    ]);

    const hasil = await bacaBoqDariExcel(berkas);
    assert.equal(hasil[0].volume, 140);
    assert.equal(hasil[0].hargaSatuan, 78_000);
  });

  it("membaca angka berformat Indonesia dan berawalan Rp", async () => {
    const berkas = await buatBerkas([
      ["Uraian", "Satuan", "Volume", "Harga Satuan"],
      ["Kusen aluminium", "m1", "12,5", "Rp 1.250.000"],
    ]);

    const hasil = await bacaBoqDariExcel(berkas);
    assert.equal(hasil[0].volume, 12.5);
    assert.equal(hasil[0].hargaSatuan, 1_250_000);
  });

  it("melewati baris total dan baris kosong tanpa mengeluh", async () => {
    const berkas = await buatBerkas([
      ["Uraian", "Satuan", "Volume", "Harga Satuan"],
      ["Atap baja ringan", "m2", 80, 210_000],
      [],
      ["Sub Total", "", "", 16_800_000],
      ["TOTAL RAB", "", "", 16_800_000],
    ]);

    const hasil = await bacaBoqDariExcel(berkas);
    assert.equal(hasil.length, 1);
    assert.equal(hasil[0].uraian, "Atap baja ringan");
  });

  it("mengisi satuan bawaan bila kolom satuan tidak ada", async () => {
    const berkas = await buatBerkas([
      ["Uraian", "Volume", "Harga Satuan"],
      ["Pekerjaan persiapan", 1, 8_500_000],
    ]);

    const hasil = await bacaBoqDariExcel(berkas);
    assert.equal(hasil[0].satuan, "ls");
    assert.equal(hasil[0].grup, null);
    assert.equal(hasil[0].spesifikasi, null);
  });

  it("melaporkan seluruh baris bermasalah sekaligus dan tidak mengimpor apa pun", async () => {
    const berkas = await buatBerkas([
      ["Uraian", "Satuan", "Volume", "Harga Satuan"],
      ["Baris benar", "m2", 10, 100_000],
      ["Volume bukan angka", "m2", "dua puluh", 100_000],
      ["Harga negatif", "m2", 5, -1],
    ]);

    const galat = await galatDari(() => bacaBoqDariExcel(berkas));
    assert.match(galat.message, /2 baris bermasalah/);
    assert.equal(galat.rincian.length, 2);
    assert.match(galat.rincian[0], /Baris 3/);
    assert.match(galat.rincian[1], /Baris 4/);
  });

  it("menolak berkas tanpa baris judul yang dikenali", async () => {
    const berkas = await buatBerkas([
      ["Kolom A", "Kolom B"],
      ["isi", "isi"],
    ]);

    const galat = await galatDari(() => bacaBoqDariExcel(berkas));
    assert.match(galat.message, /Baris judul tidak ditemukan/);
  });

  it("menolak berkas yang judulnya ada tapi tanpa satu pun baris data", async () => {
    const berkas = await buatBerkas([["Uraian", "Volume", "Harga Satuan"]]);

    const galat = await galatDari(() => bacaBoqDariExcel(berkas));
    assert.match(galat.message, /Tidak ada baris data/);
  });
});

describe("bacaRapDariExcel", () => {
  it("mengelompokkan material menurut kolom kelompok", async () => {
    const berkas = await buatBerkas([
      ["Kelompok", "Material", "Satuan", "Volume", "Harga"],
      ["Struktur", "Semen PCC 50kg", "sak", 180, 62_000],
      ["Struktur", "Besi ulir D13", "btg", 96, 128_000],
      ["Finishing", "Cat tembok", "pail", 8, 780_000],
    ]);

    const { kelompok, upah } = await bacaRapDariExcel(berkas);

    assert.equal(kelompok.length, 2);
    assert.equal(kelompok[0].nama, "Struktur");
    assert.equal(kelompok[0].items.length, 2);
    assert.equal(kelompok[1].nama, "Finishing");
    assert.equal(kelompok[1].items[0].hargaSatuan, 780_000);
    assert.equal(upah, null);
  });

  it("meneruskan kelompok terakhir ketika selnya dikosongkan", async () => {
    const berkas = await buatBerkas([
      ["Kelompok", "Material", "Satuan", "Volume", "Harga"],
      ["Struktur", "Semen PCC 50kg", "sak", 180, 62_000],
      ["", "Pasir beton", "m3", 14, 320_000],
    ]);

    const { kelompok } = await bacaRapDariExcel(berkas);
    assert.equal(kelompok.length, 1);
    assert.equal(kelompok[0].items.length, 2);
    assert.equal(kelompok[0].items[1].nama, "Pasir beton");
  });

  it("mengambil baris upah sebagai nilai tersendiri, bukan sebagai material", async () => {
    const berkas = await buatBerkas([
      ["Kelompok", "Material", "Satuan", "Volume", "Harga"],
      ["Struktur", "Semen PCC 50kg", "sak", 180, 62_000],
      ["", "Upah tenaga kerja", "ls", 1, 84_000_000],
    ]);

    const { kelompok, upah } = await bacaRapDariExcel(berkas);
    assert.equal(upah, 84_000_000);
    assert.equal(kelompok[0].items.length, 1);
    assert.equal(kelompok[0].items[0].nama, "Semen PCC 50kg");
  });

  it("menaruh material tanpa kolom kelompok ke dalam satu kelompok Lain-lain", async () => {
    const berkas = await buatBerkas([
      ["Nama", "Satuan", "Volume", "Harga"],
      ["Bata ringan", "m3", 22, 850_000],
    ]);

    const { kelompok } = await bacaRapDariExcel(berkas);
    assert.equal(kelompok.length, 1);
    assert.equal(kelompok[0].nama, "Lain-lain");
  });

  it("melaporkan seluruh baris bermasalah sekaligus", async () => {
    const berkas = await buatBerkas([
      ["Kelompok", "Material", "Satuan", "Volume", "Harga"],
      ["Struktur", "Semen PCC 50kg", "sak", 180, 62_000],
      ["Struktur", "Besi ulir D13", "btg", "sembilan", 128_000],
      ["Finishing", "Cat tembok", "pail", 8, "gratis"],
    ]);

    const galat = await galatDari(() => bacaRapDariExcel(berkas));
    assert.match(galat.message, /2 baris bermasalah/);
    assert.equal(galat.rincian.length, 2);
  });
});
