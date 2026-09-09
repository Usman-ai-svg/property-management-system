import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

/**
 * PENJAGA SIFAT SEMUA-ATAU-TIDAK PADA IMPOR (INV-15).
 *
 * Aturan pembacaannya sudah bertes: `tabel-aturan` memvalidasi seluruh baris
 * lebih dulu dan melaporkan semua kesalahannya sekaligus, jadi satu baris cacat
 * membatalkan seluruh berkas sebelum satu pun baris menyentuh database.
 *
 * Yang belum terjaga adalah paruh keduanya — penulisannya. Tiap impor mengganti
 * isi tabel: `deleteMany` lalu `createMany`. Kalau keduanya berjalan di luar
 * satu transaksi, kegagalan di antaranya meninggalkan tabel KOSONG, bukan tabel
 * lama. Kerusakan itu diam: tidak ada galat, tidak ada baris, dan orang baru
 * menyadarinya saat mencari pekerjaan yang seharusnya ada di sana.
 *
 * Tes ini membaca sumbernya — bukan menjalankan aksinya, yang menuntut sesi,
 * berkas, dan database — dan menuntut tiap penulisan impor berada di dalam
 * `prisma.$transaction([...])`. Di ERP kebutuhan ini hilang dengan sendirinya:
 * satu RPC adalah satu transaksi. Sampai saat itu, penjaganya di sini.
 */

/** Penulisan yang tidak boleh berdiri di luar transaksi. */
const PENULISAN = /prisma\.\w+\.(createMany|deleteMany|updateMany|create|update|delete)\(/g;

const BERKAS = {
  master: "src/app/(app)/master/tabel-actions.ts",
  estimasi: "src/app/(app)/estimasi/actions.ts",
  vendor: "src/app/(app)/vendor/boq-actions.ts",
};

/** Isi sebuah fungsi bernama, dicari dengan pencocokan kurung kurawal. */
function badanFungsi(kode: string, nama: string): string {
  const tanda = `function ${nama}(`;
  const mulai = kode.indexOf(tanda);
  assert.notEqual(mulai, -1, `fungsi ${nama} tidak ditemukan — namanya berubah?`);

  const buka = kode.indexOf("{", mulai);
  let dalam = 0;
  for (let i = buka; i < kode.length; i++) {
    if (kode[i] === "{") dalam++;
    else if (kode[i] === "}") {
      dalam--;
      if (dalam === 0) return kode.slice(buka, i + 1);
    }
  }
  assert.fail(`kurung fungsi ${nama} tidak tertutup`);
}

/** Rentang [awal, akhir) tiap blok `prisma.$transaction(` dalam sebuah teks. */
function rentangTransaksi(badan: string): [number, number][] {
  const hasil: [number, number][] = [];
  const tanda = "prisma.$transaction(";
  let dari = 0;
  for (;;) {
    const mulai = badan.indexOf(tanda, dari);
    if (mulai === -1) return hasil;
    const buka = mulai + tanda.length - 1;
    let dalam = 0;
    for (let i = buka; i < badan.length; i++) {
      if (badan[i] === "(") dalam++;
      else if (badan[i] === ")") {
        dalam--;
        if (dalam === 0) {
          hasil.push([mulai, i + 1]);
          dari = i + 1;
          break;
        }
      }
    }
    if (dari <= mulai) return hasil;
  }
}

/** Penulisan di luar seluruh blok transaksi sebuah fungsi. */
function penulisanTelanjang(badan: string): string[] {
  const rentang = rentangTransaksi(badan);
  const lepas: string[] = [];
  for (const m of badan.matchAll(PENULISAN)) {
    const posisi = m.index ?? 0;
    if (!rentang.some(([a, b]) => posisi > a && posisi < b)) lepas.push(m[0]);
  }
  return lepas;
}

const sumber = Object.fromEntries(
  Object.entries(BERKAS).map(([k, v]) => [k, readFileSync(v, "utf8")]),
) as Record<keyof typeof BERKAS, string>;

/** Fungsi yang menulis hasil impor, dan berkas asalnya. */
const PENULIS_IMPOR: [keyof typeof BERKAS, string][] = [
  ["estimasi", "imporBarisRab"],
  ["vendor", "imporBoqSpk"],
  // imporTabel di Master tidak menulis sendiri; ia meneruskan ke delapan
  // penyimpan di bawah ini, yang juga dipakai penyimpanan manual dari halaman.
  ["master", "simpanBoqUnit"],
  ["master", "simpanBoqKerjaTambah"],
  ["master", "simpanBoqSarpras"],
  ["master", "simpanBoqTipe"],
  ["master", "simpanRapUnit"],
  ["master", "simpanRapKerjaTambah"],
  ["master", "simpanRapSarpras"],
  ["master", "simpanRapTipe"],
];

describe("impor Excel bersifat semua-atau-tidak (INV-15)", () => {
  for (const [berkas, nama] of PENULIS_IMPOR) {
    it(`${nama} menulis hanya di dalam satu transaksi`, () => {
      const badan = badanFungsi(sumber[berkas], nama);
      assert.ok(
        badan.includes("prisma.$transaction("),
        `${nama} tidak memakai transaksi — deleteMany yang gagal di tengah ` +
          "meninggalkan tabel kosong, bukan tabel lama",
      );
      assert.deepEqual(
        penulisanTelanjang(badan),
        [],
        `${nama} menulis di luar transaksi: ${penulisanTelanjang(badan).join(", ")}`,
      );
    });
  }

  it("penggantian isi selalu hapus-lalu-buat dalam transaksi yang sama", () => {
    // Kalau deleteMany dan createMany terpisah di dua transaksi, hasil akhirnya
    // sama saja dengan tanpa transaksi.
    for (const [berkas, nama] of PENULIS_IMPOR) {
      const badan = badanFungsi(sumber[berkas], nama);
      if (!badan.includes("deleteMany(")) continue;
      const blok = rentangTransaksi(badan).map(([a, b]) => badan.slice(a, b));
      const sepasang = blok.some((t) => t.includes("deleteMany(") && t.includes("create"));
      assert.ok(sepasang, `${nama} memisahkan hapus dan buat ke transaksi berbeda`);
    }
  });

  it("imporTabel tidak menulis sendiri, melainkan meneruskan", () => {
    const badan = badanFungsi(sumber.master, "imporTabel");
    assert.deepEqual(
      penulisanTelanjang(badan),
      [],
      "imporTabel menulis langsung; penulisannya harus lewat simpanBoq*/simpanRap* " +
        "supaya sifat transaksionalnya cuma perlu dijaga di satu tempat",
    );
    assert.ok(badan.includes("simpanBoqUnit(") && badan.includes("simpanRapUnit("));
  });

  it("impor-excel.ts tetap cuma mesin, tanpa aturan bisnis", () => {
    // G1: yang boleh ikut pindah ke ERP adalah aturan bacanya, bukan mesinnya.
    // Di sana pustakanya SheetJS di browser; yang ditulis ulang hanya pengubah
    // berkas jadi kisi. Jadi berkas ini tidak boleh mengenal satu pun aturan:
    // sinonim nama kolom, angka gaya Indonesia, baris Total — semuanya milik
    // `adaptor/tabel-aturan.ts` yang murni dan bertes.
    const kode = readFileSync("src/lib/impor-excel.ts", "utf8");
    const impor = [...kode.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    assert.deepEqual(
      [...new Set(impor)].sort(),
      ["@/lib/adaptor/tabel-aturan", "exceljs"],
      "adaptor Excel hanya boleh mengenal pustakanya dan lapisan aturannya",
    );
    for (const kata of ["KOLOM_BOQ", "KOLOM_RAP", "angkaIndonesia", "toLowerCase", "total"]) {
      assert.equal(
        kode.includes(kata),
        false,
        `"${kata}" adalah penafsiran isi tabel; tempatnya di tabel-aturan.ts`,
      );
    }
  });

  it("penjaganya benar-benar menangkap penulisan telanjang", () => {
    const buruk = "{ await prisma.a.deleteMany({}); await prisma.$transaction([prisma.b.createMany({})]); }";
    assert.deepEqual(penulisanTelanjang(buruk), ["prisma.a.deleteMany("]);
    const baik = "{ await prisma.$transaction([prisma.a.deleteMany({}), prisma.b.createMany({})]); }";
    assert.deepEqual(penulisanTelanjang(baik), []);
  });
});
