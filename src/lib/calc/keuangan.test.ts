import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alokasiKontrak, ringkasKontrak, statusSerapan, totalVoDisetujui } from "./keuangan";

describe("statusSerapan", () => {
  it("menandai Over ketika biaya mendahului progres", () => {
    assert.equal(statusSerapan(0.8, 50), "Over");
  });

  it("menandai Sesuai ketika biaya sejalan dengan progres", () => {
    assert.equal(statusSerapan(0.5, 50), "Sesuai");
  });

  it("menandai Hemat ketika biaya tertinggal dari progres", () => {
    assert.equal(statusSerapan(0.2, 50), "Hemat");
  });

  it("memberi toleransi tiga poin persen agar tidak berkedip", () => {
    assert.equal(statusSerapan(0.52, 50), "Sesuai");
    assert.equal(statusSerapan(0.48, 50), "Sesuai");
  });
});

describe("ringkasKontrak", () => {
  const kontrak = {
    nominal: 900_000_000,
    retensiPct: 5,
    pembayaran: [{ nominal: 300_000_000 }, { nominal: 250_000_000 }],
    variationOrders: [
      { nominal: 24_000_000, status: "Disetujui" },
      { nominal: -8_500_000, status: "Disetujui" },
      { nominal: 36_000_000, status: "Diajukan" },
    ],
  };

  it("hanya VO disetujui yang menggeser nilai kontrak", () => {
    const r = ringkasKontrak(kontrak);
    assert.equal(r.voDisetujui, 15_500_000);
    assert.equal(r.nilaiEfektif, 915_500_000);
  });

  it("VO yang masih diajukan dilaporkan terpisah", () => {
    assert.equal(ringkasKontrak(kontrak).voDiajukan, 36_000_000);
  });

  it("menerima VO negatif untuk pekerjaan kurang", () => {
    const kurang = { ...kontrak, variationOrders: [{ nominal: -50_000_000, status: "Disetujui" }] };
    assert.equal(ringkasKontrak(kurang).nilaiEfektif, 850_000_000);
  });

  it("menghitung sisa terhadap nilai efektif, bukan nilai awal", () => {
    const r = ringkasKontrak(kontrak);
    assert.equal(r.terbayar, 550_000_000);
    assert.equal(r.sisa, 915_500_000 - 550_000_000);
  });

  it("menahan retensi dari nilai yang bisa ditagih sekarang", () => {
    const r = ringkasKontrak(kontrak);
    assert.equal(r.retensi, 915_500_000 * 0.05);
    assert.equal(r.sisaTanpaRetensi, r.nilaiEfektif - r.retensi - r.terbayar);
  });

  it("tidak membagi nol pada kontrak bernilai nol", () => {
    const kosong = { nominal: 0, retensiPct: 0, pembayaran: [], variationOrders: [] };
    assert.equal(ringkasKontrak(kosong).persenTerbayar, 0);
  });
});

describe("alokasiKontrak", () => {
  it("membagi rata bila tidak ada override", () => {
    const hasil = alokasiKontrak(900_000_000, [{}, {}, {}]);
    for (const h of hasil) assert.equal(h.alokasi, 300_000_000);
  });

  it("menghormati override dan membagi sisanya", () => {
    const hasil = alokasiKontrak(540_000_000, [
      { nilaiOverride: 165_000_000 },
      { nilaiOverride: 210_000_000 },
      { nilaiOverride: null },
    ]);
    assert.equal(hasil[0].alokasi, 165_000_000);
    assert.equal(hasil[1].alokasi, 210_000_000);
    assert.equal(hasil[2].alokasi, 540_000_000 - 165_000_000 - 210_000_000);
  });

  it("jumlah alokasi sama dengan nilai kontrak", () => {
    const nilai = 520_000_000;
    const total = alokasiKontrak(nilai, [{}, {}, { nilaiOverride: 100_000_000 }, {}])
      .reduce((s, h) => s + h.alokasi, 0);
    assert.ok(Math.abs(total - nilai) < 1e-6);
  });

  it("mengembalikan daftar kosong bila tak ada objek pekerjaan", () => {
    assert.deepEqual(alokasiKontrak(100, []), []);
  });

  it("tidak membagi nol ketika semua item di-override", () => {
    const hasil = alokasiKontrak(300, [{ nilaiOverride: 100 }, { nilaiOverride: 200 }]);
    assert.deepEqual(hasil.map((h) => h.alokasi), [100, 200]);
  });
});

describe("totalVoDisetujui", () => {
  it("mengabaikan VO yang ditolak maupun yang masih diajukan", () => {
    const total = totalVoDisetujui([
      { nominal: 10, status: "Disetujui" },
      { nominal: 20, status: "Diajukan" },
      { nominal: 40, status: "Ditolak" },
    ]);
    assert.equal(total, 10);
  });
});
