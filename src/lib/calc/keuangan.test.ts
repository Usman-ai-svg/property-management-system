import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alokasiKontrak, bagiRata, periksaAlokasi, ringkasKontrak, statusBayarKontrak, statusSerapan,
  totalVoDisetujui, alokasiPembayaran,
} from "./keuangan";

describe("statusSerapan", () => {
  it("menandai Over ketika biaya mendahului progres", () => {
    assert.equal(statusSerapan(0.8, 50), "Over");
  });

  it("menandai Sesuai ketika biaya sejalan dengan progres", () => {
    assert.equal(statusSerapan(0.5, 50), "Sesuai");
  });

  it("menandai Hemat ketika biaya tertinggal dari progres", () => {
    assert.equal(statusSerapan(0.2, 50), "Hemat");
  });

  it("memberi toleransi tiga poin persen agar tidak berkedip", () => {
    assert.equal(statusSerapan(0.52, 50), "Sesuai");
    assert.equal(statusSerapan(0.48, 50), "Sesuai");
  });
});

describe("statusBayarKontrak", () => {
  const dasar = {
    nominal: 100_000_000,
    retensiPct: 5, // retensi 5jt → pokok lunas di 95jt
    jatuhTempoBln: 3,
    variationOrders: [] as { nominal: number; status: string }[],
  };
  const bayar = (total: number, tanggal: string) => ({ total, tanggal });

  it("Belum saat belum ada pembayaran", () => {
    assert.equal(statusBayarKontrak({ ...dasar, expenses: [] }), "Belum");
  });

  it("DP saat baru sebagian pokok terbayar", () => {
    assert.equal(statusBayarKontrak({ ...dasar, expenses: [bayar(10_000_000, "2026-01-01")] }), "DP");
  });

  it("Retensi saat pokok lunas & masa pemeliharaan belum lewat", () => {
    const k = { ...dasar, expenses: [bayar(95_000_000, "2026-01-10")] };
    assert.equal(statusBayarKontrak(k, new Date("2026-03-01")), "Retensi");
  });

  it("Retensi Jatuh Tempo saat masa pemeliharaan lewat sejak tgl pokok lunas", () => {
    const k = { ...dasar, expenses: [bayar(95_000_000, "2026-01-10")] };
    // jatuh tempo = 2026-01-10 + 3 bln = 2026-04-10; 2026-05-01 sudah lewat.
    assert.equal(statusBayarKontrak(k, new Date("2026-05-01")), "Retensi Jatuh Tempo");
  });

  it("Lunas saat seluruh nilai termasuk retensi terbayar", () => {
    const k = { ...dasar, expenses: [bayar(60_000_000, "2026-01-10"), bayar(40_000_000, "2026-06-10")] };
    assert.equal(statusBayarKontrak(k, new Date("2026-07-01")), "Lunas");
  });

  it("tanpa retensi (0%) tak pernah masuk keadaan Retensi", () => {
    const tanpa = { ...dasar, retensiPct: 0 };
    assert.equal(
      statusBayarKontrak({ ...tanpa, expenses: [bayar(99_000_000, "2026-01-10")] }, new Date("2026-12-01")),
      "DP",
    );
    assert.equal(statusBayarKontrak({ ...tanpa, expenses: [bayar(100_000_000, "2026-01-10")] }), "Lunas");
  });
});

describe("ringkasKontrak", () => {
  const kontrak = {
    nominal: 900_000_000,
    retensiPct: 5,
    expenses: [{ total: 300_000_000 }, { total: 250_000_000 }],
    variationOrders: [
      { nominal: 24_000_000, status: "Disetujui" },
      { nominal: -8_500_000, status: "Disetujui" },
      { nominal: 36_000_000, status: "Diajukan" },
    ],
  };

  it("hanya VO disetujui yang menggeser nilai kontrak", () => {
    const r = ringkasKontrak(kontrak);
    assert.equal(r.voDisetujui, 15_500_000);
    assert.equal(r.nilaiEfektif, 915_500_000);
  });

  it("VO yang masih diajukan dilaporkan terpisah", () => {
    assert.equal(ringkasKontrak(kontrak).voDiajukan, 36_000_000);
  });

  it("menerima VO negatif untuk pekerjaan kurang", () => {
    const kurang = { ...kontrak, variationOrders: [{ nominal: -50_000_000, status: "Disetujui" }] };
    assert.equal(ringkasKontrak(kurang).nilaiEfektif, 850_000_000);
  });

  it("menghitung sisa terhadap nilai efektif, bukan nilai awal", () => {
    const r = ringkasKontrak(kontrak);
    assert.equal(r.terbayar, 550_000_000);
    assert.equal(r.sisa, 915_500_000 - 550_000_000);
  });

  it("menahan retensi dari nilai yang bisa ditagih sekarang", () => {
    const r = ringkasKontrak(kontrak);
    assert.equal(r.retensi, 915_500_000 * 0.05);
    assert.equal(r.sisaTanpaRetensi, r.nilaiEfektif - r.retensi - r.terbayar);
  });

  it("tidak membagi nol pada kontrak bernilai nol", () => {
    const kosong = { nominal: 0, retensiPct: 0, expenses: [], variationOrders: [] };
    assert.equal(ringkasKontrak(kosong).persenTerbayar, 0);
  });
});

describe("alokasiKontrak", () => {
  it("membagi rata bila tidak ada override", () => {
    const hasil = alokasiKontrak(900_000_000, [{}, {}, {}]);
    for (const h of hasil) assert.equal(h.alokasi, 300_000_000);
  });

  it("menghormati override dan membagi sisanya", () => {
    const hasil = alokasiKontrak(540_000_000, [
      { nilaiOverride: 165_000_000 },
      { nilaiOverride: 210_000_000 },
      { nilaiOverride: null },
    ]);
    assert.equal(hasil[0].alokasi, 165_000_000);
    assert.equal(hasil[1].alokasi, 210_000_000);
    assert.equal(hasil[2].alokasi, 540_000_000 - 165_000_000 - 210_000_000);
  });

  it("jumlah alokasi sama dengan nilai kontrak", () => {
    const nilai = 520_000_000;
    const total = alokasiKontrak(nilai, [{}, {}, { nilaiOverride: 100_000_000 }, {}])
      .reduce((s, h) => s + h.alokasi, 0);
    assert.ok(Math.abs(total - nilai) < 1e-6);
  });

  it("mengembalikan daftar kosong bila tak ada objek pekerjaan", () => {
    assert.deepEqual(alokasiKontrak(100, []), []);
  });

  it("tidak membagi nol ketika semua item di-override", () => {
    const hasil = alokasiKontrak(300, [{ nilaiOverride: 100 }, { nilaiOverride: 200 }]);
    assert.deepEqual(hasil.map((h) => h.alokasi), [100, 200]);
  });
});

describe("totalVoDisetujui", () => {
  it("mengabaikan VO yang ditolak maupun yang masih diajukan", () => {
    const total = totalVoDisetujui([
      { nominal: 10, status: "Disetujui" },
      { nominal: 20, status: "Diajukan" },
      { nominal: 40, status: "Ditolak" },
    ]);
    assert.equal(total, 10);
  });
});

describe("bagiRata", () => {
  it("membagi habis tanpa sisa", () => {
    assert.deepEqual(bagiRata(1_000_000, 4), [250_000, 250_000, 250_000, 250_000]);
  });

  it("menaruh sisa pembagian pada bagian pertama", () => {
    const b = bagiRata(1_000_000, 3);
    assert.deepEqual(b, [333_334, 333_333, 333_333]);
  });

  it("menjaga jumlah pecahan persis sama dengan nominal aslinya", () => {
    for (const [nominal, banyak] of [
      [70_000_000, 5], [1, 3], [999_999_999, 7], [12_345_678, 11],
    ] as [number, number][]) {
      const b = bagiRata(nominal, banyak);
      assert.equal(b.length, banyak);
      assert.equal(b.reduce((s, x) => s + x, 0), nominal, `${nominal} dibagi ${banyak}`);
    }
  });

  it("mengembalikan nominal utuh untuk satu penerima", () => {
    assert.deepEqual(bagiRata(70_000_000, 1), [70_000_000]);
  });

  it("mengembalikan daftar kosong bila tidak ada penerima", () => {
    assert.deepEqual(bagiRata(70_000_000, 0), []);
  });
});

describe("periksaAlokasi", () => {
  const u = (nominal: number, unitId = "u1") => ({ unitId, nominal });

  it("menerima pembebanan yang jumlahnya persis sama dengan total", () => {
    assert.equal(periksaAlokasi(70_000_000, [u(14_000_000, "a"), u(56_000_000, "b")]), null);
  });

  it("menerima pembagian tidak rata", () => {
    assert.equal(
      periksaAlokasi(100_000_000, [u(20_000_000, "a"), u(30_000_000, "b"), u(50_000_000, "c")]),
      null,
    );
  });

  it("menolak bila jumlahnya kurang, dan menyebutkan selisihnya", () => {
    const p = periksaAlokasi(70_000_000, [u(14_000_000, "a"), u(50_000_000, "b")]);
    assert.match(p ?? "", /kurang Rp 6\.000\.000/);
  });

  it("menolak bila jumlahnya lebih", () => {
    const p = periksaAlokasi(70_000_000, [u(40_000_000, "a"), u(40_000_000, "b")]);
    assert.match(p ?? "", /lebih Rp 10\.000\.000/);
  });

  it("menolak selisih satu rupiah sekalipun", () => {
    assert.notEqual(periksaAlokasi(1_000_000, [u(999_999)]), null);
  });

  it("menolak pembebanan kosong", () => {
    assert.match(periksaAlokasi(70_000_000, []) ?? "", /setidaknya satu tujuan/);
  });

  it("menolak baris yang membebani unit sekaligus sarpras", () => {
    const p = periksaAlokasi(1_000_000, [{ unitId: "u1", infrastructureId: "s1", nominal: 1_000_000 }]);
    assert.match(p ?? "", /ATAU/);
  });

  it("menolak nominal nol atau negatif", () => {
    assert.notEqual(periksaAlokasi(1_000_000, [u(1_000_000, "a"), u(0, "b")]), null);
    assert.notEqual(periksaAlokasi(1_000_000, [u(1_500_000, "a"), u(-500_000, "b")]), null);
  });

  it("menerima pembebanan level proyek tanpa unit maupun sarpras", () => {
    assert.equal(periksaAlokasi(5_000_000, [{ nominal: 5_000_000 }]), null);
  });

  it("bekerja sama dengan bagiRata untuk berapa pun pembaginya", () => {
    for (const [total, n] of [[70_000_000, 5], [1_000_000, 3], [12_345_678, 7]] as [number, number][]) {
      const baris = bagiRata(total, n).map((nominal, i) => u(nominal, `u${i}`));
      assert.equal(periksaAlokasi(total, baris), null, `${total} dibagi ${n}`);
    }
  });
});

describe("alokasiPembayaran", () => {
  it("membagi sebanding dengan porsi tiap unit, bukan mengembalikan nilai override", () => {
    // Kontrak Rp 540 juta dengan override; termin yang dibayar Rp 162 juta.
    // `alokasiKontrak` akan mengembalikan 540 juta di sini — itu bug yang
    // fungsi ini ada untuk mencegahnya.
    const hasil = alokasiPembayaran(162_000_000, 540_000_000, [
      { nilaiOverride: 165_000_000 },
      { nilaiOverride: 165_000_000 },
      { nilaiOverride: 210_000_000 },
    ]);
    assert.equal(
      hasil.reduce((s, h) => s + h.alokasi, 0),
      162_000_000,
    );
    assert.equal(hasil[2].alokasi, 63_000_000); // 210/540 × 162 juta
  });

  it("membagi rata bila tidak ada override", () => {
    const hasil = alokasiPembayaran(90_000_000, 300_000_000, [{}, {}, {}]);
    assert.deepEqual(hasil.map((h) => h.alokasi), [30_000_000, 30_000_000, 30_000_000]);
  });

  it("menaruh sisa pembulatan di baris pertama supaya jumlahnya persis", () => {
    const hasil = alokasiPembayaran(100, 300, [{}, {}, {}]);
    assert.equal(hasil.reduce((s, h) => s + h.alokasi, 0), 100);
    assert.deepEqual(hasil.map((h) => h.alokasi), [34, 33, 33]);
  });

  it("membagi rata bila nilai kontraknya nol", () => {
    const hasil = alokasiPembayaran(60, 0, [{}, {}]);
    assert.deepEqual(hasil.map((h) => h.alokasi), [30, 30]);
  });

  it("mengembalikan daftar kosong bila tidak ada cakupan", () => {
    assert.deepEqual(alokasiPembayaran(100, 200, []), []);
  });
});
