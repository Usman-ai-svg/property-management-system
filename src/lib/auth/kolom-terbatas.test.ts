import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIJAGA_DI_HALAMAN, kolomTerbatas, KOLOM_TERBATAS, penjagaKolom, saringSelect,
  WAJIB_IKUT_HARGA,
} from "./kolom-terbatas";
import { ACL_AWAL } from "../../../prisma/seed-data";

describe("penjagaKolom", () => {
  it("menemukan sub-bagian penjaga sebuah kolom", () => {
    assert.equal(penjagaKolom("unit", "hargaJual"), "hargaRabRap");
    assert.equal(penjagaKolom("project", "biayaNotaris"), "hargaRabRap");
  });

  it("null untuk kolom yang memang bebas dilihat", () => {
    assert.equal(penjagaKolom("unit", "nomor"), null);
    assert.equal(penjagaKolom("unit", "statusPembangunan"), null);
  });

  it("null untuk model yang tidak punya kolom terbatas sama sekali", () => {
    assert.equal(penjagaKolom("auditLog", "aksi"), null);
  });
});

describe("saringSelect", () => {
  const fragmen = {
    id: true, nomor: true, hargaJual: true, rapUpah: true, statusPembangunan: true,
  };

  it("membuang kolom yang penjaganya tidak dipegang", () => {
    const hasil = saringSelect("unit", fragmen, () => false);
    assert.deepEqual(Object.keys(hasil).sort(), ["id", "nomor", "statusPembangunan"]);
  });

  it("meloloskan semuanya bila izinnya dipegang", () => {
    const hasil = saringSelect("unit", fragmen, () => true);
    assert.equal(Object.keys(hasil).length, 5);
  });

  it("hanya membuang kolom milik sub-bagian yang tidak dipegang", () => {
    const hasil = saringSelect("unit", fragmen, (s) => s !== "hargaRabRap");
    assert.equal("hargaJual" in hasil, false);
    assert.equal("nomor" in hasil, true);
  });

  it("kolom yang tidak terdaftar dibiarkan lewat — ini daftar larangan, bukan izin", () => {
    const hasil = saringSelect("unit", { kolomBaru: true }, () => false);
    assert.equal("kolomBaru" in hasil, true);
  });
});

describe("kolomTerbatas", () => {
  it("mengumpulkan seluruh kolom terbatas sebuah model", () => {
    assert.deepEqual(kolomTerbatas("infrastructure").sort(), [
      "boqItems", "rab", "rapItems", "rapUpah",
    ]);
  });

  it("kosong untuk model tanpa kolom terbatas", () => {
    assert.deepEqual(kolomTerbatas("vendor"), []);
  });
});

// ---------------------------------------------------------------------------
// PENJAGA: kolom uang tidak boleh di-SELECT tanpa syarat
//
// Inilah tes yang paling penting di berkas ini. Ia membaca kode sumber
// lapisan pengambilan data dan memastikan tiap kolom uang hanya muncul di
// dalam blok `...(boleh… ? { … } : {})`.
//
// Kenapa perlu: meratakan blok bersyarat menjadi select biasa TIDAK mengubah
// apa pun di layar — komponen tetap menyembunyikan angkanya. Yang berubah
// hanya kolomnya ikut terbawa keluar dari database. Tanpa tes ini, kebocoran
// seperti itu tidak punya gejala apa pun.
// ---------------------------------------------------------------------------

/** Kolom uang yang namanya cukup khas untuk dipindai dengan aman. */
const KOLOM_UANG = [
  "hargaJual", "rapUpah", "hargaPerM2",
  "biayaPembelian", "biayaNotaris", "biayaBalikNama", "biayaLegalLain",
];

/**
 * Pengecualian yang diketahui dan disengaja.
 *
 * `src/lib/data/aset.ts` mengambil `Equipment.nilai` tanpa syarat karena
 * formulir Ubah Aset memerlukannya untuk diisikan ke kolom nilai. Hari ini
 * tidak bocor: setiap peran yang boleh mengubah aset kebetulan juga berhak
 * atas "hargaRabRap". Tapi itu kebetulan yang bisa hilang lewat satu
 * penyuntingan matriks hak akses, jadi dicatat di sini alih-alih dibiarkan
 * tak terlihat.
 */
const PENGECUALIAN = new Set(["aset.ts:nilai"]);

/**
 * Buang komentar supaya penyebutan kolom di dalamnya tidak ikut terpindai.
 *
 * Digantikan spasi dengan panjang sama dan baris baru dipertahankan, supaya
 * nomor baris yang dilaporkan tetap cocok dengan berkas aslinya.
 */
const tanpaKomentar = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

/**
 * Rentang karakter tiap blok `...(boleh… ? { … } : {})`, dicari dengan
 * pencocokan kurung, bukan regex — isinya bersarang beberapa tingkat.
 */
function rentangBersyarat(kode: string): [number, number][] {
  const rentang: [number, number][] = [];
  const pola = /\.\.\.\(\s*boleh\w*/g;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(kode))) {
    let i = m.index + 3; // di "("
    let dalam = 0;
    for (; i < kode.length; i++) {
      if (kode[i] === "(") dalam++;
      else if (kode[i] === ")") {
        dalam--;
        if (dalam === 0) break;
      }
    }
    rentang.push([m.index, i]);
  }
  return rentang;
}

describe("penjaga kolom uang di lapisan pengambilan data", () => {
  const berkas = [
    ...readdirSync("src/lib/data")
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => ["src/lib/data", f] as const),
    ["src/lib/auth", "rbac.ts"] as const,
  ];

  for (const [dir, nama] of berkas) {
    it(`${nama} tidak meng-SELECT kolom uang tanpa syarat`, (t) => {
      if (nama in DIJAGA_DI_HALAMAN) {
        // Dijaga di tingkat halaman, bukan kolom. Implikasinya diuji di
        // blok "implikasi hak akses" di bawah.
        t.skip(`dijaga izin "${DIJAGA_DI_HALAMAN[nama]}" di tingkat halaman`);
        return;
      }
      const kode = tanpaKomentar(readFileSync(join(dir, nama), "utf8"));
      const rentang = rentangBersyarat(kode);
      const bersyarat = (i: number) => rentang.some(([a, b]) => i > a && i < b);

      const pelanggaran: string[] = [];
      for (const kolom of KOLOM_UANG) {
        if (PENGECUALIAN.has(`${nama}:${kolom}`)) continue;
        const pola = new RegExp(`\\b${kolom}\\s*:\\s*true`, "g");
        let m: RegExpExecArray | null;
        while ((m = pola.exec(kode))) {
          if (!bersyarat(m.index)) {
            const baris = kode.slice(0, m.index).split("\n").length;
            pelanggaran.push(`${kolom} di baris ${baris}`);
          }
        }
      }

      assert.deepEqual(
        pelanggaran,
        [],
        `Kolom uang di-SELECT tanpa penjaga izin di ${dir}/${nama}: ${pelanggaran.join(", ")}. ` +
          "Bungkus dengan ...(bolehHarga ? { … } : {}) — lihat kolom-terbatas.ts.",
      );
    });
  }

  it("penjaganya benar-benar bekerja pada kode contoh", () => {
    // Membuktikan tes di atas tidak lolos hanya karena polanya tidak pernah cocok.
    const buruk = "select: { id: true, hargaJual: true }";
    const rentang = rentangBersyarat(buruk);
    assert.equal(rentang.length, 0);
    assert.match(buruk, /\bhargaJual\s*:\s*true/);

    const baik = "select: { id: true, ...(bolehHarga ? { hargaJual: true } : {}) }";
    const r2 = rentangBersyarat(baik);
    const i = baik.indexOf("hargaJual");
    assert.equal(r2.some(([a, b]) => i > a && i < b), true);
  });

  it("setiap kolom uang yang dipindai memang terdaftar sebagai terbatas", () => {
    const semua = new Set(Object.keys(KOLOM_TERBATAS).flatMap(kolomTerbatas));
    for (const k of KOLOM_UANG) {
      assert.equal(semua.has(k), true, `${k} dipindai tapi tidak terdaftar di KOLOM_TERBATAS`);
    }
  });
});

// ---------------------------------------------------------------------------
// Implikasi hak akses
//
// Sebagian jalur pengambilan data dijaga di tingkat halaman, bukan kolom:
// seluruh halaman menolak peran yang tidak berhak sebelum query dijalankan.
// Itu aman hanya selama pemegang izin penjaga juga berhak atas "hargaRabRap".
//
// Tes ini mengubah kebetulan itu menjadi invarian yang diperiksa.
// ---------------------------------------------------------------------------

describe("implikasi hak akses", () => {
  for (const section of WAJIB_IKUT_HARGA) {
    it(`setiap peran pemegang "${section}" juga berhak atas "hargaRabRap"`, () => {
      const pemegang = ACL_AWAL[section] ?? [];
      const berhakHarga = new Set(ACL_AWAL.hargaRabRap ?? []);
      const bolong = pemegang.filter((p) => !berhakHarga.has(p));

      assert.deepEqual(
        bolong,
        [],
        `Peran ini memegang "${section}" tanpa "hargaRabRap": ${bolong.join(", ")}. ` +
          "Jalur data yang dijaga izin itu meng-SELECT kolom RAP tanpa syarat, " +
          "jadi angkanya akan sampai ke peran yang tidak berhak. " +
          "Perbaiki matriks, atau bungkus kolomnya dengan penjaga per kolom.",
      );
    });
  }

  it("daftar berkas yang dijaga di halaman menyebut sub-bagian yang dikenal", () => {
    for (const [berkas, section] of Object.entries(DIJAGA_DI_HALAMAN)) {
      assert.equal(
        typeof ACL_AWAL[section],
        "object",
        `${berkas} menyebut sub-bagian "${section}" yang tidak ada di matriks`,
      );
    }
  });
});
