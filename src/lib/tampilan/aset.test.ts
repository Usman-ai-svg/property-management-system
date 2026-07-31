import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { kpiAset } from "./aset";

const HARI = 864e5;
const KINI = new Date("2026-07-01T00:00:00Z");

const aset = (
  kepemilikan: string,
  status: string,
  servisBerikut: Date | null = null,
  nilai?: number,
) => ({ kepemilikan, status, servisBerikut, nilai });

describe("kpiAset", () => {
  it("memisahkan aset milik sendiri dari aset sewa", () => {
    const k = kpiAset(
      [
        aset("Milik Sendiri", "Tersedia"),
        aset("Milik Sendiri", "Digunakan"),
        aset("Sewa", "Digunakan"),
      ],
      KINI,
    );
    assert.equal(k.jumlahJenis, 3);
    assert.equal(k.milikSendiri, 2);
    assert.equal(k.sewa, 1);
  });

  it("perlu perhatian mencakup Rusak DAN Pemeliharaan", () => {
    const k = kpiAset(
      [
        aset("Milik Sendiri", "Rusak"),
        aset("Milik Sendiri", "Pemeliharaan"),
        aset("Milik Sendiri", "Tersedia"),
        aset("Sewa", "Digunakan"),
      ],
      KINI,
    );
    assert.equal(k.perluPerhatian, 2);
  });

  it("nilai hanya menjumlahkan aset milik sendiri", () => {
    // Nilai pada aset sewa adalah TARIF, bukan nilai perolehan —
    // menjumlahkannya menghasilkan angka yang tidak berarti apa-apa.
    const k = kpiAset(
      [aset("Milik Sendiri", "Tersedia", null, 100), aset("Sewa", "Digunakan", null, 500)],
      KINI,
    );
    assert.equal(k.nilaiMilikSendiri, 100);
  });

  it("nilai nol bila kolomnya tidak di-SELECT untuk peran ini", () => {
    const k = kpiAset([aset("Milik Sendiri", "Tersedia")], KINI);
    assert.equal(k.nilaiMilikSendiri, 0);
  });

  it("servis dekat mencakup yang jatuh tempo 30 hari ke depan", () => {
    const k = kpiAset(
      [
        aset("Milik Sendiri", "Tersedia", new Date(KINI.getTime() + 10 * HARI)),
        aset("Milik Sendiri", "Tersedia", new Date(KINI.getTime() + 40 * HARI)),
      ],
      KINI,
    );
    assert.equal(k.servisDekat, 1);
  });

  it("servis yang sudah TERLEWAT tetap terhitung, bukan diabaikan", () => {
    const k = kpiAset(
      [aset("Milik Sendiri", "Tersedia", new Date(KINI.getTime() - 5 * HARI))],
      KINI,
    );
    assert.equal(k.servisDekat, 1);
  });

  it("aset tanpa jadwal servis tidak ikut terhitung", () => {
    const k = kpiAset([aset("Milik Sendiri", "Tersedia", null)], KINI);
    assert.equal(k.servisDekat, 0);
  });

  it("daftar kosong menghasilkan nol di semua angka", () => {
    const k = kpiAset([], KINI);
    assert.deepEqual(k, {
      jumlahJenis: 0, milikSendiri: 0, sewa: 0,
      perluPerhatian: 0, nilaiMilikSendiri: 0, servisDekat: 0,
    });
  });
});
