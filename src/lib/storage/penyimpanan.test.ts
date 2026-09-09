import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  alamatLuar, bacaBerkas, batasKategori, catatTautan, diTautanLuar, hapusBerkas,
  kelasKategori, penyediaKunci, periksaBerkasKategori, BATAS_RINGAN, GagalUnggah,
  MAKS_UKURAN,
} from "./index";

/**
 * PENJAGA JAHITAN BERKAS.
 *
 * Sistem berkas adalah satu dari dua hal di repo ini yang TIDAK ADA di ERP —
 * yang satunya identitas. Di sana tidak ada disk yang bertahan antar permintaan:
 * berkas ada di Drive atau di object storage, dan diambil lewat HTTP.
 *
 * Yang membuat penggantian itu murah adalah `node:fs` tidak pernah bocor keluar
 * dari `src/lib/storage/`. Satu `readFile` di sebuah halaman sudah cukup membuat
 * penggantian jadi pekerjaan menyisir seluruh repo — dan halaman itu akan diam
 * saja sampai ada orang mengklik dokumen di produksi.
 */

const FS_TERLARANG = [/^node:fs/, /^fs$/, /^fs\/promises$/];

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
  const dinamis = /(?:import|require)\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dinamis.exec(kode))) hasil.push(m[1]);
  return hasil;
}

describe("jahitan berkas tertutup", () => {
  const luar = [...berkasSumber("src/app"), ...berkasSumber("src/components"), ...berkasSumber("src/lib")]
    .map((f) => f.split("\\").join("/"))
    .filter((f) => !f.startsWith("src/lib/storage/"));

  it("tak ada berkas di luar src/lib/storage yang menyentuh sistem berkas", () => {
    const pelanggaran: string[] = [];
    for (const berkas of luar) {
      for (const m of moduleDiimpor(readFileSync(berkas, "utf8"))) {
        if (FS_TERLARANG.some((p) => p.test(m))) pelanggaran.push(`${berkas} → ${m}`);
      }
    }
    assert.deepEqual(
      pelanggaran,
      [],
      "Akses sistem berkas harus tinggal di src/lib/storage/ supaya penyedianya " +
        `bisa diganti sekali saat modul diserap ERP:\n${pelanggaran.join("\n")}`,
    );
  });

  it("memeriksa jumlah berkas yang masuk akal", () => {
    assert.ok(luar.length >= 100, `hanya ${luar.length} berkas ditelusuri`);
  });
});

// ---------------------------------------------------------------------------
// Penyedia tautan luar
// ---------------------------------------------------------------------------

const TAUTAN = "https://drive.google.com/file/d/1abcDEF/view";

describe("penyedia tautan luar", () => {
  it("mencatat alamat Drive sebagai kunci berawalan", () => {
    const h = catatTautan(TAUTAN);
    assert.ok(diTautanLuar(h.objectKey));
    assert.equal(alamatLuar(h.objectKey), TAUTAN);
  });

  it("tidak mengaku punya ukuran maupun sidik jari", () => {
    // Kolom sha256 kosong BUKAN kelalaian: isinya memang tidak pernah lewat
    // sini, jadi sistem ini tidak bisa membuktikan berkas di ujung tautan masih
    // sama dengan yang dicatat dulu. Lihat docs/berkas.md.
    const h = catatTautan(TAUTAN);
    assert.equal(h.sha256, "");
    assert.equal(h.ukuranByte, 0);
  });

  it("menolak host di luar Workspace", () => {
    assert.throws(
      () => catatTautan("https://drive.google.com.penipu.example/x"),
      GagalUnggah,
    );
  });

  it("menolak http polos dan alamat yang bukan URL", () => {
    assert.throws(() => catatTautan("http://drive.google.com/file/d/1/view"), GagalUnggah);
    assert.throws(() => catatTautan("lihat di drive ya"), GagalUnggah);
  });

  it("bacaBerkas menolak kunci tautan alih-alih mengembalikan berkas kosong", async () => {
    const { objectKey } = catatTautan(TAUTAN);
    await assert.rejects(() => bacaBerkas(objectKey), GagalUnggah);
  });

  it("hapusBerkas tidak menyentuh berkas milik Drive", async () => {
    // Menghapus baris di aplikasi tidak boleh diam-diam menghapus berkas yang
    // mungkin dipakai orang lain di Drive.
    const { objectKey } = catatTautan(TAUTAN);
    await hapusBerkas(objectKey);
  });

  it("kunci disk biasa tetap dilayani penyedia isi", () => {
    const p = penyediaKunci("2026/abc.pdf");
    assert.equal(p.bentuk, "isi");
    assert.equal(p.nama, "lokal");
    assert.equal(alamatLuar("2026/abc.pdf"), null);
  });
});

// ---------------------------------------------------------------------------
// Berat dan ringan
// ---------------------------------------------------------------------------

describe("kelas berkas", () => {
  it("model 3D dan DWG berat; sisanya ringan", () => {
    assert.equal(kelasKategori("model3d"), "berat");
    assert.equal(kelasKategori("gambarKerjaDwg"), "berat");
    assert.equal(kelasKategori("gambarKerjaPdf"), "ringan");
    assert.equal(kelasKategori("bukti"), "ringan");
    assert.equal(kelasKategori("kategori-yang-belum-ada"), "ringan");
  });

  it("batasnya beda: yang berat pakai batas umum", () => {
    assert.equal(batasKategori("model3d"), MAKS_UKURAN);
    assert.equal(batasKategori("bukti"), BATAS_RINGAN);
    assert.ok(BATAS_RINGAN < MAKS_UKURAN);
  });

  it(".skp 30 MB lolos sebagai berat, tapi nota 30 MB ditolak", () => {
    const tigaPuluhMb = 30 * 1024 * 1024;
    periksaBerkasKategori("rumah.skp", "model3d", tigaPuluhMb);
    assert.throws(() => periksaBerkasKategori("nota.pdf", "bukti", tigaPuluhMb), GagalUnggah);
  });

  it("yang berat pun punya batas", () => {
    assert.throws(
      () => periksaBerkasKategori("raksasa.skp", "model3d", MAKS_UKURAN + 1),
      GagalUnggah,
    );
  });

  it("ekstensi tetap diperiksa, dan tanpa ukuran pemeriksaannya dilewati", () => {
    assert.throws(() => periksaBerkasKategori("gambar.dwg", "gambarKerjaPdf"), GagalUnggah);
    // Pemanggil lama yang belum mengirim ukuran tidak ikut berubah perilakunya.
    periksaBerkasKategori("nota.pdf", "bukti");
  });
});
