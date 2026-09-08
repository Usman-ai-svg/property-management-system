import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { cacahMelampaui, kpiPlanRealisasi, TOLERANSI_SERAPAN, warnaSerapan } from "./plan-realisasi";

describe("kpiPlanRealisasi", () => {
  const sales = [
    { target: 500, real: 500, akad: true },
    { target: 500, real: 300, akad: false },
    { target: 400, real: 400, akad: true },
  ];

  it("target dihitung dari SELURUH baris, termasuk yang belum akad", () => {
    assert.equal(kpiPlanRealisasi(sales, [], 0.5).targetJual, 1400);
  });

  it("realisasi hanya dari yang sudah akad — booking belum uang", () => {
    const k = kpiPlanRealisasi(sales, [], 0.5);
    assert.equal(k.realJual, 900);
    assert.equal(k.terjual, 2);
  });

  it("menghitung pos biaya yang serapannya mendahului progres", () => {
    // Progres 50%: pos pertama terpakai 90% (melampaui), kedua 40% (aman).
    const k = kpiPlanRealisasi([], [{ plan: 100, real: 90 }, { plan: 100, real: 40 }], 0.5);
    assert.equal(k.melampaui, 1);
  });

  it("pos tepat di batas toleransi belum dianggap melampaui", () => {
    const k = kpiPlanRealisasi([], [{ plan: 100, real: 53 }], 0.5);
    assert.equal(k.melampaui, 0);
  });

  it("pos tanpa rencana tidak dihitung melampaui — pembagian nol diabaikan", () => {
    const k = kpiPlanRealisasi([], [{ plan: 0, real: 80 }], 0.5);
    assert.equal(k.melampaui, 0);
  });

  it("proyek tanpa data menghasilkan nol di semua angka", () => {
    assert.deepEqual(kpiPlanRealisasi([], [], 0), {
      targetJual: 0, realJual: 0, terjual: 0, melampaui: 0,
    });
  });
});

describe("warnaSerapan", () => {
  it("merah bila uang keluar mendahului pekerjaan", () => {
    assert.equal(warnaSerapan(0.9, 0.5), "var(--red)");
  });

  it("kuning bila serapan sejalan dengan progres", () => {
    assert.equal(warnaSerapan(0.5, 0.5), "var(--amber)");
  });

  it("hijau bila hemat", () => {
    assert.equal(warnaSerapan(0.2, 0.5), "var(--green)");
  });

  it("memakai toleransi yang sama dengan kpiPlanRealisasi", () => {
    const progres = 0.5;
    assert.equal(warnaSerapan(progres + TOLERANSI_SERAPAN + 0.001, progres), "var(--red)");
    assert.equal(warnaSerapan(progres + TOLERANSI_SERAPAN, progres), "var(--amber)");
    assert.equal(warnaSerapan(progres - TOLERANSI_SERAPAN, progres), "var(--green)");
  });
});

describe("cacahMelampaui", () => {
  const progres = 0.5;

  it("mencacah pos yang serapannya mendahului progres", () => {
    const biaya = [
      { plan: 100, real: 90 }, // 90% pada progres 50% — melampaui
      { plan: 100, real: 50 }, // sejalan
      { plan: 100, real: 10 }, // hemat
      { plan: 100, real: 80 }, // melampaui
    ];
    assert.equal(cacahMelampaui(biaya, progres), 2);
  });

  it("daftar kosong menghasilkan nol, bukan galat", () => {
    assert.equal(cacahMelampaui([], progres), 0);
  });

  it("pos tanpa rencana tidak ikut dicacah walau sudah ada realisasinya", () => {
    // Tanpa `plan`, real/plan akan jadi Infinity — dulu ini ikut terhitung
    // sebagai "boros" padahal yang benar: belum ada rencana untuk dilampaui.
    assert.equal(cacahMelampaui([{ plan: 0, real: 5_000_000 }], progres), 0);
  });

  it("hasilnya sama dengan melampaui di kpiPlanRealisasi", () => {
    const biaya = [{ plan: 100, real: 90 }, { plan: 100, real: 10 }];
    assert.equal(
      cacahMelampaui(biaya, progres),
      kpiPlanRealisasi([], biaya, progres).melampaui,
    );
  });
});
