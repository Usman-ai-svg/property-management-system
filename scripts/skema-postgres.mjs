/**
 * Hasilkan skema Prisma versi PostgreSQL dari skema SQLite.
 *
 * Dijalankan dengan `npm run skema:postgres`. Keluarannya
 * `prisma/schema.postgres.prisma`, yang TIDAK dipakai aplikasi ini —
 * gunanya sebagai bahan siap pakai saat modul diserap ERP.
 *
 * Empat perubahan yang dikerjakan, semuanya mekanis dan bisa diulang:
 *
 *   1. provider sqlite  → postgresql
 *   2. Float untuk uang → Decimal @db.Decimal(18, 2)
 *   3. Nama tabel       → diberi awalan `pm_` lewat @@map, supaya tidak
 *                         bentrok dengan 40-an tabel ERP yang sudah ada
 *   4. Enum String      → dibiarkan String, TAPI didaftar di keluaran sebagai
 *                         CREATE TYPE yang bisa dipakai belakangan
 *
 * Yang TIDAK dikerjakan otomatis, dan memang tidak boleh: mengubah relasi,
 * indeks, atau aturan onDelete. Semuanya sudah benar di skema asal.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { SEMUA_ENUM } from "../src/lib/domain/enums.ts";

const SUMBER = "prisma/schema.prisma";
const TUJUAN = "prisma/schema.postgres.prisma";
const AWALAN = "pm_";

/**
 * Kolom `Float` yang BUKAN uang, jadi tidak boleh jadi Decimal(18,2).
 *
 * Volume pekerjaan punya pecahan halus (12,375 m³ beton) dan luas lahan
 * dicatat sampai dua desimal — keduanya tetap Float. Salah menaikkannya jadi
 * Decimal(18,2) akan membulatkan volume dan menggeser seluruh nilai RAB.
 */
const BUKAN_UANG = new Set([
  // Volume & luas — punya pecahan halus. 12,375 m3 beton akan dibulatkan
  // menjadi 12,38 kalau dinaikkan jadi Decimal(18,2), dan itu menggeser
  // seluruh nilai RAB yang dihitung darinya.
  "volume", "luas", "luasTanah", "luasBangunan", "luasKavlingEfektif",
  "luasSarana", "luasPrasarana", "luasRth", "luasUnit", "luasLahan",
  // Koordinat peta — butuh enam desimal, bukan dua. Dua desimal menggeser
  // titik lokasi sampai sekitar satu kilometer.
  "pinLat", "pinLng",
  // Persentase dan jarak.
  "retensiPct", "overheadPct", "jarak", "pemakaian",
  // Koefisien AHSP — pecahan halus (0,00252 kg besi per m³). Dibulatkan jadi
  // dua desimal akan menggeser seluruh harga satuan analisa yang dihitung darinya.
  "koefisien",
  // Kuantitas baris pembelian — bisa berpecahan (mis. 2,5 m³ pasir); ikut
  // aturan yang sama dengan volume, jangan dinaikkan jadi Decimal(18,2).
  "qty",
]);

// Normalkan akhir baris ke LF. Di checkout Windows (autocrlf) berkas bisa
// ber-CRLF; tanpa normalisasi, `\r` di ujung baris membuat regex Float `(.*)$`
// gagal cocok dan tak ada satu pun kolom uang yang dinaikkan jadi Decimal.
const kode = readFileSync(SUMBER, "utf8").replace(/\r\n/g, "\n");

// --- 1. provider ---
let hasil = kode.replace('provider = "sqlite"', 'provider = "postgresql"');

// --- 2. Float uang → Decimal ---
let jumlahDecimal = 0;
let jumlahFloatTetap = 0;
hasil = hasil
  .split("\n")
  .map((baris) => {
    const m = baris.match(/^(\s+)(\w+)(\s+)Float(\??)(.*)$/);
    if (!m) return baris;
    const [, indent, nama, spasi, opsional, sisa] = m;
    if (BUKAN_UANG.has(nama)) {
      jumlahFloatTetap++;
      return baris;
    }
    jumlahDecimal++;
    return `${indent}${nama}${spasi}Decimal${opsional} @db.Decimal(18, 2)${sisa}`;
  })
  .join("\n");

// --- 3. awalan nama tabel ---
const model = [...kode.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
const nadaUlar = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

// Skema asal SUDAH punya @@map untuk tiap model; yang dilakukan di sini
// menambahkan awalan pada nama yang sudah ada, bukan menambah @@map kedua.
let jumlahMap = 0;
hasil = hasil.replace(/@@map\("([^"]+)"\)/g, (_, nama) => {
  jumlahMap++;
  return `@@map("${AWALAN}${nama}")`;
});
if (jumlahMap !== model.length) {
  throw new Error(
    `Ada ${model.length} model tapi ${jumlahMap} @@map. ` +
      "Setiap model harus punya @@map di skema asal supaya penambahan awalan bisa diandalkan.",
  );
}

// --- kepala berkas ---
const kepala = `// =============================================================================
// DIHASILKAN OTOMATIS oleh scripts/skema-postgres.mjs — JANGAN DISUNTING TANGAN.
//
// Versi PostgreSQL dari prisma/schema.prisma, disiapkan untuk penyerapan ke
// ERP Nanoland (Supabase). Aplikasi ini TIDAK memakainya.
//
// Yang sudah dikerjakan:
//   - provider postgresql
//   - ${jumlahDecimal} kolom uang jadi Decimal(18, 2)
//   - ${jumlahFloatTetap} kolom Float BUKAN uang dibiarkan (volume, luas, persentase)
//   - ${jumlahMap} tabel diberi awalan "${AWALAN}" pada @@map yang sudah ada
//
// Yang masih harus dikerjakan manusia:
//   - Enum masih bertipe String. Daftar nilai sahnya ada di bawah sebagai
//     CREATE TYPE siap pakai; menaikkannya perlu migrasi data.
//   - Row Level Security. Skema ini tidak memuat policy apa pun.
//   - Keputusan apakah tabel User/Role kita dipakai, atau diganti profiles ERP.
// =============================================================================

`;

writeFileSync(TUJUAN, kepala + hasil.replace(/^\/\/ =+\n\/\/ NANOLAND[\s\S]*?^\/\/ =+\n/m, ""));

// --- 4. berkas enum SQL ---
const baris = ["-- Enum asli Postgres, dihasilkan dari src/lib/domain/enums.ts.", ""];
for (const [nama, nilai] of Object.entries(SEMUA_ENUM)) {
  const tipe = AWALAN + nadaUlar(nama);
  baris.push(`CREATE TYPE ${tipe} AS ENUM (`);
  baris.push(nilai.map((v) => `  '${v.replace(/'/g, "''")}'`).join(",\n"));
  baris.push(");", "");
}
writeFileSync("prisma/enum-postgres.sql", baris.join("\n"));

console.log(`${TUJUAN} ditulis`);
console.log(`  ${jumlahMap} tabel diberi awalan ${AWALAN}`);
console.log(`  ${jumlahDecimal} kolom uang jadi Decimal(18, 2)`);
console.log(`  ${jumlahFloatTetap} kolom Float dibiarkan (volume, luas, persentase)`);
console.log(`prisma/enum-postgres.sql ditulis — ${Object.keys(SEMUA_ENUM).length} enum`);
