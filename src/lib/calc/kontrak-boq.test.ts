import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nilaiTerpasang,
  periksaBarisBoqSpk,
  progresPerSarpras,
  progresPerUnit,
  progresTertimbang,
} from "./kontrak-boq";

/** Pembuat baris ringkas supaya maksud tiap tes tidak tertutup boilerplate. */
const baris = (volume: number, harga: number, progress: number, unitId = "U1") => ({
  unitId,
  volume,
  hargaSatuan: harga,
  progress,
});

describe("progresTertimbang", () => {
  it("mengembalikan nol untuk daftar kosong", () => {
    assert.equal(progresTertimbang([]), 0);
  });

  it("menimbang menurut nilai, bukan jumlah baris", () => {
    // Pondasi Rp 90 juta selesai penuh, cat Rp 10 juta belum mulai.
    // Rata-rata sederhana akan bilang 50%; yang benar 90%.
    const hasil = progresTertimbang([baris(1, 90_000_000, 100), baris(1, 10_000_000, 0)]);
    assert.equal(hasil, 90);
  });

  it("menghitung baris yang selesai sebagian", () => {
    assert.equal(progresTertimbang([baris(1, 1_000_000, 50)]), 50);
  });

  it("mengembalikan 100 bila seluruh baris tuntas", () => {
    const hasil = progresTertimbang([baris(2, 500_000, 100), baris(3, 250_000, 100)]);
    assert.equal(hasil, 100);
  });

  it("mengabaikan baris bernilai nol saat menimbang", () => {
    // Baris tanpa nilai tidak boleh menarik progres ke bawah.
    const hasil = progresTertimbang([baris(1, 1_000_000, 100), baris(0, 0, 0)]);
    assert.equal(hasil, 100);
  });

  it("memakai rata-rata sederhana bila semua baris bernilai nol", () => {
    const hasil = progresTertimbang([baris(0, 0, 100), baris(0, 0, 0)]);
    assert.equal(hasil, 50);
  });

  it("menjepit progres di luar rentang 0–100", () => {
    assert.equal(progresTertimbang([baris(1, 1_000_000, 150)]), 100);
    assert.equal(progresTertimbang([baris(1, 1_000_000, -20)]), 0);
  });

  it("memperlakukan progres bukan angka sebagai nol", () => {
    assert.equal(progresTertimbang([baris(1, 1_000_000, Number.NaN)]), 0);
  });

  it("membulatkan ke bilangan bulat", () => {
    // 1/3 tuntas dari tiga baris senilai sama = 33,33% → 33.
    const hasil = progresTertimbang([
      baris(1, 1_000_000, 100),
      baris(1, 1_000_000, 0),
      baris(1, 1_000_000, 0),
    ]);
    assert.equal(hasil, 33);
  });
});

describe("progresPerUnit", () => {
  it("mengelompokkan baris menurut unitnya", () => {
    const hasil = progresPerUnit([
      baris(1, 1_000_000, 100, "U1"),
      baris(1, 1_000_000, 0, "U2"),
    ]);
    assert.equal(hasil.get("U1"), 100);
    assert.equal(hasil.get("U2"), 0);
  });

  it("menggabungkan baris dari beberapa SPK atas unit yang sama", () => {
    // Struktur oleh vendor A sudah tuntas, finishing oleh vendor B belum.
    const hasil = progresPerUnit([
      baris(1, 70_000_000, 100, "U1"),
      baris(1, 30_000_000, 0, "U1"),
    ]);
    assert.equal(hasil.get("U1"), 70);
  });

  it("melewati baris yang tidak menunjuk unit", () => {
    const hasil = progresPerUnit([
      { infrastructureId: "S1", volume: 1, hargaSatuan: 1_000_000, progress: 100 },
      baris(1, 1_000_000, 50, "U1"),
    ]);
    assert.equal(hasil.size, 1);
    assert.equal(hasil.get("U1"), 50);
  });
});

describe("progresPerSarpras", () => {
  it("mengelompokkan baris menurut item sarprasnya", () => {
    const hasil = progresPerSarpras([
      { infrastructureId: "S1", volume: 1, hargaSatuan: 2_000_000, progress: 100 },
      { infrastructureId: "S1", volume: 1, hargaSatuan: 2_000_000, progress: 0 },
      { infrastructureId: "S2", volume: 1, hargaSatuan: 1_000_000, progress: 25 },
    ]);
    assert.equal(hasil.get("S1"), 50);
    assert.equal(hasil.get("S2"), 25);
  });
});

describe("nilaiTerpasang", () => {
  it("menjumlahkan nilai pekerjaan yang sudah dikerjakan", () => {
    const hasil = nilaiTerpasang([baris(1, 90_000_000, 100), baris(1, 10_000_000, 50)]);
    assert.equal(hasil, 95_000_000);
  });

  it("mengembalikan nol bila belum ada yang dikerjakan", () => {
    assert.equal(nilaiTerpasang([baris(5, 1_000_000, 0)]), 0);
  });
});

describe("periksaBarisBoqSpk", () => {
  const sah = {
    uraian: "Pek. Pondasi",
    volume: 12,
    hargaSatuan: 750_000,
    progress: 40,
  };

  it("meloloskan baris yang sah", () => {
    assert.equal(periksaBarisBoqSpk(sah), null);
  });

  it("menolak uraian kosong", () => {
    assert.match(periksaBarisBoqSpk({ ...sah, uraian: "   " }) ?? "", /Uraian/);
  });

  it("menolak volume negatif", () => {
    assert.match(periksaBarisBoqSpk({ ...sah, volume: -1 }) ?? "", /Volume/);
  });

  it("menolak harga satuan negatif", () => {
    assert.match(periksaBarisBoqSpk({ ...sah, hargaSatuan: -1 }) ?? "", /Harga satuan/);
  });

  it("menolak progres di luar 0–100", () => {
    assert.match(periksaBarisBoqSpk({ ...sah, progress: 101 }) ?? "", /0 dan 100/);
    assert.match(periksaBarisBoqSpk({ ...sah, progress: -1 }) ?? "", /0 dan 100/);
  });

  it("meloloskan volume nol — pekerjaan bisa saja dibatalkan lewat VO", () => {
    assert.equal(periksaBarisBoqSpk({ ...sah, volume: 0 }), null);
  });
});
