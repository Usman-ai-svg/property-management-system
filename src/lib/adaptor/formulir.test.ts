import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  angkaIndonesia, bacaAngka, bacaPilihan, bacaTeks, bacaTeksOpsional, barisSejajar, GagalIsian,
  type Pembaca,
} from "./formulir";
import { angkaDari } from "./tabel-aturan";

/** Pembaca dari objek biasa, untuk tes. */
const dari = (o: Record<string, string>): Pembaca => (nama) => o[nama] ?? null;

describe("angkaIndonesia", () => {
  it("membaca angka polos", () => {
    assert.equal(angkaIndonesia("1250"), 1250);
    assert.equal(angkaIndonesia("0"), 0);
  });

  it("titik diikuti tepat tiga digit adalah pemisah ribuan", () => {
    assert.equal(angkaIndonesia("1.250"), 1250);
    assert.equal(angkaIndonesia("1.250.000"), 1250000);
    assert.equal(angkaIndonesia("250.000"), 250000);
  });

  it("titik yang BUKAN pola ribuan adalah pemisah desimal", () => {
    // Inilah cabang yang membuat aturannya tidak bisa disederhanakan:
    // "1.250" dan "12.5" sama-sama satu titik tapi dibaca berbeda.
    assert.equal(angkaIndonesia("12.5"), 12.5);
    assert.equal(angkaIndonesia("0.75"), 0.75);
    assert.equal(angkaIndonesia("1.25"), 1.25);
  });

  it("koma selalu pemisah desimal, titik jadi pemisah ribuan", () => {
    assert.equal(angkaIndonesia("12,5"), 12.5);
    assert.equal(angkaIndonesia("1.250,75"), 1250.75);
    assert.equal(angkaIndonesia("1.250.000,50"), 1250000.5);
  });

  it("menerima angka negatif", () => {
    assert.equal(angkaIndonesia("-500"), -500);
  });

  it("null untuk kosong dan untuk teks yang bukan angka", () => {
    assert.equal(angkaIndonesia(""), null);
    assert.equal(angkaIndonesia("   "), null);
    assert.equal(angkaIndonesia("entah"), null);
    assert.equal(angkaIndonesia("12abc"), null);
  });

  it("awalan Rp hanya diterima bila diminta", () => {
    assert.equal(angkaIndonesia("Rp 1.250.000"), null);
    assert.equal(angkaIndonesia("Rp 1.250.000", { terimaRp: true }), 1250000);
  });

  it("sepakat dengan parser impor Excel untuk seluruh bentuk yang sama", () => {
    // Dua jalur masuk yang berbeda — ketikan formulir dan sel Excel — harus
    // membaca angka yang sama dengan cara yang sama. Sebelum disatukan,
    // keduanya adalah dua salinan kode yang bisa bergeser sendiri-sendiri.
    for (const contoh of ["1250", "1.250", "1.250.000", "12.5", "12,75", "1.250,5", "0", "-3"]) {
      assert.equal(
        angkaIndonesia(contoh),
        angkaDari(contoh),
        `berbeda untuk "${contoh}"`,
      );
    }
  });
});

describe("bacaTeks", () => {
  it("memangkas spasi", () => {
    assert.equal(bacaTeks(dari({ nama: "  Budi  " }), "nama"), "Budi");
  });

  it("kosong bila tidak ada isiannya", () => {
    assert.equal(bacaTeks(dari({}), "nama"), "");
  });

  it("melempar bila wajib tapi kosong", () => {
    assert.throws(() => bacaTeks(dari({}), "nama", true), GagalIsian);
    assert.throws(() => bacaTeks(dari({ nama: "   " }), "nama", true), /wajib diisi/);
  });

  it("menyebut nama kolomnya pada pesan galat", () => {
    assert.throws(() => bacaTeks(dari({}), "uraian", true), /"uraian"/);
  });
});

describe("bacaTeksOpsional", () => {
  it("null untuk kosong, bukan string kosong", () => {
    assert.equal(bacaTeksOpsional(dari({}), "ket"), null);
    assert.equal(bacaTeksOpsional(dari({ ket: "  " }), "ket"), null);
  });

  it("mengembalikan teksnya bila terisi", () => {
    assert.equal(bacaTeksOpsional(dari({ ket: " catatan " }), "ket"), "catatan");
  });
});

describe("bacaAngka", () => {
  it("isian kosong bernilai 0 bila tidak wajib", () => {
    // Bukan null: hampir seluruh pemanggil menyimpannya ke kolom angka.
    assert.equal(bacaAngka(dari({}), "nilai"), 0);
  });

  it("melempar bila wajib tapi kosong", () => {
    assert.throws(() => bacaAngka(dari({}), "nilai", { wajib: true }), /wajib diisi/);
  });

  it("melempar untuk teks yang bukan angka, menyebut nilainya", () => {
    assert.throws(() => bacaAngka(dari({ v: "entah" }), "v"), /"entah"/);
  });

  it("menegakkan batas bawah", () => {
    assert.equal(bacaAngka(dari({ v: "5" }), "v", { min: 0 }), 5);
    assert.throws(() => bacaAngka(dari({ v: "-1" }), "v", { min: 0 }), /kurang dari 0/);
  });

  it("menegakkan batas atas — dipakai progres 0..100", () => {
    assert.equal(bacaAngka(dari({ v: "100" }), "v", { min: 0, max: 100 }), 100);
    assert.throws(() => bacaAngka(dari({ v: "101" }), "v", { max: 100 }), /lebih dari 100/);
  });

  it("nol tetap lolos batas min 0 — bukan dianggap kosong", () => {
    assert.equal(bacaAngka(dari({ v: "0" }), "v", { min: 0, wajib: true }), 0);
  });

  it("membaca format ribuan yang diketik pengguna", () => {
    assert.equal(bacaAngka(dari({ v: "1.250.000" }), "v"), 1250000);
  });

  it("menolak awalan Rp secara bawaan", () => {
    // Perilaku formulir hari ini. Diuji supaya perubahannya menjadi keputusan
    // sadar, bukan efek samping perapian kode.
    assert.throws(() => bacaAngka(dari({ v: "Rp 500.000" }), "v"), GagalIsian);
    assert.equal(bacaAngka(dari({ v: "Rp 500.000" }), "v", { terimaRp: true }), 500000);
  });
});

describe("bacaPilihan", () => {
  const SAH = ["Aktif", "Nonaktif"] as const;

  it("meloloskan nilai yang terdaftar", () => {
    assert.equal(bacaPilihan(dari({ s: "Aktif" }), "s", SAH), "Aktif");
  });

  it("menolak nilai di luar daftar — ini yang menahan enum karangan", () => {
    assert.throws(() => bacaPilihan(dari({ s: "Entah" }), "s", SAH), /tidak sah/);
  });

  it("menolak isian kosong", () => {
    assert.throws(() => bacaPilihan(dari({}), "s", SAH), GagalIsian);
  });

  it("peka huruf besar-kecil — nilai enum harus persis", () => {
    assert.throws(() => bacaPilihan(dari({ s: "aktif" }), "s", SAH), /tidak sah/);
  });
});

describe("barisSejajar", () => {
  const ids = ["u1", "u2"];
  const nominal = [100, 200];

  it("merakit baris dari beberapa larik sejajar", () => {
    const baris = barisSejajar([ids.length, nominal.length], (i) => ({ id: ids[i], nominal: nominal[i] }));
    assert.deepEqual(baris, [{ id: "u1", nominal: 100 }, { id: "u2", nominal: 200 }]);
  });

  it("memakai larik TERPANJANG supaya baris berisian kosong tidak hilang diam-diam", () => {
    // Kalau kolom nominal lebih pendek karena satu isian tak terkirim, barisnya
    // tetap terbentuk dan akan ditolak validasi — bukan lenyap tanpa jejak.
    const kurang = [100];
    const baris = barisSejajar([ids.length, kurang.length], (i) => ({ id: ids[i], nominal: kurang[i] ?? 0 }));
    assert.equal(baris.length, 2);
    assert.deepEqual(baris[1], { id: "u2", nominal: 0 });
  });

  it("seluruh larik kosong menghasilkan daftar kosong", () => {
    assert.deepEqual(barisSejajar([0, 0], (i) => i), []);
  });

  it("tanpa larik sama sekali juga kosong, bukan galat", () => {
    assert.deepEqual(barisSejajar([], (i) => i), []);
  });
});
