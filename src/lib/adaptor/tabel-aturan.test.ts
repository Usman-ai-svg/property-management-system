import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  angkaDari, bacaBoq, bacaRap, GagalImpor, KOLOM_BOQ, petakanKolom, teksDari,
  type Tabel,
} from "./tabel-aturan";

describe("angkaDari", () => {
  it("membaca angka apa adanya", () => {
    assert.equal(angkaDari(1250), 1250);
    assert.equal(angkaDari(12.5), 12.5);
  });

  it("membaca format ribuan Indonesia", () => {
    assert.equal(angkaDari("1.250.000"), 1250000);
    assert.equal(angkaDari("250.000"), 250000);
  });

  it("membaca koma sebagai desimal", () => {
    assert.equal(angkaDari("1.250,5"), 1250.5);
    assert.equal(angkaDari("12,75"), 12.75);
  });

  it("membuang awalan Rp", () => {
    assert.equal(angkaDari("Rp 1.250.000"), 1250000);
    assert.equal(angkaDari("rp250000"), 250000);
  });

  it("membaca titik desimal gaya Inggris bila bukan pola ribuan", () => {
    assert.equal(angkaDari("12.5"), 12.5);
  });

  it("null untuk sel kosong maupun teks yang bukan angka", () => {
    assert.equal(angkaDari(null), null);
    assert.equal(angkaDari(""), null);
    assert.equal(angkaDari("n/a"), null);
  });
});

describe("teksDari", () => {
  it("memangkas spasi", () => {
    assert.equal(teksDari("  Pek. Pondasi  "), "Pek. Pondasi");
  });

  it("kosong untuk sel kosong", () => {
    assert.equal(teksDari(null), "");
  });
});

describe("petakanKolom", () => {
  it("menemukan baris judul walau didahului baris kop", () => {
    const t: Tabel = [
      ["PT NANOLAND", null, null],
      ["BOQ Unit Galileo", null, null],
      [null, null, null],
      ["Uraian", "Volume", "Harga Satuan"],
      ["Pek. Pondasi", 10, 500000],
    ];
    const { barisJudul, kolom } = petakanKolom(t, KOLOM_BOQ, ["uraian", "volume", "hargaSatuan"]);
    assert.equal(barisJudul, 3);
    assert.deepEqual(kolom.uraian, 0);
    assert.deepEqual(kolom.hargaSatuan, 2);
  });

  it("mengenali sinonim judul kolom", () => {
    const t: Tabel = [["Pekerjaan", "Qty", "Harga"]];
    const { kolom } = petakanKolom(t, KOLOM_BOQ, ["uraian", "volume", "hargaSatuan"]);
    assert.equal(kolom.uraian, 0);
    assert.equal(kolom.volume, 1);
    assert.equal(kolom.hargaSatuan, 2);
  });

  it("tidak peduli huruf besar-kecil", () => {
    const t: Tabel = [["URAIAN", "VOLUME", "HARGA SATUAN"]];
    assert.doesNotThrow(() => petakanKolom(t, KOLOM_BOQ, ["uraian", "volume", "hargaSatuan"]));
  });

  it("menyerah setelah sepuluh baris pertama", () => {
    const t: Tabel = [
      ...Array.from({ length: 10 }, () => [null, null, null] as Tabel[number]),
      ["Uraian", "Volume", "Harga Satuan"],
    ];
    assert.throws(
      () => petakanKolom(t, KOLOM_BOQ, ["uraian", "volume", "hargaSatuan"]),
      GagalImpor,
    );
  });

  it("menyebutkan kolom wajib pada pesan galatnya", () => {
    try {
      petakanKolom([["Entah"]], KOLOM_BOQ, ["uraian", "volume", "hargaSatuan"]);
      assert.fail("seharusnya gagal");
    } catch (e) {
      assert.ok(e instanceof GagalImpor);
      assert.match(e.rincian[0], /uraian, volume, hargaSatuan/);
    }
  });
});

describe("bacaBoq", () => {
  const judul = ["Grup", "Uraian", "Satuan", "Volume", "Harga Satuan"];

  it("membaca baris yang sah", () => {
    const hasil = bacaBoq([judul, ["Struktur", "Pek. Pondasi", "m3", 10, "500.000"]]);
    assert.deepEqual(hasil, [
      {
        grup: "Struktur", uraian: "Pek. Pondasi", satuan: "m3",
        volume: 10, hargaSatuan: 500000, spesifikasi: null,
      },
    ]);
  });

  it("melewati baris kosong tanpa mengeluh", () => {
    const hasil = bacaBoq([
      judul,
      ["Struktur", "Pek. Pondasi", "m3", 10, 500000],
      [null, null, null, null, null],
      ["Struktur", "Pek. Sloof", "m3", 5, 400000],
    ]);
    assert.equal(hasil.length, 2);
  });

  it("membuang baris total supaya tidak ikut jadi pekerjaan", () => {
    const hasil = bacaBoq([
      judul,
      ["Struktur", "Pek. Pondasi", "m3", 10, 500000],
      [null, "TOTAL", null, null, 5000000],
      [null, "Sub Total", null, null, 5000000],
    ]);
    assert.equal(hasil.length, 1);
  });

  it("satuan kosong diisi 'ls'", () => {
    const [b] = bacaBoq([judul, ["Struktur", "Pek. Pondasi", null, 1, 100]]);
    assert.equal(b.satuan, "ls");
  });

  it("menolak SELURUH impor bila ada satu baris tidak sah", () => {
    // Prinsipnya: impor tidak boleh separuh jadi.
    assert.throws(
      () =>
        bacaBoq([
          judul,
          ["Struktur", "Pek. Pondasi", "m3", 10, 500000],
          ["Struktur", "Pek. Sloof", "m3", "entah", 400000],
        ]),
      GagalImpor,
    );
  });

  it("melaporkan seluruh kesalahan sekaligus, bukan satu per satu", () => {
    try {
      bacaBoq([
        judul,
        ["A", "Pek. 1", "m3", "x", 1],
        ["A", "Pek. 2", "m3", 1, "y"],
        ["A", "Pek. 3", "m3", -5, 1],
      ]);
      assert.fail("seharusnya gagal");
    } catch (e) {
      assert.ok(e instanceof GagalImpor);
      assert.equal(e.rincian.length, 3);
    }
  });

  it("nomor baris pada galat cocok dengan yang terlihat di Excel", () => {
    try {
      bacaBoq([judul, ["A", "Pek. 1", "m3", "bukan angka", 1]]);
      assert.fail("seharusnya gagal");
    } catch (e) {
      assert.ok(e instanceof GagalImpor);
      // Judul di baris 1, data di baris 2.
      assert.match(e.rincian[0], /^Baris 2:/);
    }
  });

  it("menolak volume dan harga negatif", () => {
    // Alasannya ada di rincian per baris, bukan di pesan ringkasnya.
    for (const baris of [["A", "Pek. 1", "m3", -1, 100], ["A", "Pek. 1", "m3", 1, -100]]) {
      try {
        bacaBoq([judul, baris]);
        assert.fail("seharusnya gagal");
      } catch (e) {
        assert.ok(e instanceof GagalImpor);
        assert.match(e.rincian[0], /negatif/);
      }
    }
  });

  it("mengeluh bila tidak ada satu pun baris data", () => {
    assert.throws(() => bacaBoq([judul]), /Tidak ada baris data/);
  });
});

describe("bacaRap", () => {
  const judul = ["Kelompok", "Material", "Satuan", "Volume", "Harga"];

  it("mengelompokkan item menurut kolom kelompok", () => {
    const { kelompok } = bacaRap([
      judul,
      ["Struktur", "Semen", "sak", 100, 65000],
      [null, "Pasir", "m3", 10, 250000],
      ["Atap", "Genteng", "bh", 500, 12000],
    ]);
    assert.equal(kelompok.length, 2);
    assert.equal(kelompok[0].nama, "Struktur");
    assert.equal(kelompok[0].items.length, 2, "kelompok diwarisi baris berikutnya");
    assert.equal(kelompok[1].nama, "Atap");
  });

  it("item sebelum kelompok pertama masuk 'Lain-lain'", () => {
    const { kelompok } = bacaRap([judul, [null, "Semen", "sak", 1, 65000]]);
    assert.equal(kelompok[0].nama, "Lain-lain");
  });

  it("baris upah diambil terpisah, bukan sebagai material", () => {
    const { kelompok, upah } = bacaRap([
      judul,
      ["Struktur", "Semen", "sak", 100, 65000],
      [null, "Upah Tenaga Kerja", null, null, 25000000],
    ]);
    assert.equal(upah, 25000000);
    assert.equal(kelompok.flatMap((k) => k.items).length, 1);
  });

  it("upah terbaca dari kolom volume bila kolom harga kosong", () => {
    const { upah } = bacaRap([
      judul,
      ["A", "Semen", "sak", 1, 1],
      [null, "Upah", null, 15000000, null],
    ]);
    assert.equal(upah, 15000000);
  });

  it("upah null bila memang tidak ada barisnya", () => {
    const { upah } = bacaRap([judul, ["A", "Semen", "sak", 1, 1]]);
    assert.equal(upah, null);
  });

  it("menolak seluruh impor bila ada baris tidak sah", () => {
    assert.throws(
      () => bacaRap([judul, ["A", "Semen", "sak", "entah", 65000]]),
      GagalImpor,
    );
  });
});
