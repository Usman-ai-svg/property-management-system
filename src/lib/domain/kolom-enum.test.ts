import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { SEMUA_ENUM } from "./enums";
import { ENUM_TANPA_KOLOM, KOLOM_ENUM } from "./kolom-enum";

/**
 * PENJAGA KOMENTAR ENUM.
 *
 * Komentar `///` di schema.prisma adalah satu-satunya tempat pembaca skema tahu
 * nilai apa yang sah untuk sebuah kolom String. Dua di antaranya pernah basi
 * diam-diam — `Expense.jenis` kehilangan "Kontraktor", `Expense.metode`
 * kehilangan "Hutang" — dan tidak ada yang menyadarinya sampai ada yang
 * berniat membangun CHECK constraint dari komentar itu.
 *
 * Tes ini menutup celahnya dari dua arah: komentar wajib mengulang daftar
 * `enums.ts` persis, dan kolom enum baru wajib didaftarkan di `KOLOM_ENUM`.
 */

type Kolom = { tipe: string; komentar: string; baris: number };

/** Baca schema.prisma jadi peta `Model.kolom` → tipe + komentar `///` di atasnya. */
function bacaKolom(): Map<string, Kolom> {
  const isi = readFileSync("prisma/schema.prisma", "utf8").replace(/\r\n/g, "\n");
  const hasil = new Map<string, Kolom>();
  let model = "";
  let komentar: string[] = [];

  isi.split("\n").forEach((baris, i) => {
    const awalModel = baris.match(/^model (\w+)/);
    if (awalModel) {
      model = awalModel[1];
      komentar = [];
      return;
    }
    const barisKomentar = baris.match(/^\s*\/\/\/\s?(.*)$/);
    if (barisKomentar) {
      komentar.push(barisKomentar[1].trim());
      return;
    }
    const kolom = baris.match(/^\s+(\w+)\s+(\w+)/);
    if (kolom && model) {
      hasil.set(`${model}.${kolom[1]}`, {
        tipe: kolom[2],
        // Komentar berbaris ganda disambung dengan spasi: daftar nilai yang
        // panjang memang harus dipenggal agar barisnya tidak melar.
        komentar: komentar.join(" ").replace(/\s+/g, " ").trim(),
        baris: i + 1,
      });
    }
    komentar = [];
  });

  return hasil;
}

/** Bentuk kanonik daftar nilai di komentar: dipisah " | ", urut seperti enums.ts. */
function daftarKanonik(nilai: readonly string[]): string {
  return nilai.join(" | ");
}

const KOLOM = bacaKolom();

describe("registri kolom enum", () => {
  it("setiap kolom terdaftar benar-benar ada di schema.prisma dan bertipe String", () => {
    for (const nama of Object.keys(KOLOM_ENUM)) {
      const kolom = KOLOM.get(nama);
      assert.ok(kolom, `${nama} terdaftar di KOLOM_ENUM tapi tidak ada di schema.prisma`);
      assert.equal(kolom.tipe, "String", `${nama} bertipe ${kolom.tipe}, seharusnya String`);
    }
  });

  it("komentar /// tiap kolom enum diawali daftar nilai lengkap dari enums.ts", () => {
    const salah: string[] = [];
    for (const [nama, nilai] of Object.entries(KOLOM_ENUM)) {
      const kolom = KOLOM.get(nama);
      if (!kolom) continue; // sudah dilaporkan tes di atas
      const kanonik = daftarKanonik(nilai);
      if (!kolom.komentar.startsWith(kanonik)) {
        salah.push(
          `  ${nama} (schema.prisma:${kolom.baris})\n` +
            `    seharusnya diawali : ${kanonik}\n` +
            `    komentar sekarang  : ${kolom.komentar || "(tidak ada komentar ///)"}`,
        );
      }
    }
    assert.deepEqual(
      salah,
      [],
      `komentar enum tidak cocok dengan enums.ts — enums.ts yang benar, komentarnya yang diperbaiki:\n${salah.join("\n")}`,
    );
  });

  it("tidak ada kolom berdaftar enum yang lupa didaftarkan", () => {
    // Sebuah komentar dianggap "berdaftar enum" bila potongan awalnya, dipisah
    // " | ", seluruhnya anggota satu enum yang sama. Prosa biasa tidak akan
    // lolos syarat ini, jadi kolom teks bebas tidak ikut terjaring.
    const belum: string[] = [];
    for (const [nama, kolom] of KOLOM) {
      if (nama in KOLOM_ENUM || !kolom.komentar.includes(" | ")) continue;
      const potongan = kolom.komentar.split(/\s+—\s+|\.\s|:\s/)[0];
      const bagian = potongan.split(" | ").map((s) => s.trim());
      if (bagian.length < 2) continue;
      const adaEnumnya = Object.values(SEMUA_ENUM).some((v) =>
        bagian.every((b) => (v as readonly string[]).includes(b)),
      );
      if (adaEnumnya) belum.push(`${nama} (schema.prisma:${kolom.baris}) — ${potongan}`);
    }
    assert.deepEqual(
      belum,
      [],
      `kolom berikut memuat nilai enum tapi belum ada di KOLOM_ENUM:\n${belum.join("\n")}`,
    );
  });
});

describe("cakupan enum", () => {
  const dipakai = new Set<string>();
  for (const nilai of Object.values(KOLOM_ENUM)) {
    for (const [nama, enumnya] of Object.entries(SEMUA_ENUM)) {
      // Himpunan bagian (mis. METODE_TUNAI) tetap dihitung memakai enum induknya.
      if ((nilai as readonly string[]).every((v) => (enumnya as readonly string[]).includes(v))) {
        dipakai.add(nama);
      }
    }
  }

  it("setiap enum menempel pada kolom, atau tercatat alasannya", () => {
    for (const nama of Object.keys(SEMUA_ENUM)) {
      if (dipakai.has(nama)) continue;
      assert.ok(
        ENUM_TANPA_KOLOM[nama],
        `${nama} tidak dipakai kolom mana pun dan tidak dijelaskan di ENUM_TANPA_KOLOM`,
      );
    }
  });

  it("ENUM_TANPA_KOLOM tidak memuat enum yang ternyata dipakai kolom", () => {
    for (const nama of Object.keys(ENUM_TANPA_KOLOM)) {
      assert.ok(SEMUA_ENUM[nama as keyof typeof SEMUA_ENUM], `${nama} bukan enum di SEMUA_ENUM`);
      assert.equal(
        dipakai.has(nama),
        false,
        `${nama} sebenarnya dipakai kolom — hapus dari ENUM_TANPA_KOLOM`,
      );
    }
  });
});
