import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { luasBersertifikat, totalKolomRabRap, totalRabRap } from "./master";

const unit = [{ rab: 500, rap: 440 }, { rab: 300, rap: 260 }];
const sarpras = [{ rab: 200, rap: 180 }];

describe("totalRabRap", () => {
  it("memisahkan total unit dan sarpras, lalu menjumlahkannya", () => {
    const t = totalRabRap(unit, sarpras, true);
    assert.equal(t.rabUnit, 800);
    assert.equal(t.rabSarpras, 200);
    assert.equal(t.rab, 1000);
    assert.equal(t.rap, 880);
  });

  it("peran tanpa hak harga mendapat NOL, bukan angka yang disembunyikan", () => {
    // Kolom yang tidak boleh dilihat tidak boleh sampai ke browser sama sekali.
    assert.deepEqual(totalRabRap(unit, sarpras, false), {
      rabUnit: 0, rapUnit: 0, rabSarpras: 0, rapSarpras: 0, rab: 0, rap: 0,
    });
  });

  it("proyek kosong menghasilkan nol", () => {
    assert.equal(totalRabRap([], [], true).rab, 0);
  });

  it("proyek tanpa sarpras tetap menghitung unitnya", () => {
    assert.equal(totalRabRap(unit, [], true).rab, 800);
  });
});

describe("totalKolomRabRap", () => {
  it("menjumlahkan kolom RAB dan RAP", () => {
    assert.deepEqual(totalKolomRabRap([{ rab: 10, rap: 8 }, { rab: 5, rap: 4 }]), { rab: 15, rap: 12 });
  });

  it("baris yang nilainya belum terisi dihitung nol, tidak menghilangkan total", () => {
    assert.deepEqual(totalKolomRabRap([{ rab: 10, rap: 8 }, {}, { rab: null, rap: null }]), {
      rab: 10, rap: 8,
    });
  });

  it("tabel kosong menghasilkan nol", () => {
    assert.deepEqual(totalKolomRabRap([]), { rab: 0, rap: 0 });
  });
});

describe("luasBersertifikat", () => {
  it("menjumlahkan luas seluruh legalitas", () => {
    assert.equal(luasBersertifikat([{ luas: 1200 }, { luas: 800 }]), 2000);
  });

  it("legalitas tanpa luas dihitung nol", () => {
    assert.equal(luasBersertifikat([{ luas: 1200 }, {}, { luas: null }]), 1200);
  });

  it("tanpa legalitas sama sekali bernilai nol", () => {
    assert.equal(luasBersertifikat([]), 0);
  });
});
