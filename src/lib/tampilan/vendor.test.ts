import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { kpiVendor, ringkasVendor, susunBarisVendor } from "./vendor";

const kontrak = (
  nominal: number,
  terbayar: number[],
  kodeProyek = "NT4",
  vo: { nominal: number; status: string }[] = [],
) => ({
  nominal,
  retensiPct: 5,
  expenses: terbayar.map((total) => ({ total })),
  variationOrders: vo,
  project: { kode: kodeProyek },
});

describe("ringkasVendor", () => {
  it("menjumlahkan nilai efektif dan yang sudah terbayar", () => {
    const r = ringkasVendor([kontrak(1000, [400]), kontrak(500, [100])]);
    assert.equal(r.jumlahKontrak, 2);
    assert.equal(r.nilai, 1500);
    assert.equal(r.terbayar, 500);
  });

  it("nilai kontrak sudah termasuk VO yang DISETUJUI", () => {
    const r = ringkasVendor([
      kontrak(1000, [], "NT4", [{ nominal: 200, status: "Disetujui" }]),
    ]);
    assert.equal(r.nilai, 1200);
  });

  it("VO yang masih diajukan belum menambah nilai kontrak", () => {
    const r = ringkasVendor([
      kontrak(1000, [], "NT4", [{ nominal: 200, status: "Diajukan" }]),
    ]);
    assert.equal(r.nilai, 1000);
  });

  it("VO pekerjaan kurang mengurangi nilai kontrak", () => {
    const r = ringkasVendor([
      kontrak(1000, [], "NT4", [{ nominal: -150, status: "Disetujui" }]),
    ]);
    assert.equal(r.nilai, 850);
  });

  it("daftar proyek tidak menggandakan proyek yang sama", () => {
    const r = ringkasVendor([kontrak(100, [], "NT4"), kontrak(200, [], "NT4"), kontrak(50, [], "GN2")]);
    assert.deepEqual(r.proyek.sort(), ["GN2", "NT4"]);
  });

  it("vendor tanpa kontrak menghasilkan nol, bukan galat", () => {
    const r = ringkasVendor([]);
    assert.deepEqual(r, { jumlahKontrak: 0, proyek: [], nilai: 0, terbayar: 0 });
  });
});

describe("susunBarisVendor", () => {
  it("mempertahankan kolom vendor aslinya", () => {
    const [b] = susunBarisVendor([
      { id: "v1", nama: "PT Karya", status: "Aktif", contracts: [kontrak(500, [200])] },
    ]);
    assert.equal(b.id, "v1");
    assert.equal(b.nama, "PT Karya");
    assert.equal(b.nilai, 500);
    assert.equal(b.terbayar, 200);
  });
});

describe("kpiVendor", () => {
  const vendor = [
    { status: "Aktif", contracts: [kontrak(1000, [1000]), kontrak(500, [200])] },
    { status: "Nonaktif", contracts: [kontrak(300, [])] },
  ];

  it("menghitung vendor aktif terpisah dari total terdaftar", () => {
    const k = kpiVendor(vendor);
    assert.equal(k.jumlahVendor, 2);
    assert.equal(k.vendorAktif, 1);
  });

  it("kontrak berjalan ditentukan posisi bayar, bukan status atau tanggal", () => {
    // Kontrak pertama lunas; dua lainnya belum.
    const k = kpiVendor(vendor);
    assert.equal(k.jumlahKontrak, 3);
    assert.equal(k.kontrakBerjalan, 2);
  });

  it("belum terbayar = nilai efektif dikurangi yang sudah dibayar", () => {
    const k = kpiVendor(vendor);
    assert.equal(k.totalNilai, 1800);
    assert.equal(k.totalTerbayar, 1200);
    assert.equal(k.belumTerbayar, 600);
  });

  it("kontrak yang terbayar melebihi nilainya tidak dihitung berjalan", () => {
    const k = kpiVendor([{ status: "Aktif", contracts: [kontrak(100, [120])] }]);
    assert.equal(k.kontrakBerjalan, 0);
  });

  it("tanpa vendor sama sekali menghasilkan nol di semua angka", () => {
    const k = kpiVendor([]);
    assert.equal(k.jumlahKontrak, 0);
    assert.equal(k.totalNilai, 0);
    assert.equal(k.belumTerbayar, 0);
  });
});
