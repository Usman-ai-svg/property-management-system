import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  biayaKelompok, biayaKomponen, hargaSatuanAnalisa, nilaiBaris,
  rekapAnalisa, rekapRabPerGrup, totalRab, type Analisa, type KomponenAnalisa,
} from "./ahsp";

/**
 * Contoh analisa nyata: pasangan pondasi batu kali 1:4 per m³, koefisien gaya
 * SNI. Nilainya dihitung ulang dengan tangan di bawah sebagai pembanding
 * independen — bila suatu saat berbeda, perbedaannya harus disengaja.
 */
const PONDASI: Analisa = {
  overheadPct: 13,
  komponen: [
    { kelompok: "BAHAN", koefisien: 1.2, hargaAcuan: 350_000 },   // batu belah
    { kelompok: "BAHAN", koefisien: 163, hargaAcuan: 1_600 },     // semen (kg)
    { kelompok: "BAHAN", koefisien: 0.52, hargaAcuan: 250_000 },  // pasir pasang
    { kelompok: "UPAH", koefisien: 1.5, hargaAcuan: 110_000 },    // pekerja
    { kelompok: "UPAH", koefisien: 0.75, hargaAcuan: 150_000 },   // tukang batu
    { kelompok: "UPAH", koefisien: 0.075, hargaAcuan: 170_000 },  // kepala tukang
    { kelompok: "UPAH", koefisien: 0.075, hargaAcuan: 180_000 },  // mandor
  ],
};

// Hitung ulang tangan.
const UPAH = 1.5 * 110_000 + 0.75 * 150_000 + 0.075 * 170_000 + 0.075 * 180_000; // 303.750
const BAHAN = 1.2 * 350_000 + 163 * 1_600 + 0.52 * 250_000;                       // 810.800
const LANGSUNG = UPAH + BAHAN;                                                     // 1.114.550
// Overhead dihitung ×13/100 (bukan ×1,13) supaya bebas galat pembulatan biner —
// 1.114.550 × 1,13 di floating point jatuh ke 1.259.441,4999… dan salah bulat.
const OVERHEAD = (LANGSUNG * 13) / 100;                                            // 144.891,5
const HARGA = Math.round(LANGSUNG + OVERHEAD);                                     // 1.259.442

describe("biayaKomponen", () => {
  it("mengalikan koefisien dengan harga acuan", () => {
    assert.equal(biayaKomponen({ koefisien: 0.52, hargaAcuan: 250_000 }), 130_000);
  });
});

describe("biayaKelompok", () => {
  it("menjumlah hanya komponen kelompok yang diminta", () => {
    assert.equal(biayaKelompok(PONDASI.komponen, "UPAH"), UPAH);
    assert.equal(biayaKelompok(PONDASI.komponen, "BAHAN"), BAHAN);
  });

  it("mengembalikan nol untuk kelompok yang tak punya komponen", () => {
    assert.equal(biayaKelompok(PONDASI.komponen, "ALAT"), 0);
  });
});

describe("rekapAnalisa", () => {
  it("cocok dengan hitungan tangan yang independen", () => {
    const r = rekapAnalisa(PONDASI);
    assert.equal(r.upah, UPAH);
    assert.equal(r.bahan, BAHAN);
    assert.equal(r.alat, 0);
    assert.equal(r.langsung, LANGSUNG);
    assert.equal(r.overhead, OVERHEAD);
    assert.equal(r.hargaSatuan, HARGA);
  });

  it("mengenakan overhead atas total biaya langsung, bukan per kelompok", () => {
    // Overhead sekali atas (upah+bahan) harus sama dengan langsung×(1+pct),
    // bukan (upah×1,13)+(bahan×1,13) yang kebetulan sama — jadi diuji lewat
    // pemisahan: satu analisa upah-saja + satu bahan-saja ≠ dampak pembulatan.
    const r = rekapAnalisa(PONDASI);
    assert.equal(r.overhead, (r.langsung * 13) / 100);
    assert.equal(r.hargaSatuan, Math.round(r.langsung + r.overhead));
  });

  it("overhead 0% membuat harga satuan = pembulatan biaya langsung", () => {
    const r = rekapAnalisa({ ...PONDASI, overheadPct: 0 });
    assert.equal(r.overhead, 0);
    assert.equal(r.hargaSatuan, Math.round(LANGSUNG));
  });

  it("membulatkan harga satuan ke rupiah penuh", () => {
    const a: Analisa = {
      overheadPct: 10,
      komponen: [{ kelompok: "BAHAN", koefisien: 1, hargaAcuan: 3_333 }],
    };
    // 3.333 × 1,1 = 3.666,3 → 3.666
    assert.equal(rekapAnalisa(a).hargaSatuan, 3_666);
  });
});

describe("hargaSatuanAnalisa", () => {
  it("sama dengan hargaSatuan pada rekap penuh", () => {
    assert.equal(hargaSatuanAnalisa(PONDASI), rekapAnalisa(PONDASI).hargaSatuan);
  });

  it("naik ketika sebuah harga acuan naik", () => {
    const naik: Analisa = {
      ...PONDASI,
      komponen: PONDASI.komponen.map((k: KomponenAnalisa) =>
        k.kelompok === "BAHAN" ? { ...k, hargaAcuan: k.hargaAcuan * 1.1 } : k,
      ),
    };
    assert.ok(hargaSatuanAnalisa(naik) > hargaSatuanAnalisa(PONDASI));
  });
});

describe("nilaiBaris & totalRab", () => {
  it("nilai baris = volume × harga satuan", () => {
    assert.equal(nilaiBaris({ volume: 12.5, hargaSatuan: 1_000_000 }), 12_500_000);
  });

  it("total menjumlah seluruh baris", () => {
    assert.equal(
      totalRab([
        { volume: 2, hargaSatuan: 1_000 },
        { volume: 3, hargaSatuan: 1_000 },
      ]),
      5_000,
    );
  });
});

describe("rekapRabPerGrup", () => {
  it("mempertahankan urutan kemunculan pertama, bukan alfabetis", () => {
    const grup = rekapRabPerGrup([
      { grup: "Struktur", uraian: "a", volume: 1, hargaSatuan: 1 },
      { grup: "Persiapan", uraian: "b", volume: 1, hargaSatuan: 1 },
      { grup: "Struktur", uraian: "c", volume: 1, hargaSatuan: 1 },
    ]);
    assert.deepEqual(grup.map((g) => g.nama), ["Struktur", "Persiapan"]);
    assert.equal(grup[0].items.length, 2);
  });

  it("menjumlahkan total tiap grup", () => {
    const grup = rekapRabPerGrup([
      { grup: "Tanah", uraian: "galian", volume: 10, hargaSatuan: 90_000 },
      { grup: "Tanah", uraian: "urugan", volume: 4, hargaSatuan: 30_000 },
    ]);
    assert.equal(grup[0].total, 10 * 90_000 + 4 * 30_000);
  });

  it("membawa serta field tambahan seperti id", () => {
    const grup = rekapRabPerGrup([
      { id: "abc", grup: "A", uraian: "x", volume: 1, hargaSatuan: 1 },
    ]);
    assert.equal(grup[0].items[0].id, "abc");
  });
});
