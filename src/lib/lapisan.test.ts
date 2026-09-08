import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * PENJAGA LAPISAN.
 *
 * Nilai terbesar basis kode ini untuk migrasi bukan tampilannya, melainkan
 * bahwa aturan bisnisnya duduk di lapisan yang tidak tahu apa-apa soal
 * framework. Sifat itu gampang rusak tanpa terasa: satu `import` yang praktis
 * hari ini membuat seluruh berkas tidak bisa dipindah tahun depan.
 *
 * Tes ini menjaganya. Ia hanya membaca baris `import`, bukan seluruh teks,
 * supaya komentar yang menyebut nama pustaka tidak ikut dianggap pelanggaran.
 */

/** Lapisan yang harus tetap bisa disalin ke ERP tanpa perubahan sebaris pun. */
const LAPISAN_MURNI = [
  "src/lib/calc",
  "src/lib/domain",
  "src/lib/tampilan",
  "src/lib/adaptor",
  // Lapisan kelima yang resmi. Dulu `src/lib/format.ts` berdiri sendiri di luar
  // daftar ini — murni, dipakai lapisan murni lain, tapi tidak dijaga. Dijadikan
  // folder ber-index supaya masuk penjagaan tanpa mengubah satu pun jalur impor
  // (`@/lib/format` tetap sama) dan supaya bisa jadi namespace tersendiri di
  // bundel ERP.
  "src/lib/format",
  // Lapisan keenam: kontrak masukan tiap aksi tulis. Justru inilah yang paling
  // harus tetap murni — fungsi `periksa*` di dalamnya akan disalin apa adanya
  // menjadi validasi di dalam RPC Postgres, dan tesnya jadi acuan mengujinya.
  "src/lib/kontrak",
];

/** Yang tidak boleh diimpor dari lapisan murni. */
const TERLARANG = [
  { pola: /^react$|^react\//, alasan: "React" },
  { pola: /^next(\/|$)/, alasan: "Next.js" },
  { pola: /^@\/lib\/db$/, alasan: "Prisma" },
  { pola: /^@prisma\//, alasan: "Prisma" },
  { pola: /^exceljs$/, alasan: "ExcelJS" },
  { pola: /^node:/, alasan: "API Node" },
  { pola: /^@\/lib\/data\//, alasan: "lapisan pengambilan data" },
  { pola: /^@\/app\//, alasan: "lapisan halaman" },
  { pola: /^@\/components\//, alasan: "komponen React" },
];

/** Seluruh berkas .ts non-tes di sebuah folder, rekursif. */
function berkasSumber(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasSumber(jalur));
    else if (nama.endsWith(".ts") && !nama.endsWith(".test.ts")) hasil.push(jalur);
  }
  return hasil;
}

/** Modul yang diimpor sebuah berkas. Hanya baris import, bukan komentar. */
function moduleDiimpor(kode: string): string[] {
  const hasil: string[] = [];
  const pola = /^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(kode))) hasil.push(m[1]);
  // import "sesuatu" tanpa binding
  const polaPolos = /^\s*import\s+["']([^"']+)["']/gm;
  while ((m = polaPolos.exec(kode))) hasil.push(m[1]);
  return hasil;
}

describe("kemurnian lapisan", () => {
  for (const dir of LAPISAN_MURNI) {
    for (const berkas of berkasSumber(dir)) {
      it(`${berkas} tidak mengimpor framework`, () => {
        const impor = moduleDiimpor(readFileSync(berkas, "utf8"));
        const pelanggaran = impor
          .map((m) => {
            const larangan = TERLARANG.find((l) => l.pola.test(m));
            return larangan ? `${m} (${larangan.alasan})` : null;
          })
          .filter((x): x is string => x !== null);

        assert.deepEqual(
          pelanggaran,
          [],
          `${berkas} mengimpor ${pelanggaran.join(", ")}. ` +
            "Lapisan ini harus bisa disalin ke ERP apa adanya — pindahkan " +
            "bagian yang butuh framework ke pemanggilnya.",
        );
      });
    }
  }

  it("penjaganya membaca impor, bukan komentar", () => {
    // Berkas di lapisan murni memang MENYEBUT nama pustaka di komentar untuk
    // menjelaskan apa yang sengaja tidak dipakai. Itu tidak boleh dihitung.
    const contoh = `/** Tanpa exceljs, tanpa react. */\nimport { a } from "./b";\n`;
    assert.deepEqual(moduleDiimpor(contoh), ["./b"]);
  });

  it("penjaganya benar-benar menangkap impor terlarang", () => {
    const buruk = `import ExcelJS from "exceljs";\nimport { x } from "next/navigation";\n`;
    const ketemu = moduleDiimpor(buruk).filter((m) => TERLARANG.some((l) => l.pola.test(m)));
    assert.deepEqual(ketemu, ["exceljs", "next/navigation"]);
  });

  it("memeriksa jumlah berkas yang masuk akal", () => {
    // Kalau penelusuran folder rusak dan tidak menemukan apa pun, seluruh tes
    // di atas akan lolos tanpa memeriksa apa-apa.
    const jumlah = LAPISAN_MURNI.reduce((s, d) => s + berkasSumber(d).length, 0);
    assert.ok(jumlah >= 12, `hanya ${jumlah} berkas ditemukan di lapisan murni`);
  });
});

describe("penjaga lapisan pengambilan data", () => {
  it("src/lib/data tidak mengimpor React maupun komponen", () => {
    const pelanggaran: string[] = [];
    for (const berkas of berkasSumber("src/lib/data")) {
      for (const m of moduleDiimpor(readFileSync(berkas, "utf8"))) {
        if (/^react$|^@\/components\//.test(m)) pelanggaran.push(`${berkas}: ${m}`);
      }
    }
    assert.deepEqual(pelanggaran, []);
  });
});

/** Seluruh page.tsx dan route.ts di bawah sebuah folder, rekursif. */
function berkasHalaman(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasHalaman(jalur));
    else if (nama === "page.tsx" || nama === "route.ts") hasil.push(jalur);
  }
  return hasil;
}

/**
 * PENJAGA HALAMAN TIDAK MENYENTUH PRISMA.
 *
 * MIGRASI.md menjanjikan bahwa saat modul ini diserap ERP, hanya
 * `src/lib/data/` yang berganti isi — dari `prisma.*` menjadi pemanggilan RPC —
 * sementara halaman tidak perlu tahu sumber datanya berubah. Janji itu hanya
 * berlaku selama tidak ada halaman yang memegang query-nya sendiri.
 *
 * Sebelum tes ini ada, aturannya cuma tertulis di dokumen beserta perintah grep
 * untuk memeriksanya sendiri — dan memang luntur: lima berkas sempat mengimpor
 * `@/lib/db` langsung. Yang dijaga tes bertahan, yang hanya ditulis di dokumen
 * tidak. Karena itu pemeriksaannya sekarang di sini.
 *
 * `*actions.ts` sengaja TIDAK ikut diperiksa: itu lapisan perubahan data yang
 * nantinya menjadi RPC penulisan, dan memang masih memanggil Prisma.
 */
describe("penjaga halaman tidak menyentuh Prisma", () => {
  it("tidak ada page.tsx / route.ts yang mengimpor @/lib/db", () => {
    const pelanggaran: string[] = [];
    for (const berkas of berkasHalaman("src/app")) {
      for (const m of moduleDiimpor(readFileSync(berkas, "utf8"))) {
        if (m === "@/lib/db") pelanggaran.push(berkas);
      }
    }

    assert.deepEqual(
      pelanggaran,
      [],
      "Berkas berikut memegang query Prisma sendiri:\n  " +
        pelanggaran.join("\n  ") +
        "\nTurunkan query-nya ke src/lib/data/ dan panggil lewat fungsi bernama. " +
        "Perhatikan blok `...(bolehHarga ? … : {})` di dalam select — itu " +
        "penegakan hak akses, bukan kerapian; ia harus ikut pindah utuh.",
    );
  });

  it("penjaganya benar-benar menangkap impor Prisma", () => {
    const buruk = `import { prisma } from "@/lib/db";\n`;
    assert.ok(moduleDiimpor(buruk).includes("@/lib/db"));
  });

  it("memeriksa jumlah berkas yang masuk akal", () => {
    const jumlah = berkasHalaman("src/app").length;
    assert.ok(jumlah >= 25, `hanya ${jumlah} halaman/rute ditemukan`);
  });
});

/**
 * PENJAGA BERKAS PORTABEL DI AKAR src/lib.
 *
 * `nav.ts` tidak berada di dalam folder lapisan murni,
 * tetapi ikut dipancarkan oleh `npm run bangun:portabel` karena keduanya murni
 * dan justru paling dibutuhkan UI: cara menulis rupiah, persen, dan tanggal,
 * tarif PPN 11% & all-in 10%, serta struktur menu beserta sub-bagian hak
 * aksesnya.
 *
 * Karena letaknya di luar folder yang disapu penjaga di atas, satu impor
 * Prisma di sini tidak akan tertangkap oleh siapa pun — dan pemancarannya baru
 * gagal belakangan, jauh dari sebabnya. Karena itu keduanya disebut eksplisit.
 */
// `format` dulu ikut di sini sebagai `src/lib/format.ts`. Sekarang ia folder
// ber-index dan sudah masuk LAPISAN_MURNI di atas, jadi tak perlu disebut dua kali.
const BERKAS_PORTABEL = ["src/lib/nav.ts"];

describe("kemurnian berkas portabel di akar src/lib", () => {
  for (const berkas of BERKAS_PORTABEL) {
    it(`${berkas} tetap bisa dipancarkan ke ESM polos`, () => {
      const pelanggaran = moduleDiimpor(readFileSync(berkas, "utf8"))
        .map((m) => {
          const larangan = TERLARANG.find((l) => l.pola.test(m));
          return larangan ? `${m} (${larangan.alasan})` : null;
        })
        .filter((x): x is string => x !== null);

      assert.deepEqual(
        pelanggaran,
        [],
        `${berkas} mengimpor ${pelanggaran.join(", ")}. Berkas ini ikut ` +
          "dipancarkan ke portabel/ untuk dipakai vanilla JS di ERP — " +
          "pindahkan bagian yang butuh framework ke pemanggilnya.",
      );
    });
  }
});
