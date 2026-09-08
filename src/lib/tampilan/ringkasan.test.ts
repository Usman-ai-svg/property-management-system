import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proyekBerjalan, STATUS_BERJALAN, totalProgresUnit } from "./ringkasan";

const proyek = [
  { kode: "A", status: STATUS_BERJALAN, unitProgress: 10, rataProgress: 40 },
  { kode: "B", status: "Perencanaan", unitProgress: 0, rataProgress: 90 },
  { kode: "C", status: STATUS_BERJALAN, unitProgress: 25, rataProgress: 75 },
];

describe("proyekBerjalan", () => {
  it("hanya mengambil proyek yang sedang dibangun", () => {
    assert.deepEqual(proyekBerjalan(proyek).aktif.map((p) => p.kode), ["A", "C"]);
  });

  it("proyek berprogres tertinggi diambil dari yang berjalan saja", () => {
    // B progresnya 90 tapi masih Perencanaan — tidak boleh terpilih.
    assert.equal(proyekBerjalan(proyek).tertinggi?.kode, "C");
  });

  it("tidak mengubah urutan daftar aslinya", () => {
    const salinan = [...proyek];
    proyekBerjalan(proyek);
    assert.deepEqual(proyek.map((p) => p.kode), salinan.map((p) => p.kode));
  });

  it("tanpa proyek berjalan, tertinggi bernilai undefined", () => {
    const hasil = proyekBerjalan([{ status: "Perencanaan", unitProgress: 0, rataProgress: 10 }]);
    assert.deepEqual(hasil.aktif, []);
    assert.equal(hasil.tertinggi, undefined);
  });

  it("daftar kosong tidak menimbulkan galat", () => {
    assert.equal(proyekBerjalan([]).tertinggi, undefined);
  });
});

describe("totalProgresUnit", () => {
  it("menjumlahkan progres unit seluruh proyek", () => {
    assert.equal(totalProgresUnit(proyek), 35);
  });

  it("tanpa proyek bernilai nol", () => {
    assert.equal(totalProgresUnit([]), 0);
  });
});
