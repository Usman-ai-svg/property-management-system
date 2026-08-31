import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * PENJAGA TAUTAN BERKODE.
 *
 * Kode entitas yang ditempel mentah ke alamat adalah bug yang tidak terlihat
 * sampai ada data nyata: seluruh kode contoh ("NT2", "T36") ramah alamat, jadi
 * halaman terbuka normal. Begitu ada tipe rumah "36/72" atau fase "F1/A" —
 * penamaan yang lazim di lapangan — garis miringnya memecah segmen alamat dan
 * halamannya 404 padahal datanya ada.
 *
 * Karena gejalanya baru muncul di data tertentu, tes fungsional tidak
 * menangkapnya. Yang menangkap adalah pembacaan kode sumber: setiap kode yang
 * disisipkan ke alamat wajib lewat `segmen()`.
 *
 * Penjaga ini memindai SETIAP template literal yang berbentuk alamat, bukan
 * hanya yang dibungkus href/revalidatePath/redirect. Versi sebelumnya terbatas
 * pada pola pembungkus itu di dalam src/app saja, dan celahnya nyata: alamat
 * yang diserahkan lewat prop (`basis={...}`), yang disimpan ke variabel dulu
 * (`const alamatDasar = ...`), serta seluruh isi src/components lolos begitu
 * saja. Menyapu semua template literal menutup ketiganya sekaligus.
 */

/** Akar yang disapu. Alamat bisa dirangkai di mana saja, bukan cuma di halaman. */
const AKAR = ["src/app", "src/components", "src/lib"];

/** Berkas .ts/.tsx non-tes di sebuah folder, rekursif. */
function berkasSumber(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasSumber(jalur));
    else if (/\.tsx?$/.test(nama) && !nama.endsWith(".test.ts")) hasil.push(jalur);
  }
  return hasil;
}

/**
 * Ekspresi yang isinya KODE entitas, bukan id acak.
 *
 * Id (cuid) tidak pernah memuat karakter yang perlu disandi, jadi
 * `/vendor/${vendor.id}` sengaja tidak dipersoalkan.
 */
const BERISI_KODE = (ekspresi: string): boolean => {
  const e = ekspresi.trim();
  return /(^|\.)kode$/.test(e) || e.startsWith("kodeProyek");
};

/**
 * Template literal yang berbentuk alamat.
 *
 * Alamat selalu diawali "/" atau "?" — teks biasa di dalam backtick tidak
 * begitu, jadi satu aturan ini cukup memisahkan alamat dari string lain.
 */
const POLA_TEMPLATE = /`([^`]*)`/g;
const BERBENTUK_ALAMAT = (teks: string) => /^[/?]/.test(teks);

/** Baris tempat sebuah offset berada, untuk pesan kesalahan yang bisa diklik. */
const barisDi = (teks: string, posisi: number) => teks.slice(0, posisi).split("\n").length;

/** Semua pelanggaran di satu isi berkas. */
function pelanggaranDi(berkas: string, isi: string): string[] {
  const hasil: string[] = [];
  POLA_TEMPLATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = POLA_TEMPLATE.exec(isi))) {
    const alamat = m[1];
    if (!BERBENTUK_ALAMAT(alamat)) continue;
    for (const sisip of alamat.matchAll(/\$\{([^}]+)\}/g)) {
      const ekspresi = sisip[1];
      if (!BERISI_KODE(ekspresi)) continue;
      if (ekspresi.includes("segmen(")) continue;
      hasil.push(`${berkas}:${barisDi(isi, m.index)} → \${${ekspresi}}`);
    }
  }
  return hasil;
}

describe("penjaga tautan berkode", () => {
  it("setiap kode yang masuk alamat lewat segmen()", () => {
    const pelanggaran: string[] = [];
    for (const akar of AKAR) {
      for (const berkas of berkasSumber(akar)) {
        pelanggaran.push(...pelanggaranDi(berkas, readFileSync(berkas, "utf8")));
      }
    }

    assert.deepEqual(
      pelanggaran,
      [],
      "Kode berikut ditempel mentah ke alamat:\n  " +
        pelanggaran.join("\n  ") +
        "\nBungkus dengan segmen() dari @/lib/adaptor/rute — kode seperti " +
        '"36/72" atau "F1/A" memecah segmen alamat dan membuat halaman 404.',
    );
  });

  it("penjaganya benar-benar menangkap pelanggaran", () => {
    // Kalau polanya salah tulis, tes di atas lolos tanpa memeriksa apa pun.
    assert.deepEqual(
      pelanggaranDi("x.tsx", "href={`/master/${p.kode}/tipe/${t.kode}`}"),
      ["x.tsx:1 → ${p.kode}", "x.tsx:1 → ${t.kode}"],
    );
    assert.deepEqual(pelanggaranDi("x.tsx", "href={`/master/${segmen(p.kode)}`}"), []);
  });

  it("menangkap alamat di luar href — prop dan variabel", () => {
    // Justru bentuk-bentuk inilah yang lolos dari penjaga versi pertama.
    assert.deepEqual(
      pelanggaranDi("x.tsx", "basis={`/konstruksi/${kodeProyek}/unit`}"),
      ["x.tsx:1 → ${kodeProyek}"],
    );
    assert.deepEqual(
      pelanggaranDi("x.ts", "const alamatDasar = `/keuangan/${proyek.kode}`;"),
      ["x.ts:1 → ${proyek.kode}"],
    );
  });

  it("id acak tidak ikut dipersoalkan", () => {
    for (const e of ["vendor.id", "id", "versi.id", "kontrak.vendor.id"]) {
      assert.equal(BERISI_KODE(e), false, `${e} seharusnya tidak dianggap kode`);
    }
    for (const e of ["p.kode", "kodeProyek", "kodeProyek.toUpperCase()", "lama.project.kode"]) {
      assert.equal(BERISI_KODE(e), true, `${e} seharusnya dianggap kode`);
    }
  });

  it("string biasa bukan alamat tidak dipersoalkan", () => {
    assert.deepEqual(pelanggaranDi("x.ts", "const judul = `Proyek ${p.kode}`;"), []);
  });

  it("memeriksa jumlah berkas yang masuk akal", () => {
    const jumlah = AKAR.reduce((n, akar) => n + berkasSumber(akar).length, 0);
    assert.ok(jumlah >= 60, `hanya ${jumlah} berkas tersapu`);
  });
});
