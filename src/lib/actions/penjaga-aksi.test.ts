import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * PENJAGA SERVER ACTION.
 *
 * Setiap berkas `"use server"` mengekspor SELURUH fungsinya sebagai endpoint
 * yang bisa dipanggil langsung dari browser. Tombol yang tidak digambar di UI
 * sama sekali tidak menahannya.
 *
 * Karena itu pemeriksaan izin di dalam aksi adalah satu-satunya yang
 * benar-benar menahan — dan aksi yang lupa memanggilnya tidak menimbulkan
 * gejala apa pun sampai ada yang mencobanya.
 *
 * Tes ini menelusuri tiap aksi yang diekspor dan memastikan ia sampai ke
 * `izinkan()`, langsung maupun lewat fungsi pembantu di berkas yang sama atau
 * lewat aksi lain yang sudah terjaga.
 *
 * Ditemukan saat tes ini pertama ditulis: `nilaiTerpasangSpk` di
 * vendor/boq-actions.ts adalah endpoint terbuka tanpa penjaga dan tanpa satu
 * pun pemanggil. Sudah dihapus.
 */

const AKAR = "src/app";

/**
 * Berkas yang memang tidak boleh punya pemeriksaan izin.
 *
 * `login/actions.ts` ADALAH endpoint autentikasinya — menuntut izin di sana
 * berarti seseorang harus sudah masuk untuk bisa masuk.
 */
const BUKAN_AKSI_TERJAGA = new Set(["src/app/login/actions.ts"]);

/** Seluruh berkas yang diawali "use server". */
function berkasAksi(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasAksi(jalur));
    else if (nama.endsWith(".ts") && readFileSync(jalur, "utf8").trimStart().startsWith('"use server"')) {
      hasil.push(jalur);
    }
  }
  return hasil;
}

interface Fungsi {
  nama: string;
  badan: string;
  diekspor: boolean;
}

/** Pecah sebuah berkas jadi daftar fungsi tingkat atas beserta badannya. */
function fungsiDalam(kode: string): Fungsi[] {
  const pola = /^(export\s+)?(?:async\s+)?function\s+(\w+)/gm;
  const titik: { i: number; nama: string; diekspor: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pola.exec(kode))) {
    titik.push({ i: m.index, nama: m[2], diekspor: !!m[1] });
  }
  return titik.map((t, k) => ({
    nama: t.nama,
    diekspor: t.diekspor,
    badan: kode.slice(t.i, k + 1 < titik.length ? titik[k + 1].i : kode.length),
  }));
}

/**
 * Apakah sebuah fungsi sampai ke `izinkan()`.
 *
 * Ditelusuri sampai kedalaman tertentu lewat fungsi lain di berkas yang sama
 * dan lewat aksi yang diimpor dari berkas aksi lain — beberapa aksi memang
 * mendelegasikan penjagaannya, misalnya `imporTabel` yang memanggil
 * `simpanBoqUnit`.
 */
function terjaga(
  fn: Fungsi,
  semua: Map<string, Fungsi>,
  lintas: Map<string, Fungsi>,
  dilalui = new Set<string>(),
): boolean {
  if (dilalui.has(fn.nama)) return false;
  dilalui.add(fn.nama);

  // `bolehUbah`/`bolehLihat` ikut dihitung: sebagian penjaga memeriksanya
  // sendiri lalu melempar, misalnya `izinkanKelolaAkses` di admin/actions.ts.
  if (/\b(izinkan|wajibUbah|wajibLihat|bolehUbah|bolehLihat)\s*\(/.test(fn.badan)) return true;

  for (const [nama, lain] of [...semua, ...lintas]) {
    if (nama === fn.nama) continue;
    if (new RegExp(`\\b${nama}\\s*\\(`).test(fn.badan) && terjaga(lain, semua, lintas, dilalui)) {
      return true;
    }
  }
  return false;
}

describe("penjaga Server Action", () => {
  const berkas = berkasAksi(AKAR).filter((f) => !BUKAN_AKSI_TERJAGA.has(f));

  it("menemukan berkas aksi yang masuk akal", () => {
    // Kalau penelusuran rusak, seluruh tes di bawah lolos tanpa memeriksa apa pun.
    assert.ok(berkas.length >= 10, `hanya ${berkas.length} berkas "use server" ditemukan`);
  });

  // Kumpulan seluruh fungsi lintas berkas, untuk menelusuri delegasi.
  const lintas = new Map<string, Fungsi>();
  for (const f of berkas) {
    for (const fn of fungsiDalam(readFileSync(f, "utf8"))) lintas.set(fn.nama, fn);
  }

  for (const f of berkas) {
    const kode = readFileSync(f, "utf8");
    const fungsi = fungsiDalam(kode);
    const peta = new Map(fungsi.map((x) => [x.nama, x]));

    for (const fn of fungsi.filter((x) => x.diekspor)) {
      it(`${f.replace("src/app/", "")} · ${fn.nama} berada di balik pemeriksaan izin`, () => {
        assert.equal(
          terjaga(fn, peta, lintas),
          true,
          `${fn.nama} tidak pernah sampai ke izinkan(). Berkas "use server" ` +
            "mengekspor setiap fungsinya sebagai endpoint yang bisa dipanggil " +
            "langsung dari browser — penyaringan di UI tidak menahannya.",
        );
      });
    }
  }

  it("penjaganya benar-benar menolak aksi tanpa izin", () => {
    // Membuktikan tes di atas tidak lolos hanya karena penelusurannya longgar.
    const buruk = fungsiDalam(
      'export async function bocor(id: string) {\n  return prisma.unit.findMany();\n}\n',
    );
    assert.equal(terjaga(buruk[0], new Map(), new Map()), false);

    const baik = fungsiDalam(
      'export async function aman(id: string) {\n  await izinkan("progress");\n}\n',
    );
    assert.equal(terjaga(baik[0], new Map(), new Map()), true);
  });

  it("mengenali penjagaan lewat fungsi pembantu di berkas yang sama", () => {
    const kode =
      'async function cek(id: string) {\n  return izinkan("businessPlan", id);\n}\n' +
      'export async function simpan(id: string) {\n  await cek(id);\n}\n';
    const fungsi = fungsiDalam(kode);
    const peta = new Map(fungsi.map((x) => [x.nama, x]));
    const simpan = fungsi.find((x) => x.nama === "simpan")!;
    assert.equal(terjaga(simpan, peta, new Map()), true);
  });
});
