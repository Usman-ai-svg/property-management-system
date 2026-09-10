import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ROLES, ROLE_GROUP, SECTIONS } from "./domain/enums";
import { JABATAN, JABATAN_LUAR, KUNCI_JABATAN, jabatanDariHris } from "./domain/jabatan";

/**
 * PENJAGA HAK AKSES.
 *
 * Sumbu izin modul ini adalah JABATAN — bukan `profiles.role` milik ERP, dan
 * bukan lagi "peran" milik repo. Berkas ini menjaga tiga hal yang, kalau
 * hanyut, tidak menimbulkan galat apa pun; yang terjadi cuma seseorang
 * kehilangan akses atau mendapat akses yang tidak seharusnya, dan itu baru
 * ketahuan saat ada yang mengeluh.
 *
 *   1. SATU SUMBER. Dulu ada dua daftar yang tidak sama: `ROLES` di `enums.ts`
 *      berisi 21 nama, daftar yang dipakai seed berisi 22. Tipe `Role`
 *      berbohong, dan runtime selamat hanya karena seed membaca daftar yang
 *      lain.
 *   2. JABATAN LUAR TIDAK PERNAH BOLEH MENGUBAH. Matriks akan disunting
 *      berkali-kali; satu tambahan yang tidak sengaja tidak akan terlihat.
 *   3. SQL MASIH SEJALAN dengan sumbernya — ketahuan di sini, bukan di
 *      Supabase setengah jalan.
 */

const HAK_AKSES = JSON.parse(readFileSync("prisma/acuan/hak-akses.json", "utf8")) as {
  catatan: string[];
  akses: { jabatan: string; section: string; bolehLihat: boolean; bolehUbah: boolean }[];
};
const SQL = readFileSync("prisma/acl.sql", "utf8");
const require_ = createRequire(import.meta.url);

const punya = (jabatan: string, section: string) =>
  HAK_AKSES.akses.find((a) => a.jabatan === jabatan && a.section === section);

describe("satu sumber kebenaran jabatan", () => {
  it("ROLES dan ROLE_GROUP diturunkan dari JABATAN, bukan ditulis ulang", () => {
    assert.deepEqual([...ROLES], KUNCI_JABATAN);
    assert.deepEqual(Object.keys(ROLE_GROUP).sort(), [...KUNCI_JABATAN].sort());
  });

  it("kunci dan teks HRIS-nya sama-sama unik", () => {
    const kunci = JABATAN.map((j) => j.kunci);
    const hris = JABATAN.map((j) => j.jabatanHris.toLowerCase());
    assert.equal(new Set(kunci).size, kunci.length, "ada kunci jabatan kembar");
    assert.equal(new Set(hris).size, hris.length, "ada jabatanHris kembar");
  });

  it("tiap peran repo lama menempel pada TEPAT SATU jabatan", () => {
    // `peranAsal` adalah jejak konversi matriks. Peran yang menempel di dua
    // jabatan berarti haknya dihitung dua kali; yang tidak menempel di mana pun
    // berarti haknya hilang tanpa jejak.
    const semua = JABATAN.flatMap((j) => j.peranAsal);
    assert.equal(new Set(semua).size, semua.length, "ada peran yang menempel di dua jabatan");
    assert.equal(semua.length, 21, `harusnya 21 peran repo lama, ada ${semua.length}`);
    assert.equal(
      semua.includes("Administrator Sistem"),
      false,
      "Administrator Sistem sudah dihapus; padanannya jabatan director",
    );
  });

  it("teks HRIS dicocokkan tanpa peduli huruf besar-kecil dan spasi berlebih", () => {
    // Dua bentuk salah ketik yang paling sering, dan paling tidak layak
    // menyebabkan seseorang kehilangan seluruh aksesnya.
    assert.equal(jabatanDariHris("Quantity Surveyor Asst"), "quantity_surveyor_asst");
    assert.equal(jabatanDariHris("  head of   operation "), "head_of_operation");
    assert.equal(jabatanDariHris("tukang sulap"), null);
    assert.equal(jabatanDariHris(""), null);
    assert.equal(jabatanDariHris(null), null);
  });
});

describe('"Administrator Sistem" benar-benar hilang dari kode', () => {
  const berkasSumber = (dir: string): string[] => {
    const hasil: string[] = [];
    for (const nama of readdirSync(dir)) {
      const jalur = join(dir, nama);
      if (statSync(jalur).isDirectory()) {
        if (nama === "generated") continue;
        hasil.push(...berkasSumber(jalur));
      } else if (/\.(ts|tsx|prisma|json)$/.test(nama)) hasil.push(jalur);
    }
    return hasil;
  };

  it("tidak muncul sebagai literal di src maupun prisma", () => {
    // Kriteria selesai P1. Peran itu tidak punya padanan di ERP: yang memegang
    // modul Pengaturan dan jejak audit di sana adalah `director`.
    const pelanggar = [...berkasSumber("src"), ...berkasSumber("prisma")]
      .map((f) => f.split("\\").join("/"))
      .filter((f) => !f.endsWith("hak-akses.test.ts"))
      .filter((f) => readFileSync(f, "utf8").includes('"Administrator Sistem"'));
    assert.deepEqual(pelanggar, []);
  });
});

describe("jabatan luar tidak boleh mengubah apa pun", () => {
  it("delapan jabatan bercakupan luar, dan semuanya baca-saja", () => {
    assert.equal(JABATAN_LUAR.length, 8, `ada ${JABATAN_LUAR.length} jabatan luar`);
    const bocor = HAK_AKSES.akses.filter((a) => a.bolehUbah && JABATAN_LUAR.includes(a.jabatan));
    assert.deepEqual(
      bocor.map((b) => `${b.jabatan}/${b.section}`),
      [],
      "jabatan bercakupan luar mendapat hak ubah",
    );
  });

  it("yang boleh dilihatnya persis enam sub-bagian konteks", () => {
    // Bukan angka sembarangan: enam ini yang mereka butuhkan untuk bekerja di
    // luar modul, dan enam sisanya — harga, margin, keuangan, petty cash,
    // progres, persetujuan RAB — memang bukan urusan mereka.
    const diharapkan = [
      "aset", "daftarSarpras", "daftarUnit", "deskripsi", "dokumenTeknis", "penyesuaianAset",
    ];
    for (const j of JABATAN_LUAR) {
      const terlihat = HAK_AKSES.akses
        .filter((a) => a.jabatan === j && a.bolehLihat)
        .map((a) => a.section)
        .sort();
      assert.deepEqual(terlihat, diharapkan, `${j} melihat sub-bagian yang tidak seharusnya`);
    }
  });
});

describe("keputusan yang tidak boleh hanyut", () => {
  it("head of operation memegang seluruh dua belas sub-bagian", () => {
    // Gabungan Head Operation Office + Head Operation Project + Business
    // Development. Disengaja dan sudah disetujui; praktis superuser kedua.
    const ubah = HAK_AKSES.akses.filter((a) => a.jabatan === "head_of_operation" && a.bolehUbah);
    assert.equal(ubah.length, SECTIONS.length);
  });

  it("director juga, karena dialah administrator sistemnya", () => {
    const ubah = HAK_AKSES.akses.filter((a) => a.jabatan === "director" && a.bolehUbah);
    assert.equal(ubah.length, SECTIONS.length);
  });

  it("QS asst TETAP tidak boleh menyetujui RAB", () => {
    // Pemisahan penyusun–penyetuju: ia yang menyusun RAB, dan tidak boleh
    // menyetujui buatannya sendiri. Selamat dari konversi ke jabatan, dan
    // harus tetap selamat.
    const baris = punya("quantity_surveyor_asst", "setujuiRab");
    assert.ok(baris, "QS asst seharusnya masih boleh MELIHAT setujuiRab");
    assert.equal(baris?.bolehUbah, false);
  });

  it("QS asst mewarisi hak ubah aset dari sisi Procurement", () => {
    assert.equal(punya("quantity_surveyor_asst", "aset")?.bolehUbah, true);
  });

  it("komisaris melihat banyak, mengubah tak satu pun", () => {
    const baris = HAK_AKSES.akses.filter((a) => a.jabatan === "komisaris");
    assert.ok(baris.length >= 9, `komisaris cuma melihat ${baris.length} sub-bagian`);
    assert.deepEqual(baris.filter((b) => b.bolehUbah), []);
  });

  it("tidak ada baris boleh-ubah tanpa boleh-lihat", () => {
    const nakal = HAK_AKSES.akses.filter((a) => a.bolehUbah && !a.bolehLihat);
    assert.deepEqual(nakal, []);
  });

  it("seluruh jabatan dan sub-bagiannya dikenal", () => {
    const kunci = new Set(KUNCI_JABATAN);
    const section = new Set<string>(SECTIONS);
    for (const a of HAK_AKSES.akses) {
      assert.ok(kunci.has(a.jabatan), `jabatan "${a.jabatan}" tidak dikenal`);
      assert.ok(section.has(a.section), `sub-bagian "${a.section}" tidak dikenal`);
    }
  });
});

describe("acl.sql", () => {
  let hasil: { error?: { message: string; cursorpos: number } };

  before(async () => {
    const buatParser = require_("pg-query-emscripten").default;
    const pg = await buatParser();
    hasil = pg.parse(SQL);
  });

  it("terurai penuh oleh grammar PostgreSQL asli", () => {
    if (hasil.error) {
      const konteks = SQL.slice(Math.max(0, hasil.error.cursorpos - 200), hasil.error.cursorpos + 60);
      assert.fail(`${hasil.error.message}\n\nkonteks:\n${konteks}`);
    }
  });

  it("jumlah barisnya sama dengan isi JSON", () => {
    const jumlah = SQL.split("('rsp-").length - 1;
    assert.equal(jumlah, HAK_AKSES.akses.length, "acl.sql tidak sinkron — jalankan npm run acl:sql");
  });

  it("dikunci ke kunci jabatan, bukan teks HRIS", () => {
    for (const j of JABATAN) {
      assert.ok(SQL.includes(`'${j.kunci}'`), `${j.kunci} hilang dari acl.sql`);
    }
    // Teks HRIS yang bercampur kapital tidak boleh bocor jadi kunci matriks.
    assert.equal(SQL.includes("'Finance & Tax'"), false);
    assert.equal(SQL.includes("'HRD staff'"), false);
  });

  it("membawa catatan yang tidak boleh hilang saat dibaca orang lain", () => {
    // Tanpa kalimat ini, orang berikutnya akan membaca bolehUbah pettyCash
    // sebagai "boleh semua tahap" — dan itu justru gerbang yang paling penting.
    assert.match(SQL, /bolehUbah pada pettyCash/i);
    assert.match(SQL, /tabel transisi/i);
  });

  it("bisa dijalankan ulang tanpa menggandakan", () => {
    assert.match(SQL, /\non conflict \("id"\) do nothing;/);
    assert.match(SQL, /begin;/);
    assert.match(SQL, /commit;/);
  });
});
