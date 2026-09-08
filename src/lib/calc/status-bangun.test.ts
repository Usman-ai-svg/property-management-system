import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { porsiPersen, sebaranProgres, statusBangunSarpras, statusBangunUnit } from "./status-bangun";

const bulanLalu = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

describe("statusBangunUnit", () => {
  it("mengikuti progres selama di bawah 100%", () => {
    assert.equal(statusBangunUnit({ progress: 0, statusJual: "Tersedia" }), "Belum Terbangun");
    assert.equal(statusBangunUnit({ progress: 1, statusJual: "Tersedia" }), "Progress");
    assert.equal(statusBangunUnit({ progress: 99, statusJual: "Serah Terima" }), "Progress");
  });

  it("100% tanpa serah terima = Terbangun", () => {
    assert.equal(statusBangunUnit({ progress: 100, statusJual: "Tersedia" }), "Terbangun");
    assert.equal(statusBangunUnit({ progress: 100, statusJual: "Akad" }), "Terbangun");
  });

  it("100% + serah terima < 3 bulan = Masa Garansi", () => {
    assert.equal(
      statusBangunUnit({ progress: 100, statusJual: "Serah Terima", tanggalSerahTerima: bulanLalu(1) }),
      "Masa Garansi",
    );
    // Tanpa tanggal, dianggap baru diserahkan → masih Masa Garansi.
    assert.equal(
      statusBangunUnit({ progress: 100, statusJual: "Serah Terima", tanggalSerahTerima: null }),
      "Masa Garansi",
    );
  });

  it("100% + serah terima >= 3 bulan = Selesai", () => {
    assert.equal(
      statusBangunUnit({ progress: 100, statusJual: "Serah Terima", tanggalSerahTerima: bulanLalu(5) }),
      "Selesai",
    );
  });
});

describe("statusBangunSarpras", () => {
  it("hanya bergantung pada progres", () => {
    assert.equal(statusBangunSarpras(0), "Belum Terbangun");
    assert.equal(statusBangunSarpras(50), "Progress");
    assert.equal(statusBangunSarpras(100), "Selesai");
  });
});

describe("sebaranProgres", () => {
  it("membagi objek jadi belum, dikerjakan, dan selesai", () => {
    const s = sebaranProgres([0, 40, 100, 100, 0]);
    assert.equal(s.total, 5);
    assert.equal(s.belum, 2);
    assert.equal(s.dikerjakan, 1);
    assert.equal(s.selesai, 2);
  });

  it("memakai ambang yang sama dengan statusBangunSarpras", () => {
    for (const p of [0, 1, 50, 99, 100]) {
      const s = sebaranProgres([p]);
      const status = statusBangunSarpras(p);
      if (status === "Belum Terbangun") assert.equal(s.belum, 1, `p=${p}`);
      else if (status === "Selesai") assert.equal(s.selesai, 1, `p=${p}`);
      else assert.equal(s.dikerjakan, 1, `p=${p}`);
    }
  });

  it("rata-rata dibulatkan ke persen bulat", () => {
    assert.equal(sebaranProgres([10, 20, 31]).rata, 20);
  });

  it("tanpa objek: semua nol, bukan NaN", () => {
    assert.deepEqual(sebaranProgres([]), { total: 0, belum: 0, dikerjakan: 0, selesai: 0, rata: 0 });
  });

  it("progres di atas 100 tetap terhitung selesai sekali", () => {
    const s = sebaranProgres([120]);
    assert.equal(s.selesai, 1);
    assert.equal(s.dikerjakan, 0);
  });
});

describe("porsiPersen", () => {
  it("menghitung porsi terhadap total", () => {
    assert.equal(porsiPersen(1, 4), 25);
  });

  it("total nol menghasilkan nol", () => {
    assert.equal(porsiPersen(3, 0), 0);
  });
});
