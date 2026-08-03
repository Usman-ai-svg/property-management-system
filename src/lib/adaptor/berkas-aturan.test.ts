import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  bersihkanNamaFile, ekstensiDari, GagalUnggah, kunciAman, kunciObjek,
  MAKS_UKURAN, namaSaja, periksaBerkas, tipeDari,
} from "./berkas-aturan";

describe("ekstensiDari", () => {
  it("mengembalikan ekstensi berhuruf kecil", () => {
    assert.equal(ekstensiDari("Gambar Kerja.PDF"), ".pdf");
    assert.equal(ekstensiDari("model.SKP"), ".skp");
  });

  it("kosong bila tidak ada ekstensi", () => {
    assert.equal(ekstensiDari("README"), "");
  });

  it("tidak tertipu titik pada nama folder", () => {
    assert.equal(ekstensiDari("v1.2/berkas"), "");
    assert.equal(ekstensiDari("v1.2/berkas.pdf"), ".pdf");
  });

  it("berkas tersembunyi tanpa ekstensi tidak dianggap berekstensi", () => {
    assert.equal(ekstensiDari(".gitignore"), "");
  });
});

describe("namaSaja", () => {
  it("membuang jalur gaya POSIX maupun Windows", () => {
    assert.equal(namaSaja("/etc/passwd"), "passwd");
    assert.equal(namaSaja("C:\\Users\\User\\gambar.pdf"), "gambar.pdf");
  });
});

describe("bersihkanNamaFile", () => {
  it("membuang jalur direktori", () => {
    assert.equal(bersihkanNamaFile("../../etc/passwd"), "passwd");
  });

  it("membuang jalur gaya Windows — berkas diunggah dari dua jenis mesin", () => {
    assert.equal(bersihkanNamaFile("C:\\Users\\User\\Gambar Kerja.pdf"), "Gambar Kerja.pdf");
  });

  it("mengganti karakter aneh dengan garis bawah", () => {
    assert.equal(bersihkanNamaFile("lap;oran|k?erja.pdf"), "lap_oran_k_erja.pdf");
  });

  it("mempertahankan spasi, titik, tanda kurung, dan strip", () => {
    assert.equal(bersihkanNamaFile("BOQ Unit (rev-2).xlsx"), "BOQ Unit (rev-2).xlsx");
  });

  it("menolak nama yang setelah dibersihkan tidak menyisakan apa pun", () => {
    assert.throws(() => bersihkanNamaFile("../"), GagalUnggah);
    assert.throws(() => bersihkanNamaFile("."), GagalUnggah);
  });

  it("memangkas nama yang sangat panjang", () => {
    assert.equal(bersihkanNamaFile("a".repeat(300)).length, 180);
  });
});

describe("periksaBerkas", () => {
  const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  it("menerima jenis yang terdaftar", () => {
    assert.doesNotThrow(() => periksaBerkas("boq.xlsx", XLSX, 1024));
    assert.doesNotThrow(() => periksaBerkas("denah.pdf", "application/pdf", 1024));
  });

  it("menolak berkas kosong", () => {
    assert.throws(() => periksaBerkas("a.pdf", "application/pdf", 0), /kosong/i);
  });

  it("menolak berkas melebihi batas", () => {
    assert.throws(() => periksaBerkas("a.pdf", "application/pdf", MAKS_UKURAN + 1), /melebihi/i);
  });

  it("menolak ekstensi yang tidak cocok dengan tipe MIME-nya", () => {
    // Berkas .exe yang mengaku PDF adalah pola serangan paling dasar.
    assert.throws(() => periksaBerkas("virus.exe", "application/pdf", 1024), /tidak diterima/i);
  });

  it("menolak tipe MIME yang sama sekali tidak terdaftar", () => {
    assert.throws(() => periksaBerkas("a.sh", "application/x-sh", 1024), /tidak diterima/i);
  });

  it("menerima berkas 3D yang browser-nya tidak mengenali tipenya", () => {
    // Chrome mengirim tipe kosong untuk .skp dan .dwg.
    assert.doesNotThrow(() => periksaBerkas("model.skp", "", 1024));
    assert.doesNotThrow(() => periksaBerkas("denah.dwg", "application/octet-stream", 1024));
  });

  it("tetap menolak ekstensi berbahaya walau tipenya kosong", () => {
    assert.throws(() => periksaBerkas("skrip.sh", "", 1024), /tidak diterima/i);
  });
});

describe("kunciObjek", () => {
  it("memakai UUID, bukan nama asli", () => {
    const k = kunciObjek("Gambar Kerja.pdf", "abc-123", 2026);
    assert.equal(k, "2026/abc-123.pdf");
    assert.equal(k.includes("Gambar"), false);
  });

  it("dua unggahan bernama sama tidak saling menimpa", () => {
    assert.notEqual(kunciObjek("a.pdf", "u1", 2026), kunciObjek("a.pdf", "u2", 2026));
  });

  it("dikelompokkan per tahun", () => {
    assert.equal(kunciObjek("a.pdf", "u1", 2025).startsWith("2025/"), true);
  });
});

describe("kunciAman", () => {
  it("menerima kunci yang dibuat sendiri", () => {
    assert.equal(kunciAman("2026/abc-123.pdf"), true);
  });

  it("menolak segmen naik direktori", () => {
    assert.equal(kunciAman("../rahasia.pdf"), false);
    assert.equal(kunciAman("2026/../../etc/passwd"), false);
  });

  it("menolak jalur absolut, termasuk gaya Windows", () => {
    assert.equal(kunciAman("/etc/passwd"), false);
    assert.equal(kunciAman("C:\\Windows\\system32"), false);
  });

  it("menolak kunci kosong", () => {
    assert.equal(kunciAman(""), false);
  });
});

describe("tipeDari", () => {
  it("mengembalikan tipe MIME sesuai ekstensi", () => {
    assert.equal(tipeDari("a.pdf"), "application/pdf");
    assert.equal(tipeDari("a.PNG"), "image/png");
  });

  it("jatuh ke octet-stream untuk yang tidak dikenali", () => {
    assert.equal(tipeDari("a.xyz"), "application/octet-stream");
  });
});
