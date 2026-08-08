import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hargaTerendah, nilaiHpsBaris, nilaiMenangBaris, rekapPemenang, rekapVendor,
  susunPerbandingan, totalHps,
} from "./tender";

/**
 * Skenario nyata: tender "tambah area laundry" dengan pekerjaan Sipil & Kanopi,
 * masing-masing ditawar dua vendor (kebijakan ≥2 pembanding). Pemenang
 * ditetapkan per baris — baris Sipil bisa jatuh ke vendor berbeda, dan satu
 * baris Kanopi sengaja dibiarkan belum diputus. Angka dihitung ulang dengan
 * tangan di komentar sebagai pembanding independen.
 */
const A = "vendorSipilA";
const B = "vendorSipilB";
const X = "vendorKanopiX";
const Y = "vendorKanopiY";

const ITEMS = [
  {
    id: "b1", grup: "Sipil", volume: 20, hpsHargaSatuan: 500_000,
    pemenangVendorId: A,
    bids: [{ vendorId: A, hargaSatuan: 480_000 }, { vendorId: B, hargaSatuan: 510_000 }],
  },
  {
    id: "b2", grup: "Sipil", volume: 5, hpsHargaSatuan: 200_000,
    pemenangVendorId: B, // override: pemenang beda vendor dalam grup yang sama
    bids: [{ vendorId: A, hargaSatuan: 210_000 }, { vendorId: B, hargaSatuan: 190_000 }],
  },
  {
    id: "b3", grup: "Kanopi", volume: 30, hpsHargaSatuan: 300_000,
    pemenangVendorId: X,
    bids: [{ vendorId: X, hargaSatuan: 290_000 }, { vendorId: Y, hargaSatuan: 305_000 }],
  },
  {
    id: "b4", grup: "Kanopi", volume: 10, hpsHargaSatuan: 150_000,
    pemenangVendorId: null, // belum ditetapkan
    bids: [{ vendorId: X, hargaSatuan: 160_000 }],
  },
];
const VENDORS = [A, B, X, Y];

describe("nilaiHpsBaris & totalHps", () => {
  it("HPS baris = volume × harga satuan acuan", () => {
    assert.equal(nilaiHpsBaris(ITEMS[0]), 10_000_000);
  });
  it("total HPS menjumlah seluruh baris", () => {
    assert.equal(totalHps(ITEMS), 21_500_000); // 10jt + 1jt + 9jt + 1,5jt
  });
});

describe("hargaTerendah", () => {
  it("mengambil harga satuan terendah antar bid", () => {
    assert.equal(hargaTerendah(ITEMS[0]), 480_000);
  });
  it("null bila belum ada penawaran", () => {
    assert.equal(hargaTerendah({ bids: [] }), null);
  });
});

describe("nilaiMenangBaris", () => {
  it("nilai pemenang = volume × harga tawaran vendor pemenang", () => {
    assert.equal(nilaiMenangBaris(ITEMS[0]), 9_600_000); // 20 × 480.000
    assert.equal(nilaiMenangBaris(ITEMS[1]), 950_000);   // 5 × 190.000
  });
  it("null bila belum ada pemenang", () => {
    assert.equal(nilaiMenangBaris(ITEMS[3]), null);
  });
  it("null bila pemenang ditetapkan tanpa bid yang cocok (anomali)", () => {
    assert.equal(
      nilaiMenangBaris({ volume: 1, hpsHargaSatuan: 1, pemenangVendorId: "hantu", bids: [] }),
      null,
    );
  });
});

describe("susunPerbandingan", () => {
  const matriks = susunPerbandingan(ITEMS, VENDORS);

  it("membawa serta baris asli & sejumlah kolom sama dengan vendor", () => {
    assert.equal(matriks.length, 4);
    assert.equal(matriks[0].baris.id, "b1");
    assert.equal(matriks[0].sel.length, VENDORS.length);
  });

  it("mengisi null untuk vendor yang tak menawar baris itu", () => {
    // Baris Sipil (b1): X & Y tak menawar → dua sel terakhir null.
    assert.equal(matriks[0].sel[2], null);
    assert.equal(matriks[0].sel[3], null);
  });

  it("menghitung nilai & selisih terhadap HPS", () => {
    const selA = matriks[0].sel[0]!;
    assert.equal(selA.nilai, 9_600_000);
    assert.equal(selA.selisihHps, -400_000); // di bawah HPS
    const selB = matriks[0].sel[1]!;
    assert.equal(selB.selisihHps, 200_000); // di atas HPS
  });

  it("menandai harga satuan terendah pada tiap baris", () => {
    assert.equal(matriks[0].sel[0]!.terendah, true);  // A 480rb terendah
    assert.equal(matriks[0].sel[1]!.terendah, false); // B 510rb
  });
});

describe("rekapVendor", () => {
  const rekap = rekapVendor(ITEMS, VENDORS);
  const byId = (v: string) => rekap.find((r) => r.vendorId === v)!;

  it("menjumlah seluruh tawaran vendor lintas baris yang ia tawar", () => {
    // A: b1 9,6jt + b2 (5×210rb=1,05jt) = 10,65jt atas 2 baris
    assert.equal(byId(A).jumlahBarisDitawar, 2);
    assert.equal(byId(A).totalTawaran, 10_650_000);
  });

  it("menghitung baris & total yang dimenangkan tiap vendor", () => {
    assert.equal(byId(A).jumlahBarisMenang, 1);
    assert.equal(byId(A).totalMenang, 9_600_000);
    assert.equal(byId(B).totalMenang, 950_000);
    assert.equal(byId(X).totalMenang, 8_700_000);
    assert.equal(byId(Y).jumlahBarisMenang, 0);
    assert.equal(byId(Y).totalMenang, 0);
  });
});

describe("rekapPemenang", () => {
  const r = rekapPemenang(ITEMS);

  it("menjumlah nilai baris yang sudah berpemenang", () => {
    assert.equal(r.totalDimenangkan, 19_250_000); // 9,6jt + 0,95jt + 8,7jt
  });
  it("menghitung baris yang belum ditetapkan", () => {
    assert.equal(r.barisBelumDitetapkan, 1);
  });
  it("penghematan = Σ(HPS − menang) atas baris yang diputus saja", () => {
    assert.equal(r.hematVsHps, 750_000); // 400rb + 50rb + 300rb
  });
  it("meringkas per vendor pemenang", () => {
    assert.equal(r.perVendor.length, 3); // A, B, X (Y tak menang, b4 belum diputus)
    const a = r.perVendor.find((v) => v.vendorId === A)!;
    assert.equal(a.jumlahBaris, 1);
    assert.equal(a.total, 9_600_000);
  });
  it("tetap melaporkan total HPS penuh termasuk baris belum diputus", () => {
    assert.equal(r.totalHps, 21_500_000);
  });
});
