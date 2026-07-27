import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taksiranNilaiRusak, terapkanPenyesuaian, unitTerpakai } from "./aset";

/** 5 helm, semuanya masih baik. */
const utuh = { jumlah: 5, jumlahRusak: 0 };

describe("terapkanPenyesuaian · Hilang", () => {
  it("mengurangi jumlah", () => {
    const { stok, galat } = terapkanPenyesuaian(utuh, "Hilang", 2);
    assert.equal(galat, null);
    assert.deepEqual(stok, { jumlah: 3, jumlahRusak: 0 });
  });

  it("menolak kehilangan melebihi stok", () => {
    const { galat } = terapkanPenyesuaian(utuh, "Hilang", 6);
    assert.match(galat ?? "", /stok tercatat hanya 5/);
  });

  it("mengambil dari unit baik lebih dulu, baru dari yang rusak", () => {
    // 5 unit, 2 di antaranya rusak → 3 masih baik. Hilang 4 unit.
    const { stok } = terapkanPenyesuaian({ jumlah: 5, jumlahRusak: 2 }, "Hilang", 4);
    assert.deepEqual(stok, { jumlah: 1, jumlahRusak: 1 });
  });

  it("tidak menyisakan rusak melebihi jumlah saat semuanya hilang", () => {
    const { stok } = terapkanPenyesuaian({ jumlah: 5, jumlahRusak: 2 }, "Hilang", 5);
    assert.deepEqual(stok, { jumlah: 0, jumlahRusak: 0 });
  });
});

describe("terapkanPenyesuaian · Rusak", () => {
  it("menambah jumlahRusak tanpa mengurangi jumlah", () => {
    // Barangnya masih dimiliki perusahaan, hanya tidak bisa dipakai.
    const { stok, galat } = terapkanPenyesuaian(utuh, "Rusak", 2);
    assert.equal(galat, null);
    assert.deepEqual(stok, { jumlah: 5, jumlahRusak: 2 });
  });

  it("menolak bila melebihi unit yang masih terpakai", () => {
    const { galat } = terapkanPenyesuaian({ jumlah: 5, jumlahRusak: 3 }, "Rusak", 3);
    assert.match(galat ?? "", /hanya 2 unit yang masih terpakai/);
  });
});

describe("terapkanPenyesuaian · Perbaikan Selesai", () => {
  it("mengurangi jumlahRusak", () => {
    const { stok, galat } = terapkanPenyesuaian({ jumlah: 5, jumlahRusak: 3 }, "Perbaikan Selesai", 2);
    assert.equal(galat, null);
    assert.deepEqual(stok, { jumlah: 5, jumlahRusak: 1 });
  });

  it("menolak memperbaiki lebih banyak daripada yang rusak", () => {
    const { galat } = terapkanPenyesuaian({ jumlah: 5, jumlahRusak: 1 }, "Perbaikan Selesai", 2);
    assert.match(galat ?? "", /yang tercatat rusak hanya 1/);
  });
});

describe("terapkanPenyesuaian · Koreksi Stok", () => {
  it("menambah stok bila opname menemukan lebih", () => {
    const { stok } = terapkanPenyesuaian(utuh, "Koreksi Stok", 2);
    assert.deepEqual(stok, { jumlah: 7, jumlahRusak: 0 });
  });

  it("mengurangi stok bila opname menemukan kurang", () => {
    const { stok } = terapkanPenyesuaian(utuh, "Koreksi Stok", -2);
    assert.deepEqual(stok, { jumlah: 3, jumlahRusak: 0 });
  });

  it("menolak koreksi yang membuat stok negatif", () => {
    const { galat } = terapkanPenyesuaian(utuh, "Koreksi Stok", -6);
    assert.match(galat ?? "", /tidak boleh negatif/);
  });

  it("menolak koreksi yang membuat stok lebih kecil daripada unit rusak", () => {
    const { galat } = terapkanPenyesuaian({ jumlah: 5, jumlahRusak: 3 }, "Koreksi Stok", -3);
    assert.match(galat ?? "", /3 unit tercatat rusak/);
  });
});

describe("terapkanPenyesuaian · pemeriksaan umum", () => {
  it("menolak angka nol", () => {
    assert.match(terapkanPenyesuaian(utuh, "Hilang", 0).galat ?? "", /tidak boleh nol/);
  });

  it("menolak bilangan pecahan", () => {
    assert.match(terapkanPenyesuaian(utuh, "Hilang", 1.5).galat ?? "", /bilangan bulat/);
  });

  it("menolak angka negatif selain pada Koreksi Stok", () => {
    assert.match(terapkanPenyesuaian(utuh, "Rusak", -1).galat ?? "", /harus lebih dari nol/);
  });

  it("tidak mengubah stok bila penyesuaiannya ditolak", () => {
    const { stok } = terapkanPenyesuaian(utuh, "Hilang", 99);
    assert.deepEqual(stok, utuh);
  });
});

describe("unitTerpakai", () => {
  it("adalah jumlah dikurangi yang rusak", () => {
    assert.equal(unitTerpakai({ jumlah: 5, jumlahRusak: 2 }), 3);
  });

  it("tidak pernah negatif", () => {
    assert.equal(unitTerpakai({ jumlah: 1, jumlahRusak: 3 }), 0);
  });
});

describe("taksiranNilaiRusak", () => {
  it("memakai nilai rata-rata per unit", () => {
    assert.equal(taksiranNilaiRusak({ jumlah: 5, jumlahRusak: 2, nilai: 10_000_000 }), 4_000_000);
  });

  it("mengembalikan nol bila tidak ada stok", () => {
    assert.equal(taksiranNilaiRusak({ jumlah: 0, jumlahRusak: 0, nilai: 10_000_000 }), 0);
  });
});
