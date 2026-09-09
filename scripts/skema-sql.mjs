/**
 * Hasilkan DDL PostgreSQL polos untuk schema `proyek` di ERP Nanoland.
 *
 * Dijalankan dengan `npm run skema:sql`. Keluarannya `prisma/proyek.sql` —
 * `CREATE TABLE` biasa yang bisa ditempel ke SQL editor Supabase, TANPA perantara
 * Prisma. ERP tidak memakai Prisma sama sekali.
 *
 * Bedanya dengan `skema-postgres.mjs` yang lama, dan kenapa keduanya ada:
 * yang lama menghasilkan `schema.postgres.prisma` (masih skema Prisma, tabel
 * berawalan `pm_`). Ia dipertahankan sebagai pembanding sampai DDL ini terbukti;
 * lihat KONTRAK-RPC.md. Yang ini keluarannya SQL, tanpa awalan, karena modul
 * mendapat schema `proyek` sendiri sehingga bentrok nama tidak mungkin terjadi.
 *
 * KEPUTUSAN YANG SUDAH DITETAPKAN dan tidak perlu dipertanyakan lagi:
 *
 *   Schema          proyek, tanpa awalan pm_ pada nama tabel
 *   Nama kolom      tetap camelCase, DIKUTIP — supaya to_jsonb(baris)
 *                   menghasilkan persis bentuk yang diharapkan lapisan murni
 *   Uang            numeric(18,2)
 *   Volume, luas,   double precision — dua desimal akan membulatkan 12,375 m3
 *   koordinat       beton dan menggeser seluruh RAB yang dihitung darinya
 *   Enum            text + CHECK dari enums.ts, bukan tipe enum asli
 *   User/Role       tidak ikut; FK identitas dialihkan ke auth.users
 *   @updatedAt      jadi trigger, bukan diisi aplikasi
 *
 * CATATAN PENGURAI. Nilai bawaan diurai dengan penghitung kedalaman kurung,
 * BUKAN regex `@default\(([^)]*)\)`. Regex itu tidak menangani kurung bersarang:
 * `now()` terbaca jadi `now(` lalu ditolak, dan kolomnya keluar tanpa default.
 * Cacat itu pernah terjadi — 21 kolom `dibuatPada` lolos tanpa default dan baru
 * ketahuan saat INSERT pertama gagal.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { SEMUA_ENUM } from "../src/lib/domain/enums.ts";
import { KOLOM_ENUM } from "../src/lib/domain/kolom-enum.ts";

const SUMBER = "prisma/schema.prisma";
const TUJUAN = "prisma/proyek.sql";
const SCHEMA = "proyek";

/** Model yang TIDAK ikut migrasi — identitas datang dari Supabase Auth. */
const TANPA_MIGRASI = new Set(["User", "Role", "UserRole", "UserProjectAccess"]);

/**
 * Kolom `Float` yang BUKAN uang.
 *
 * Volume pekerjaan punya pecahan halus (12,375 m³ beton) dan koordinat butuh
 * enam desimal. Menaikkannya jadi numeric(18,2) akan membulatkan keduanya —
 * pada volume itu menggeser nilai RAB, pada koordinat menggeser titik lokasi
 * sampai sekitar satu kilometer.
 */
const BUKAN_UANG = new Set([
  "volume", "luas", "luasTanah", "luasBangunan", "luasKavlingEfektif",
  "luasSarana", "luasPrasarana", "luasRth", "luasUnit", "luasLahan",
  "pinLat", "pinLng",
  "retensiPct", "overheadPct", "jarak", "pemakaian",
  "koefisien", "qty",
]);

// ---------------------------------------------------------------------------
// 1. Pengurai skema Prisma
// ---------------------------------------------------------------------------

/**
 * Potong sebuah baris atribut menjadi daftar atribut utuh.
 *
 * Memakai penghitung kedalaman kurung supaya `@default(now())` dan
 * `@relation(fields: [a], references: [b])` tetap utuh.
 */
function pisahAtribut(teks) {
  const hasil = [];
  let dalam = 0;
  let mulai = -1;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (c === "@" && dalam === 0) {
      if (mulai >= 0) hasil.push(teks.slice(mulai, i).trim());
      mulai = i;
    } else if (c === "(") dalam++;
    else if (c === ")") dalam--;
  }
  if (mulai >= 0) hasil.push(teks.slice(mulai).trim());
  return hasil;
}

/** Isi sebuah atribut berkurung, mis. `@default(now())` → `now()`. */
function isiAtribut(atribut) {
  const buka = atribut.indexOf("(");
  if (buka < 0) return null;
  let dalam = 0;
  for (let i = buka; i < atribut.length; i++) {
    if (atribut[i] === "(") dalam++;
    else if (atribut[i] === ")") {
      dalam--;
      if (dalam === 0) return atribut.slice(buka + 1, i);
    }
  }
  throw new Error(`Kurung tidak seimbang pada atribut: ${atribut}`);
}

function uraiSkema(kode) {
  const model = [];
  let sekarang = null;

  for (const mentah of kode.replace(/\r\n/g, "\n").split("\n")) {
    const baris = mentah.trim();
    if (!baris || baris.startsWith("//") || baris.startsWith("///")) continue;

    const awal = baris.match(/^model\s+(\w+)\s*\{$/);
    if (awal) {
      sekarang = { nama: awal[1], tabel: null, kolom: [], unik: [], indeks: [] };
      model.push(sekarang);
      continue;
    }
    if (!sekarang) continue;
    if (baris === "}") { sekarang = null; continue; }

    // Atribut tingkat model
    if (baris.startsWith("@@")) {
      const map = baris.match(/^@@map\("([^"]+)"\)/);
      if (map) { sekarang.tabel = map[1]; continue; }
      const unik = baris.match(/^@@unique\(\[([^\]]+)\]/);
      if (unik) { sekarang.unik.push(unik[1].split(",").map((x) => x.trim())); continue; }
      const indeks = baris.match(/^@@index\(\[([^\]]+)\]/);
      if (indeks) { sekarang.indeks.push(indeks[1].split(",").map((x) => x.trim())); continue; }
      continue;
    }

    // Kolom: nama, tipe, sisanya atribut
    const kol = baris.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
    if (!kol) continue;
    const [, nama, tipe, larik, opsional, sisa] = kol;
    const atribut = pisahAtribut(sisa);

    sekarang.kolom.push({
      nama,
      tipe,
      larik: Boolean(larik),
      opsional: Boolean(opsional),
      id: atribut.some((a) => a === "@id" || a.startsWith("@id ")),
      unik: atribut.some((a) => a === "@unique" || a.startsWith("@unique ")),
      updatedAt: atribut.some((a) => a === "@updatedAt"),
      bawaan: atribut.find((a) => a.startsWith("@default("))
        ? isiAtribut(atribut.find((a) => a.startsWith("@default(")))
        : null,
      relasi: atribut.find((a) => a.startsWith("@relation("))
        ? isiAtribut(atribut.find((a) => a.startsWith("@relation(")))
        : null,
    });
  }
  return model;
}

// ---------------------------------------------------------------------------
// 2. Pemetaan tipe
// ---------------------------------------------------------------------------

const SKALAR = new Set(["String", "Int", "Float", "Boolean", "DateTime", "Json", "Decimal"]);

function tipeSql(kolom) {
  switch (kolom.tipe) {
    case "String": return "text";
    case "Int": return "integer";
    case "Boolean": return "boolean";
    case "DateTime": return "timestamptz";
    case "Json": return "jsonb";
    case "Decimal": return "numeric(18,2)";
    case "Float": return BUKAN_UANG.has(kolom.nama) ? "double precision" : "numeric(18,2)";
    default: throw new Error(`Tipe tak dikenal: ${kolom.tipe}`);
  }
}

/** Nilai bawaan Prisma → nilai bawaan SQL, atau null bila tak diterjemahkan. */
function bawaanSql(kolom) {
  const b = kolom.bawaan;
  if (b === null) return null;
  if (b === "now()") return "now()";
  if (b === "cuid()" || b === "uuid()" || b === "autoincrement()") return null; // id diisi aplikasi/RPC
  if (b === "true" || b === "false") return b;
  if (/^-?\d+(\.\d+)?$/.test(b)) return b;
  const teks = b.match(/^"(.*)"$/);
  if (teks) return `'${teks[1].replace(/'/g, "''")}'`;
  return null;
}

const kutip = (n) => `"${n}"`;

// ---------------------------------------------------------------------------
// 3. Bangun DDL
// ---------------------------------------------------------------------------

const kode = readFileSync(SUMBER, "utf8");
const semuaModel = uraiSkema(kode);
const ikut = semuaModel.filter((m) => !TANPA_MIGRASI.has(m.nama));
const namaTabel = new Map(ikut.map((m) => [m.nama, m.tabel]));

let jumlahKolom = 0;
let jumlahUang = 0;
let jumlahCheck = 0;
let jumlahFk = 0;
let jumlahFkAuth = 0;
const trigger = [];
const indeksLuar = [];

const bagian = [];

for (const m of ikut) {
  if (!m.tabel) throw new Error(`Model ${m.nama} tidak punya @@map — nama tabelnya tak pasti.`);

  const baris = [];
  const skalar = m.kolom.filter((k) => SKALAR.has(k.tipe) && !k.larik);

  for (const k of skalar) {
    jumlahKolom++;
    const tipe = tipeSql(k);
    if (tipe === "numeric(18,2)") jumlahUang++;

    const bagianKolom = [`  ${kutip(k.nama)} ${tipe}`];
    if (k.id) bagianKolom.push("primary key");
    if (!k.opsional && !k.id) bagianKolom.push("not null");
    const bawaan = bawaanSql(k);
    if (bawaan) bagianKolom.push(`default ${bawaan}`);
    baris.push(bagianKolom.join(" "));

    if (k.updatedAt) trigger.push({ tabel: m.tabel, kolom: k.nama });
  }

  // CHECK dari registri kolom enum — sumbernya enums.ts, bukan komentar skema.
  for (const k of skalar) {
    const daftar = KOLOM_ENUM[`${m.nama}.${k.nama}`];
    if (!daftar) continue;
    jumlahCheck++;
    const nilai = daftar.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
    baris.push(
      `  constraint ${m.tabel}_${k.nama.toLowerCase()}_sah check (${kutip(k.nama)} in (${nilai}))`,
    );
  }

  // UNIQUE
  for (const k of skalar) {
    if (k.unik) baris.push(`  unique (${kutip(k.nama)})`);
  }
  for (const gabungan of m.unik) {
    baris.push(`  unique (${gabungan.map(kutip).join(", ")})`);
  }

  // FOREIGN KEY dari kolom relasi
  for (const k of m.kolom) {
    if (!k.relasi) continue;
    const bidang = k.relasi.match(/fields:\s*\[([^\]]+)\]/);
    const acuan = k.relasi.match(/references:\s*\[([^\]]+)\]/);
    if (!bidang || !acuan) continue;
    const kolomLokal = bidang[1].split(",").map((x) => x.trim());
    const kolomAsing = acuan[1].split(",").map((x) => x.trim());
    // Aksi bawaan MENGIKUTI PRISMA, bukan bawaan SQL.
    //
    // Prisma memakai SetNull untuk relasi opsional dan Restrict untuk yang
    // wajib; SQL memakai NO ACTION untuk keduanya. Memakai bawaan SQL akan
    // menggeser perilaku diam-diam — dan pergeseran itu baru ketahuan saat
    // penghapusan pertama di produksi, bukan saat DDL dijalankan.
    const onDelete = k.relasi.match(/onDelete:\s*(\w+)/);
    const kolomInduk = m.kolom.find((x) => x.nama === kolomLokal[0]);
    const bawaanPrisma = kolomInduk?.opsional ? "set null" : "restrict";
    const aksi = onDelete
      ? { Cascade: "cascade", SetNull: "set null", Restrict: "restrict", NoAction: "no action" }[onDelete[1]] ?? bawaanPrisma
      : bawaanPrisma;

    if (TANPA_MIGRASI.has(k.tipe)) {
      // Identitas: FK dialihkan ke auth.users. Selalu ON DELETE SET NULL —
      // menghapus akun tidak boleh ikut menghapus jejak yang dibuatnya.
      jumlahFkAuth++;
      baris.push(
        `  foreign key (${kolomLokal.map(kutip).join(", ")}) references auth.users(id) on delete set null`,
      );
      continue;
    }
    const tabelAsing = namaTabel.get(k.tipe);
    if (!tabelAsing) continue;
    jumlahFk++;
    baris.push(
      `  foreign key (${kolomLokal.map(kutip).join(", ")}) ` +
        `references ${SCHEMA}.${tabelAsing}(${kolomAsing.map(kutip).join(", ")}) on delete ${aksi}`,
    );
  }

  bagian.push(`create table ${SCHEMA}.${m.tabel} (\n${baris.join(",\n")}\n);`);

  for (const gabungan of m.indeks) {
    indeksLuar.push(
      `create index ${m.tabel}_${gabungan.map((g) => g.toLowerCase()).join("_")}_idx ` +
        `on ${SCHEMA}.${m.tabel} (${gabungan.map(kutip).join(", ")});`,
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Trigger @updatedAt
// ---------------------------------------------------------------------------

const ddlTrigger = [
  "-- @updatedAt jadi trigger, bukan diisi aplikasi. Di Next.js Prisma yang",
  "-- mengisinya; di ERP penulisnya banyak (RPC, impor, perbaikan manual), dan",
  "-- satu jalur yang lupa mengisi akan membuat kolomnya berbohong.",
  `create or replace function ${SCHEMA}.set_diubah_pada() returns trigger as $$`,
  "begin",
  '  new."diubahPada" = now();',
  "  return new;",
  "end;",
  "$$ language plpgsql;",
  "",
  ...trigger.map(
    (t) =>
      `create trigger ${t.tabel}_diubah_pada before update on ${SCHEMA}.${t.tabel}\n` +
      `  for each row execute function ${SCHEMA}.set_diubah_pada();`,
  ),
];

// ---------------------------------------------------------------------------
// 5. RLS dan grant (E3)
// ---------------------------------------------------------------------------

const ddlRls = [
  "-- ROW LEVEL SECURITY",
  "--",
  "-- Pola yang sama dengan seluruh ERP: baca lewat PostgREST dengan RLS aktif,",
  "-- TULIS selalu lewat RPC SECURITY DEFINER. Karena itu tiap tabel di bawah",
  "-- punya satu policy SELECT dan TIDAK punya policy tulis sama sekali — itu",
  "-- disengaja, bukan kelupaan.",
  "--",
  "-- Peran publik-tanpa-login tidak pernah disebut di berkas ini — namanya pun",
  "-- sengaja tidak ditulis, supaya `grep` atas nama itu benar-benar kosong.",
  "-- Bukan dicabut belakangan: memang tidak pernah diberi. Di ERP pernah ada",
  "-- temuan audit berupa lima view keuangan ber-SECURITY DEFINER yang terbuka",
  "-- untuk peran publik — artinya siapa pun pemegang kunci publik bisa membaca",
  "-- buku besar tanpa login. Satu-satunya yang diberi hak di sini:",
  "-- `authenticated`, dan hanya SELECT.",
  "",
  `grant usage on schema ${SCHEMA} to authenticated;`,
  "",
  ...ikut.flatMap((m) => [
    `alter table ${SCHEMA}.${m.tabel} enable row level security;`,
    `create policy ${m.tabel}_baca on ${SCHEMA}.${m.tabel} for select to authenticated using (true);`,
    `grant select on ${SCHEMA}.${m.tabel} to authenticated;`,
    "",
  ]),
];

// ---------------------------------------------------------------------------
// 6. Tulis
// ---------------------------------------------------------------------------

const kepala = [
  "-- =============================================================================",
  "-- DIHASILKAN OTOMATIS oleh scripts/skema-sql.mjs — JANGAN DISUNTING TANGAN.",
  "--",
  "-- DDL schema `proyek` untuk ERP Nanoland (Supabase/PostgreSQL 16).",
  "-- Sumbernya prisma/schema.prisma; jalankan `npm run skema:sql` sesudah skema",
  "-- berubah.",
  "--",
  `--   ${ikut.length} tabel · ${jumlahKolom} kolom`,
  `--   ${jumlahUang} kolom uang numeric(18,2)`,
  `--   ${jumlahCheck} CHECK enum, seluruhnya dari src/lib/domain/enums.ts`,
  `--   ${jumlahFk} foreign key dalam schema · ${jumlahFkAuth} dialihkan ke auth.users`,
  `--   ${trigger.length} trigger diubahPada`,
  "--",
  `-- Tidak ikut: ${[...TANPA_MIGRASI].join(", ")} — identitas dari Supabase Auth.`,
  "-- =============================================================================",
  "",
  `create schema if not exists ${SCHEMA};`,
  "",
];

const isi = [
  ...kepala,
  "-- ---------------------------------------------------------------------------",
  "-- TABEL",
  "-- ---------------------------------------------------------------------------",
  "",
  ...bagian.map((b) => b + "\n"),
  "-- ---------------------------------------------------------------------------",
  "-- INDEKS",
  "-- ---------------------------------------------------------------------------",
  "",
  ...indeksLuar,
  "",
  "-- ---------------------------------------------------------------------------",
  "-- TRIGGER",
  "-- ---------------------------------------------------------------------------",
  "",
  ...ddlTrigger,
  "",
  "-- ---------------------------------------------------------------------------",
  "-- RLS & GRANT",
  "-- ---------------------------------------------------------------------------",
  "",
  ...ddlRls,
].join("\n");

writeFileSync(TUJUAN, isi);

console.log(`${TUJUAN} ditulis`);
console.log(`  ${ikut.length} tabel, ${jumlahKolom} kolom`);
console.log(`  ${jumlahUang} kolom uang numeric(18,2)`);
console.log(`  ${jumlahCheck} CHECK enum dari ${Object.keys(SEMUA_ENUM).length} enum terdaftar`);
console.log(`  ${jumlahFk} FK dalam schema, ${jumlahFkAuth} ke auth.users`);
console.log(`  ${trigger.length} trigger diubahPada`);
