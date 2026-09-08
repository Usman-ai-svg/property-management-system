import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulatkanProgres,
  fraksiBaris,
  progresSah,
  jepitProgres,
  ringkasOpnamePersen,
  grupBerjalan,
  ringkasOpname,
  susunOpname,
  susunOpnameDariPersen,
} from "./opname";

const BARIS = [
  { uraian: "Pondasi", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
  { uraian: "Dinding", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
  { uraian: "Atap", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
  { uraian: "Finishing", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
];

describe("fraksiBaris", () => {
  it("menyelesaikan baris secara berurutan, bukan serentak", () => {
    // Pada 25% dari 4 baris: baris pertama selesai, sisanya belum tersentuh.
    assert.equal(fraksiBaris(25, 0, 4), 1);
    assert.equal(fraksiBaris(25, 1, 4), 0);
    assert.equal(fraksiBaris(25, 2, 4), 0);
  });

  it("mengembalikan nilai antara nol dan satu", () => {
    for (const p of [-50, 0, 37, 100, 150]) {
      for (let i = 0; i < 4; i++) {
        const f = fraksiBaris(p, i, 4);
        assert.ok(f >= 0 && f <= 1, `f(${p}, ${i}) = ${f}`);
      }
    }
  });

  it("aman terhadap jumlah baris nol", () => {
    assert.equal(fraksiBaris(50, 0, 0), 0);
  });
});

describe("susunOpname", () => {
  it("bobot seluruh baris berjumlah seratus", () => {
    const total = susunOpnameDariPersen(BARIS, 0, 50).reduce((s, r) => s + r.bobot, 0);
    assert.ok(Math.abs(total - 100) < 1e-9);
  });

  it("penambahan minggu ini adalah selisih dua titik progres", () => {
    const baris = susunOpnameDariPersen(BARIS, 25, 50);
    const kumulatif = baris.reduce((s, r) => s + r.bobotKini, 0);
    const lalu = baris.reduce((s, r) => s + r.bobotLalu, 0);
    const delta = baris.reduce((s, r) => s + r.deltaBobot, 0);
    assert.ok(Math.abs(kumulatif - lalu - delta) < 1e-9);
  });

  it("tidak memunculkan kemajuan ketika progres tidak berubah", () => {
    for (const r of susunOpnameDariPersen(BARIS, 60, 60)) {
      assert.equal(r.deltaProgres, 0);
      assert.equal(r.deltaNilai, 0);
    }
  });

  it("nilai kumulatif seluruh baris sama dengan nilai kontrak pada 100%", () => {
    const r = ringkasOpname(susunOpnameDariPersen(BARIS, 0, 100));
    assert.equal(r.nilaiKini, 400_000_000);
    assert.equal(r.nilaiKontrak, 400_000_000);
  });

  it("mengembalikan daftar kosong bila tidak ada baris", () => {
    assert.deepEqual(susunOpnameDariPersen([], 0, 50), []);
  });

  it("mengembalikan daftar kosong bila seluruh nilainya nol", () => {
    assert.deepEqual(susunOpnameDariPersen([{ uraian: "x", satuan: "ls", volume: 0, hargaSatuan: 0 }], 0, 50), []);
  });

  it("membobot baris sesuai nilainya, bukan sama rata", () => {
    const campuran = [
      { uraian: "Besar", satuan: "ls", volume: 1, hargaSatuan: 300_000_000 },
      { uraian: "Kecil", satuan: "ls", volume: 1, hargaSatuan: 100_000_000 },
    ];
    const baris = susunOpnameDariPersen(campuran, 0, 100);
    assert.equal(baris[0].bobot, 75);
    assert.equal(baris[1].bobot, 25);
  });
});

describe("grupBerjalan", () => {
  const b = (grup: string, progress: number) => ({ grup, volume: 1, hargaSatuan: 1_000_000, progress });

  it("hanya menyebut grup yang progres tertimbangnya 0<x<100", () => {
    const rows = [
      b("Struktur", 100), b("Struktur", 100),   // selesai → 100%
      b("Arsitektur", 40), b("Arsitektur", 0),  // berjalan → 20%
      b("MEP", 0),                               // belum → 0%
    ];
    assert.deepEqual(grupBerjalan(rows), ["Arsitektur"]);
  });

  it("bisa menyebut LEBIH DARI SATU grup yang berjalan bersamaan", () => {
    const rows = [b("Struktur", 60), b("Arsitektur", 30), b("MEP", 0), b("Atap", 100)];
    assert.deepEqual(grupBerjalan(rows), ["Struktur", "Arsitektur"]);
  });

  it("mengembalikan daftar kosong bila tak ada baris", () => {
    assert.deepEqual(grupBerjalan([]), []);
  });

  it("tidak menyebut grup yang seluruhnya sudah 100%", () => {
    assert.deepEqual(grupBerjalan([b("Atap", 100)]), []);
  });

  it("menyebut grup dengan satu baris yang sedang dikerjakan", () => {
    assert.deepEqual(grupBerjalan([b("Taman", 50)]), ["Taman"]);
  });
});

describe("susunOpname dari angka per baris", () => {
  const isi = [
    { uraian: "Pondasi", satuan: "ls", volume: 1, hargaSatuan: 90_000_000, progressLalu: 60, progress: 100 },
    { uraian: "Cat", satuan: "ls", volume: 1, hargaSatuan: 10_000_000, progressLalu: 0, progress: 0 },
  ];

  it("memakai angka tiap baris apa adanya, bukan menyebarnya", () => {
    const [pondasi, cat] = susunOpname(isi);
    assert.equal(pondasi.progresKini, 100);
    assert.equal(pondasi.progresLalu, 60);
    assert.equal(cat.progresKini, 0);
  });

  it("menimbang bobot menurut nilai baris", () => {
    const [pondasi, cat] = susunOpname(isi);
    assert.equal(Math.round(pondasi.bobot), 90);
    assert.equal(Math.round(cat.bobot), 10);
  });

  it("menghitung penambahan minggu ini dari selisih kedua angka", () => {
    const [pondasi] = susunOpname(isi);
    assert.equal(pondasi.deltaProgres, 40);
    assert.equal(pondasi.deltaNilai, 36_000_000);
  });

  it("menjumlahkan nilai terpasang sesuai capaian tiap baris", () => {
    const r = ringkasOpname(susunOpname(isi));
    assert.equal(r.nilaiKini, 90_000_000);
    assert.equal(r.nilaiKontrak, 100_000_000);
  });

  it("menjepit angka di luar rentang 0–100", () => {
    const [a] = susunOpname([
      { uraian: "X", satuan: "ls", volume: 1, hargaSatuan: 1_000_000, progressLalu: -5, progress: 150 },
    ]);
    assert.equal(a.progresKini, 100);
    assert.equal(a.progresLalu, 0);
  });

  it("mengembalikan daftar kosong bila tidak ada baris bernilai", () => {
    assert.deepEqual(susunOpname([]), []);
  });
});

describe("jepitProgres", () => {
  it("membiarkan nilai di dalam rentang", () => {
    assert.equal(jepitProgres(45), 45);
  });

  it("menjepit ketikan di luar rentang", () => {
    assert.equal(jepitProgres(150), 100);
    assert.equal(jepitProgres(-20), 0);
  });

  it("bukan-angka jadi nol, bukan NaN yang menular ke penjumlahan", () => {
    assert.equal(jepitProgres(Number.NaN), 0);
    assert.equal(jepitProgres(Number.POSITIVE_INFINITY), 0);
  });
});

describe("ringkasOpnamePersen", () => {
  const baris = [
    { id: "a", volume: 10, hargaSatuan: 100_000 },  // 1.000.000
    { id: "b", volume: 5, hargaSatuan: 200_000 },   // 1.000.000
  ];

  it("menjumlahkan nilai seluruh baris", () => {
    assert.equal(ringkasOpnamePersen(baris, () => 0).total, 2_000_000);
  });

  it("menghitung nilai terpasang menurut persen tiap baris", () => {
    const r = ringkasOpnamePersen(baris, (b) => (b.id === "a" ? 50 : 0));
    assert.equal(r.terpasang, 500_000);
    assert.equal(r.persen, 25);
  });

  it("seluruh baris seratus persen berarti terpasang penuh", () => {
    const r = ringkasOpnamePersen(baris, () => 100);
    assert.equal(r.terpasang, r.total);
    assert.equal(r.persen, 100);
  });

  it("daftar kosong menghasilkan nol, bukan pembagian nol", () => {
    assert.deepEqual(ringkasOpnamePersen([], () => 50), { total: 0, terpasang: 0, persen: 0 });
  });

  it("baris bernilai nol tidak membuat persen jadi NaN", () => {
    const r = ringkasOpnamePersen([{ id: "x", volume: 0, hargaSatuan: 0 }], () => 100);
    assert.equal(r.persen, 0);
  });

  it("persen di luar rentang dijepit — terpasang tak pernah melebihi total", () => {
    const r = ringkasOpnamePersen(baris, () => 150);
    assert.equal(r.terpasang, r.total);
    assert.equal(r.persen, 100);
  });
});

describe("progresSah", () => {
  it("menerima seluruh rentang 0 sampai 100", () => {
    for (const p of [0, 0.5, 50, 99.9, 100]) assert.equal(progresSah(p), true, String(p));
  });

  it("menolak di luar rentang — opname dasar penagihan, jadi ditolak bukan dijepit", () => {
    assert.equal(progresSah(-1), false);
    assert.equal(progresSah(101), false);
  });

  it("menolak bukan-angka", () => {
    assert.equal(progresSah(Number.NaN), false);
    assert.equal(progresSah(Number.POSITIVE_INFINITY), false);
  });

  it("berbeda sikap dengan jepitProgres pada nilai yang sama", () => {
    assert.equal(progresSah(150), false);
    assert.equal(jepitProgres(150), 100);
  });
});

describe("bulatkanProgres", () => {
  it("membulatkan ke persen bulat karena kolomnya bertipe Int", () => {
    assert.equal(bulatkanProgres(49.4), 49);
    assert.equal(bulatkanProgres(49.5), 50);
  });

  it("nilai bulat tidak berubah", () => {
    assert.equal(bulatkanProgres(100), 100);
  });
});
