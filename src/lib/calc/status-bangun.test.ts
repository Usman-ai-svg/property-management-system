import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statusBangunSarpras, statusBangunUnit } from "./status-bangun";

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
