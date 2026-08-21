import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  cariTransisi,
  laporanTerkunci,
  saldoDana,
  totalLaporan,
  transisiDari,
} from "./petty-cash";

describe("saldoDana", () => {
  it("saldo = Σ topUp − Σ pengeluaran", () => {
    const saldo = saldoDana(
      [{ nominal: 2_000_000 }, { nominal: 1_500_000 }],
      [{ total: 800_000 }, { total: 300_000 }],
    );
    assert.equal(saldo, 2_400_000);
  });

  it("boleh negatif — pemegang menalangi lebih dari kas di tangan", () => {
    const saldo = saldoDana([{ nominal: 1_000_000 }], [{ total: 1_250_000 }]);
    assert.equal(saldo, -250_000);
  });

  it("tanpa mutasi apa pun saldonya nol", () => {
    assert.equal(saldoDana([], []), 0);
  });
});

describe("totalLaporan", () => {
  it("menjumlah total tiap pengeluaran", () => {
    assert.equal(totalLaporan([{ total: 100 }, { total: 250 }]), 350);
  });
});

describe("transisi status", () => {
  it("Draft hanya bisa diajukan oleh pemegang", () => {
    const t = transisiDari("Draft");
    assert.equal(t.length, 1);
    assert.equal(t[0]?.ke, "Diajukan");
    assert.equal(t[0]?.oleh, "Pemegang");
  });

  it("Diajukan bisa diverifikasi atau dikembalikan QS", () => {
    const t = transisiDari("Diajukan").map((x) => x.ke).sort();
    assert.deepEqual(t, ["DiverifikasiQS", "Draft"]);
  });

  it("hanya Finance yang mereimburse laporan yang sudah disetujui", () => {
    const t = cariTransisi("Disetujui", "Direimburse");
    assert.ok(t);
    assert.equal(t?.oleh, "Finance");
  });

  it("transisi yang melompati tahap tidak sah", () => {
    assert.equal(cariTransisi("Draft", "Disetujui"), undefined);
    assert.equal(cariTransisi("Direimburse", "Draft"), undefined);
  });

  it("baris terkunci di semua status kecuali Draft", () => {
    assert.equal(laporanTerkunci("Draft"), false);
    assert.equal(laporanTerkunci("Diajukan"), true);
    assert.equal(laporanTerkunci("Direimburse"), true);
  });
});
