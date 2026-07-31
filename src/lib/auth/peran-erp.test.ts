import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { SECTIONS } from "@/lib/domain/enums";
import { periksaPengguna } from "@/lib/adaptor/identitas";
import {
  bolehBukaModulProyek, izinDariPeranErp, modeRbac, penggunaDariErp,
  PETA_PERAN_ERP, TERTUTUP_UNTUK_PELAKSANA,
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
