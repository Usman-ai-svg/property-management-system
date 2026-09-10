import { readFileSync, writeFileSync } from "node:fs";
import { JABATAN, jabatanDari } from "../src/lib/domain/jabatan.ts";
import { SECTIONS } from "../src/lib/domain/enums.ts";

/**
 * MATRIKS HAK AKSES → INSERT untuk `proyek.role_section_permissions`.
 *
 * Dipisahkan dari `acuan:sql` karena umurnya berbeda: pustaka harga diisi
 * sekali lalu dirawat tim, sedangkan matriks ini disunting berkali-kali sesudah
 * sistem jalan. Menggabungkan keduanya berarti menjalankan ulang yang satu
 * memaksa menyentuh yang lain.
 *
 * Dikunci ke KUNCI jabatan (`quantity_surveyor_asst`), bukan ke teks jabatan
 * HRIS. Selama kolom jabatan di HRIS belum terbukti punya daftar tertutup,
 * teksnya harus dianggap bebas — dan satu salah ketik akan mencabut akses
 * seseorang tanpa pesan apa pun. Pemetaan teks HRIS → kunci ada di
 * `src/lib/domain/jabatan.ts`, dan mengoreksinya berbiaya satu baris.
 *
 * Skrip ini memverifikasi hasilnya sendiri sebelum menulis: tiap baris harus
 * menunjuk jabatan dan sub-bagian yang benar-benar ada, hak ubah tidak boleh
 * melampaui hak lihat, dan jabatan bercakupan `luar` tidak boleh membawa satu
 * pun hak ubah. Memancarkan tanpa memeriksa hanya memindahkan kegagalan ke
 * orang lain.
 */

const SUMBER = "prisma/acuan/hak-akses.json";
const KELUARAN = "prisma/acl.sql";

const { catatan, akses } = JSON.parse(readFileSync(SUMBER, "utf8"));

// --- periksa dulu ------------------------------------------------------------

const kunciSah = new Set(JABATAN.map((j) => j.kunci));
const sectionSah = new Set(SECTIONS);
const terlihat = new Set();

for (const a of akses) {
  const kunci = `${a.jabatan}/${a.section}`;
  if (!kunciSah.has(a.jabatan)) throw new Error(`${kunci}: jabatan tidak dikenal`);
  if (!sectionSah.has(a.section)) throw new Error(`${kunci}: sub-bagian tidak ada di enums.ts`);
  if (terlihat.has(kunci)) throw new Error(`${kunci}: baris kembar`);
  terlihat.add(kunci);

  // Hak ubah tanpa hak lihat adalah keadaan yang tidak bisa terjadi: yang
  // diubah orang pasti dilihatnya lebih dulu. Kalau lolos, akibatnya bukan
  // galat melainkan halaman kosong yang tombolnya tetap bekerja.
  if (a.bolehUbah && !a.bolehLihat) throw new Error(`${kunci}: boleh ubah tanpa boleh lihat`);

  if (a.bolehUbah && jabatanDari(a.jabatan)?.cakupan === "luar") {
    throw new Error(`${kunci}: jabatan bercakupan luar tidak boleh punya hak ubah`);
  }
}

// --- pancarkan ---------------------------------------------------------------

const slug = (teks) =>
  String(teks).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const kutip = (nilai) =>
  typeof nilai === "boolean" ? String(nilai) : `'${String(nilai).split("'").join("''")}'`;

const baris = akses.map((a) => ({
  id: `rsp-${slug(a.jabatan)}-${slug(a.section)}`,
  jabatan: a.jabatan,
  section: a.section,
  bolehLihat: a.bolehLihat,
  bolehUbah: a.bolehUbah,
}));

const kolom = ["id", "jabatan", "section", "bolehLihat", "bolehUbah"];
const nilai = baris
  .map((b) => `  (${kolom.map((k) => kutip(b[k])).join(", ")})`)
  .join(",\n");

const ringkas = JABATAN.map((j) => {
  const punya = baris.filter((b) => b.jabatan === j.kunci);
  const ubah = punya.filter((b) => b.bolehUbah).length;
  return `--   ${j.kunci.padEnd(24)} lihat ${String(punya.length).padStart(2)}  ubah ${String(ubah).padStart(2)}`;
}).join("\n");

const sql = `-- Matriks hak akses modul PROYEK — dihasilkan oleh scripts/acl-sql.mjs.
-- JANGAN disunting tangan: sumbernya ${SUMBER}.
--
-- Dijalankan SESUDAH prisma/proyek.sql. Aman dijalankan ulang: tiap baris
-- punya id tetap yang diturunkan dari (jabatan, sub-bagian), dan diakhiri
-- "on conflict do nothing" — menjalankan dua kali tidak menggandakan apa pun
-- dan TIDAK menimpa penyuntingan yang sudah dilakukan lewat halaman Admin.
--
${catatan.map((c) => `-- ${c}`).join("\n")}
--
-- Ringkasan per jabatan:
${ringkas}

begin;

insert into proyek.role_section_permissions (${kolom.map((k) => `"${k}"`).join(", ")}) values
${nilai}
on conflict ("id") do nothing;

commit;
`;

writeFileSync(KELUARAN, sql);

const jumlahUbah = baris.filter((b) => b.bolehUbah).length;
console.log(
  `${KELUARAN}: ${baris.length} baris hak akses untuk ${JABATAN.length} jabatan ` +
    `(${jumlahUbah} di antaranya boleh ubah).`,
);
