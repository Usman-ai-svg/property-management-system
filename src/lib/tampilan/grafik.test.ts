import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pembagiProporsi, porsiPotongan } from "./grafik";

describe("pembagiProporsi", () => {
  it("menjumlahkan seluruh nilai", () => {
    assert.equal(pembagiProporsi([{ nilai: 30 }, { nilai: 70 }]), 100);
  });

  it("data kosong menghasilkan 1, supaya pembagian tidak jadi NaN", () => {
    assert.equal(pembagiProporsi([]), 1);
  });

  it("seluruh nilai nol juga menghasilkan 1", () => {
    // Grafik tergambar kosong, bukan hilang sama sekali.
    assert.equal(pembagiProporsi([{ nilai: 0 }, { nilai: 0 }]), 1);
  });
});

describe("porsiPotongan", () => {
  it("mengembalikan pecahan terhadap pembaginya", () => {
    assert.equal(porsiPotongan(25, 100), 0.25);
  });

  it("pembagi nol menghasilkan nol, bukan Infinity", () => {
    assert.equal(porsiPotongan(25, 0), 0);
  });
});
