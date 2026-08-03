import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  alokasiKontrakSarprasTerbayar,
  alokasiKontrakTerbayar,
  biayaLangsung,
  komposisiObjek,
  totalDibebankan,
  transaksiUntukObjek,
} from "./keuangan-proyek";

const kontrak = (
  nominal: number,
  terbayar: number[],
  units: { unitId: string; nilaiOverride?: number | null }[],
) => ({
  nominal,
  retensiPct: 0,
  expenses: terbayar.map((total) => ({ total })),
  variationOrders: [],
  units,
});

describe("alokasiKontrakTerbayar", () => {
  it("membagi rata kontrak borongan sesuai porsi yang sudah dibayar", () => {
    // Kontrak Rp 600 juta untuk 3 unit, baru terbayar setengahnya.
    const peta = alokasiKontrakTerbayar([
      kontrak(600, [300], [{ unitId: "a" }, { unitId: "b" }, { unitId: "c" }]),
    ]);
    assert.equal(peta.get("a"), 100);
    assert.equal(peta.get("b"), 100);
    assert.equal(peta.get("c"), 100);
  });

  it("menghormati nilaiOverride, bukan membagi rata", () => {
    const peta = alokasiKontrakTerbayar([
      kontrak(1000, [1000], [{ unitId: "besar", nilaiOverride: 700 }, { unitId: "kecil" }]),
    ]);
    assert.equal(peta.get("besar"), 700);
    assert.equal(peta.get("kecil"), 300);
  });

  it("menjumlahkan bila satu unit dicakup beberapa kontrak", () => {
    const peta = alokasiKontrakTerbayar([
      kontrak(100, [100], [{ unitId: "a" }]),
      kontrak(50, [50], [{ unitId: "a" }]),
    ]);
    assert.equal(peta.get("a"), 150);
  });

  it("nol untuk kontrak yang belum dibayar sama sekali", () => {
    const peta = alokasiKontrakTerbayar([kontrak(500, [], [{ unitId: "a" }])]);
    assert.equal(peta.get("a"), 0);
  });

  it("tidak membagi nol dengan nol saat nilai kontrak nol", () => {
    const peta = alokasiKontrakTerbayar([kontrak(0, [], [{ unitId: "a" }])]);
    assert.equal(peta.get("a"), 0);
  });

  it("membagi berdasarkan NILAI lalu dikalikan porsi terbayar, bukan sebaliknya", () => {
    // Bila urutannya dibalik — membagi yang terbayar — unit override akan
    // mendapat 700 padahal baru separuh kontrak yang dibayar.
    const peta = alokasiKontrakTerbayar([
      kontrak(1000, [500], [{ unitId: "besar", nilaiOverride: 700 }, { unitId: "kecil" }]),
    ]);
    assert.equal(peta.get("besar"), 350);
    assert.equal(peta.get("kecil"), 150);
  });
});

describe("alokasiKontrakSarprasTerbayar", () => {
  it("bekerja sama seperti versi unit", () => {
    const peta = alokasiKontrakSarprasTerbayar([
      {
        nominal: 400,
        retensiPct: 0,
        expenses: [{ total: 200 }],
        variationOrders: [],
        infrastructures: [{ infrastructureId: "jalan" }, { infrastructureId: "drainase" }],
      },
    ]);
    assert.equal(peta.get("jalan"), 100);
    assert.equal(peta.get("drainase"), 100);
  });
});

describe("biayaLangsung", () => {
  it("menjumlahkan dari baris alokasi, bukan dari total transaksi", () => {
    // Satu transfer Rp 300 juta untuk tiga unit tetap SATU baris bank.
    // Memakai `total` akan menghitungnya tiga kali.
    const hasil = biayaLangsung([
      {
        total: 300,
        alokasi: [
          { unitId: "a", infrastructureId: null, nominal: 100 },
          { unitId: "b", infrastructureId: null, nominal: 100 },
          { unitId: "c", infrastructureId: null, nominal: 100 },
        ],
      },
    ]);
    assert.equal(hasil.perUnit.get("a"), 100);
    assert.equal(hasil.perUnit.get("b"), 100);
    assert.equal(hasil.perUnit.get("c"), 100);
    assert.equal(hasil.levelProyek, 0);
  });

  it("memisahkan unit, sarpras, dan biaya level proyek", () => {
    const hasil = biayaLangsung([
      { total: 60, alokasi: [{ unitId: "u1", infrastructureId: null, nominal: 60 }] },
      { total: 40, alokasi: [{ unitId: null, infrastructureId: "s1", nominal: 40 }] },
      // Alokasi tanpa unit dan tanpa sarpras: perijinan, pengolahan lahan.
      { total: 25, alokasi: [{ unitId: null, infrastructureId: null, nominal: 25 }] },
    ]);
    assert.equal(hasil.perUnit.get("u1"), 60);
    assert.equal(hasil.perSarpras.get("s1"), 40);
    assert.equal(hasil.levelProyek, 25);
  });

  it("total seluruh pecahan sama dengan total seluruh transaksi", () => {
    const pengeluaran = [
      {
        total: 100,
        alokasi: [
          { unitId: "a", infrastructureId: null, nominal: 70 },
          { unitId: null, infrastructureId: "s", nominal: 20 },
          { unitId: null, infrastructureId: null, nominal: 10 },
        ],
      },
    ];
    const h = biayaLangsung(pengeluaran);
    const jumlahPecahan =
      [...h.perUnit.values()].reduce((s, x) => s + x, 0) +
      [...h.perSarpras.values()].reduce((s, x) => s + x, 0) +
      h.levelProyek;
    assert.equal(jumlahPecahan, pengeluaran.reduce((s, e) => s + e.total, 0));
  });
});

describe("transaksiUntukObjek", () => {
  const pengeluaran = [
    {
      total: 300,
      uraian: "upah borongan",
      alokasi: [
        { unitId: "a", infrastructureId: null, nominal: 200 },
        { unitId: "b", infrastructureId: null, nominal: 100 },
      ],
    },
    { total: 50, uraian: "material", alokasi: [{ unitId: "b", infrastructureId: null, nominal: 50 }] },
  ];

  it("melaporkan nominal yang dibebankan, bukan total transaksi", () => {
    const [t] = transaksiUntukObjek(pengeluaran, { unitId: "a" });
    assert.equal(t.total, 300);
    assert.equal(t.nominalDibebankan, 200);
    assert.equal(t.jumlahTujuan, 2);
  });

  it("hanya mengembalikan transaksi yang menyentuh objek yang diminta", () => {
    assert.equal(transaksiUntukObjek(pengeluaran, { unitId: "a" }).length, 1);
    assert.equal(transaksiUntukObjek(pengeluaran, { unitId: "b" }).length, 2);
    assert.equal(transaksiUntukObjek(pengeluaran, { unitId: "z" }).length, 0);
  });

  it("mencari lewat infrastructureId saat yang diminta sarpras", () => {
    const dengan = [
      { total: 80, alokasi: [{ unitId: null, infrastructureId: "jalan", nominal: 80 }] },
    ];
    assert.equal(transaksiUntukObjek(dengan, { sarprasId: "jalan" }).length, 1);
    assert.equal(transaksiUntukObjek(dengan, { sarprasId: "taman" }).length, 0);
  });
});

describe("komposisiObjek", () => {
  const tx = [
    { jenis: "Material", nominalDibebankan: 300 },
    { jenis: "Upah Borongan", nominalDibebankan: 500 },
    { jenis: "Material", nominalDibebankan: 200 },
  ];
  const urutan = ["Upah Borongan", "Material", "Subkon"];

  it("menjumlahkan per jenis lalu mengurutkan dari terbesar", () => {
    assert.deepEqual(komposisiObjek(tx, urutan), [
      { jenis: "Upah Borongan", nilai: 500 },
      { jenis: "Material", nilai: 500 },
    ]);
  });

  it("membuang jenis yang tidak terpakai, bukan menampilkannya bernilai nol", () => {
    assert.equal(komposisiObjek(tx, urutan).some((x) => x.jenis === "Subkon"), false);
  });

  it("objek tanpa transaksi menghasilkan daftar kosong", () => {
    assert.deepEqual(komposisiObjek([], urutan), []);
  });
});

describe("totalDibebankan", () => {
  it("menjumlahkan nominal yang dibebankan, bukan total transaksi", () => {
    assert.equal(
      totalDibebankan([{ nominalDibebankan: 120 }, { nominalDibebankan: 80 }]),
      200,
    );
  });

  it("nol untuk daftar kosong", () => {
    assert.equal(totalDibebankan([]), 0);
  });
});
