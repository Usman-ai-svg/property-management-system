import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hargaSatuanDb, rekapAnalisaDb, ringkasEstimasi, type AnalisaDb } from "./estimasi";

/** Analisa contoh dalam bentuk basis data (komponen menunjuk harga dasar). */
const GALIAN: AnalisaDb = {
  overheadPct: 13,
  komponen: [
    { koefisien: 0.75, hargaDasar: { kategori: "UPAH", hargaAcuan: 110_000 } },
    { koefisien: 0.025, hargaDasar: { kategori: "UPAH", hargaAcuan: 180_000 } },
  ],
};

describe("hargaSatuanDb", () => {
  it("memetakan bentuk basis data ke mesin hitung dan membulatkan", () => {
    // (0,75×110.000 + 0,025×180.000) = 87.000; ×1,13 = 98.310
    assert.equal(hargaSatuanDb(GALIAN), 98_310);
  });
});

describe("rekapAnalisaDb", () => {
  it("mengembalikan rincian upah/bahan/alat", () => {
    const r = rekapAnalisaDb(GALIAN);
    assert.equal(r.upah, 87_000);
    assert.equal(r.bahan, 0);
    assert.equal(r.alat, 0);
    assert.equal(r.hargaSatuan, 98_310);
  });

  it("mengelompokkan komponen sesuai kategori harga dasarnya", () => {
    const a: AnalisaDb = {
      overheadPct: 0,
      komponen: [
        { koefisien: 1, hargaDasar: { kategori: "BAHAN", hargaAcuan: 100 } },
        { koefisien: 2, hargaDasar: { kategori: "ALAT", hargaAcuan: 50 } },
      ],
    };
    const r = rekapAnalisaDb(a);
    assert.equal(r.bahan, 100);
    assert.equal(r.alat, 100);
    assert.equal(r.hargaSatuan, 200);
  });
});

describe("ringkasEstimasi", () => {
  it("mengelompokkan per grup dan menjumlah grand total", () => {
    const { grup, total } = ringkasEstimasi([
      { grup: "Tanah", uraian: "galian", volume: 45, hargaSatuan: 98_310 },
      { grup: "Struktur", uraian: "pondasi", volume: 22, hargaSatuan: 1_259_442 },
      { grup: "Tanah", uraian: "urugan", volume: 10, hargaSatuan: 30_000 },
    ]);
    assert.deepEqual(grup.map((g) => g.nama), ["Tanah", "Struktur"]);
    assert.equal(grup[0].items.length, 2);
    assert.equal(grup[0].total, 45 * 98_310 + 10 * 30_000);
    assert.equal(total, 45 * 98_310 + 22 * 1_259_442 + 10 * 30_000);
  });

  it("estimasi kosong menghasilkan total nol", () => {
    const { grup, total } = ringkasEstimasi([]);
    assert.deepEqual(grup, []);
    assert.equal(total, 0);
  });
});
