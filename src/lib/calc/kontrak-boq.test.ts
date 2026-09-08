import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  barisVoEfektif,
  boqCocokDenganSpk,
  nominalVo,
  nilaiBoqSeluruhObjek,
  nilaiTerpasang,
  periksaBarisBoqSpk,
  progresPerSarpras,
  progresPerUnit,
  progresSpk,
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

describe("VO masuk BOQ terinci (rekonsiliasi nilai kontrak)", () => {
  // Pokok: 2 unit × Rp10jt/unit = Rp20jt.
  const template = [{ id: "T1", volume: 1, hargaSatuan: 10_000_000 }];
  const objekIds = ["U1", "U2"];

  it("Nilai BOQ pokok = template × jumlah objek (tanpa VO)", () => {
    assert.equal(nilaiBoqSeluruhObjek(template, [], objekIds), 20_000_000);
  });

  it("baris VO menambah Nilai BOQ Terinci sehingga = nilai kontrak (pokok + VO)", () => {
    // VO tambah kuda-kuda Rp2jt di U1, dan kurang Rp0,5jt di U2.
    const voItems = [
      barisVoEfektif({ id: "V1", voNomor: "VO-01", unitId: "U1", grup: "VO", uraian: "Kuda-kuda", satuan: "unit", volume: 1, hargaSatuan: 2_000_000, progress: 0 }),
      barisVoEfektif({ id: "V2", voNomor: "VO-01", unitId: "U2", grup: "VO", uraian: "Kurang lisplank", satuan: "ls", volume: 1, hargaSatuan: -500_000, progress: 0 }),
    ];
    const pokok = nilaiBoqSeluruhObjek(template, [], objekIds);
    const nilaiVo = voItems.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
    // Nilai kontrak efektif = pokok + Σ VO disetujui.
    const nilaiEfektif = pokok + nilaiVo;
    // Nilai BOQ Terinci yang ditampilkan = Σ seluruh baris (pokok + VO).
    const semuaBaris = [
      ...objekIds.flatMap(() => template.map((t) => ({ volume: t.volume, hargaSatuan: t.hargaSatuan }))),
      ...voItems,
    ];
    const nilaiBoqTerinci = semuaBaris.reduce((s, b) => s + b.volume * b.hargaSatuan, 0);
    assert.equal(nilaiBoqTerinci, nilaiEfektif);
    assert.equal(nilaiBoqTerinci, 21_500_000);
  });

  it("baris VO ber-awalan 'vo:' pada id opname supaya mengarah ke ContractVoItem", () => {
    const b = barisVoEfektif({ id: "V9", voNomor: "VO-02", unitId: "U1", grup: "VO", uraian: "x", satuan: "ls", volume: 1, hargaSatuan: 1, progress: 0 });
    assert.equal(b.boqItemId, "vo:V9");
    assert.equal(b.voNomor, "VO-02");
  });

  it("progresSpk ikut menimbang baris VO disetujui", () => {
    // Pokok Rp20jt (0%), VO Rp20jt (100%) → tertimbang 50%.
    const voItems = [{ unitId: "U1", volume: 1, hargaSatuan: 20_000_000, progress: 100 }];
    assert.equal(progresSpk(template, [], objekIds, voItems), 50);
  });
});

describe("boqCocokDenganSpk", () => {
  it("selisih pecahan rupiah masih dianggap cocok", () => {
    assert.equal(boqCocokDenganSpk(900_000_000.4, 900_000_000), true);
  });

  it("nilai persis sama tentu cocok", () => {
    assert.equal(boqCocokDenganSpk(900_000_000, 900_000_000), true);
  });

  it("selisih satu rupiah penuh sudah tidak cocok — itu tanda baris belum terinci", () => {
    assert.equal(boqCocokDenganSpk(900_000_001, 900_000_000), false);
    assert.equal(boqCocokDenganSpk(899_999_999, 900_000_000), false);
  });

  it("BOQ kosong pada kontrak bernilai tidak dianggap cocok", () => {
    assert.equal(boqCocokDenganSpk(0, 900_000_000), false);
  });

  it("dua-duanya nol dianggap cocok", () => {
    assert.equal(boqCocokDenganSpk(0, 0), true);
  });
});

describe("nominalVo", () => {
  it("menjumlahkan baris dan membulatkan ke rupiah", () => {
    assert.equal(nominalVo([{ volume: 2.5, hargaSatuan: 1_000_001 }]), 2_500_003);
  });

  it("VO pekerjaan kurang bernilai negatif", () => {
    assert.equal(nominalVo([{ volume: -1, hargaSatuan: 5_000_000 }]), -5_000_000);
  });

  it("tambah dan kurang bisa saling meniadakan jadi nol", () => {
    assert.equal(
      nominalVo([{ volume: 1, hargaSatuan: 1000 }, { volume: -1, hargaSatuan: 1000 }]),
      0,
    );
  });

  it("tanpa baris bernilai nol", () => {
    assert.equal(nominalVo([]), 0);
  });
});
