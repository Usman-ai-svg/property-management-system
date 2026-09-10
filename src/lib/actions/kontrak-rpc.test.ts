import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * PENJAGA `KONTRAK-RPC.md`.
 *
 * Dokumen itu adalah inventaris seluruh aksi tulis beserta usulan RPC-nya —
 * yang dibawa ke sesi migrasi dan dipakai orang yang menulis PL/pgSQL-nya.
 *
 * Ia sudah pernah basi sekali: ditulis saat ada 77 aksi, lalu repo tumbuh jadi
 * 135 tanpa dokumennya ikut berubah. 58 aksi tidak punya kontrak, dan tidak ada
 * satu pun yang gagal karena itu — dokumen memang tidak bisa gagal sendiri.
 *
 * Karena itu jumlahnya dihitung ulang di sini dari SUMBER, bukan dipercaya dari
 * angka yang tertulis. Menambah satu Server Action tanpa mendaftarkannya
 * membuat tes ini merah pada commit yang sama.
 */

const AKAR = "src/app";
const DOK = "KONTRAK-RPC.md";

function berkasAksi(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasAksi(jalur));
    else if (
      nama.endsWith(".ts") &&
      readFileSync(jalur, "utf8").trimStart().startsWith('"use server"')
    ) {
      hasil.push(jalur.split("\\").join("/"));
    }
  }
  return hasil;
}

/** Nama tiap fungsi yang DIEKSPOR dari sebuah berkas aksi. */
function aksiDiekspor(kode: string): string[] {
  const hasil: string[] = [];
  const pola = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(kode))) hasil.push(m[1]);
  return hasil;
}

// `login/actions.ts` ikut dihitung: dokumennya memang mendaftarkan `login` dan
// `logout` — bukan sebagai RPC, melainkan sebagai catatan bahwa keduanya
// digantikan Supabase Auth. Yang berbahaya bukan aksi yang tercatat tidak jadi
// RPC, melainkan aksi yang tidak tercatat sama sekali.
const berkas = berkasAksi(AKAR);
const aksi = berkas.flatMap((f) => aksiDiekspor(readFileSync(f, "utf8")));

const dok = readFileSync(DOK, "utf8");

/**
 * Nama aksi pada kolom pertama tabel inventaris, ditulis dalam backtick.
 *
 * Sengaja daftar, bukan himpunan: satu nama bisa muncul dua kali dengan arti
 * berbeda. `hapusPembayaran` ada di Keuangan (pembayaran PO) dan di Vendor
 * (pembayaran kontrak) — dua aksi berbeda dengan dua RPC berbeda. Menyamakan
 * keduanya lewat himpunan membuat salah satunya bisa hilang tanpa ketahuan.
 */
const aksiDidokumentasikan = dok
  .split("\n")
  // Hanya baris tabel inventaris yang dihitung — delapan kolom. Bagian
  // "Peleburan" di bawahnya juga punya tabel yang diawali nama aksi dalam
  // backtick (`hapusUnit` vs `hapusUnitPaksa`), dan ikut menghitungnya membuat
  // tiga aksi tampak terdaftar dua kali.
  .filter((b) => b.startsWith("| `") && (b.match(/\|/g) ?? []).length >= 8)
  .map((b) => b.match(/^\| `(\w+)`/)?.[1])
  .filter((n): n is string => Boolean(n));

describe("KONTRAK-RPC.md sejalan dengan kode", () => {
  it("menemukan berkas aksi dan aksi dalam jumlah yang masuk akal", () => {
    assert.ok(berkas.length >= 13, `hanya ${berkas.length} berkas aksi ditemukan`);
    assert.ok(aksi.length >= 100, `hanya ${aksi.length} aksi ditemukan`);
  });

  it("nama aksi yang kembar antar modul cuma yang sudah diketahui", () => {
    // Nama sama di dua modul bukan kesalahan, tapi ia membuat inventaris tidak
    // bisa lagi mengenali aksi dari namanya saja. Yang baru harus disadari saat
    // dibuat, bukan ditemukan belakangan oleh orang yang menulis RPC-nya.
    const jumlah = new Map<string, number>();
    for (const a of aksi) jumlah.set(a, (jumlah.get(a) ?? 0) + 1);
    const kembar = [...jumlah].filter(([, n]) => n > 1).map(([a]) => a);
    assert.deepEqual(
      kembar,
      ["hapusPembayaran"],
      "hapusPembayaran ada di Keuangan (pembayaran PO) dan Vendor (pembayaran kontrak)",
    );
  });

  it("daftar aksi di dokumen sama persis dengan yang ada di kode", () => {
    // Dua arah sekaligus. Aksi tanpa baris berarti tidak punya usulan RPC, dan
    // baru ketahuan saat orang yang menulis PL/pgSQL mencarinya. Baris tanpa
    // aksi berarti ada yang menulis RPC untuk sesuatu yang sudah dihapus.
    assert.deepEqual([...aksi].sort(), [...aksiDidokumentasikan].sort());
  });

  it("angka pada tabel Ringkasan dihitung, bukan diketik dari ingatan", () => {
    const angka = (label: string): number => {
      const m = dok.match(new RegExp(`\\| ${label} \\| \\*{0,2}(\\d+)`));
      assert.ok(m, `baris "${label}" tidak ada di tabel Ringkasan`);
      return Number(m![1]);
    };
    assert.equal(angka("Aksi tulis"), aksi.length);
    assert.equal(angka("Berkas ber-`\"use server\"`"), berkas.length);
  });
});
