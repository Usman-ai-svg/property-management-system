import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  periksaAjukanRab,
  periksaBarisRab,
  periksaHapusHargaDasar,
  periksaHapusPemasok,
  periksaHargaDasar,
  periksaPemasok,
  periksaRabDapatDiubah,
  periksaSetujuiRab,
  periksaSimpanAnalisa,
  periksaSimpanTabelRab,
  periksaTambahPenawaran,
  periksaTambahRabEstimasi,
  periksaTolakRab,
  periksaUbahRabEstimasi,
} from "./estimasi";

describe("periksaRabDapatDiubah", () => {
  it("Draft dan Ditolak boleh disunting", () => {
    assert.equal(periksaRabDapatDiubah("Draft", "RAB-1"), null);
    assert.equal(periksaRabDapatDiubah("Ditolak", "RAB-1"), null);
  });

  it("Diajukan tidak boleh — isinya sedang jadi dasar keputusan orang lain", () => {
    const g = periksaRabDapatDiubah("Diajukan", "RAB-1");
    assert.ok(g && /RAB-1/.test(g), g ?? "(lolos)");
  });

  it("Final tidak boleh — sudah jadi dasar SPK", () => {
    assert.ok(periksaRabDapatDiubah("Final", "RAB-1"));
  });
});

describe("periksaPemasok", () => {
  const m = {
    nama: "Toko Bangunan Sejahtera",
    kategori: "Material",
    status: "Aktif",
    kontakNama: null, kontakTelepon: null, alamat: null, kecamatan: null, provinsi: null,
  };

  it("pemasok lengkap lolos", () => {
    assert.equal(periksaPemasok(m), null);
  });

  it("kontak boleh kosong — tidak semua supplier punya PIC tetap", () => {
    assert.equal(periksaPemasok({ ...m, kontakNama: "", kontakTelepon: "" }), null);
  });

  it("nama kosong ditolak", () => {
    assert.ok(periksaPemasok({ ...m, nama: "  " }));
  });

  it("kategori karangan ditolak", () => {
    assert.ok(periksaPemasok({ ...m, kategori: "Serba-serbi" }));
  });
});

describe("periksaHapusPemasok", () => {
  it("pemasok tanpa penawaran boleh dihapus", () => {
    assert.equal(periksaHapusPemasok({ id: "s1" }, { jumlahPenawaran: 0, nama: "Toko A" }), null);
  });

  it("pemasok yang pernah menawar ditolak — riwayat harganya masih dipakai", () => {
    const g = periksaHapusPemasok({ id: "s1" }, { jumlahPenawaran: 4, nama: "Toko A" });
    assert.ok(g && /4 penawaran/.test(g), g ?? "(lolos)");
  });
});

describe("periksaHargaDasar", () => {
  const m = { kode: "MT-001", kategori: "BAHAN", uraian: "Semen 50kg", satuan: "sak", hargaAcuan: 62_000 };

  it("harga dasar lengkap lolos", () => {
    assert.equal(periksaHargaDasar(m, { kodeBentrok: false }), null);
  });

  it("harga acuan NOL diterima — item yang harganya belum diketahui", () => {
    assert.equal(periksaHargaDasar({ ...m, hargaAcuan: 0 }, { kodeBentrok: false }), null);
  });

  it("harga negatif ditolak", () => {
    assert.ok(periksaHargaDasar({ ...m, hargaAcuan: -1 }, { kodeBentrok: false }));
  });

  it("kode yang sudah dipakai ditolak", () => {
    const g = periksaHargaDasar(m, { kodeBentrok: true });
    assert.ok(g && /sudah dipakai/.test(g), g ?? "(lolos)");
  });

  it("kategori di luar UPAH/BAHAN/ALAT ditolak", () => {
    assert.ok(periksaHargaDasar({ ...m, kategori: "LAIN" }, { kodeBentrok: false }));
  });
});

describe("periksaHapusHargaDasar", () => {
  it("harga dasar yang tak dipakai boleh dihapus", () => {
    assert.equal(periksaHapusHargaDasar({ id: "h1" }, { jumlahPemakaian: 0, kode: "MT-001" }), null);
  });

  it("harga dasar yang dipakai analisa ditolak", () => {
    const g = periksaHapusHargaDasar({ id: "h1" }, { jumlahPemakaian: 3, kode: "MT-001" });
    assert.ok(g && /3 komponen analisa/.test(g), g ?? "(lolos)");
  });
});

describe("periksaTambahPenawaran", () => {
  const m = { hargaDasarId: "h1", pemasokId: "s1", harga: 61_500, keterangan: null };

  it("penawaran lengkap lolos", () => {
    assert.equal(periksaTambahPenawaran(m), null);
  });

  it("harga NOL diterima — barang bonus atau contoh", () => {
    assert.equal(periksaTambahPenawaran({ ...m, harga: 0 }), null);
  });

  it("harga negatif ditolak", () => {
    assert.ok(periksaTambahPenawaran({ ...m, harga: -100 }));
  });

  it("tanpa pemasok ditolak", () => {
    assert.ok(periksaTambahPenawaran({ ...m, pemasokId: "" }));
  });
});

describe("periksaSimpanAnalisa", () => {
  const m = {
    id: null,
    kode: "AHS-01",
    uraian: "Pasangan bata merah",
    satuan: "m2",
    kelompok: "Arsitektur",
    overheadPct: 13,
    komponen: [{ hargaDasarId: "h1", koefisien: 0.0252 }],
  };

  it("analisa lengkap lolos", () => {
    assert.equal(periksaSimpanAnalisa(m, { kodeBentrok: false }), null);
  });

  it("koefisien pecahan halus diterima apa adanya", () => {
    assert.equal(
      periksaSimpanAnalisa({ ...m, komponen: [{ hargaDasarId: "h1", koefisien: 0.00252 }] }, { kodeBentrok: false }),
      null,
    );
  });

  it("analisa tanpa komponen ditolak", () => {
    assert.ok(periksaSimpanAnalisa({ ...m, komponen: [] }, { kodeBentrok: false }));
  });

  it("koefisien nol ditolak — komponennya tidak dipakai sama sekali", () => {
    const g = periksaSimpanAnalisa(
      { ...m, komponen: [{ hargaDasarId: "h1", koefisien: 0 }] },
      { kodeBentrok: false },
    );
    assert.ok(g && /koefisien/.test(g), g ?? "(lolos)");
  });

  it("koefisien negatif ditolak", () => {
    assert.ok(
      periksaSimpanAnalisa({ ...m, komponen: [{ hargaDasarId: "h1", koefisien: -1 }] }, { kodeBentrok: false }),
    );
  });

  it("overhead nol diterima — tidak semua analisa membebankan overhead", () => {
    assert.equal(periksaSimpanAnalisa({ ...m, overheadPct: 0 }, { kodeBentrok: false }), null);
  });

  it("kode bentrok ditolak", () => {
    assert.ok(periksaSimpanAnalisa(m, { kodeBentrok: true }));
  });
});

describe("RAB Estimasi — alur status", () => {
  it("membuat RAB butuh proyek dan nama", () => {
    assert.equal(periksaTambahRabEstimasi({ projectId: "p1", nama: "RAB Tahap 1" }), null);
    assert.ok(periksaTambahRabEstimasi({ projectId: "p1", nama: " " }));
    assert.ok(periksaTambahRabEstimasi({ projectId: "", nama: "RAB" }));
  });

  it("menyunting RAB Final ditolak", () => {
    assert.ok(
      periksaUbahRabEstimasi({ id: "r1", nama: "Baru" }, { status: "Final", nomor: "RAB-1" }),
    );
  });

  it("RAB Draft berisi boleh diajukan", () => {
    assert.equal(
      periksaAjukanRab({ id: "r1" }, { status: "Draft", nomor: "RAB-1", jumlahBaris: 12 }),
      null,
    );
  });

  it("RAB kosong tidak bisa diajukan — tidak ada yang bisa disetujui", () => {
    const g = periksaAjukanRab({ id: "r1" }, { status: "Draft", nomor: "RAB-1", jumlahBaris: 0 });
    assert.ok(g && /belum punya baris/.test(g), g ?? "(lolos)");
  });

  it("RAB yang sudah Final tidak bisa diajukan ulang", () => {
    assert.ok(periksaAjukanRab({ id: "r1" }, { status: "Final", nomor: "RAB-1", jumlahBaris: 5 }));
  });

  it("hanya yang Diajukan bisa disetujui atau ditolak", () => {
    assert.equal(periksaSetujuiRab({ id: "r1" }, { status: "Diajukan", nomor: "RAB-1" }), null);
    assert.ok(periksaSetujuiRab({ id: "r1" }, { status: "Draft", nomor: "RAB-1" }));
    assert.equal(
      periksaTolakRab({ id: "r1", catatan: "Harga terlalu tinggi" }, { status: "Diajukan", nomor: "RAB-1" }),
      null,
    );
    assert.ok(periksaTolakRab({ id: "r1", catatan: "x" }, { status: "Final", nomor: "RAB-1" }));
  });
});

describe("periksaBarisRab", () => {
  const konteks = { status: "Draft", nomor: "RAB-1" };
  const m = {
    rabEstimasiId: "r1",
    grup: "Struktur",
    uraian: "Pembesian",
    satuan: "kg",
    volume: 1200,
    analisaId: null as string | null,
    hargaSatuan: 18_500 as number | null,
  };

  it("baris berharga ketik lolos", () => {
    assert.equal(periksaBarisRab(m, konteks), null);
  });

  it("baris berbasis analisa lolos tanpa harga ketik", () => {
    assert.equal(periksaBarisRab({ ...m, analisaId: "a1", hargaSatuan: null }, konteks), null);
  });

  it("baris tanpa analisa DAN tanpa harga ditolak — tidak punya nilai", () => {
    const g = periksaBarisRab({ ...m, analisaId: null, hargaSatuan: null }, konteks);
    assert.ok(g && /analisa atau mengisi harga/.test(g), g ?? "(lolos)");
  });

  it("volume nol diterima — baris yang volumenya diisi belakangan", () => {
    assert.equal(periksaBarisRab({ ...m, volume: 0 }, konteks), null);
  });

  it("volume negatif ditolak", () => {
    assert.ok(periksaBarisRab({ ...m, volume: -1 }, konteks));
  });

  it("menambah baris ke RAB Final ditolak", () => {
    assert.ok(periksaBarisRab(m, { status: "Final", nomor: "RAB-1" }));
  });
});

describe("periksaSimpanTabelRab", () => {
  const konteks = { status: "Draft", nomor: "RAB-1" };
  const grup = [{ nama: "Struktur", items: [{ uraian: "Pembesian", volume: 10, hargaSatuan: 100 }] }];

  it("tabel berisi lolos", () => {
    assert.equal(periksaSimpanTabelRab(grup, konteks), null);
  });

  it("tabel kosong ditolak — menyimpannya menghapus seluruh isi RAB", () => {
    const g = periksaSimpanTabelRab([], konteks);
    assert.ok(g && /tidak boleh kosong/.test(g), g ?? "(lolos)");
  });

  it("kelompok tanpa nama ditolak", () => {
    assert.ok(periksaSimpanTabelRab([{ nama: " ", items: [] }], konteks));
  });

  it("baris tanpa uraian ditolak, dan pesannya menyebut kelompoknya", () => {
    const g = periksaSimpanTabelRab(
      [{ nama: "Struktur", items: [{ uraian: "", volume: 1, hargaSatuan: 1 }] }],
      konteks,
    );
    assert.ok(g && /kelompok "Struktur"/.test(g), g ?? "(lolos)");
  });

  it("menyimpan tabel ke RAB Diajukan ditolak", () => {
    assert.ok(periksaSimpanTabelRab(grup, { status: "Diajukan", nomor: "RAB-1" }));
  });
});
