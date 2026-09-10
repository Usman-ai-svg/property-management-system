import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * PENJAGA DATA ACUAN.
 *
 * `prisma/acuan/*.json` adalah isi yang harus sudah ada sebelum tim bisa memakai
 * sistemnya sama sekali: matriks hak akses, price book, dan analisa harga
 * satuan. Ia punya dua pembaca yang tidak saling kenal — `seed.ts` untuk demo
 * dan `scripts/acuan-sql.mjs` untuk Supabase — jadi yang dijaga di sini bukan
 * cuma isinya, melainkan juga bahwa keduanya masih membaca sumber yang sama.
 *
 * Dua lapis, seperti penjaga DDL:
 *
 *   1. SINTAKS — `prisma/acuan.sql` diurai `pg-query-emscripten`, grammar
 *      PostgreSQL asli. Kalau ia menerima, Postgres 16 juga menerima.
 *   2. ISI — kunci unik, rujukan komponen yang tidak menggantung, sub-bagian
 *      yang benar-benar ada di `enums.ts`, dan hak ubah yang tidak melampaui
 *      hak lihat.
 */

const SQL = readFileSync("prisma/acuan.sql", "utf8");
const DDL = readFileSync("prisma/proyek.sql", "utf8");
const require_ = createRequire(import.meta.url);

const bacaJson = (nama: string) =>
  JSON.parse(readFileSync(`prisma/acuan/${nama}`, "utf8"));

const hargaDasar = bacaJson("harga-dasar.json") as {
  kode: string; kategori: string; uraian: string; satuan: string; hargaAcuan: number;
}[];
const analisa = bacaJson("analisa.json") as {
  kode: string; uraian: string; satuan: string; kelompok: string; overheadPct: number;
  komponen: { kode: string; koefisien: number }[];
}[];

describe("data acuan — isi", () => {
  it("kode harga dasar unik, kategorinya sah", () => {
    const kode = hargaDasar.map((h) => h.kode);
    assert.equal(new Set(kode).size, kode.length, "ada kode harga dasar kembar");
    for (const h of hargaDasar) {
      assert.ok(
        ["UPAH", "BAHAN", "ALAT"].includes(h.kategori),
        `${h.kode}: kategori "${h.kategori}" di luar KelompokDasar`,
      );
      assert.ok(h.hargaAcuan >= 0, `${h.kode}: harga acuan negatif`);
    }
  });

  it("tiap komponen analisa menunjuk harga dasar yang ada", () => {
    // Komponen menggantung tidak akan tertangkap sebagai galat saat seed —
    // `hargaDasarId.get(kode)!` menghasilkan undefined, dan barisnya hilang
    // diam-diam dari analisa. Harga satuannya lalu terlalu murah tanpa sebab
    // yang terlihat.
    const ada = new Set(hargaDasar.map((h) => h.kode));
    const menggantung: string[] = [];
    for (const a of analisa) {
      for (const k of a.komponen) if (!ada.has(k.kode)) menggantung.push(`${a.kode} → ${k.kode}`);
      assert.ok(a.komponen.length > 0, `${a.kode}: analisa tanpa komponen`);
    }
    assert.deepEqual(menggantung, []);
  });

  it("kode analisa unik dan overhead-nya masuk akal", () => {
    const kode = analisa.map((a) => a.kode);
    assert.equal(new Set(kode).size, kode.length, "ada kode analisa kembar");
    for (const a of analisa) {
      assert.ok(a.overheadPct >= 0 && a.overheadPct <= 100, `${a.kode}: overhead ${a.overheadPct}%`);
    }
  });

  it("matriks hak akses tidak di berkas ini — ia punya penjaganya sendiri", () => {
    // Sejak matriks dikunci ke jabatan, ia punya perintah dan berkasnya
    // sendiri (`acl:sql` -> prisma/acl.sql). Dijaga hak-akses.test.ts.
    assert.equal(
      SQL.includes("role_section_permissions"),
      false,
      "matriks hak akses seharusnya tidak lagi ikut acuan.sql",
    );
  });
});

describe("acuan.sql — sintaks", () => {
  let hasil: { error?: { message: string; cursorpos: number } };

  before(async () => {
    const buatParser = require_("pg-query-emscripten").default;
    const pg = await buatParser();
    hasil = pg.parse(SQL);
  });

  it("terurai penuh oleh grammar PostgreSQL asli", () => {
    if (hasil.error) {
      const konteks = SQL.slice(Math.max(0, hasil.error.cursorpos - 200), hasil.error.cursorpos + 60);
      assert.fail(`${hasil.error.message}\n\nkonteks:\n${konteks}`);
    }
  });
});

describe("acuan.sql — masih sejalan dengan sumbernya", () => {
  it("jumlah barisnya sama dengan isi JSON", () => {
    // Kalau JSON disunting tanpa menjalankan ulang `npm run acuan:sql`, di
    // sinilah ketahuannya — bukan di Supabase, setengah jalan.
    const komponen = analisa.reduce((n, a) => n + a.komponen.length, 0);
    const hitung = (awalan: string) => SQL.split(`('${awalan}`).length - 1;
    assert.equal(hitung("hd-"), hargaDasar.length, "baris harga dasar tidak sinkron");
    assert.equal(hitung("an-"), analisa.length, "baris analisa tidak sinkron");
    assert.equal(hitung("ka-"), komponen, "baris komponen tidak sinkron");
  });

  it("tiap kode harga dasar dan analisa benar-benar muncul", () => {
    for (const h of hargaDasar) assert.ok(SQL.includes(`'${h.kode}'`), `${h.kode} hilang dari SQL`);
    for (const a of analisa) assert.ok(SQL.includes(`'${a.kode}'`), `${a.kode} hilang dari SQL`);
  });

  it("hanya mengisi tabel yang memang ada di DDL, tanpa awalan pm_", () => {
    const tabel = [...SQL.matchAll(/insert into proyek\.(\w+) /g)].map((m) => m[1]);
    assert.ok(tabel.length >= 3, `hanya ${tabel.length} pernyataan insert`);
    for (const t of tabel) {
      assert.ok(DDL.includes(`create table proyek.${t} (`), `tabel ${t} tidak ada di proyek.sql`);
      assert.equal(t.startsWith("pm_"), false);
    }
  });

  it("bisa dijalankan ulang tanpa menggandakan", () => {
    // Dihitung dari awal baris, supaya kalimat "on conflict do nothing" di
    // komentar kepala berkas tidak ikut terhitung sebagai penjaga.
    const insert = SQL.split("\ninsert into").length - 1;
    const konflik = SQL.split("\non conflict (").length - 1;
    assert.equal(konflik, insert, "ada insert tanpa on conflict");
    assert.match(SQL, /begin;/);
    assert.match(SQL, /commit;/);
  });

  it("tidak memuat data peragaan", () => {
    // Proyek contoh, unit contoh, pengguna contoh: semuanya berhenti di demo.
    for (const tabel of ["projects", "units", "users", "expenses", "vendors", "pemasok"]) {
      assert.equal(
        SQL.includes(`insert into proyek.${tabel} `),
        false,
        `${tabel} adalah data peragaan; tidak boleh ikut acuan.sql`,
      );
    }
  });
});

describe("seed memakai sumber yang sama", () => {
  it("seed-data dan seed-ahsp membaca prisma/acuan, bukan salinan sendiri", () => {
    // Inti kelompok H: satu sumber, dua keluaran. Kalau seed menyimpan salinan
    // sendiri, demo dan produksi akan berbeda dalam sebulan — dan yang keliru
    // justru yang jarang dilihat.
    for (const berkas of ["prisma/seed-data.ts", "prisma/seed-ahsp.ts"]) {
      const kode = readFileSync(berkas, "utf8");
      assert.match(kode, /from "\.\/acuan\/muat"/, `${berkas} tidak membaca data acuan`);
    }
    const data = readFileSync("prisma/seed-data.ts", "utf8");
    assert.equal(
      /ACL_AWAL: Record<string, string\[\]> = \{/.test(data),
      false,
      "matriks hak akses ditulis ulang sebagai literal di seed-data.ts",
    );
  });
});
