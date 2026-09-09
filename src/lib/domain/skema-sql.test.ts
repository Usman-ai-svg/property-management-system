import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { KOLOM_ENUM } from "./kolom-enum";

/**
 * PENJAGA DDL SCHEMA `proyek`.
 *
 * `prisma/proyek.sql` adalah berkas yang benar-benar akan dijalankan di
 * Supabase. Kalau ia salah, yang gagal bukan tes melainkan migrasi — dan
 * gagalnya di tengah, setelah sebagian tabel terlanjur dibuat.
 *
 * Dua lapis pemeriksaan:
 *
 *   1. SINTAKS — diurai `pg-query-emscripten`, yaitu parser PostgreSQL yang
 *      asli dikompilasi ke WebAssembly. Bukan pencocokan pola: kalau ia
 *      menerima, Postgres 16 juga menerima. Yang tidak tertangkap: galat
 *      semantik seperti FK ke tabel yang belum ada.
 *   2. ISI — aturan yang sudah diputuskan dan tidak boleh hanyut: tanpa awalan
 *      `pm_`, kolom uang numeric(18,2), volume double precision, CHECK enum
 *      dari `enums.ts`, RLS aktif tanpa policy tulis, dan `anon` tidak pernah
 *      disebut.
 */

const SQL = readFileSync("prisma/proyek.sql", "utf8");
const require_ = createRequire(import.meta.url);

describe("DDL proyek.sql — sintaks", () => {
  let hasil: { error?: { message: string; cursorpos: number }; parse_tree?: { stmts: unknown[] } };

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

  it("berisi pernyataan sebanyak yang masuk akal", () => {
    const jumlah = hasil.parse_tree?.stmts.length ?? 0;
    assert.ok(jumlah > 200, `hanya ${jumlah} pernyataan`);
  });
});

describe("DDL proyek.sql — keputusan yang tidak boleh hanyut", () => {
  it("memakai schema proyek, tanpa awalan pm_ pada nama tabel", () => {
    assert.match(SQL, /create schema if not exists proyek;/);
    assert.equal(
      /create table proyek\.pm_/.test(SQL),
      false,
      "awalan pm_ tidak dipakai lagi — modul sudah punya schema sendiri",
    );
  });

  it("nama kolom tetap camelCase dan dikutip", () => {
    // Supaya to_jsonb(baris) menghasilkan persis bentuk yang diharapkan
    // lapisan murni. Snake_case akan memaksa tiap RPC memberi alias kolom satu
    // per satu, dan satu salah ketik pada alias kolom uang adalah angka keliru
    // yang tidak menimbulkan galat apa pun.
    assert.match(SQL, /"hargaSatuan"/);
    assert.match(SQL, /"projectId"/);
    assert.equal(/"harga_satuan"/.test(SQL), false);
  });

  it("kolom uang numeric(18,2), volume dan koordinat double precision", () => {
    for (const kolom of ["total", "hargaSatuan", "nominal", "hargaJual"]) {
      assert.match(
        SQL,
        new RegExp(`"${kolom}" numeric\\(18,2\\)`),
        `${kolom} seharusnya numeric(18,2)`,
      );
    }
    for (const kolom of ["volume", "pinLat", "pinLng", "luasTanah", "retensiPct"]) {
      assert.match(
        SQL,
        new RegExp(`"${kolom}" double precision`),
        `${kolom} seharusnya double precision — dua desimal akan membulatkannya`,
      );
      assert.equal(
        new RegExp(`"${kolom}" numeric`).test(SQL),
        false,
        `${kolom} tidak boleh numeric`,
      );
    }
  });

  it("setiap kolom enum terdaftar punya CHECK, dan isinya dari enums.ts", () => {
    // Nilai enum boleh memuat kurung — "Unit (rumah dijual)", "Hak Milik (HM)" —
    // jadi batas CHECK dicari lewat penutup `))` di akhir baris, bukan lewat
    // "sampai kurung pertama". Persis jenis kekeliruan yang dulu membuat
    // `@default(now())` hilang diam-diam dari generator.
    // Satu nama kolom bisa muncul di banyak tabel dengan enum berbeda —
    // `status` dipakai proyek, sarpras, vendor, VO, pengeluaran, dan petty
    // cash. Jadi yang diperiksa: ADA baris CHECK untuk kolom itu yang memuat
    // SELURUH nilai enumnya, bukan baris pertama yang kebetulan cocok.
    const kurang: string[] = [];
    for (const [kunci, nilai] of Object.entries(KOLOM_ENUM)) {
      const kolom = kunci.split(".")[1];
      const semuaBaris = SQL.split("\n").filter((b) =>
        b.includes(`_sah check ("${kolom}" in (`),
      );
      if (semuaBaris.length === 0) { kurang.push(`${kunci} tanpa CHECK`); continue; }
      const cocok = semuaBaris.some((b) =>
        nilai.every((v) => b.includes(`'${v.replace(/'/g, "''")}'`)),
      );
      if (!cocok) kurang.push(`${kunci}: tak ada CHECK yang memuat seluruh nilainya`);
    }
    assert.deepEqual(kurang, [], kurang.join("\n"));
  });

  it('nilai enum yang pernah basi ikut terbawa — "Kontraktor" dan "Hutang"', () => {
    // Cacat E1: komentar skema kehilangan keduanya. Kalau CHECK dibangun dari
    // komentar dan bukan dari enums.ts, pencatatan pengeluaran-hutang dan
    // pekerjaan kontraktor akan ditolak database tanpa alasan yang jelas.
    const check = SQL.match(/check \("jenis" in \(([^)]*)\)\)/g)?.join(" ") ?? "";
    assert.ok(check.includes("'Kontraktor'"), "CHECK jenis kehilangan Kontraktor");
    const metode = SQL.match(/check \("metode" in \(([^)]*)\)\)/g)?.join(" ") ?? "";
    assert.ok(metode.includes("'Hutang'"), "CHECK metode kehilangan Hutang");
  });

  it("User, Role, dan UserRole tidak ikut; identitas dialihkan ke auth.users", () => {
    for (const tabel of ["users", "roles", "user_roles", "user_project_access"]) {
      assert.equal(
        new RegExp(`create table proyek\\.${tabel} `).test(SQL),
        false,
        `${tabel} seharusnya tidak ikut migrasi`,
      );
    }
    assert.match(SQL, /references auth\.users\(id\)/);
  });

  it("matriks hak akses ikut, dan dikunci ke nama peran", () => {
    // Panduan: jangan membuang RoleSectionPermission. Di ERP dibiarkan terbuka
    // penuh, tapi mekanismenya harus utuh supaya bisa diperketat tanpa
    // membongkar RPC satu per satu.
    assert.match(SQL, /create table proyek\.role_section_permissions/);
    assert.match(SQL, /"roleNama" text/);
    assert.equal(/role_section_permissions[\s\S]*?"roleId"/.test(SQL), false);
  });

  it("@updatedAt jadi trigger, bukan diisi aplikasi", () => {
    assert.match(SQL, /create or replace function proyek\.set_diubah_pada\(\)/);
    assert.match(SQL, /create trigger \w+_diubah_pada before update/);
  });
});

describe("DDL proyek.sql — RLS dan grant", () => {
  const tabel = [...SQL.matchAll(/create table proyek\.(\w+) \(/g)].map((m) => m[1]);

  it("menemukan seluruh tabel", () => {
    assert.ok(tabel.length >= 55, `hanya ${tabel.length} tabel ditemukan`);
  });

  it("setiap tabel menyalakan RLS", () => {
    const kurang = tabel.filter(
      (t) => !SQL.includes(`alter table proyek.${t} enable row level security;`),
    );
    assert.deepEqual(kurang, [], `tabel tanpa RLS: ${kurang.join(", ")}`);
  });

  it("setiap tabel punya tepat satu policy, dan itu SELECT", () => {
    for (const t of tabel) {
      const policy = [...SQL.matchAll(new RegExp(`create policy \\w+ on proyek\\.${t} for (\\w+)`, "g"))];
      assert.equal(policy.length, 1, `${t} punya ${policy.length} policy`);
      assert.equal(policy[0][1], "select", `${t} punya policy ${policy[0][1]}`);
    }
  });

  it("TIDAK ada policy tulis sama sekali — tulis hanya lewat RPC", () => {
    for (const aksi of ["insert", "update", "delete", "all"]) {
      assert.equal(
        new RegExp(`for ${aksi}\\b`).test(SQL),
        false,
        `ada policy ${aksi}; tulis harus lewat RPC SECURITY DEFINER`,
      );
    }
  });

  it("hak atas tabel hanya select; schema hanya usage", () => {
    const atasTabel = [...SQL.matchAll(/grant ([\w ,]+) on proyek\.\w+ to (\w+);/g)];
    assert.ok(atasTabel.length >= 55, `hanya ${atasTabel.length} grant tabel`);
    for (const [, hak, peran] of atasTabel) {
      assert.equal(hak.trim(), "select", `hak "${hak.trim()}" diberikan atas tabel`);
      assert.equal(peran, "authenticated", `hak diberikan ke peran "${peran}"`);
    }
    const atasSchema = [...SQL.matchAll(/grant ([\w ,]+) on schema \w+ to (\w+);/g)];
    for (const [, hak, peran] of atasSchema) {
      assert.equal(hak.trim(), "usage");
      assert.equal(peran, "authenticated");
    }
  });

  it("anon TIDAK PERNAH disebut", () => {
    // Bukan dicabut belakangan: memang tidak pernah diberi. Di ERP pernah ada
    // temuan audit berupa view keuangan ber-SECURITY DEFINER dengan grant anon
    // — siapa pun pemegang anon key bisa membaca buku besar tanpa login.
    assert.equal(/\banon\b/.test(SQL), false, "kata `anon` muncul di DDL");
  });
});
