import { readFileSync, writeFileSync } from "node:fs";

/**
 * DATA ACUAN → INSERT untuk schema `proyek`.
 *
 * Pasangan `skema:sql`: yang itu membuat tabelnya, yang ini mengisi pustaka
 * harga — price book dan analisa harga satuan. Dijalankan sekali di SQL editor
 * Supabase, sesudah `prisma/proyek.sql`.
 *
 * Matriks hak akses TIDAK di sini: ia punya perintahnya sendiri, `acl:sql`.
 * Alasannya bukan kerapian — matriks disunting berkali-kali sesudah sistem
 * jalan, sedangkan pustaka harga diisi sekali lalu dirawat tim. Menggabungkan
 * keduanya berarti menjalankan ulang yang satu memaksa menyentuh yang lain.
 *
 * Data peragaan TIDAK ikut. Proyek contoh, unit contoh, dan pengeluaran contoh
 * tetap di `prisma/seed.ts` dan berhenti di demo.
 *
 * ------------------------------------------------------------------------
 * KENAPA ID-nya DIBUAT, BUKAN DIBIARKAN DIISI DATABASE
 * ------------------------------------------------------------------------
 * Kolom `id` tabel-tabel ini `text primary key` tanpa default: aplikasilah yang
 * membuat cuid. Untuk data acuan itu justru menguntungkan — id diturunkan dari
 * kunci alaminya (`hd-m-01`, `an-a-01`, `rsp-bod-keuangan`), sehingga:
 *
 *   1. berkasnya bisa dijalankan ULANG tanpa menggandakan apa pun, karena
 *      `on conflict ("id") do nothing` punya sesuatu untuk dibandingkan; dan
 *   2. komponen analisa bisa menunjuk harga dasarnya tanpa subquery, tanpa CTE,
 *      dan tanpa urutan penyisipan yang rapuh.
 *
 * Id yang terbaca manusia juga berarti galat FK menyebut baris yang salah
 * dengan namanya, bukan dengan 25 huruf acak.
 */

const KELUARAN = "prisma/acuan.sql";

const baca = (nama) => JSON.parse(readFileSync(`prisma/acuan/${nama}`, "utf8"));

const hargaDasar = baca("harga-dasar.json");
const analisa = baca("analisa.json");


// --- alat bantu --------------------------------------------------------------

/** Kunci alami → potongan id yang aman dan terbaca. */
const slug = (teks) =>
  String(teks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const kutip = (nilai) => {
  if (nilai === null || nilai === undefined) return "null";
  if (typeof nilai === "number") return String(nilai);
  if (typeof nilai === "boolean") return nilai ? "true" : "false";
  return `'${String(nilai).split("'").join("''")}'`;
};

const idHarga = (kode) => `hd-${slug(kode)}`;
const idAnalisa = (kode) => `an-${slug(kode)}`;

/** Satu pernyataan insert, satu baris per nilai, idempoten. */
function pernyataan(tabel, kolom, baris) {
  if (baris.length === 0) return "";
  const daftar = kolom.map((k) => `"${k}"`).join(", ");
  const nilai = baris.map((b) => `  (${kolom.map((k) => kutip(b[k])).join(", ")})`).join(",\n");
  return `insert into proyek.${tabel} (${daftar}) values\n${nilai}\non conflict ("id") do nothing;\n`;
}

// --- price book & analisa ----------------------------------------------------

const barisHarga = hargaDasar.map((h) => ({
  id: idHarga(h.kode),
  kode: h.kode,
  kategori: h.kategori,
  uraian: h.uraian,
  satuan: h.satuan,
  hargaAcuan: h.hargaAcuan,
}));

const kodeHarga = new Set(hargaDasar.map((h) => h.kode));

const barisAnalisa = analisa.map((a) => ({
  id: idAnalisa(a.kode),
  kode: a.kode,
  uraian: a.uraian,
  satuan: a.satuan,
  kelompok: a.kelompok,
  overheadPct: a.overheadPct,
}));

const barisKomponen = [];
for (const a of analisa) {
  a.komponen.forEach((k, i) => {
    if (!kodeHarga.has(k.kode)) {
      throw new Error(`${a.kode}: komponen menunjuk harga dasar "${k.kode}" yang tidak ada`);
    }
    barisKomponen.push({
      id: `ka-${slug(a.kode)}-${String(i + 1).padStart(2, "0")}`,
      analisaId: idAnalisa(a.kode),
      hargaDasarId: idHarga(k.kode),
      koefisien: k.koefisien,
      urutan: i,
    });
  });
}

// --- rangkai -----------------------------------------------------------------

const bagian = [
  `-- Data acuan modul PROYEK — dihasilkan oleh scripts/acuan-sql.mjs.
-- JANGAN disunting tangan: sumbernya prisma/acuan/*.json.
--
-- Dijalankan SESUDAH prisma/proyek.sql, sekali, sebelum tim mulai mengisi.
-- Aman dijalankan ulang: tiap baris punya id tetap dan diakhiri
-- "on conflict do nothing", jadi menjalankan dua kali tidak menggandakan
-- apa pun dan juga TIDAK menimpa nilai yang sudah disunting tim.
--
-- Matriks hak akses TIDAK di berkas ini — lihat prisma/acl.sql (npm run acl:sql).
-- Urutan pengisian data sesudah ini: docs/urutan-isi-data.md

begin;
`,
  `-- ${barisHarga.length} harga dasar. Nilainya harga awal yang WAJIB disesuaikan
-- tim sebelum dipakai menyusun RAB — yang acuan di sini strukturnya, bukan angkanya.`,
  pernyataan("harga_dasar", ["id", "kode", "kategori", "uraian", "satuan", "hargaAcuan"], barisHarga),
  `-- ${barisAnalisa.length} analisa harga satuan, koefisien bergaya SNI AHSP.
-- Harga satuannya TIDAK disimpan: selalu dihitung dari komponen × harga dasar.`,
  pernyataan("analisa_harga", ["id", "kode", "uraian", "satuan", "kelompok", "overheadPct"], barisAnalisa),
  `-- ${barisKomponen.length} komponen analisa.`,
  pernyataan("komponen_analisa", ["id", "analisaId", "hargaDasarId", "koefisien", "urutan"], barisKomponen),
  "commit;\n",
];

writeFileSync(KELUARAN, bagian.join("\n"));

console.log(
  `${KELUARAN}: ${barisHarga.length} harga dasar, ${barisAnalisa.length} analisa, ` +
    `${barisKomponen.length} komponen.`,
);
