import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  periksaAjukanLaporanPetty,
  periksaBeriDanaPetty,
  periksaCatatPengeluaranPetty,
  periksaReimburseLaporanPetty,
  periksaTransisiLaporanPetty,
} from "./petty-cash";

describe("periksaBeriDanaPetty", () => {
  const m = { projectId: "p1", pemegangId: "u1", plafon: 5_000_000, nominal: 2_000_000, keterangan: null };

  it("pemberian dana yang wajar lolos", () => {
    assert.equal(periksaBeriDanaPetty(m, { pemegangSah: true }), null);
  });

  it("plafon nol DITERIMA — dana tanpa batas atas", () => {
    assert.equal(periksaBeriDanaPetty({ ...m, plafon: 0 }, { pemegangSah: true }), null);
  });

  it("nominal nol ditolak — tidak menghasilkan apa pun selain baris kosong", () => {
    assert.ok(periksaBeriDanaPetty({ ...m, nominal: 0 }, { pemegangSah: true }));
  });

  it("pemegang yang bukan Supervisor aktif ditolak", () => {
    const g = periksaBeriDanaPetty(m, { pemegangSah: false });
    assert.ok(g && /Supervisor/.test(g), g ?? "(lolos)");
  });

  it("tanpa proyek ditolak", () => {
    assert.ok(periksaBeriDanaPetty({ ...m, projectId: "" }, { pemegangSah: true }));
  });
});

describe("periksaCatatPengeluaranPetty", () => {
  const m = {
    fundId: "d1",
    peruntukan: "Unit (rumah dijual)",
    jenis: "Material",
    uraian: "Paku 5 kg",
    total: 150_000,
  };
  const konteks = { danaAktif: true, pelakuPemegang: true };

  it("pencatatan oleh pemegang dana aktif lolos", () => {
    assert.equal(periksaCatatPengeluaranPetty(m, konteks), null);
  });

  it("dana yang sudah ditutup ditolak", () => {
    const g = periksaCatatPengeluaranPetty(m, { ...konteks, danaAktif: false });
    assert.ok(g && /sudah ditutup/.test(g), g ?? "(lolos)");
  });

  it("bukan pemegang dana ditolak — selisih kas harus bisa ditanyakan ke seseorang", () => {
    const g = periksaCatatPengeluaranPetty(m, { ...konteks, pelakuPemegang: false });
    assert.ok(g && /pemegang dana/.test(g), g ?? "(lolos)");
  });

  it("total nol ditolak", () => {
    assert.ok(periksaCatatPengeluaranPetty({ ...m, total: 0 }, konteks));
  });

  it('jenis "Kontraktor" ditolak juga di petty cash', () => {
    assert.ok(periksaCatatPengeluaranPetty({ ...m, jenis: "Kontraktor" }, konteks));
  });
});

describe("periksaAjukanLaporanPetty", () => {
  const konteks = {
    status: "Draft" as const,
    pelakuPemegang: true,
    jumlahPengeluaran: 3,
    adaNota: true,
  };

  it("laporan Draft berisi dan bernota lolos", () => {
    assert.equal(periksaAjukanLaporanPetty({ reportId: "r1" }, konteks), null);
  });

  it("bukan pemegang dana ditolak", () => {
    assert.ok(periksaAjukanLaporanPetty({ reportId: "r1" }, { ...konteks, pelakuPemegang: false }));
  });

  it("laporan yang sudah diajukan tidak bisa diajukan lagi", () => {
    const g = periksaAjukanLaporanPetty({ reportId: "r1" }, { ...konteks, status: "Diajukan" });
    assert.ok(g && /bukan Draft/.test(g), g ?? "(lolos)");
  });

  it("laporan kosong ditolak", () => {
    const g = periksaAjukanLaporanPetty({ reportId: "r1" }, { ...konteks, jumlahPengeluaran: 0 });
    assert.ok(g && /masih kosong/.test(g), g ?? "(lolos)");
  });

  it("tanpa nota gabungan ditolak — tanpa bukti fisik yang tersisa hanya pengakuan", () => {
    const g = periksaAjukanLaporanPetty({ reportId: "r1" }, { ...konteks, adaNota: false });
    assert.ok(g && /Nota gabungan/.test(g), g ?? "(lolos)");
  });
});

describe("periksaTransisiLaporanPetty", () => {
  it("verifikasi QS atas laporan yang diajukan lolos", () => {
    assert.equal(
      periksaTransisiLaporanPetty(
        { reportId: "r1", ke: "DiverifikasiQS" },
        { status: "Diajukan", tahapVerifikasi: true },
      ),
      null,
    );
  });

  it("transisi yang melompat tahap ditolak", () => {
    const g = periksaTransisiLaporanPetty(
      { reportId: "r1", ke: "Direimburse" },
      { status: "Draft", tahapVerifikasi: true },
    );
    assert.ok(g && /tidak sah/.test(g), g ?? "(lolos)");
  });

  it("transisi di luar wewenang verifikasi ditolak", () => {
    const g = periksaTransisiLaporanPetty(
      { reportId: "r1", ke: "Direimburse" },
      { status: "Disetujui", tahapVerifikasi: false },
    );
    assert.ok(g && /wewenang/.test(g), g ?? "(lolos)");
  });

  it("tanpa id laporan ditolak", () => {
    assert.ok(
      periksaTransisiLaporanPetty({ reportId: "", ke: "DiverifikasiQS" }, { status: "Diajukan", tahapVerifikasi: true }),
    );
  });
});

describe("periksaReimburseLaporanPetty", () => {
  it("laporan disetujui yang bernilai lolos", () => {
    assert.equal(
      periksaReimburseLaporanPetty({ reportId: "r1" }, { status: "Disetujui", total: 1_500_000 }),
      null,
    );
  });

  it("laporan yang belum disetujui ditolak", () => {
    const g = periksaReimburseLaporanPetty({ reportId: "r1" }, { status: "Diajukan", total: 1_500_000 });
    assert.ok(g && /belum disetujui/.test(g), g ?? "(lolos)");
  });

  it("laporan bernilai nol ditolak — tak ada yang perlu diganti", () => {
    const g = periksaReimburseLaporanPetty({ reportId: "r1" }, { status: "Disetujui", total: 0 });
    assert.ok(g && /Laporan kosong/.test(g), g ?? "(lolos)");
  });
});
