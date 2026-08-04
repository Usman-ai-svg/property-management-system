import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hariKerja, mingguBaru } from "./hari-kerja";

// Rabu 2026-08-05, Kamis 06, Jumat 07, Sabtu 08, Minggu 09, Senin 10, Selasa 11, Rabu 12.
const kamis = new Date(2026, 7, 6);
const jumat = new Date(2026, 7, 7);
const sabtu = new Date(2026, 7, 8);
const rabuDepan = new Date(2026, 7, 12);

describe("hariKerja", () => {
  it("nol untuk hari yang sama", () => {
    assert.equal(hariKerja(kamis, kamis), 0);
  });

  it("menghitung Jumat = 1 hari kerja setelah Kamis", () => {
    assert.equal(hariKerja(kamis, jumat), 1);
  });

  it("menghitung Sabtu = 2 (Sabtu tetap hari kerja)", () => {
    assert.equal(hariKerja(kamis, sabtu), 2);
  });

  it("melewati Minggu: Kamis → Rabu minggu depan = 5 hari kerja", () => {
    // Jumat, Sabtu, [Minggu libur], Senin, Selasa, Rabu = 5
    assert.equal(hariKerja(kamis, rabuDepan), 5);
  });

  it("nol bila sampai sebelum dari", () => {
    assert.equal(hariKerja(rabuDepan, kamis), 0);
  });
});

describe("mingguBaru", () => {
  it("baseline null selalu minggu baru", () => {
    assert.equal(mingguBaru(null, kamis), true);
  });

  it("koreksi Jumat/Sabtu (sama minggu) BUKAN minggu baru", () => {
    assert.equal(mingguBaru(kamis, jumat), false);
    assert.equal(mingguBaru(kamis, sabtu), false);
  });

  it("Rabu minggu depan (≥5 hari kerja) adalah minggu baru", () => {
    assert.equal(mingguBaru(kamis, rabuDepan), true);
  });
});
