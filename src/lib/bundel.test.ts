import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import * as bundel from "./_bundel";

/**
 * PENJAGA BUNDEL LAPISAN MURNI.
 *
 * `npm run bundel:hitung` memancarkan `src/lib/_bundel.ts` menjadi satu berkas
 * yang dipakai ERP dari `index.html`. Dua hal bisa membuatnya salah tanpa
 * bersuara, dan keduanya dijaga di sini:
 *
 *   1. Modul baru di lapisan murni LUPA didaftarkan. Bundelnya tetap terbangun,
 *      cuma tidak berisi fungsi yang dicari — dan ketahuannya di ERP, sebagai
 *      "undefined is not a function" pada halaman yang jarang dibuka.
 *   2. Dua modul mengekspor nama yang sama dengan isi berbeda. Ini sudah
 *      dijaga `gabung()` yang melempar saat impor; mengimpor bundel di tes ini
 *      berarti pelanggarannya jadi tes merah, bukan bundel diam yang salah.
 */

/** Lapisan yang ikut, beserta namespace-nya di bundel. */
const LAPISAN: [string, Record<string, unknown>][] = [
  ["calc", bundel.calc],
  ["domain", bundel.domain],
  ["tampilan", bundel.tampilan],
  ["adaptor", bundel.adaptor],
  ["format", bundel.format],
  ["kontrak", bundel.kontrak],
];

const sumberBundel = readFileSync("src/lib/_bundel.ts", "utf8");

describe("bundel proyek-hitung", () => {
  it("punya enam namespace, semuanya berisi", () => {
    for (const [nama, isi] of LAPISAN) {
      assert.ok(Object.keys(isi).length > 0, `namespace ${nama} kosong`);
    }
    assert.equal(Object.keys(bundel).length, LAPISAN.length, "ada namespace tak terdaftar di tes");
  });

  it("seluruh modul lapisan murni ikut terdaftar", () => {
    const kurang: string[] = [];
    for (const [lapisan] of LAPISAN) {
      const dir = `src/lib/${lapisan}`;
      for (const berkas of readdirSync(dir)) {
        if (!berkas.endsWith(".ts") || berkas.endsWith(".test.ts")) continue;
        const jalur = `./${lapisan}/${berkas.replace(/\.ts$/, "")}`;
        if (!sumberBundel.includes(`from "${jalur}"`)) kurang.push(`${dir}/${berkas}`);
      }
    }
    assert.deepEqual(
      kurang,
      [],
      `modul lapisan murni belum masuk src/lib/_bundel.ts:\n${kurang.join("\n")}`,
    );
  });

  it("nama yang sama di dua modul harus benar-benar fungsi yang sama", () => {
    // `gabung()` sudah melempar saat modul ini diimpor. Yang diperiksa di sini
    // adalah kasus yang dulu menyembunyikan tiga salinan `nilaiBaris`: nama
    // kembar yang dibiarkan lewat harus menunjuk objek yang identik.
    const calc = bundel.calc as Record<string, unknown>;
    const boq = calc.subtotal;
    assert.equal(typeof boq, "function");
    assert.equal(calc.nilaiBaris, boq, "subtotal dan nilaiBaris bukan fungsi yang sama");
  });

  it("membawa fungsi yang memang dicari ERP", () => {
    const calc = bundel.calc as Record<string, unknown>;
    const format = bundel.format as Record<string, unknown>;
    const kontrak = bundel.kontrak as Record<string, unknown>;
    for (const [nama, isi] of [["calc.totalBaris", calc.totalBaris], ["format.rp", format.rp ?? format.rupiah], ["kontrak.periksaTambahRabEstimasi", kontrak.periksaTambahRabEstimasi]] as const) {
      assert.equal(typeof isi, "function", `${nama} tidak ada di bundel`);
    }
  });

  it("hitungannya benar-benar jalan lewat namespace", () => {
    const calc = bundel.calc as { totalBaris: (r: { volume: number; hargaSatuan: number }[]) => number };
    assert.equal(
      calc.totalBaris([
        { volume: 2, hargaSatuan: 1000 },
        { volume: 3, hargaSatuan: 500 },
      ]),
      3500,
    );
  });
});
