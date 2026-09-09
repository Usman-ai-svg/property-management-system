import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { kewenangan, penyediaDari } from "./penyedia";
import type { Pengguna } from "@/lib/adaptor/identitas";
import type { Section } from "@/lib/domain/enums";

/**
 * PENJAGA JAHITAN IDENTITAS.
 *
 * Repo ini punya tabel pengguna, hash sandi, dan JWT sendiri; ERP tidak memakai
 * satu pun. Yang membuat penggantian itu murah adalah selama mekanismenya tidak
 * bocor keluar dari `src/lib/auth/`. Satu `import { cookies }` di sebuah
 * halaman sudah cukup membuat penggantian jadi pekerjaan menyisir seluruh repo.
 *
 * Tes ini menjaganya, dan sengaja membaca berkas sumber — bukan menjalankan
 * kode — supaya pelanggaran ketahuan sebagai kegagalan tes, bukan sebagai
 * kejutan saat migrasi.
 */

/** Modul yang hanya boleh diimpor dari dalam `src/lib/auth/`. */
const KHUSUS_AUTH = [
  { pola: /^@\/lib\/auth\/session$/, alasan: "sesi/JWT" },
  { pola: /^next\/headers$/, alasan: "cookie Next.js" },
];

/**
 * `jose` dipakai dua hal yang berbeda: menandatangani token sesi (auth) dan
 * menandatangani permintaan service-account Google Drive (storage). Yang kedua
 * tidak ada hubungannya dengan identitas pengguna dan memang tetap ada di ERP,
 * jadi ia dikecualikan secara eksplisit — bukan dilewatkan diam-diam.
 */
const DIKECUALIKAN = ["src/lib/storage/gdrive.ts"];

function berkasSumber(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasSumber(jalur));
    else if (/\.(ts|tsx)$/.test(nama) && !nama.endsWith(".test.ts")) hasil.push(jalur);
  }
  return hasil;
}

function moduleDiimpor(kode: string): string[] {
  const hasil: string[] = [];
  const pola = /^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(kode))) hasil.push(m[1]);
  const dinamis = /import\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dinamis.exec(kode))) hasil.push(m[1]);
  return hasil;
}

describe("jahitan identitas tertutup", () => {
  const luar = [...berkasSumber("src/app"), ...berkasSumber("src/components"), ...berkasSumber("src/lib")]
    .map((f) => f.split("\\").join("/"))
    .filter((f) => !f.startsWith("src/lib/auth/"))
    .filter((f) => !DIKECUALIKAN.includes(f));

  it("tak ada berkas di luar src/lib/auth yang menyentuh sesi", () => {
    const pelanggaran: string[] = [];
    for (const berkas of luar) {
      const impor = moduleDiimpor(readFileSync(berkas, "utf8"));
      for (const m of impor) {
        const larangan = KHUSUS_AUTH.find((l) => l.pola.test(m));
        if (larangan) pelanggaran.push(`${berkas} → ${m} (${larangan.alasan})`);
      }
    }
    assert.deepEqual(
      pelanggaran,
      [],
      "Mekanisme sesi harus tinggal di src/lib/auth/ supaya bisa diganti sekali " +
        `saat modul diserap ERP:\n${pelanggaran.join("\n")}`,
    );
  });

  it("memeriksa jumlah berkas yang masuk akal", () => {
    assert.ok(luar.length >= 100, `hanya ${luar.length} berkas ditelusuri`);
  });
});

// ---------------------------------------------------------------------------
// Perilaku penyedia
// ---------------------------------------------------------------------------

const pengguna = (izin: [Section, boolean][]): Pengguna => ({
  id: "u1",
  nama: "Budi",
  peranAktif: "Project Manager",
  peran: ["Project Manager", "Supervisor"],
  semuaProyek: false,
  proyekIds: ["p1"],
  izin: new Map(izin),
});

describe("kewenangan", () => {
  it("sub-bagian ber-bolehUbah true berarti boleh ubah", () => {
    assert.equal(kewenangan(pengguna([["keuangan", true]]), "keuangan"), "ubah");
  });

  it("sub-bagian ber-bolehUbah false berarti lihat saja", () => {
    assert.equal(kewenangan(pengguna([["keuangan", false]]), "keuangan"), "lihat");
  });

  it("sub-bagian yang TIDAK ADA di peta berarti tidak boleh sama sekali", () => {
    // Bukan "lihat". Inilah yang membuat sub-bagian baru tertutup secara
    // bawaan: menambah section di enums.ts tidak diam-diam membukanya.
    assert.equal(kewenangan(pengguna([["keuangan", true]]), "pettyCash"), "tidak");
  });

  it("tanpa pengguna, apa pun tertutup", () => {
    assert.equal(kewenangan(null, "keuangan"), "tidak");
  });
});

describe("penyediaDari", () => {
  const p = penyediaDari(async () => pengguna([["keuangan", true], ["aset", false]]));

  it("siapa() hanya membawa id dan nama", () => {
    return p.siapa().then((i) => {
      assert.deepEqual(i, { id: "u1", nama: "Budi" });
    });
  });

  it("peran() memisahkan yang aktif dari yang dimiliki", () => {
    return p.peran().then((r) => {
      assert.equal(r?.aktif, "Project Manager");
      assert.deepEqual(r?.dimiliki, ["Project Manager", "Supervisor"]);
    });
  });

  it("boleh() menjawab tiga tingkat", async () => {
    assert.equal(await p.boleh("keuangan"), "ubah");
    assert.equal(await p.boleh("aset"), "lihat");
    assert.equal(await p.boleh("businessPlan"), "tidak");
  });

  it("tanpa sesi, ketiganya menjawab kosong — bukan melempar", async () => {
    const kosong = penyediaDari(async () => null);
    assert.equal(await kosong.siapa(), null);
    assert.equal(await kosong.peran(), null);
    assert.equal(await kosong.boleh("keuangan"), "tidak");
  });
});
