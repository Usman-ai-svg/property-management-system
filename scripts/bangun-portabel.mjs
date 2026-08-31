/**
 * Pancarkan empat lapisan murni menjadi ESM siap-browser.
 *
 * ERP tujuan memakai satu index.html + vanilla JS + Supabase RPC — tidak ada
 * bundler, tidak ada langkah kompilasi. Aturan bisnisnya (calc, domain,
 * tampilan, adaptor) adalah bagian yang paling mahal dibuat ulang dan paling
 * berbahaya kalau ditulis ulang dari layar, jadi yang dibutuhkan adalah
 * berkas .js yang bisa langsung ditulis di `<script type="module">`.
 *
 * `tsc` sendiri tidak cukup. Sumbernya memakai impor tanpa ekstensi
 * (`./tabel-aturan`) dan beberapa alias `@/lib/...`; keduanya sah di
 * moduleResolution "bundler" tetapi TIDAK bisa dimuat browser, yang menuntut
 * jalur lengkap. Karena itu keluaran tsc ditulis ulang di sini.
 *
 * Skrip ini sekaligus gerbangnya sendiri: setelah memancarkan, ia memeriksa
 * tak ada impor tersisa yang tidak bisa dimuat browser, lalu benar-benar
 * meng-import setiap modul hasil pancaran untuk membuktikan semuanya berdiri
 * sendiri. Membangun tanpa memeriksa hanya memindahkan kegagalan ke browser
 * orang lain.
 *
 * Jalankan: npm run bangun:portabel
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const AKAR = process.cwd();
const KELUARAN = join(AKAR, "portabel");

/** Semua berkas dengan ekstensi tertentu di bawah sebuah folder, rekursif. */
function berkas(dir, ekstensi) {
  if (!existsSync(dir)) return [];
  const hasil = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkas(jalur, ekstensi));
    else if (nama.endsWith(ekstensi)) hasil.push(jalur);
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// 1. Pancarkan
// ---------------------------------------------------------------------------
rmSync(KELUARAN, { recursive: true, force: true });
console.log("Memancarkan lapisan murni dengan tsc...");
// Binari tsc dipanggil langsung lewat node, bukan lewat `npx`: di Windows,
// spawn sebuah .cmd tanpa shell ditolak dengan EINVAL.
execFileSync(
  process.execPath,
  [join(AKAR, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.portabel.json"],
  { stdio: "inherit", cwd: AKAR },
);

// ---------------------------------------------------------------------------
// 2. Tulis ulang impor agar bisa dimuat browser
// ---------------------------------------------------------------------------
// Menyentuh specifier di `import ... from "X"`, `export ... from "X"`, dan
// `import("X")`. Alias `@/lib/...` menunjuk akar lapisan murni, jadi ia bisa
// dijadikan jalur relatif terhadap berkas yang memuatnya.
const POLA = /(\bfrom\s*["']|\bimport\s*\(\s*["'])([^"']+)(["'])/g;

function jalurBaru(spesifier, berkasJs) {
  let target = spesifier;

  if (target.startsWith("@/lib/")) {
    const absolut = join(KELUARAN, target.slice("@/lib/".length));
    let rel = relative(dirname(berkasJs), absolut).split("\\").join("/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    target = rel;
  }

  if (!target.startsWith(".")) return null; // paket luar — tak seharusnya ada
  if (/\.(js|mjs|json)$/.test(target)) return target;

  // Folder dengan index.js, atau berkas biasa.
  const sebagaiBerkas = resolve(dirname(berkasJs), target + ".js");
  if (existsSync(sebagaiBerkas)) return target + ".js";
  const sebagaiIndex = resolve(dirname(berkasJs), target, "index.js");
  if (existsSync(sebagaiIndex)) return target.replace(/\/$/, "") + "/index.js";
  return target + ".js"; // biar tahap pemeriksaan yang melaporkannya
}

let jumlahTulisUlang = 0;
for (const js of [...berkas(KELUARAN, ".js"), ...berkas(KELUARAN, ".d.ts")]) {
  const isi = readFileSync(js, "utf8");
  const baru = isi.replace(POLA, (utuh, awal, spesifier, akhir) => {
    const ganti = jalurBaru(spesifier, js);
    if (ganti === null || ganti === spesifier) return utuh;
    jumlahTulisUlang++;
    // .d.ts tidak butuh ekstensi .js, tapi memakainya tetap sah dan membuat
    // kedua keluaran konsisten.
    return awal + ganti + akhir;
  });
  if (baru !== isi) writeFileSync(js, baru, "utf8");
}
console.log(`Impor ditulis ulang: ${jumlahTulisUlang}`);

// ---------------------------------------------------------------------------
// 3. Periksa: tak ada impor yang tidak bisa dimuat browser
// ---------------------------------------------------------------------------
const pelanggaran = [];
for (const js of berkas(KELUARAN, ".js")) {
  const isi = readFileSync(js, "utf8");
  for (const m of isi.matchAll(POLA)) {
    const spesifier = m[2];
    const rel = relative(AKAR, js).split("\\").join("/");
    if (!spesifier.startsWith(".")) {
      pelanggaran.push(`${rel}: "${spesifier}" bukan jalur relatif`);
      continue;
    }
    if (!/\.(js|mjs|json)$/.test(spesifier)) {
      pelanggaran.push(`${rel}: "${spesifier}" tanpa ekstensi`);
      continue;
    }
    if (!existsSync(resolve(dirname(js), spesifier))) {
      pelanggaran.push(`${rel}: "${spesifier}" tidak ada`);
    }
  }
}

if (pelanggaran.length) {
  console.error("\nImpor yang tidak bisa dimuat browser:");
  for (const p of pelanggaran) console.error("  " + p);
  process.exit(1);
}

// Penanda tipe modul. Browser tidak memerlukannya — `<script type="module">`
// sudah menentukannya — tetapi tanpa ini Node menebak-nebak tiap berkas dan
// memperingatkan, dan alat pemeriksa yang berjalan di Node ikut terganggu.
writeFileSync(
  join(KELUARAN, "package.json"),
  JSON.stringify({ name: "nanoland-portabel", type: "module", private: true }, null, 2) + "\n",
  "utf8",
);

// ---------------------------------------------------------------------------
// 4. Buktikan setiap modul berdiri sendiri
// ---------------------------------------------------------------------------
// Pemeriksaan teks di atas tidak menangkap ketergantungan melingkar maupun
// galat saat modul dievaluasi. Meng-import semuanya menangkapnya.
const semua = berkas(KELUARAN, ".js");
let jumlahEkspor = 0;
for (const js of semua) {
  const mod = await import(pathToFileURL(js).href);
  jumlahEkspor += Object.keys(mod).length;
}

writeFileSync(
  join(KELUARAN, "README.md"),
  [
    "# Lapisan portabel — ESM siap-browser",
    "",
    "Dibangkitkan oleh `npm run bangun:portabel`. **Jangan disunting di sini** —",
    "sumbernya `src/lib/{calc,domain,tampilan,adaptor}`, dan suntingan di folder",
    "ini akan hilang pada pembangunan berikutnya.",
    "",
    "Isinya aturan bisnis murni: tanpa React, tanpa Next, tanpa Prisma, tanpa",
    "API Node. Bisa dimuat langsung dari satu index.html:",
    "",
    "```html",
    '<script type="module">',
    '  import { totalBaris } from "./portabel/calc/boq.js";',
    '  import { rp } from "./portabel/adaptor/formulir.js";',
    "</script>",
    "```",
    "",
    "Berkas `.d.ts` ikut dipancarkan supaya editor tetap memberi bantuan tipe",
    "meski kodenya dipanggil dari JavaScript biasa.",
    "",
    `Modul: ${semua.length} · ekspor: ${jumlahEkspor}`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Modul dipancarkan : ${semua.length}`);
console.log(`Ekspor tersedia   : ${jumlahEkspor}`);
console.log(`Keluaran          : portabel/`);
console.log("\nSemua modul berhasil dimuat sebagai ESM berdiri sendiri.");
