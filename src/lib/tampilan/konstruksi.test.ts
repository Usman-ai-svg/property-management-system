import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { kpiKonstruksi, rataTertimbang } from "./konstruksi";

describe("rataTertimbang", () => {
  it("proyek besar berbobot lebih daripada proyek kecil", () => {
    // Rata-rata dari rata-rata akan menghasilkan 50%. Yang benar 90%,
    // karena 90 dari 100 unit sudah 100% sementara 10 unit lain masih 0%.
    assert.equal(
      rataTertimbang([{ rata: 100, jumlah: 90 }, { rata: 0, jumlah: 10 }]),
      90,
    );
  });

  it("sama dengan rata-rata biasa bila bobotnya sama", () => {
    assert.equal(rataTertimbang([{ rata: 40, jumlah: 5 }, { rata: 60, jumlah: 5 }]), 50);
  });

  it("mengabaikan proyek berbobot nol", () => {
    assert.equal(
      rataTertimbang([{ rata: 80, jumlah: 10 }, { rata: 0, jumlah: 0 }]),
      80,
    );
  });

  it("nol bila tidak ada objek sama sekali, bukan NaN", () => {
    assert.equal(rataTertimbang([]), 0);
    assert.equal(rataTertimbang([{ rata: 50, jumlah: 0 }]), 0);
  });

  it("dibulatkan ke bilangan bulat", () => {
    assert.equal(rataTertimbang([{ rata: 33, jumlah: 1 }, { rata: 34, jumlah: 1 }]), 34);
  });
});

describe("kpiKonstruksi", () => {
  const proyek = [
    { jumlahUnit: 51, dikerjakan: 40, rataUnit: 60, jumlahSarpras: 6, rataSarpras: 50 },
    { jumlahUnit: 12, dikerjakan: 5, rataUnit: 20, jumlahSarpras: 3, rataSarpras: 80 },
  ];

  it("menjumlahkan unit dan yang sedang dikerjakan", () => {
    const k = kpiKonstruksi(proyek);
    assert.equal(k.jumlahProyek, 2);
    assert.equal(k.totalUnit, 63);
    assert.equal(k.dikerjakan, 45);
  });

  it("rata progres unit ditimbang jumlah unit", () => {
    // (60x51 + 20x12) / 63 = 52,4 -> 52. Rata-rata polos akan memberi 40.
    assert.equal(kpiKonstruksi(proyek).rataUnit, 52);
  });

  it("rata progres sarpras ditimbang jumlah sarpras, bukan jumlah unit", () => {
    // (50x6 + 80x3) / 9 = 60
    assert.equal(kpiKonstruksi(proyek).rataSarpras, 60);
  });

  it("proyek tanpa sarpras tidak membuat rata sarpras jadi NaN", () => {
    const k = kpiKonstruksi([
      { jumlahUnit: 10, dikerjakan: 2, rataUnit: 30, jumlahSarpras: 0, rataSarpras: 0 },
    ]);
    assert.equal(k.totalSarpras, 0);
    assert.equal(k.rataSarpras, 0);
  });
});
