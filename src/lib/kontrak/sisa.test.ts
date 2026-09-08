/**
 * Tes kontrak untuk tiga modul terakhir: Admin, Landbank, dan Equipment.
 *
 * Digabung dalam satu berkas karena ketiganya kecil dan tidak saling
 * bertumpang tindih — memecahnya jadi tiga berkas hanya menambah kepala tanpa
 * menambah kejelasan.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_SANDI,
  periksaGantiPeran,
  periksaLogin,
  periksaUbahIzin,
  periksaUbahStatusUser,
  periksaUser,
} from "./admin";
import {
  periksaSimpanBarisRencana,
  periksaSimpanCashflow,
  periksaSimpanHargaDasarUnit,
  periksaSimpanKategoriRencana,
  periksaSimpanPembanding,
} from "./landbank";
import {
  periksaAset,
  periksaCatatPenyesuaianAset,
  periksaCatatServis,
  periksaHapusAset,
  periksaSelesaikanPenggunaan,
  periksaTambahPenggunaan,
} from "./equipment";

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

describe("periksaUbahIzin", () => {
  it("sub-bagian dan tingkat yang sah lolos", () => {
    assert.equal(periksaUbahIzin({ roleId: "r1", section: "keuangan", tingkat: "ubah" }), null);
  });

  it("sub-bagian karangan ditolak", () => {
    assert.ok(periksaUbahIzin({ roleId: "r1", section: "gudang", tingkat: "ubah" }));
  });

  it("tingkat izin karangan ditolak", () => {
    assert.ok(periksaUbahIzin({ roleId: "r1", section: "keuangan", tingkat: "penuh" }));
  });

  it('tingkat "tidak" adalah pilihan yang sah, bukan ketiadaan nilai', () => {
    assert.equal(periksaUbahIzin({ roleId: "r1", section: "keuangan", tingkat: "tidak" }), null);
  });
});

describe("periksaUbahStatusUser", () => {
  it("menonaktifkan orang lain boleh", () => {
    assert.equal(
      periksaUbahStatusUser({ id: "u2" }, { targetDiriSendiri: false, aktif: false }),
      null,
    );
  });

  it("menonaktifkan diri sendiri ditolak — bisa mengunci seluruh sistem", () => {
    const g = periksaUbahStatusUser({ id: "u1" }, { targetDiriSendiri: true, aktif: false });
    assert.ok(g && /akun Anda sendiri/.test(g), g ?? "(lolos)");
  });

  it("mengaktifkan kembali diri sendiri tidak dilarang", () => {
    assert.equal(
      periksaUbahStatusUser({ id: "u1" }, { targetDiriSendiri: true, aktif: true }),
      null,
    );
  });
});

describe("periksaUser", () => {
  const baru = {
    id: null,
    nama: "Budi",
    email: "budi@nanoland.id",
    sandi: "rahasia123",
    peranIds: ["r1"],
    proyekIds: [],
  };
  const konteks = { emailBentrok: false, peranDikenal: true, proyekDikenal: true };

  it("akun baru yang lengkap lolos", () => {
    assert.equal(periksaUser(baru, konteks), null);
  });

  it("email tanpa @ ditolak", () => {
    assert.ok(periksaUser({ ...baru, email: "budi.nanoland.id" }, konteks));
  });

  it("email yang sudah dipakai ditolak", () => {
    assert.ok(periksaUser(baru, { ...konteks, emailBentrok: true }));
  });

  it("sandi di bawah batas ditolak saat membuat akun", () => {
    const g = periksaUser({ ...baru, sandi: "a".repeat(MIN_SANDI - 1) }, konteks);
    assert.ok(g && /Kata sandi minimal/.test(g), g ?? "(lolos)");
  });

  it("saat menyunting, sandi KOSONG berarti tidak diganti — bukan ditolak", () => {
    assert.equal(periksaUser({ ...baru, id: "u1", sandi: null }, konteks), null);
    assert.equal(periksaUser({ ...baru, id: "u1", sandi: "" }, konteks), null);
  });

  it("saat menyunting, sandi baru tetap harus memenuhi panjang minimum", () => {
    assert.ok(periksaUser({ ...baru, id: "u1", sandi: "pendek" }, konteks));
  });

  it("pengguna tanpa peran ditolak — bisa masuk tapi tak bisa melihat apa pun", () => {
    const g = periksaUser({ ...baru, peranIds: [] }, konteks);
    assert.ok(g && /setidaknya satu peran/.test(g), g ?? "(lolos)");
  });

  it("peran atau proyek yang tak dikenal ditolak", () => {
    assert.ok(periksaUser(baru, { ...konteks, peranDikenal: false }));
    assert.ok(periksaUser(baru, { ...konteks, proyekDikenal: false }));
  });
});

describe("periksaLogin & periksaGantiPeran", () => {
  it("isian masuk yang lengkap lolos", () => {
    assert.equal(periksaLogin({ email: "budi@nanoland.id", sandi: "rahasia123" }), null);
  });

  it("email berbentuk ngawur TIDAK ditolak di layar masuk", () => {
    // Membedakan "format salah" dari "tidak terdaftar" memberi tahu penebak
    // bahwa alamat itu ada. Yang diperiksa hanya kelengkapan.
    assert.equal(periksaLogin({ email: "bukan-email", sandi: "rahasia123" }), null);
  });

  it("isian kosong ditolak", () => {
    assert.ok(periksaLogin({ email: "", sandi: "rahasia123" }));
    assert.ok(periksaLogin({ email: "budi@nanoland.id", sandi: "" }));
  });

  it("ganti peran hanya ke peran yang dimiliki", () => {
    assert.equal(periksaGantiPeran({ peran: "Finance" }, { peranDimiliki: true }), null);
    const g = periksaGantiPeran({ peran: "Finance" }, { peranDimiliki: false });
    assert.ok(g && /tidak memegang peran/.test(g), g ?? "(lolos)");
  });
});

// ---------------------------------------------------------------------------
// Landbank
// ---------------------------------------------------------------------------

describe("kontrak Landbank", () => {
  it("kategori rencana butuh proyek dan nama", () => {
    assert.equal(
      periksaSimpanKategoriRencana({ id: null, projectId: "p1", nama: "Tanah" }),
      null,
    );
    assert.ok(periksaSimpanKategoriRencana({ id: null, projectId: "p1", nama: " " }));
  });

  it("baris rencana boleh bervolume dan berharga nol — kerangka dulu, angka menyusul", () => {
    assert.equal(
      periksaSimpanBarisRencana({ id: null, kategoriId: "k1", nama: "Cut & fill", volume: 0, harga: 0, satuan: null }),
      null,
    );
  });

  it("baris rencana berharga negatif ditolak — akan mengurangi HPP tanpa terlihat", () => {
    assert.ok(
      periksaSimpanBarisRencana({ id: null, kategoriId: "k1", nama: "Cut & fill", volume: 1, harga: -5, satuan: null }),
    );
  });

  it("harga dasar unit boleh nol", () => {
    assert.equal(
      periksaSimpanHargaDasarUnit({ projectId: "p1", unitId: "u1", hargaDasar: 0 }),
      null,
    );
  });

  it("cashflow mencatat masuk dan keluar sebagai dua angka positif", () => {
    assert.equal(
      periksaSimpanCashflow({ id: null, projectId: "p1", periode: "2026-Q1", masuk: 100, keluar: 0 }),
      null,
    );
    assert.ok(
      periksaSimpanCashflow({ id: null, projectId: "p1", periode: "2026-Q1", masuk: 100, keluar: -50 }),
    );
  });

  it("cashflow tanpa periode ditolak", () => {
    assert.ok(periksaSimpanCashflow({ id: null, projectId: "p1", periode: "", masuk: 1, keluar: 1 }));
  });

  it("pembanding butuh nama dan harga per m² tak negatif", () => {
    assert.equal(
      periksaSimpanPembanding({ id: null, projectId: "p1", nama: "Perumahan sebelah", hargaPerM2: 3_500_000, keterangan: null }),
      null,
    );
    assert.ok(
      periksaSimpanPembanding({ id: null, projectId: "p1", nama: "", hargaPerM2: 1, keterangan: null }),
    );
  });
});

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

describe("periksaAset", () => {
  const m = {
    id: null,
    kode: "SCF-01",
    nama: "Scaffolding",
    jenis: "Peralatan",
    kategori: "Perancah",
    kepemilikan: "Milik Sendiri",
    jumlah: 20,
    vendorId: null as string | null,
  };

  it("alat lengkap lolos", () => {
    assert.equal(periksaAset(m, { kodeBentrok: false }), null);
  });

  it("jumlah nol ditolak — yang benar mencatat penyesuaian Hilang", () => {
    assert.ok(periksaAset({ ...m, jumlah: 0 }, { kodeBentrok: false }));
  });

  it("alat sewa tanpa vendor ditolak", () => {
    const g = periksaAset({ ...m, kepemilikan: "Sewa" }, { kodeBentrok: false });
    assert.ok(g && /vendor pemiliknya/.test(g), g ?? "(lolos)");
  });

  it("alat sewa dengan vendor lolos", () => {
    assert.equal(
      periksaAset({ ...m, kepemilikan: "Sewa", vendorId: "v1" }, { kodeBentrok: false }),
      null,
    );
  });

  it("kode bentrok ditolak", () => {
    assert.ok(periksaAset(m, { kodeBentrok: true }));
  });
});

describe("periksaHapusAset", () => {
  it("alat tanpa riwayat penggunaan boleh dihapus", () => {
    assert.equal(periksaHapusAset({ id: "a1" }, { jumlahPenggunaan: 0, kode: "SCF-01" }), null);
  });

  it("alat yang pernah dipakai ditolak", () => {
    assert.ok(periksaHapusAset({ id: "a1" }, { jumlahPenggunaan: 3, kode: "SCF-01" }));
  });
});

describe("periksaCatatPenyesuaianAset", () => {
  it("penyesuaian dengan jenis dan jumlah sah lolos", () => {
    assert.equal(
      periksaCatatPenyesuaianAset({ assetId: "a1", jenis: "Rusak", jumlah: 2, catatan: null }),
      null,
    );
  });

  it("jenis karangan ditolak — tiap jenis punya akibat berbeda pada stok", () => {
    assert.ok(
      periksaCatatPenyesuaianAset({ assetId: "a1", jenis: "Entah", jumlah: 2, catatan: null }),
    );
  });

  it("jumlah nol ditolak", () => {
    assert.ok(
      periksaCatatPenyesuaianAset({ assetId: "a1", jenis: "Hilang", jumlah: 0, catatan: null }),
    );
  });
});

describe("periksaCatatServis", () => {
  const m = {
    assetId: "a1",
    tanggal: "2026-09-01",
    berikutnya: "2026-12-01",
    biaya: 750_000,
    catatan: null,
  };

  it("servis dengan jadwal berikutnya di depan lolos", () => {
    assert.equal(periksaCatatServis(m), null);
  });

  it("tanpa jadwal berikutnya lolos", () => {
    assert.equal(periksaCatatServis({ ...m, berikutnya: null }), null);
  });

  it("jadwal berikutnya sebelum tanggal servis ditolak", () => {
    const g = periksaCatatServis({ ...m, berikutnya: "2026-08-01" });
    assert.ok(g && /lebih awal/.test(g), g ?? "(lolos)");
  });

  it("biaya nol diterima — servis dalam garansi", () => {
    assert.equal(periksaCatatServis({ ...m, biaya: 0 }), null);
  });
});

describe("periksaTambahPenggunaan", () => {
  const m = {
    assetId: "a1",
    projectId: "p1",
    jumlah: 5,
    mulai: "2026-09-01",
    selesai: null as string | null,
    penanggungJawab: "Agus",
    catatan: null,
  };
  const konteks = { tersedia: 12, kode: "SCF-01" };

  it("pemakaian dalam batas stok lolos", () => {
    assert.equal(periksaTambahPenggunaan(m, konteks), null);
  });

  it("memakai tepat sebanyak stok tersedia lolos", () => {
    assert.equal(periksaTambahPenggunaan({ ...m, jumlah: 12 }, konteks), null);
  });

  it("melebihi stok tersedia ditolak", () => {
    const g = periksaTambahPenggunaan({ ...m, jumlah: 13 }, konteks);
    assert.ok(g && /hanya tersedia 12/.test(g), g ?? "(lolos)");
  });

  it("tanggal selesai sebelum mulai ditolak", () => {
    assert.ok(periksaTambahPenggunaan({ ...m, selesai: "2026-08-01" }, konteks));
  });

  it("jumlah nol ditolak", () => {
    assert.ok(periksaTambahPenggunaan({ ...m, jumlah: 0 }, konteks));
  });
});

describe("periksaSelesaikanPenggunaan", () => {
  const konteks = { mulai: "2026-09-01", sudahSelesai: false };

  it("menyelesaikan penggunaan aktif lolos", () => {
    assert.equal(
      periksaSelesaikanPenggunaan({ id: "g1", selesai: "2026-09-20" }, konteks),
      null,
    );
  });

  it("penggunaan yang sudah selesai tidak diselesaikan dua kali", () => {
    assert.ok(
      periksaSelesaikanPenggunaan({ id: "g1", selesai: null }, { ...konteks, sudahSelesai: true }),
    );
  });

  it("tanggal selesai sebelum mulai ditolak", () => {
    assert.ok(periksaSelesaikanPenggunaan({ id: "g1", selesai: "2026-08-01" }, konteks));
  });
});
