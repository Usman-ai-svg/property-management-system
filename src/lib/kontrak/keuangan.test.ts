import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  periksaBagikanBiayaUnitRata,
  periksaBayarHutang,
  periksaBayarPembelian,
  periksaBuatPembelian,
  periksaCatatPengeluaran,
  periksaHapusPembayaranPembelian,
  periksaHapusPembelian,
  periksaHapusPengeluaran,
  periksaIsianHutang,
  periksaPembebanan,
  periksaTerimaPembelian,
  periksaUbahPengeluaran,
  type MasukanCatatPengeluaran,
} from "./keuangan";

/** Masukan yang lolos — tiap tes menyimpangkan satu hal saja darinya. */
const sah: MasukanCatatPengeluaran = {
  projectId: "p1",
  peruntukan: "Unit (rumah dijual)",
  jenis: "Material",
  metode: "Transfer",
  uraian: "Semen 50 sak",
  total: 2_000_000,
  pembebanan: [{ unitId: "u1", infrastructureId: null, nominal: 2_000_000 }],
  kreditur: null,
  tenggat: null,
};

describe("periksaPembebanan", () => {
  it("pembebanan yang jumlahnya pas dan sasarannya cocok: lolos", () => {
    assert.equal(periksaPembebanan(1000, "Unit (rumah dijual)", [
      { unitId: "u1", infrastructureId: null, nominal: 600 },
      { unitId: "u2", infrastructureId: null, nominal: 400 },
    ]), null);
  });

  it("tanpa pembebanan sama sekali: sah, itu biaya level proyek", () => {
    assert.equal(periksaPembebanan(1000, "Perijinan & Ormas", []), null);
  });

  it("jumlah tidak sama dengan total: ditolak", () => {
    const g = periksaPembebanan(1000, "Unit (rumah dijual)", [
      { unitId: "u1", infrastructureId: null, nominal: 999 },
    ]);
    assert.ok(g && /tidak sama/.test(g), g ?? "(lolos)");
  });

  it("selisih satu rupiah pun ditolak", () => {
    assert.ok(periksaPembebanan(1000, "Unit (rumah dijual)", [
      { unitId: "u1", infrastructureId: null, nominal: 1001 },
    ]));
  });

  it("tujuan yang sama dua kali: ditolak", () => {
    const g = periksaPembebanan(1000, "Unit (rumah dijual)", [
      { unitId: "u1", infrastructureId: null, nominal: 500 },
      { unitId: "u1", infrastructureId: null, nominal: 500 },
    ]);
    assert.ok(g && /lebih dari sekali/.test(g), g ?? "(lolos)");
  });

  it("dua baris level proyek juga dianggap tujuan ganda", () => {
    assert.ok(periksaPembebanan(1000, "Perijinan & Ormas", [
      { unitId: null, infrastructureId: null, nominal: 500 },
      { unitId: null, infrastructureId: null, nominal: 500 },
    ]));
  });

  it("peruntukan sarpras tidak boleh dibebankan ke unit", () => {
    const g = periksaPembebanan(1000, "Prasarana & Sarana", [
      { unitId: "u1", infrastructureId: null, nominal: 1000 },
    ]);
    assert.ok(g && /tidak bisa dibebankan ke unit/.test(g), g ?? "(lolos)");
  });

  it("peruntukan unit tidak boleh dibebankan ke sarpras", () => {
    const g = periksaPembebanan(1000, "Unit (rumah dijual)", [
      { unitId: null, infrastructureId: "s1", nominal: 1000 },
    ]);
    assert.ok(g && /sarana & prasarana/.test(g), g ?? "(lolos)");
  });

  it("peruntukan non-standar (data lama) dilewati, tidak ditolak", () => {
    assert.equal(periksaPembebanan(1000, "Peruntukan Antah Berantah", [
      { unitId: "u1", infrastructureId: null, nominal: 1000 },
    ]), null);
  });
});

describe("periksaIsianHutang", () => {
  it("metode kas tidak menuntut kreditur maupun tenggat", () => {
    assert.equal(periksaIsianHutang("Transfer", null, null), null);
  });

  it("metode Hutang tanpa kreditur: ditolak", () => {
    assert.ok(periksaIsianHutang("Hutang", null, "2026-10-01"));
  });

  it("metode Hutang tanpa tenggat: ditolak", () => {
    assert.ok(periksaIsianHutang("Hutang", "Toko Sejahtera", null));
  });

  it("metode Hutang dengan tenggat ngawur: ditolak", () => {
    const g = periksaIsianHutang("Hutang", "Toko Sejahtera", "kapan-kapan");
    assert.ok(g && /tidak sah/.test(g), g ?? "(lolos)");
  });

  it("metode Hutang lengkap: lolos", () => {
    assert.equal(periksaIsianHutang("Hutang", "Toko Sejahtera", "2026-10-01"), null);
  });
});

describe("periksaCatatPengeluaran", () => {
  it("masukan yang benar lolos", () => {
    assert.equal(periksaCatatPengeluaran(sah), null);
  });

  it("tanpa proyek: ditolak", () => {
    assert.ok(periksaCatatPengeluaran({ ...sah, projectId: "  " }));
  });

  it("total nol ditolak — pengeluaran tanpa nilai tidak punya arti", () => {
    assert.ok(periksaCatatPengeluaran({ ...sah, total: 0, pembebanan: [] }));
  });

  it("total negatif ditolak", () => {
    assert.ok(periksaCatatPengeluaran({ ...sah, total: -5, pembebanan: [] }));
  });

  it("keterangan kosong ditolak", () => {
    assert.ok(periksaCatatPengeluaran({ ...sah, uraian: "   " }));
  });

  it('jenis "Kontraktor" ditolak — hanya sah lahir dari SPK', () => {
    const g = periksaCatatPengeluaran({ ...sah, jenis: "Kontraktor" });
    assert.ok(g && /jenis biaya/.test(g), g ?? "(lolos)");
  });

  it("peruntukan karangan ditolak", () => {
    assert.ok(periksaCatatPengeluaran({ ...sah, peruntukan: "Entah" }));
  });

  it("metode karangan ditolak", () => {
    assert.ok(periksaCatatPengeluaran({ ...sah, metode: "Barter" }));
  });

  it("metode Hutang wajib membawa kreditur dan tenggat", () => {
    assert.ok(periksaCatatPengeluaran({ ...sah, metode: "Hutang" }));
    assert.equal(
      periksaCatatPengeluaran({
        ...sah, metode: "Hutang", kreditur: "Toko Sejahtera", tenggat: "2026-10-01",
      }),
      null,
    );
  });
});

describe("periksaUbahPengeluaran", () => {
  const dasar = { ...sah, id: "e1" };
  const konteks = {
    metodeLama: "Transfer",
    terbayarCicilan: 0,
    contractId: null as string | null,
    pembelianId: null as string | null,
  };

  it("perubahan yang wajar lolos", () => {
    assert.equal(periksaUbahPengeluaran(dasar, konteks), null);
  });

  it("baris pembayaran kontrak tidak boleh disunting dari Keuangan", () => {
    const g = periksaUbahPengeluaran(dasar, { ...konteks, contractId: "k1" });
    assert.ok(g && /modul Vendor/.test(g), g ?? "(lolos)");
  });

  it("baris pembayaran PO tidak boleh disunting dari Keuangan", () => {
    const g = periksaUbahPengeluaran(dasar, { ...konteks, pembelianId: "b1" });
    assert.ok(g && /Pembelian Material/.test(g), g ?? "(lolos)");
  });

  it("pengeluaran-hutang tidak bisa berubah jadi tunai", () => {
    const g = periksaUbahPengeluaran(
      { ...dasar, metode: "Transfer" },
      { ...konteks, metodeLama: "Hutang" },
    );
    assert.ok(g && /tidak bisa diubah menjadi pembayaran tunai/.test(g), g ?? "(lolos)");
  });

  it("pengeluaran tunai tidak bisa berubah jadi hutang", () => {
    const g = periksaUbahPengeluaran(
      { ...dasar, metode: "Hutang", kreditur: "X", tenggat: "2026-10-01" },
      konteks,
    );
    assert.ok(g && /tidak bisa diubah menjadi hutang/.test(g), g ?? "(lolos)");
  });

  it("total baru tak boleh turun di bawah yang sudah dicicil", () => {
    const g = periksaUbahPengeluaran(
      {
        ...dasar, metode: "Hutang", kreditur: "X", tenggat: "2026-10-01",
        total: 500_000, pembebanan: [{ unitId: "u1", infrastructureId: null, nominal: 500_000 }],
      },
      { ...konteks, metodeLama: "Hutang", terbayarCicilan: 800_000 },
    );
    assert.ok(g && /sudah dicicil/.test(g), g ?? "(lolos)");
  });

  it("total baru sama dengan yang sudah dicicil masih boleh — itu pelunasan pas", () => {
    assert.equal(
      periksaUbahPengeluaran(
        {
          ...dasar, metode: "Hutang", kreditur: "X", tenggat: "2026-10-01",
          total: 800_000, pembebanan: [{ unitId: "u1", infrastructureId: null, nominal: 800_000 }],
        },
        { ...konteks, metodeLama: "Hutang", terbayarCicilan: 800_000 },
      ),
      null,
    );
  });
});

describe("periksaHapusPengeluaran", () => {
  const kosong = { contractId: null, pembelianId: null, jumlahCicilan: 0 };

  it("pengeluaran biasa boleh dihapus", () => {
    assert.equal(periksaHapusPengeluaran({ id: "e1" }, kosong), null);
  });

  it("tanpa id ditolak", () => {
    assert.ok(periksaHapusPengeluaran({ id: "" }, kosong));
  });

  it("pembayaran kontrak ditolak", () => {
    assert.ok(periksaHapusPengeluaran({ id: "e1" }, { ...kosong, contractId: "k1" }));
  });

  it("hutang yang sudah dicicil ditolak — cicilannya catatan kas keluar", () => {
    const g = periksaHapusPengeluaran({ id: "e1" }, { ...kosong, jumlahCicilan: 2 });
    assert.ok(g && /2 cicilan/.test(g), g ?? "(lolos)");
  });
});

describe("periksaBagikanBiayaUnitRata", () => {
  it("proyek berunit dengan biaya level proyek: lolos", () => {
    assert.equal(
      periksaBagikanBiayaUnitRata({ projectId: "p1" }, { jumlahUnit: 5, jumlahBiayaLevelProyek: 2 }),
      null,
    );
  });

  it("proyek tanpa unit ditolak", () => {
    const g = periksaBagikanBiayaUnitRata({ projectId: "p1" }, { jumlahUnit: 0, jumlahBiayaLevelProyek: 2 });
    assert.ok(g && /belum punya unit/.test(g), g ?? "(lolos)");
  });

  it("tidak ada yang bisa dibagikan ditolak", () => {
    assert.ok(periksaBagikanBiayaUnitRata({ projectId: "p1" }, { jumlahUnit: 5, jumlahBiayaLevelProyek: 0 }));
  });
});

describe("periksaBuatPembelian", () => {
  const po = {
    projectId: "p1",
    pemasokId: "s1",
    nomor: "PO-2026-001",
    tanggal: null,
    keterangan: null,
    items: [{ uraian: "Semen", satuan: "sak", qty: 50, harga: 62_000, hargaDasarId: null }],
  };

  it("PO dengan satu barang lolos", () => {
    assert.equal(periksaBuatPembelian(po), null);
  });

  it("PO tanpa barang ditolak", () => {
    assert.ok(periksaBuatPembelian({ ...po, items: [] }));
  });

  it("qty nol ditolak", () => {
    const g = periksaBuatPembelian({ ...po, items: [{ ...po.items[0], qty: 0 }] });
    assert.ok(g && /Qty/.test(g), g ?? "(lolos)");
  });

  it("harga nol DITERIMA — barang bonus atau contoh", () => {
    assert.equal(periksaBuatPembelian({ ...po, items: [{ ...po.items[0], harga: 0 }] }), null);
  });

  it("harga negatif ditolak", () => {
    assert.ok(periksaBuatPembelian({ ...po, items: [{ ...po.items[0], harga: -1 }] }));
  });

  it("nomor PO kosong ditolak", () => {
    assert.ok(periksaBuatPembelian({ ...po, nomor: " " }));
  });
});

describe("periksaTerimaPembelian", () => {
  it("penerimaan lengkap lolos", () => {
    assert.equal(
      periksaTerimaPembelian({ id: "b1", penerima: "Agus", tanggalTerima: "2026-09-01T08:00" }),
      null,
    );
  });

  it("tanpa nama penerima ditolak — ini bukti serah-terima fisik", () => {
    assert.ok(periksaTerimaPembelian({ id: "b1", penerima: "", tanggalTerima: "2026-09-01" }));
  });

  it("tanggal ngawur ditolak", () => {
    assert.ok(periksaTerimaPembelian({ id: "b1", penerima: "Agus", tanggalTerima: "besok" }));
  });
});

describe("periksaHapusPembelian", () => {
  it("PO tanpa pembayaran boleh dihapus", () => {
    assert.equal(periksaHapusPembelian({ id: "b1" }, { jumlahPembayaran: 0, nomor: "PO-1" }), null);
  });

  it("PO yang sudah dibayar ditolak", () => {
    const g = periksaHapusPembelian({ id: "b1" }, { jumlahPembayaran: 1, nomor: "PO-1" });
    assert.ok(g && /1 pembayaran/.test(g), g ?? "(lolos)");
  });
});

describe("periksaBayarPembelian", () => {
  const bayar = {
    pembelianId: "b1",
    total: 5_000_000,
    peruntukan: "Unit (rumah dijual)",
    metode: "Transfer",
    unitId: "u1",
    infrastructureId: null,
  };
  const konteks = { sisa: 10_000_000, nomor: "PO-1" };

  it("pembayaran dalam batas sisa lolos", () => {
    assert.equal(periksaBayarPembelian(bayar, konteks), null);
  });

  it("membayar tepat sebesar sisa lolos", () => {
    assert.equal(periksaBayarPembelian({ ...bayar, total: 10_000_000 }, konteks), null);
  });

  it("melebihi sisa ditolak", () => {
    const g = periksaBayarPembelian({ ...bayar, total: 10_000_001 }, konteks);
    assert.ok(g && /melebihi sisa/.test(g), g ?? "(lolos)");
  });

  it("PO yang sudah lunas ditolak", () => {
    const g = periksaBayarPembelian(bayar, { ...konteks, sisa: 0 });
    assert.ok(g && /sudah lunas/.test(g), g ?? "(lolos)");
  });

  it('metode "Hutang" ditolak — akan mencatat biaya dua kali', () => {
    const g = periksaBayarPembelian({ ...bayar, metode: "Hutang" }, konteks);
    assert.ok(g && /metode pembayaran/.test(g), g ?? "(lolos)");
  });

  it("sasaran pembebanan harus cocok dengan peruntukannya", () => {
    assert.ok(periksaBayarPembelian({ ...bayar, peruntukan: "Prasarana & Sarana" }, konteks));
  });
});

describe("periksaHapusPembayaranPembelian", () => {
  it("pembayaran PO boleh dihapus", () => {
    assert.equal(periksaHapusPembayaranPembelian({ id: "e1" }, { pembelianId: "b1" }), null);
  });

  it("pengeluaran biasa ditolak lewat jalur ini", () => {
    assert.ok(periksaHapusPembayaranPembelian({ id: "e1" }, { pembelianId: null }));
  });
});

describe("periksaBayarHutang", () => {
  const cicilan = { expenseId: "e1", nominal: 1_000_000, metode: "Transfer", tanggal: "2026-09-01" };
  const konteks = { metodeInduk: "Hutang", sisa: 3_000_000 };

  it("cicilan dalam batas sisa lolos", () => {
    assert.equal(periksaBayarHutang(cicilan, konteks), null);
  });

  it("melunasi tepat sisa lolos", () => {
    assert.equal(periksaBayarHutang({ ...cicilan, nominal: 3_000_000 }, konteks), null);
  });

  it("melebihi sisa ditolak", () => {
    assert.ok(periksaBayarHutang({ ...cicilan, nominal: 3_000_001 }, konteks));
  });

  it("induk yang bukan hutang ditolak", () => {
    const g = periksaBayarHutang(cicilan, { ...konteks, metodeInduk: "Transfer" });
    assert.ok(g && /bukan hutang/.test(g), g ?? "(lolos)");
  });

  it("hutang yang sudah lunas ditolak", () => {
    assert.ok(periksaBayarHutang(cicilan, { ...konteks, sisa: 0 }));
  });

  it('metode "Hutang" ditolak — melunasi hutang dengan hutang', () => {
    assert.ok(periksaBayarHutang({ ...cicilan, metode: "Hutang" }, konteks));
  });

  it("tanggal ngawur ditolak", () => {
    assert.ok(periksaBayarHutang({ ...cicilan, tanggal: "kemarin" }, konteks));
  });
});
