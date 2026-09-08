import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  biayaPerolehan,
  totalLandbank,
  totalOmzetRencana,
  kelompokKuartal,
  kuartalPeriode,
  luasTotal,
  rataRasioEfektif,
  ringkasRencana,
  susunBarisLandbank,
  totalKategoriHpp,
  totalKategoriOps,
} from "./landbank";
import { hargaAllIn, hargaPpn } from "../format";

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

describe("totalKategoriHpp", () => {
  it("menjumlahkan volume × harga tiap baris", () => {
    assert.equal(
      totalKategoriHpp([{ volume: 7, harga: 100 }, { volume: 1, harga: 300 }]),
      1000,
    );
  });

  it("nol untuk kategori tanpa baris", () => {
    assert.equal(totalKategoriHpp([]), 0);
  });
});

describe("totalKategoriOps", () => {
  it("menjumlahkan volume × harga tiap baris (ala RAB)", () => {
    assert.equal(
      totalKategoriOps([{ volume: 12, harga: 20 }, { volume: 1, harga: 60 }]),
      300,
    );
  });

  it("nol untuk kategori tanpa baris", () => {
    assert.equal(totalKategoriOps([]), 0);
  });
});

describe("ringkasRencana", () => {
  const bp = {
    // Total omset = Σ harga dasar (non-PPN) seluruh unit.
    omzet: [{ hargaDasar: 1200 }, { hargaDasar: 800 }],
    // HPP = Σ (volume × harga) baris tiap kategori.
    hpp: [{ rows: [{ volume: 1, harga: 500 }, { volume: 1, harga: 300 }] }],
    // Operasional = Σ (volume × harga) baris tiap kategori.
    operasional: [{ rows: [{ volume: 2, harga: 100 }] }, { rows: [{ volume: 1, harga: 100 }] }],
  };

  it("omzet = jumlah harga dasar seluruh unit", () => {
    assert.equal(ringkasRencana(bp).omzet, 2000);
  });

  it("HPP = jumlah volume × harga seluruh baris kategori", () => {
    assert.equal(ringkasRencana(bp).hpp, 800);
  });

  it("laba bersih = omzet dikurangi HPP dan operasional", () => {
    const r = ringkasRencana(bp);
    assert.equal(r.ops, 300);
    assert.equal(r.laba, 900);
  });

  it("margin dihitung terhadap omzet", () => {
    assert.equal(ringkasRencana(bp).margin, 0.45);
  });

  it("margin nol saat omzet nol, bukan Infinity", () => {
    const r = ringkasRencana({ omzet: [], hpp: [{ rows: [{ volume: 1, harga: 500 }] }], operasional: [] });
    assert.equal(r.laba, -500);
    assert.equal(r.margin, 0);
  });

  it("seluruh angka nol bila proyek belum punya business plan", () => {
    const r = ringkasRencana(undefined);
    assert.deepEqual(r, { omzet: 0, hpp: 0, ops: 0, laba: 0, margin: 0 });
  });
});

describe("harga rencana omset", () => {
  it("Harga+PPN menambah 11% ke harga dasar", () => {
    assert.equal(hargaPpn(1_000_000_000), 1_110_000_000);
  });

  it("All-In menambah 10% di atas harga ber-PPN (bertingkat, bukan datar)", () => {
    // (1M × 1,11) × 1,10 = 1,221M — bukan 1M × 1,21.
    assert.equal(hargaAllIn(1_000_000_000), 1_221_000_000);
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
      { projectId: "p1", omzet: [{ hargaDasar: 500 }, { hargaDasar: 500 }], hpp: [], operasional: [] },
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

describe("kuartalPeriode", () => {
  it("memetakan bulan ke kuartal 1..4", () => {
    assert.deepEqual(kuartalPeriode("2025-01"), { tahun: 2025, kuartal: 1 });
    assert.deepEqual(kuartalPeriode("2025-03"), { tahun: 2025, kuartal: 1 });
    assert.deepEqual(kuartalPeriode("2025-04"), { tahun: 2025, kuartal: 2 });
    assert.deepEqual(kuartalPeriode("2025-09"), { tahun: 2025, kuartal: 3 });
    assert.deepEqual(kuartalPeriode("2025-12"), { tahun: 2025, kuartal: 4 });
  });
});

describe("kelompokKuartal", () => {
  const data = [
    { periode: "2025-02", masuk: 100, keluar: 40 }, // Q1 2025
    { periode: "2025-05", masuk: 200, keluar: 250 }, // Q2 2025
    { periode: "2025-06", masuk: 300, keluar: 100 }, // Q2 2025
    { periode: "2026-01", masuk: 500, keluar: 300 }, // Q1 2026
  ];

  it("mengelompokkan per tahun lalu per kuartal", () => {
    const g = kelompokKuartal(data);
    assert.equal(g.length, 2);
    assert.equal(g[0].tahun, 2025);
    assert.deepEqual(g[0].kuartal.map((q) => q.kuartal), [1, 2]);
    assert.equal(g[1].tahun, 2026);
    assert.deepEqual(g[1].kuartal.map((q) => q.kuartal), [1]);
  });

  it("menjumlah subtotal kuartal dari baris di bawahnya", () => {
    const q2 = kelompokKuartal(data)[0].kuartal[1];
    assert.equal(q2.bulan.length, 2);
    assert.equal(q2.masuk, 500);
    assert.equal(q2.keluar, 350);
    assert.equal(q2.net, 150);
  });

  it("subtotal tahun = jumlah kuartalnya", () => {
    const t2025 = kelompokKuartal(data)[0];
    assert.equal(t2025.masuk, 600);
    assert.equal(t2025.keluar, 390);
    assert.equal(t2025.net, 210);
  });

  it("kumulatif net berjalan lintas kuartal & tahun", () => {
    const g = kelompokKuartal(data);
    // 60, lalu 60-50=10, lalu 10+200=210 (akhir 2025), lalu 210+200=410 (2026).
    assert.equal(g[0].kuartal[0].bulan[0].kumulatif, 60);
    assert.equal(g[0].kumulatifAkhir, 210);
    assert.equal(g[1].kumulatifAkhir, 410);
  });

  it("mengurutkan periode kronologis lebih dulu, tak bergantung urutan masukan", () => {
    const acak = [data[3], data[1], data[0], data[2]];
    const g = kelompokKuartal(acak);
    assert.deepEqual(g.map((t) => t.tahun), [2025, 2026]);
    assert.equal(g[0].kumulatifAkhir, 210);
  });
});

describe("totalLandbank", () => {
  const baris = [
    { luasTotal: 12_000, perolehan: 3_000_000_000 },
    { luasTotal: 8_000, perolehan: 1_500_000_000 },
  ];

  it("menjumlahkan luas dan biaya perolehan", () => {
    assert.deepEqual(totalLandbank(baris, true), { luas: 20_000, perolehan: 4_500_000_000 });
  });

  it("tanpa hak harga, perolehan nol tapi luas tetap tampil", () => {
    assert.deepEqual(totalLandbank(baris, false), { luas: 20_000, perolehan: 0 });
  });

  it("landbank kosong bernilai nol", () => {
    assert.deepEqual(totalLandbank([], true), { luas: 0, perolehan: 0 });
  });
});

describe("totalOmzetRencana", () => {
  const ppn = (d: number) => d * 1.11;
  const allIn = (d: number) => ppn(d) * 1.05;
  const omzet = [{ hargaDasar: 400_000_000 }, { hargaDasar: 600_000_000 }];

  it("menjumlahkan tiga tingkat harga dari harga dasar yang sama", () => {
    const t = totalOmzetRencana(omzet, ppn, allIn);
    assert.equal(t.dasar, 1_000_000_000);
    assert.equal(t.ppn, ppn(1_000_000_000));
    assert.ok(t.allIn > t.ppn && t.ppn > t.dasar);
  });

  it("rencana kosong bernilai nol di ketiga tingkat", () => {
    assert.deepEqual(totalOmzetRencana([], ppn, allIn), { dasar: 0, ppn: 0, allIn: 0 });
  });
});
