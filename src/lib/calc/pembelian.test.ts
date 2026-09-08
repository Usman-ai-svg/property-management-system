import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hutangPembelian, statusPembelian, terbayarPembelian, totalPembelian,
} from "./pembelian";

describe("totalPembelian", () => {
  it("menjumlahkan qty × harga tiap baris", () => {
    assert.equal(
      totalPembelian([
        { qty: 2, harga: 150_000 },
        { qty: 10, harga: 35_000 },
      ]),
      650_000,
    );
  });

  it("PO tanpa baris bernilai nol", () => {
    assert.equal(totalPembelian([]), 0);
  });

  it("kuantitas berpecahan tidak dibulatkan — 2,5 m³ pasir tetap 2,5", () => {
    assert.equal(totalPembelian([{ qty: 2.5, harga: 400_000 }]), 1_000_000);
  });
});

describe("terbayarPembelian", () => {
  it("menjumlahkan seluruh pembayaran", () => {
    assert.equal(terbayarPembelian([{ total: 100 }, { total: 250 }]), 350);
  });

  it("belum ada pembayaran berarti nol", () => {
    assert.equal(terbayarPembelian([]), 0);
  });
});

describe("hutangPembelian", () => {
  it("sisa yang belum dibayar", () => {
    assert.equal(hutangPembelian(1_000_000, 400_000), 600_000);
  });

  it("lunas pas menghasilkan nol", () => {
    assert.equal(hutangPembelian(1_000_000, 1_000_000), 0);
  });

  it("kelebihan bayar menghasilkan angka negatif — perilaku yang berlaku sekarang", () => {
    // Sengaja TIDAK dijepit ke nol: menjepitnya akan mengubah angka yang sudah
    // tampil di dua halaman. Apakah kelebihan bayar boleh terjadi sama sekali
    // adalah pertanyaan invarian, bukan pertanyaan tampilan.
    assert.equal(hutangPembelian(1_000_000, 1_200_000), -200_000);
  });
});

describe("statusPembelian", () => {
  it("belum diterima dan belum dibayar sama sekali: Draft", () => {
    assert.equal(statusPembelian(false, 1_000_000, 0), "Draft");
  });

  it("belum diterima tapi sudah dibayar sebagian: DP", () => {
    assert.equal(statusPembelian(false, 1_000_000, 300_000), "DP");
  });

  it("belum diterima tapi sudah lunas: Dibayar Penuh — uang keluar mendahului barang", () => {
    assert.equal(statusPembelian(false, 1_000_000, 1_000_000), "Dibayar Penuh");
  });

  it("sudah diterima tapi masih ada sisa: Diterima", () => {
    assert.equal(statusPembelian(true, 1_000_000, 300_000), "Diterima");
  });

  it("sudah diterima dan sisa habis: Lunas", () => {
    assert.equal(statusPembelian(true, 1_000_000, 1_000_000), "Lunas");
  });

  it("kelebihan bayar tetap dianggap lunas", () => {
    assert.equal(statusPembelian(true, 1_000_000, 1_200_000), "Lunas");
    assert.equal(statusPembelian(false, 1_000_000, 1_200_000), "Dibayar Penuh");
  });

  it("PO bernilai nol tidak pernah dianggap lunas", () => {
    // total 0 dengan terbayar 0 bukan "Lunas" — belum ada apa pun untuk dibayar,
    // dan menandainya lunas akan menyembunyikan PO kosong yang salah input.
    assert.equal(statusPembelian(false, 0, 0), "Draft");
    assert.equal(statusPembelian(true, 0, 0), "Diterima");
  });
});
