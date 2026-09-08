import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  JENIS_KONTRAK, peruntukanDariJenisKontrak, PERUNTUKAN_BIAYA, POS_HPP, SECTIONS, SEMUA_ENUM,
} from "./enums";

/**
 * Penjaga persiapan Postgres.
 *
 * `scripts/skema-postgres.mjs` membangun `CREATE TYPE` dari `SEMUA_ENUM`.
 * Enum yang lupa didaftarkan di sana tidak akan ikut terbawa saat modul
 * dipindah ke ERP — dan itu baru ketahuan setelah ada nilai yang ditolak
 * database di produksi.
 */
describe("SEMUA_ENUM", () => {
  const kode = readFileSync("src/lib/domain/enums.ts", "utf8");

  it("mendaftarkan setiap konstanta enum yang diekspor", () => {
    // Semua konstanta huruf besar yang berupa daftar string, kecuali yang
    // memang bukan enum kolom database.
    const BUKAN_KOLOM = new Set(["SECTIONS", "ROLES"]);
    const diekspor = [...kode.matchAll(/^export const ([A-Z][A-Z_]+) = \[/gm)]
      .map((m) => m[1])
      .filter((n) => !BUKAN_KOLOM.has(n));

    const terdaftar = new Set(
      Object.values(SEMUA_ENUM).map((v) => JSON.stringify([...v])),
    );

    const bolong: string[] = [];
    for (const nama of diekspor) {
      const nilai = (kode.match(new RegExp(`export const ${nama} = \\[([\\s\\S]*?)\\] as const`)) ??
        [])[1];
      if (!nilai) continue;
      const daftar = [...nilai.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      if (!terdaftar.has(JSON.stringify(daftar))) bolong.push(nama);
    }

    assert.deepEqual(
      bolong,
      [],
      `Enum ini tidak terdaftar di SEMUA_ENUM: ${bolong.join(", ")}. ` +
        "Akibatnya CREATE TYPE-nya tidak ikut dihasilkan untuk Postgres.",
    );
  });

  it("tidak ada enum yang isinya kosong", () => {
    for (const [nama, nilai] of Object.entries(SEMUA_ENUM)) {
      assert.ok(nilai.length > 0, `${nama} kosong`);
    }
  });

  it("tidak ada nilai ganda di dalam satu enum", () => {
    for (const [nama, nilai] of Object.entries(SEMUA_ENUM)) {
      assert.equal(new Set(nilai).size, nilai.length, `${nama} punya nilai ganda`);
    }
  });

  it("SECTIONS tidak ikut jadi enum kolom — itu nama sub-bagian, bukan nilai data", () => {
    const semua = Object.values(SEMUA_ENUM).map((v) => JSON.stringify([...v]));
    assert.equal(semua.includes(JSON.stringify([...SECTIONS])), false);
  });
});

describe("berkas hasil generate untuk Postgres", () => {
  it("schema.postgres.prisma sudah dihasilkan dan memakai provider postgresql", () => {
    const s = readFileSync("prisma/schema.postgres.prisma", "utf8");
    assert.match(s, /provider = "postgresql"/);
  });

  it("seluruh tabel diberi awalan pm_ supaya tidak bentrok dengan tabel ERP", () => {
    const s = readFileSync("prisma/schema.postgres.prisma", "utf8");
    const map = [...s.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(map.length >= 40, `hanya ${map.length} @@map ditemukan`);
    const tanpaAwalan = map.filter((n) => !n.startsWith("pm_"));
    assert.deepEqual(tanpaAwalan, [], `tabel tanpa awalan: ${tanpaAwalan.join(", ")}`);
  });

  it("volume dan koordinat TIDAK dinaikkan jadi Decimal(18,2)", () => {
    // Dua desimal membulatkan 12,375 m3 beton jadi 12,38 dan menggeser RAB;
    // pada koordinat, dua desimal menggeser titik sampai sekitar 1 km.
    const s = readFileSync("prisma/schema.postgres.prisma", "utf8");
    for (const kolom of ["volume", "pinLat", "pinLng", "luasTanah", "retensiPct"]) {
      const pola = new RegExp(`^\\s+${kolom}\\s+Decimal`, "m");
      assert.equal(pola.test(s), false, `${kolom} seharusnya tetap Float`);
    }
  });

  it("kolom uang memakai Decimal, bukan Float", () => {
    const s = readFileSync("prisma/schema.postgres.prisma", "utf8");
    for (const kolom of ["hargaJual", "rapUpah", "nominal", "total", "hargaSatuan"]) {
      const pola = new RegExp(`^\\s+${kolom}\\s+Float`, "m");
      assert.equal(pola.test(s), false, `${kolom} masih Float, seharusnya Decimal`);
    }
  });

  it("enum-postgres.sql memuat CREATE TYPE untuk setiap enum", () => {
    const sql = readFileSync("prisma/enum-postgres.sql", "utf8");
    const jumlah = (sql.match(/CREATE TYPE/g) ?? []).length;
    assert.equal(jumlah, Object.keys(SEMUA_ENUM).length);
  });

  it("nilai enum yang mengandung petik ditulis aman untuk SQL", () => {
    const sql = readFileSync("prisma/enum-postgres.sql", "utf8");
    // Tidak boleh ada petik tunggal yang tidak digandakan di dalam nilai.
    for (const baris of sql.split("\n")) {
      const isi = baris.match(/^\s+'(.*)',?$/);
      if (!isi) continue;
      assert.equal(isi[1].replace(/''/g, "").includes("'"), false, `nilai tidak aman: ${baris}`);
    }
  });
});

describe("peruntukanDariJenisKontrak", () => {
  it("kontrak unit membebani peruntukan unit", () => {
    assert.equal(peruntukanDariJenisKontrak("Unit"), "Unit (rumah dijual)");
  });

  it("kontrak sarpras membebani prasarana & sarana", () => {
    assert.equal(peruntukanDariJenisKontrak("Sarpras"), "Prasarana & Sarana");
  });

  it("setiap jenis kontrak menghasilkan peruntukan yang sah", () => {
    // Penjaga terhadap nilai teks lama seperti "Sarana & Prasarana", yang dulu
    // tidak cocok enum sehingga biayanya luput dari laporan realisasi.
    for (const jenis of JENIS_KONTRAK) {
      assert.ok(
        (PERUNTUKAN_BIAYA as readonly string[]).includes(peruntukanDariJenisKontrak(jenis)),
        `${jenis} menghasilkan peruntukan di luar enum`,
      );
    }
  });

  it("peruntukan hasilnya selalu punya pos HPP", () => {
    for (const jenis of JENIS_KONTRAK) {
      assert.ok(POS_HPP[peruntukanDariJenisKontrak(jenis)], `${jenis} tanpa pos HPP`);
    }
  });
});
