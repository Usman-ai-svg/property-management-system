import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  peringatanPencairanLebih,
  periksaCatatBiayaOperasional,
  periksaHapusPembayaranJual,
  periksaSimpanPembayaranJual,
} from "./plan-real";

describe("periksaCatatBiayaOperasional", () => {
  const m = {
    projectId: "p1",
    kategori: "Gaji & Tunjangan",
    nominal: 12_000_000,
    uraian: "Gaji tim proyek September",
    tanggal: null,
  };
  const konteks = { posBusinessPlan: ["Gaji & Tunjangan", "Sewa Kantor"] };

  it("biaya pada pos yang ada di business plan lolos", () => {
    assert.equal(periksaCatatBiayaOperasional(m, konteks), null);
  });

  it("pos yang tidak ada di business plan ditolak", () => {
    const g = periksaCatatBiayaOperasional({ ...m, kategori: "Entertain" }, konteks);
    assert.ok(g && /tidak ada pada business plan/.test(g), g ?? "(lolos)");
  });

  it("beda ejaan dianggap pos yang berbeda — itulah gunanya daftar tertutup", () => {
    assert.ok(periksaCatatBiayaOperasional({ ...m, kategori: "Gaji dan Tunjangan" }, konteks));
  });

  it("proyek tanpa pos operasional ditolak dengan pesan yang berbeda", () => {
    const g = periksaCatatBiayaOperasional(m, { posBusinessPlan: [] });
    assert.ok(g && /belum punya pos/.test(g), g ?? "(lolos)");
  });

  it("nominal nol ditolak", () => {
    assert.ok(periksaCatatBiayaOperasional({ ...m, nominal: 0 }, konteks));
  });

  it("keterangan kosong ditolak", () => {
    assert.ok(periksaCatatBiayaOperasional({ ...m, uraian: " " }, konteks));
  });

  it("tanggal ngawur ditolak bila diisi", () => {
    assert.ok(periksaCatatBiayaOperasional({ ...m, tanggal: "kemarin dulu" }, konteks));
  });
});

describe("periksaSimpanPembayaranJual", () => {
  const m = {
    id: null,
    unitId: "u1",
    nominal: 50_000_000,
    tanggal: "2026-09-01",
    keterangan: "Pencairan KPR tahap 1",
  };

  it("pencairan yang wajar lolos", () => {
    assert.equal(periksaSimpanPembayaranJual(m), null);
  });

  it("menyunting pembayaran lama juga lolos", () => {
    assert.equal(periksaSimpanPembayaranJual({ ...m, id: "sp1" }), null);
  });

  it("tanpa unit ditolak", () => {
    assert.ok(periksaSimpanPembayaranJual({ ...m, unitId: "" }));
  });

  it("nominal nol ditolak", () => {
    assert.ok(periksaSimpanPembayaranJual({ ...m, nominal: 0 }));
  });

  it("tanggal ngawur ditolak", () => {
    assert.ok(periksaSimpanPembayaranJual({ ...m, tanggal: "besok" }));
  });
});

describe("periksaHapusPembayaranJual", () => {
  it("dengan id lolos", () => {
    assert.equal(periksaHapusPembayaranJual({ id: "sp1" }), null);
  });

  it("tanpa id ditolak", () => {
    assert.ok(periksaHapusPembayaranJual({ id: "" }));
  });
});

describe("peringatanPencairanLebih", () => {
  it("pencairan dalam batas harga akad tidak memberi peringatan", () => {
    assert.equal(peringatanPencairanLebih(300_000_000, 100_000_000, 500_000_000), null);
  });

  it("pencairan pas sebesar harga akad tidak memberi peringatan", () => {
    assert.equal(peringatanPencairanLebih(400_000_000, 100_000_000, 500_000_000), null);
  });

  it("kelebihan memberi peringatan, bukan penolakan — uangnya MASUK", () => {
    const p = peringatanPencairanLebih(500_000_000, 20_000_000, 500_000_000);
    assert.ok(p && /melebihi harga akad/.test(p), p ?? "(tanpa peringatan)");
  });
});
