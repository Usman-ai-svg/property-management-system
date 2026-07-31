import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  biayaPerolehan,
  luasTotal,
  rataRasioEfektif,
  ringkasRencana,
  susunBarisLandbank,
} from "./landbank";

describe("luasTotal", () => {
  it("menjumlahkan kavling, sarana, prasarana, dan RTH", () => {
    assert.equal(
      luasTotal({ luasKavlingEfektif: 1000, luasSarana: 200, luasPrasarana: 300, luasRth: 100 }),
      1600,
    );
  });
});

describe("biayaPerolehan", () => {
  it("menjumlahkan harga beli dan seluruh biaya legal", () => {
    assert.equal(
      biayaPerolehan({
        biayaPembelian: 1000, biayaNotaris: 50, biayaBalikNama: 30, biayaLegalLain: 20,
      }),
      1100,
    );
  });

  it("nol bila kolomnya tidak di-SELECT untuk peran ini", () => {
    // Bukan berarti biayanya nol — berarti peran ini tidak berhak melihatnya.
    assert.equal(biayaPerolehan({}), 0);
  });

  it("mengabaikan kolom yang sebagian saja terisi", () => {
    assert.equal(biayaPerolehan({ biayaPembelian: 500, biayaNotaris: 25 }), 525);
  });
});

describe("ringkasRencana", () => {
  const bp = {
    omzet: [{ jumlah: 10, harga: 100 }, { jumlah: 5, harga: 200 }],
    hpp: [{ nilai: 800 }],
    operasional: [{ nilai: 200 }, { nilai: 100 }],
  };

  it("omzet = jumlah unit dikali harga, dijumlahkan per tipe", () => {
    assert.equal(ringkasRencana(bp).omzet, 2000);
  });

  it("laba bersih = omzet dikurangi HPP dan operasional", () => {
    const r = ringkasRencana(bp);
    assert.equal(r.hpp, 800);
    assert.equal(r.ops, 300);
    assert.equal(r.laba, 900);
  });

  it("margin dihitung terhadap omzet", () => {
    assert.equal(ringkasRencana(bp).margin, 0.45);
  });

  it("margin nol saat omzet nol, bukan Infinity", () => {
    const r = ringkasRencana({ omzet: [], hpp: [{ nilai: 500 }], operasional: [] });
    assert.equal(r.laba, -500);
    assert.equal(r.margin, 0);
  });

  it("seluruh angka nol bila proyek belum punya business plan", () => {
    const r = ringkasRencana(undefined);
    assert.deepEqual(r, { omzet: 0, hpp: 0, ops: 0, laba: 0, margin: 0 });
  });
});

describe("susunBarisLandbank", () => {
  const proyek = [
    {
      id: "p1", luasKavlingEfektif: 700, luasSarana: 100, luasPrasarana: 150, luasRth: 50,
      biayaPembelian: 900, biayaNotaris: 100,
    },
    { id: "p2", luasKavlingEfektif: 500, luasSarana: 250, luasPrasarana: 200, luasRth: 50 },
  ];

  it("menghitung rasio kavling efektif terhadap luas total", () => {
    const [a, b] = susunBarisLandbank(proyek, []);
    assert.equal(a.luasTotal, 1000);
    assert.equal(a.rasioEfektif, 0.7);
    assert.equal(b.rasioEfektif, 0.5);
  });

  it("menandai proyek yang belum punya business plan", () => {
    const baris = susunBarisLandbank(proyek, [
      { projectId: "p1", omzet: [{ jumlah: 2, harga: 500 }], hpp: [], operasional: [] },
    ]);
    assert.equal(baris[0].punyaBp, true);
    assert.equal(baris[0].omzet, 1000);
    assert.equal(baris[1].punyaBp, false);
    assert.equal(baris[1].omzet, 0);
  });

  it("mempertahankan seluruh kolom proyek aslinya", () => {
    const [a] = susunBarisLandbank(proyek, []);
    assert.equal(a.id, "p1");
    assert.equal(a.luasKavlingEfektif, 700);
    assert.equal(a.perolehan, 1000);
  });

  it("rasio nol untuk proyek tanpa luas, bukan NaN", () => {
    const [a] = susunBarisLandbank(
      [{ id: "kosong", luasKavlingEfektif: 0, luasSarana: 0, luasPrasarana: 0, luasRth: 0 }],
      [],
    );
    assert.equal(a.rasioEfektif, 0);
  });
});

describe("rataRasioEfektif", () => {
  it("rata-rata dari rasio tiap proyek, bukan rasio dari total", () => {
    // Proyek besar 50% dan proyek kecil 100% menghasilkan 75%, bukan 55%
    // yang akan keluar bila dihitung dari jumlah luasnya.
    assert.equal(rataRasioEfektif([{ rasioEfektif: 0.5 }, { rasioEfektif: 1 }]), 0.75);
  });

  it("nol untuk daftar kosong, bukan NaN", () => {
    assert.equal(rataRasioEfektif([]), 0);
  });
});
