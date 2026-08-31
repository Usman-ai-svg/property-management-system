import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { bacaSegmen, kodeProyekDari, segmen } from "./rute";

describe("segmen alamat", () => {
  it("meloloskan kode biasa tanpa mengubahnya", () => {
    for (const kode of ["NT2", "T36", "NT2-F1-1", "NWT", "SPK-NT4-003"]) {
      assert.equal(segmen(kode), kode);
      assert.equal(bacaSegmen(segmen(kode)), kode);
    }
  });

  it("menyandi garis miring supaya tidak memecah alamat", () => {
    // Ini kasus yang bikin halaman 404: tipe rumah "36/72" ditempel mentah
    // jadi /master/NT2/tipe/36/72 — dua segmen, bukan satu.
    assert.equal(segmen("36/72"), "36%2F72");
    assert.ok(!segmen("36/72").includes("/"));
  });

  it("bolak-balik utuh untuk kode yang tidak ramah alamat", () => {
    const contoh = [
      "36/72", // tipe rumah
      "45/90",
      "F1/A", // kode fase
      "NT2-F1/A-901", // kode unit yang mewarisi kode fase
      "BLOK A", // spasi
      "RTH#1", // pagar — memotong alamat jadi fragmen
      "A?B", // tanda tanya — sisanya dianggap kueri
      "DISKON 50%", // persen — mudah salah baca kalau disandi dua kali
      "A&B",
      "JL. RAYA + 2",
      "TIPE Ã‰",
    ];
    for (const kode of contoh) {
      assert.equal(bacaSegmen(segmen(kode)), kode, `gagal bolak-balik: ${kode}`);
    }
  });

  it("membuka sandi tepat sekali", () => {
    // Kode yang memang memuat tulisan "%2F" tidak boleh berubah jadi "/".
    assert.equal(bacaSegmen(segmen("A%2FB")), "A%2FB");
  });

  it("mengembalikan nilai mentah bila sandinya cacat, bukan melempar", () => {
    // Alamat yang dirangkai tangan bisa cacat. Yang benar adalah pencarian
    // gagal wajar (404), bukan halaman error 500.
    assert.equal(bacaSegmen("%E0%A4"), "%E0%A4");
    assert.equal(bacaSegmen("%"), "%");
  });

  it("membakukan kode proyek jadi huruf besar", () => {
    assert.equal(kodeProyekDari("nt2"), "NT2");
    assert.equal(kodeProyekDari(segmen("nt/2")), "NT/2");
  });
});
