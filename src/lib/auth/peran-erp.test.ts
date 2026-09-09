import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ROLES, SECTIONS } from "@/lib/domain/enums";
import { periksaPengguna } from "@/lib/adaptor/identitas";
import {
  bolehBukaModulProyek, izinDariPeranErp, modeRbac, penggunaDariErp,
  PERAN_ERP, PERAN_KELOLA_AKSES, PETA_PERAN_ERP, peranDariPosisiErp, PETA_POSISI_ERP,
  POSISI_ADMIN_SISTEM, posisiBolehBukaModulProyek,
  TANPA_AKSES_PROYEK, TERTUTUP_UNTUK_PELAKSANA,
} from "./peran-erp";

describe("modeRbac", () => {
  it("bawaannya internal — selama berdiri sendiri, model sendiri yang benar", () => {
    assert.equal(modeRbac({}), "internal");
    assert.equal(modeRbac({ RBAC_MODE: "" }), "internal");
  });

  it("beralih ke ERP hanya dengan nilai yang persis", () => {
    assert.equal(modeRbac({ RBAC_MODE: "erp" }), "erp");
    assert.equal(modeRbac({ RBAC_MODE: "ERP" }), "internal");
    assert.equal(modeRbac({ RBAC_MODE: "yes" }), "internal");
  });
});

describe("izinDariPeranErp", () => {
  it("director memegang seluruh sub-bagian dengan hak ubah", () => {
    const izin = izinDariPeranErp("director");
    for (const s of SECTIONS) {
      assert.equal(izin.get(s), true, `director seharusnya boleh ubah "${s}"`);
    }
  });

  it("peran yang tidak dikenal tidak mendapat apa-apa", () => {
    // Daftar putih: peran baru di ERP tidak otomatis membuka modul proyek.
    assert.equal(izinDariPeranErp("sales").size, 0);
    assert.equal(izinDariPeranErp("viewer").size, 0);
    assert.equal(izinDariPeranErp("hrd").size, 0);
    assert.equal(izinDariPeranErp("peran-baru-entah").size, 0);
  });

  it("membedakan lihat dari ubah", () => {
    const manager = izinDariPeranErp("manager");
    assert.equal(manager.get("progress"), true, "manager boleh ubah progres");
    assert.equal(manager.get("hargaRabRap"), false, "manager hanya boleh lihat harga");
  });

  it("sub-bagian yang tidak disebut berarti tidak boleh dilihat sama sekali", () => {
    const staff = izinDariPeranErp("staff");
    assert.equal(staff.has("hargaRabRap"), false);
    assert.equal(staff.has("businessPlan"), false);
    assert.equal(staff.has("keuangan"), false);
  });
});

describe("batas yang tidak boleh dilonggarkan", () => {
  for (const { peran, section } of TERTUTUP_UNTUK_PELAKSANA) {
    for (const s of section) {
      it(`peran ERP "${peran}" tidak berhak atas "${s}"`, () => {
        const izin = izinDariPeranErp(peran);
        assert.equal(
          izin.has(s),
          false,
          `Membuka "${s}" untuk "${peran}" berarti angka yang tertutup di sistem ini ` +
            "menjadi terbuka begitu modul dipindah ke ERP.",
        );
      });
    }
  }

  it("hanya director yang memegang businessPlan", () => {
    const pemegang = Object.keys(PETA_PERAN_ERP).filter((p) =>
      izinDariPeranErp(p).has("businessPlan"),
    );
    assert.deepEqual(pemegang, ["director"]);
  });

  it("setiap peran yang boleh ubah keuangan juga boleh lihat harga", () => {
    // Jalur data Keuangan mengambil kolom RAP tanpa syarat; lihat
    // WAJIB_IKUT_HARGA di kolom-terbatas.ts.
    for (const p of Object.keys(PETA_PERAN_ERP)) {
      const izin = izinDariPeranErp(p);
      if (izin.has("keuangan")) {
        assert.equal(izin.has("hargaRabRap"), true, `"${p}" memegang keuangan tanpa hargaRabRap`);
      }
    }
  });

  it("setiap peran yang memegang businessPlan juga berhak atas harga", () => {
    for (const p of Object.keys(PETA_PERAN_ERP)) {
      const izin = izinDariPeranErp(p);
      if (izin.has("businessPlan")) {
        assert.equal(izin.has("hargaRabRap"), true, `"${p}" memegang businessPlan tanpa hargaRabRap`);
      }
    }
  });

  it("peta hanya menyebut sub-bagian yang benar-benar ada", () => {
    const sah = new Set<string>(SECTIONS);
    for (const [peran, peta] of Object.entries(PETA_PERAN_ERP)) {
      for (const s of Object.keys(peta)) {
        assert.equal(sah.has(s), true, `"${peran}" menyebut sub-bagian "${s}" yang tidak ada`);
      }
    }
  });
});

describe("bolehBukaModulProyek", () => {
  it("mengizinkan lima peran ERP yang memang berhak", () => {
    for (const p of ["director", "accountant", "manager", "admin", "staff"]) {
      assert.equal(bolehBukaModulProyek(p), true, p);
    }
  });

  it("menolak peran ERP di luar itu", () => {
    for (const p of ["sales", "viewer", "hrd"]) {
      assert.equal(bolehBukaModulProyek(p), false, p);
    }
  });
});

describe("penggunaDariErp", () => {
  const mentah = { id: "u1", nama: "Budi", peran: [], peranErp: "manager" };

  it("menghasilkan objek yang memenuhi kontrak Pengguna", () => {
    assert.equal(periksaPengguna(penggunaDariErp(mentah)), null);
  });

  it("peranAktif berisi peran ERP-nya", () => {
    const u = penggunaDariErp(mentah);
    assert.equal(u.peranAktif, "manager");
    assert.deepEqual(u.peran, ["manager"]);
  });

  it("membuka seluruh proyek — ERP belum punya pembatasan per proyek", () => {
    // Pelonggaran yang disengaja dan tercatat. Memalsukannya jadi daftar
    // kosong akan membuat setiap halaman tampak kosong tanpa penjelasan.
    const u = penggunaDariErp(mentah);
    assert.equal(u.semuaProyek, true);
    assert.deepEqual(u.proyekIds, []);
  });

  it("peran ERP tanpa akses modul menghasilkan izin kosong", () => {
    const u = penggunaDariErp({ ...mentah, peranErp: "sales" });
    assert.equal(u.izin.size, 0);
  });
});

// ===========================================================================
// Pemetaan posisi ERP → peran modul proyek
// ===========================================================================

describe("peranDariPosisiErp", () => {
  it("Director memegang BOD — satu-satunya yang boleh Business Plan", () => {
    assert.deepEqual(peranDariPosisiErp("Director"), ["BOD", "Administrator Sistem"]);
  });

  it("Head of Operation merangkap dua peran, keputusan Usman 2026-09-09", () => {
    const peran = peranDariPosisiErp("Head of Operation");
    assert.deepEqual(peran, ["Head Operation Office", "Head Operation Project"]);
  });

  it("tahap Setujui petty cash ada pemegangnya", () => {
    // TRANSISI_PETTY menuntut nama peran persis "Head Operation Project".
    // Tanpa satu pun posisi yang memetakannya, laporan petty cash mentok di
    // DiverifikasiQS dan tidak pernah bisa direimburse.
    const adaHop = Object.values(PETA_POSISI_ERP).some((p) => p.includes("Head Operation Project"));
    assert.ok(adaHop, "tidak ada posisi ERP yang memegang Head Operation Project");
  });

  it("keempat tahap alur petty cash punya pemegang di daftar ERP", () => {
    const semua = Object.values(PETA_POSISI_ERP).flat();
    for (const peran of ["Supervisor", "Quantity Surveyor", "Head Operation Project", "Finance"]) {
      assert.ok(semua.includes(peran), `tahap petty cash tanpa pemegang: ${peran}`);
    }
  });

  it("pemegang dana petty cash adalah Manager Proyek dan Logistic Staff", () => {
    // Keduanya merangkap Supervisor — syarat keras di beriDanaPetty.
    assert.ok(peranDariPosisiErp("Manager Proyek").includes("Supervisor"));
    assert.ok(peranDariPosisiErp("Logistic Staff").includes("Supervisor"));
  });

  it("Security tidak berhak membuka modul proyek", () => {
    assert.equal(posisiBolehBukaModulProyek("Security"), false);
    assert.ok(TANPA_AKSES_PROYEK.includes("Security"));
  });

  it("posisi yang belum dipetakan tidak otomatis dapat akses", () => {
    // Daftar putih: posisi baru di ERP harus diputuskan, bukan diwarisi.
    assert.deepEqual(peranDariPosisiErp("Posisi Yang Belum Ada"), []);
    assert.equal(posisiBolehBukaModulProyek("Posisi Yang Belum Ada"), false);
  });

  it("tiap peran yang dipetakan memang ada di ROLES", () => {
    const semua = [...new Set(Object.values(PETA_POSISI_ERP).flat())];
    for (const peran of semua) {
      assert.ok(
        (ROLES as readonly string[]).includes(peran),
        `"${peran}" dipetakan tapi bukan peran yang dikenal di domain/enums.ts`,
      );
    }
  });

  it("posisi yang tanpa akses tidak boleh sekaligus ada di peta", () => {
    for (const posisi of TANPA_AKSES_PROYEK) {
      assert.equal(posisi in PETA_POSISI_ERP, false, `${posisi} ada di dua tempat`);
    }
  });
});

describe("koreksi pemetaan 2026-09-09", () => {
  it("Logistic Staff murni Supervisor — pendaftaran alat bukan urusannya", () => {
    assert.deepEqual(peranDariPosisiErp("Logistic Staff"), ["Supervisor"]);
  });

  it("Procurement tetap ada pemegangnya, pindah ke QS Asst", () => {
    const semua = Object.values(PETA_POSISI_ERP).flat();
    assert.ok(semua.includes("Procurement"), "tak ada yang memegang Procurement");
    assert.ok(peranDariPosisiErp("Quantity Surveyor Asst").includes("Procurement"));
  });

  it("tahap Reimburse punya DUA pemegang — tidak berhenti bila satu berhalangan", () => {
    const pemegangFinance = Object.entries(PETA_POSISI_ERP)
      .filter(([, peran]) => peran.includes("Finance"))
      .map(([posisi]) => posisi);
    assert.deepEqual(pemegangFinance.sort(), ["Finance & Tax", "Staff Administration"]);
  });

  it("Support Function ditutup, dan tidak sekaligus ada di peta", () => {
    assert.equal(posisiBolehBukaModulProyek("Support Function"), false);
    assert.ok(TANPA_AKSES_PROYEK.includes("Support Function"));
  });

  it("posisi media dipetakan ke tiga peran berbeda walau izinnya identik", () => {
    // Bedanya label, bukan kewenangan — tetapi labelnya ikut ke jejak audit,
    // jadi tetap perlu benar.
    assert.deepEqual(peranDariPosisiErp("Copy Writer"), ["Head Content & Media"]);
    assert.deepEqual(peranDariPosisiErp("Design Graphic Staff"), ["Editor"]);
    assert.deepEqual(peranDariPosisiErp("Graphic Designer"), ["Social Media"]);
  });
});

describe("padanan Administrator Sistem", () => {
  it("melekat pada Director — ERP tidak punya peran administrator tersendiri", () => {
    // Jawaban Usman 2026-09-09 setelah memeriksa ERP: profiles.role cuma
    // delapan nilai dan tidak satu pun bernama administrator sistem. Yang
    // memegang modul Pengaturan, jejak audit, dan is_hr_admin() adalah
    // director — jadi dialah administratornya, de facto.
    assert.deepEqual([...POSISI_ADMIN_SISTEM], ["Director"]);
    assert.ok(peranDariPosisiErp("Director").includes("Administrator Sistem"));
  });

  it("MENAMBAH, bukan menggantikan peran hariannya", () => {
    // Kalau menimpa, Director kehilangan BOD — nama yang tercantum di matriks
    // hak akses, di PERAN_KELOLA_AKSES, dan di seluruh dokumen — lalu masuk
    // setiap hari sebagai superuser petty cash.
    const hasil = peranDariPosisiErp("Director");
    assert.deepEqual(hasil, ["BOD", "Administrator Sistem"]);
  });

  it("peran hariannya yang aktif lebih dulu, bukan yang superuser", () => {
    // Gerbang petty cash memeriksa peranAktif === "Administrator Sistem", dan
    // peran pertama itulah yang aktif saat masuk. Jadi menembus alur petty cash
    // menuntut perpindahan sadar lewat "Lihat sebagai" — persis seperti Manager
    // Proyek yang harus berpindah ke Supervisor untuk memegang uang tunai.
    assert.equal(peranDariPosisiErp("Director")[0], "BOD");
  });

  it("tak ada posisi LAIN yang mendapat Administrator Sistem", () => {
    const lain = Object.entries(PETA_POSISI_ERP)
      .filter(([posisi]) => !POSISI_ADMIN_SISTEM.includes(posisi))
      .filter(([, peran]) => peran.includes("Administrator Sistem"))
      .map(([posisi]) => posisi);
    assert.deepEqual(lain, []);
  });

  it("posisi tak dikenal tetap kosong, sekalipun disebut sebagai admin", () => {
    // Daftar admin bukan pintu belakang untuk memberi akses: posisi yang tidak
    // ada di peta tetap tidak punya peran harian, cuma dapat Administrator
    // Sistem — dan itu harus datang dari keputusan sadar mengisi daftarnya.
    assert.deepEqual(peranDariPosisiErp("Posisi Yang Belum Ada"), []);
    assert.deepEqual(
      peranDariPosisiErp("IT Administrator", ["IT Administrator"]),
      ["Administrator Sistem"],
    );
  });

  it("pengelolaan pengguna & matriks tidak bergantung pada peran itu", () => {
    // Gerbangnya hak ubah `deskripsi`, bukan nama peran Administrator Sistem.
    // Director (lewat BOD) dan Head of Operation sudah memenuhinya, jadi
    // halaman Admin tetap bisa dipakai walau seseorang tidak pernah berpindah
    // ke peran administrator.
    const bisaKelola = (peran: string[]) =>
      peran.some((p) => (PERAN_KELOLA_AKSES as readonly string[]).includes(p));
    assert.ok(bisaKelola(["BOD"]), "BOD seharusnya bisa mengelola akses");
    assert.ok(bisaKelola(peranDariPosisiErp("Head of Operation")));
  });
});

describe("daftar profiles.role", () => {
  it("PETA_PERAN_ERP hanya menyebut peran yang benar-benar ada di ERP", () => {
    // Salah ketik di sini tidak menimbulkan galat: peran tak dikenal cuma
    // menghasilkan peta izin kosong, dan orangnya kehilangan seluruh akses
    // tanpa satu pun pesan.
    const sah = new Set<string>(PERAN_ERP);
    for (const p of Object.keys(PETA_PERAN_ERP)) {
      assert.ok(sah.has(p), `"${p}" bukan nilai profiles.role yang tercatat`);
    }
  });

  it("yang sengaja ditutup persis sales, viewer, dan hrd", () => {
    const tertutup = PERAN_ERP.filter((p) => !bolehBukaModulProyek(p));
    assert.deepEqual([...tertutup].sort(), ["hrd", "sales", "viewer"]);
  });

  it("hrd besar di ERP tapi tertutup di sini", () => {
    // is_hr_admin() memberinya gaji dan payroll di ERP. Itu di luar modul ini;
    // di sini ia sama tertutupnya dengan viewer.
    assert.equal(bolehBukaModulProyek("hrd"), false);
    assert.deepEqual([...izinDariPeranErp("hrd").keys()], []);
  });
});
