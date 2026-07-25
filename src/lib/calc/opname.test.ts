import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fraksiBaris, keteranganPekerjaan, ringkasOpname, susunOpname } from "./opname";

const BARIS = [
  { uraian: "Pondasi", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
  { uraian: "Dinding", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
  { uraian: "Atap", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
  { uraian: "Finishing", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
];

describe("fraksiBaris", () => {
  it("menyelesaikan baris secara berurutan, bukan serentak", () => {
    // Pada 25% dari 4 baris: baris pertama selesai, sisanya belum tersentuh.
    assert.equal(fraksiBaris(25, 0, 4), 1);
    assert.equal(fraksiBaris(25, 1, 4), 0);
    assert.equal(fraksiBaris(25, 2, 4), 0);
  });

  it("mengembalikan nilai antara nol dan satu", () => {
    for (const p of [-50, 0, 37, 100, 150]) {
      for (let i = 0; i < 4; i++) {
        const f = fraksiBaris(p, i, 4);
        assert.ok(f >= 0 && f <= 1, `f(${p}, ${i}) = ${f}`);
      }
    }
  });

  it("aman terhadap jumlah baris nol", () => {
    assert.equal(fraksiBaris(50, 0, 0), 0);
  });
});

describe("susunOpname", () => {
  it("bobot seluruh baris berjumlah seratus", () => {
    const total = susunOpname(BARIS, 0, 50).reduce((s, r) => s + r.bobot, 0);
    assert.ok(Math.abs(total - 100) < 1e-9);
  });

  it("penambahan minggu ini adalah selisih dua titik progres", () => {
    const baris = susunOpname(BARIS, 25, 50);
    const kumulatif = baris.reduce((s, r) => s + r.bobotKini, 0);
    const lalu = baris.reduce((s, r) => s + r.bobotLalu, 0);
    const delta = baris.reduce((s, r) => s + r.deltaBobot, 0);
    assert.ok(Math.abs(kumulatif - lalu - delta) < 1e-9);
  });

  it("tidak memunculkan kemajuan ketika progres tidak berubah", () => {
    for (const r of susunOpname(BARIS, 60, 60)) {
      assert.equal(r.deltaProgres, 0);
      assert.equal(r.deltaNilai, 0);
    }
  });

  it("nilai kumulatif seluruh baris sama dengan nilai kontrak pada 100%", () => {
    const r = ringkasOpname(susunOpname(BARIS, 0, 100));
    assert.equal(r.nilaiKini, 400_000_000);
    assert.equal(r.nilaiKontrak, 400_000_000);
  });

  it("mengembalikan daftar kosong bila tidak ada baris", () => {
    assert.deepEqual(susunOpname([], 0, 50), []);
  });

  it("mengembalikan daftar kosong bila seluruh nilainya nol", () => {
    assert.deepEqual(susunOpname([{ uraian: "x", satuan: "ls", volume: 0, hargaSatuan: 0 }], 0, 50), []);
  });

  it("membobot baris sesuai nilainya, bukan sama rata", () => {
    const campuran = [
      { uraian: "Besar", satuan: "ls", volume: 1, hargaSatuan: 300_000_000 },
      { uraian: "Kecil", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
    ];
    const baris = susunOpname(campuran, 0, 100);
    assert.equal(baris[0].bobot, 75);
    assert.equal(baris[1].bobot, 25);
  });
});

describe("keteranganPekerjaan", () => {
  it("menyebut belum mulai pada nol persen", () => {
    assert.deepEqual(keteranganPekerjaan(0), ["Belum mulai"]);
  });

  it("menyebut selesai pada seratus persen", () => {
    assert.deepEqual(keteranganPekerjaan(100), ["Selesai"]);
  });

  it("selalu mengembalikan minimal satu keterangan", () => {
    for (let p = 0; p <= 100; p++) assert.ok(keteranganPekerjaan(p).length >= 1);
  });
});
