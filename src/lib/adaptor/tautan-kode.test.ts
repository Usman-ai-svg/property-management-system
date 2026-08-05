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
 */

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
  return /(^|\.)kode$/.test(e) || e === "kodeProyek" || e === "kodeProyek.toUpperCase()";
};

/** Template literal yang jadi alamat: href, revalidatePath, redirect. */
const POLA_ALAMAT = [
  /href=\{`([^`]*)`\}/g,
  /href=\{[^}]*?`([^`]*)`[^}]*?\}/g,
  /revalidatePath\(`([^`]*)`\)/g,
  /redirect\(`([^`]*)`\)/g,
];

/** Baris tempat sebuah offset berada, untuk pesan kesalahan yang bisa diklik. */
const barisDi = (teks: string, posisi: number) => teks.slice(0, posisi).split("\n").length;

describe("penjaga tautan berkode", () => {
  it("setiap kode yang masuk alamat lewat segmen()", () => {
    const pelanggaran: string[] = [];

    for (const berkas of berkasSumber("src/app")) {
      const isi = readFileSync(berkas, "utf8");
      for (const pola of POLA_ALAMAT) {
        pola.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pola.exec(isi))) {
          const alamat = m[1];
          // Hanya alamat, bukan sembarang template. Alamat selalu diawali "/"
          // atau "?" — teks biasa di dalam href tidak ada.
          if (!/^[/?]/.test(alamat)) continue;

          for (const sisip of alamat.matchAll(/\$\{([^}]+)\}/g)) {
            const ekspresi = sisip[1];
            if (!BERISI_KODE(ekspresi)) continue;
            if (ekspresi.includes("segmen(")) continue;
            pelanggaran.push(`${berkas}:${barisDi(isi, m.index)} → \${${ekspresi}}`);
          }
        }
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
    const buruk = "href={`/master/${p.kode}/tipe/${t.kode}`}";
    const ketemu = [...buruk.matchAll(/\$\{([^}]+)\}/g)]
      .map((x) => x[1])
      .filter((e) => BERISI_KODE(e) && !e.includes("segmen("));
    assert.deepEqual(ketemu, ["p.kode", "t.kode"]);

    const baik = "href={`/master/${segmen(p.kode)}`}";
    const ketemu2 = [...baik.matchAll(/\$\{([^}]+)\}/g)]
      .map((x) => x[1])
      .filter((e) => BERISI_KODE(e) && !e.includes("segmen("));
    assert.deepEqual(ketemu2, []);
  });

  it("id acak tidak ikut dipersoalkan", () => {
    for (const e of ["vendor.id", "id", "versi.id", "kontrak.vendor.id"]) {
      assert.equal(BERISI_KODE(e), false, `${e} seharusnya tidak dianggap kode`);
    }
    for (const e of ["p.kode", "kodeProyek", "lama.project.kode"]) {
      assert.equal(BERISI_KODE(e), true, `${e} seharusnya dianggap kode`);
    }
  });

  it("memeriksa jumlah berkas yang masuk akal", () => {
    assert.ok(berkasSumber("src/app").length >= 30);
  });
});
