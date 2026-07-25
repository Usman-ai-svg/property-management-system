import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boqSarprasDefault, buatBoqDariTemplate, buatRapDariTemplate, hitungUpahRap,
  kelompokkanRap, rabAcuan, rapAcuan, totalBaris,
} from "./boq";
import { PORSI_MATERIAL_DALAM_RAP, RASIO_RAP_TERHADAP_RAB, TEMPLATE_BOQ } from "../domain/templates";

/**
 * Replikasi persis rumus RAB pada prototipe `NanolandManagementSystem.jsx`,
 * dipakai sebagai pembanding independen. Bila suatu saat nilainya berbeda,
 * perbedaan itu harus disengaja — bukan kecelakaan saat menyunting template.
 */
function rabPrototipe(luasBangunan: number): number {
  const tpl = [
    { per: 0, harga: 3_500_000 }, { per: 1.0, harga: 620_000 }, { per: 1.0, harga: 780_000 },
    { per: 2.8, harga: 165_000 }, { per: 1.15, harga: 385_000 }, { per: 1.0, harga: 285_000 },
    { per: 0.95, harga: 145_000 }, { per: 3.2, harga: 42_000 }, { per: 0, harga: 18_500_000 },
    { per: 0.45, harga: 285_000 }, { per: 0, harga: 12_000_000 }, { per: 0, harga: 4_500_000 },
  ];
  return tpl.reduce((jumlah, r) => {
    const vol = r.per === 0 ? 1 : Math.round(luasBangunan * r.per * 10) / 10;
    return jumlah + Math.round(vol * r.harga);
  }, 0);
}

const LUAS_TIPE = [36, 45, 50, 60, 72];

describe("buatBoqDariTemplate", () => {
  it("menghasilkan satu baris per item template", () => {
    assert.equal(buatBoqDariTemplate(45).length, TEMPLATE_BOQ.length);
  });

  it("memperlakukan perM2 = 0 sebagai lump sum dengan volume 1", () => {
    const baris = buatBoqDariTemplate(72);
    for (const [i, t] of TEMPLATE_BOQ.entries()) {
      if (t.perM2 === 0) assert.equal(baris[i].volume, 1, `baris "${t.uraian}" harus lump sum`);
    }
  });

  it("menskalakan volume terhadap luas bangunan", () => {
    const kecil = buatBoqDariTemplate(36);
    const besar = buatBoqDariTemplate(72);
    const iDinding = TEMPLATE_BOQ.findIndex((t) => t.uraian.includes("Dinding"));
    assert.equal(besar[iDinding].volume, kecil[iDinding].volume * 2);
  });

  it("mempertahankan urutan template", () => {
    const baris = buatBoqDariTemplate(50);
    assert.deepEqual(baris.map((b) => b.urutan), baris.map((_, i) => i));
  });
});

describe("rabAcuan", () => {
  for (const lb of LUAS_TIPE) {
    it(`sama dengan prototipe untuk LB ${lb} m²`, () => {
      assert.equal(rabAcuan(lb), rabPrototipe(lb));
    });
  }

  it("naik seiring luas bangunan", () => {
    for (let i = 1; i < LUAS_TIPE.length; i++) {
      assert.ok(rabAcuan(LUAS_TIPE[i]) > rabAcuan(LUAS_TIPE[i - 1]));
    }
  });
});

describe("rapAcuan", () => {
  for (const lb of LUAS_TIPE) {
    it(`bernilai ${RASIO_RAP_TERHADAP_RAB * 100}% dari RAB untuk LB ${lb} m²`, () => {
      assert.equal(rapAcuan(lb), Math.round(rabAcuan(lb) * RASIO_RAP_TERHADAP_RAB));
    });
  }

  it("selalu lebih kecil dari RAB — inilah margin pelaksanaan", () => {
    for (const lb of LUAS_TIPE) assert.ok(rapAcuan(lb) < rabAcuan(lb));
  });
});

describe("buatRapDariTemplate", () => {
  for (const lb of LUAS_TIPE) {
    it(`material jatuh tepat pada ${PORSI_MATERIAL_DALAM_RAP * 100}% RAP untuk LB ${lb} m²`, () => {
      const material = totalBaris(buatRapDariTemplate(lb));
      const target = rapAcuan(lb) * PORSI_MATERIAL_DALAM_RAP;
      // Volume dibulatkan dua desimal, jadi toleransi kecil memang diharapkan.
      assert.ok(
        Math.abs(material - target) / target < 0.001,
        `material ${material} menyimpang lebih dari 0,1% dari target ${target}`,
      );
    });
  }

  it("material + upah menghasilkan RAP acuan", () => {
    for (const lb of LUAS_TIPE) {
      const total = totalBaris(buatRapDariTemplate(lb)) + hitungUpahRap(lb);
      assert.ok(Math.abs(total - rapAcuan(lb)) <= 1, `LB ${lb}: ${total} vs ${rapAcuan(lb)}`);
    }
  });

  it("tidak menghasilkan volume negatif", () => {
    for (const r of buatRapDariTemplate(36)) assert.ok(r.volume >= 0);
  });
});

describe("kelompokkanRap", () => {
  it("mempertahankan urutan kemunculan pertama, bukan alfabetis", () => {
    const grup = kelompokkanRap([
      { grup: "Zeta", nama: "a", volume: 1, hargaSatuan: 1 },
      { grup: "Alfa", nama: "b", volume: 1, hargaSatuan: 1 },
      { grup: "Zeta", nama: "c", volume: 1, hargaSatuan: 1 },
    ]);
    assert.deepEqual(grup.map((g) => g.nama), ["Zeta", "Alfa"]);
    assert.equal(grup[0].items.length, 2);
  });

  it("menjumlahkan total tiap kelompok", () => {
    const grup = kelompokkanRap([
      { grup: "A", nama: "x", volume: 2, hargaSatuan: 1000 },
      { grup: "A", nama: "y", volume: 3, hargaSatuan: 1000 },
    ]);
    assert.equal(grup[0].total, 5000);
  });

  it("membawa serta field tambahan seperti id", () => {
    const grup = kelompokkanRap([{ id: "abc", grup: "A", volume: 1, hargaSatuan: 1 }]);
    assert.equal(grup[0].items[0].id, "abc");
  });
});

describe("boqSarprasDefault", () => {
  it("porsinya berjumlah seratus persen dari RAB", () => {
    const rab = 385_000_000;
    const total = totalBaris(boqSarprasDefault("Jalan Lingkungan", "Prasarana", rab));
    // Tiap baris dibulatkan, jadi selisih beberapa rupiah wajar.
    assert.ok(Math.abs(total - rab) < 10, `total ${total} vs rab ${rab}`);
  });

  it("menyebut nama item pada pekerjaan utamanya", () => {
    const baris = boqSarprasDefault("Saluran Drainase", "Prasarana", 1_000_000);
    assert.ok(baris.some((b) => b.uraian.includes("Saluran Drainase")));
  });
});
