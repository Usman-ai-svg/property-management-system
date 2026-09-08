import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GRUP_LAINNYA, kelompokkanBaris } from "./kelompok-tabel";

const baris = [
  { nama: "a", grup: "Finishing" },
  { nama: "b", grup: "Persiapan" },
  { nama: "c", grup: "Finishing" },
  { nama: "d", grup: "Struktur" },
];
const URUTAN = ["Persiapan", "Struktur", "Finishing"] as const;

describe("kelompokkanBaris", () => {
  it("mengumpulkan baris sekelompok jadi satu", () => {
    const hasil = kelompokkanBaris(baris, (b) => b.grup, URUTAN);
    const finishing = hasil.find((g) => g.nama === "Finishing");
    assert.deepEqual(finishing?.rows.map((r) => r.nama), ["a", "c"]);
  });

  it("mengikuti urutan pelaksanaan, bukan alfabetis", () => {
    const hasil = kelompokkanBaris(baris, (b) => b.grup, URUTAN);
    assert.deepEqual(hasil.map((g) => g.nama), ["Persiapan", "Struktur", "Finishing"]);
  });

  it("kelompok tak terdaftar ditaruh sesudah yang terdaftar, urut abjad", () => {
    const campur = [...baris, { nama: "e", grup: "Zeta" }, { nama: "f", grup: "Alfa" }];
    const hasil = kelompokkanBaris(campur, (b) => b.grup, URUTAN);
    assert.deepEqual(hasil.map((g) => g.nama), [
      "Persiapan", "Struktur", "Finishing", "Alfa", "Zeta",
    ]);
  });

  it("baris tanpa nama kelompok masuk Lainnya, bukan dibuang", () => {
    const hasil = kelompokkanBaris([{ nama: "x", grup: "" }], (b) => b.grup, URUTAN);
    assert.equal(hasil.length, 1);
    assert.equal(hasil[0].nama, GRUP_LAINNYA);
    assert.equal(hasil[0].rows.length, 1);
  });

  it("tanpa urutanGrup, seluruhnya alfabetis", () => {
    const hasil = kelompokkanBaris(baris, (b) => b.grup);
    assert.deepEqual(hasil.map((g) => g.nama), ["Finishing", "Persiapan", "Struktur"]);
  });

  it("daftar kosong menghasilkan daftar kosong", () => {
    assert.deepEqual(kelompokkanBaris([], (b: { grup: string }) => b.grup, URUTAN), []);
  });

  it("tidak ada baris yang hilang berapa pun kelompoknya", () => {
    const hasil = kelompokkanBaris(baris, (b) => b.grup, URUTAN);
    assert.equal(hasil.reduce((s, g) => s + g.rows.length, 0), baris.length);
  });
});
