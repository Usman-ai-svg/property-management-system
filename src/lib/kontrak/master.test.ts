import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAKS_FASE,
  periksaAturJumlahFase,
  periksaBarisTabel,
  periksaHapusFase,
  periksaHapusProyek,
  periksaHapusTipeUnit,
  periksaKodeProyek,
  periksaSimpanFase,
  periksaSimpanSarpras,
  periksaSimpanTipeUnit,
  periksaTambahProyek,
  periksaUbahLegalitas,
  periksaUbahLokasi,
  periksaUnit,
  uraikanPin,
} from "./master";

describe("periksaKodeProyek", () => {
  it("kode huruf-angka 2–8 karakter lolos", () => {
    assert.equal(periksaKodeProyek("NT2", false), null);
    assert.equal(periksaKodeProyek("GRIYA12", false), null);
  });

  it("terlalu pendek atau terlalu panjang ditolak", () => {
    assert.ok(periksaKodeProyek("A", false));
    assert.ok(periksaKodeProyek("ABCDEFGHI", false));
  });

  it("spasi dan tanda baca ditolak — kode ini masuk ke kode unit dan URL", () => {
    assert.ok(periksaKodeProyek("NT 2", false));
    assert.ok(periksaKodeProyek("NT-2", false));
  });

  it("huruf kecil ditolak — kode disimpan huruf besar", () => {
    assert.ok(periksaKodeProyek("nt2", false));
  });

  it("kode yang sudah dipakai ditolak", () => {
    const g = periksaKodeProyek("NT2", true);
    assert.ok(g && /sudah dipakai/.test(g), g ?? "(lolos)");
  });
});

describe("periksaTambahProyek", () => {
  const m = { kode: "NT5", nama: "Nano Town 5", lokasi: "Bogor", status: "Perencanaan" };

  it("proyek lengkap lolos", () => {
    assert.equal(periksaTambahProyek(m, { kodeBentrok: false }), null);
  });

  it("status karangan ditolak", () => {
    assert.ok(periksaTambahProyek({ ...m, status: "Rencana Saja" }, { kodeBentrok: false }));
  });

  it("nama kosong ditolak", () => {
    assert.ok(periksaTambahProyek({ ...m, nama: " " }, { kodeBentrok: false }));
  });
});

describe("periksaHapusProyek", () => {
  const kosong = { jumlahUnit: 0, jumlahSarpras: 0, jumlahPengeluaran: 0, nama: "NT5" };

  it("proyek kosong boleh dihapus", () => {
    assert.equal(periksaHapusProyek({ id: "p1" }, kosong), null);
  });

  it("proyek yang sudah berisi ditolak", () => {
    const g = periksaHapusProyek({ id: "p1" }, { ...kosong, jumlahUnit: 12 });
    assert.ok(g && /12 unit/.test(g), g ?? "(lolos)");
  });

  it("pengeluaran saja pun sudah cukup untuk menolak", () => {
    assert.ok(periksaHapusProyek({ id: "p1" }, { ...kosong, jumlahPengeluaran: 1 }));
  });
});

describe("periksaSimpanFase & periksaAturJumlahFase", () => {
  it("fase baru dengan kode unik lolos", () => {
    assert.equal(
      periksaSimpanFase({ id: null, projectId: "p1", kode: "F1", nama: "Fase 1" }, { kodeBentrok: false }),
      null,
    );
  });

  it("kode fase yang sudah ada di proyek itu ditolak", () => {
    assert.ok(
      periksaSimpanFase({ id: null, projectId: "p1", kode: "F1", nama: "Fase 1" }, { kodeBentrok: true }),
    );
  });

  it("membuat fase massal dalam batas lolos", () => {
    assert.equal(periksaAturJumlahFase({ projectId: "p1", jumlah: MAKS_FASE }), null);
  });

  it("melebihi batas ditolak — angka besar hampir selalu salah ketik", () => {
    const g = periksaAturJumlahFase({ projectId: "p1", jumlah: MAKS_FASE + 1 });
    assert.ok(g && /maksimal 50/.test(g), g ?? "(lolos)");
  });

  it("jumlah nol ditolak", () => {
    assert.ok(periksaAturJumlahFase({ projectId: "p1", jumlah: 0 }));
  });
});

describe("periksaHapusFase", () => {
  it("fase kosong boleh dihapus", () => {
    assert.equal(periksaHapusFase({ id: "f1" }, { jumlahUnit: 0, kode: "F1" }), null);
  });

  it("fase berisi unit ditolak", () => {
    assert.ok(periksaHapusFase({ id: "f1" }, { jumlahUnit: 6, kode: "F1" }));
  });
});

describe("uraikanPin", () => {
  it("membaca lintang dan bujur", () => {
    assert.deepEqual(uraikanPin("-6.4021, 106.7532"), { lat: -6.4021, lng: 106.7532 });
  });

  it("tanpa spasi juga terbaca", () => {
    assert.deepEqual(uraikanPin("-6.4,106.7"), { lat: -6.4, lng: 106.7 });
  });

  it("satu angka saja ditolak", () => {
    assert.equal(typeof uraikanPin("-6.4021"), "string");
  });

  it("teks yang bukan angka ditolak", () => {
    assert.equal(typeof uraikanPin("dekat pasar, sebelah masjid"), "string");
  });

  it("pin kosong pada ubah lokasi diterima — berarti tidak diubah", () => {
    assert.equal(periksaUbahLokasi({ id: "p1", pin: null }), null);
    assert.equal(periksaUbahLokasi({ id: "p1", pin: "  " }), null);
  });
});

describe("periksaUbahLegalitas", () => {
  const baris = { nib: "123", jenisHak: "Hak Milik (HM)", nomorHak: "412", luas: 1200 };

  it("legalitas lengkap lolos", () => {
    assert.equal(periksaUbahLegalitas({ projectId: "p1", baris: [baris] }), null);
  });

  it("tanpa NIB sama sekali ditolak", () => {
    assert.ok(periksaUbahLegalitas({ projectId: "p1", baris: [] }));
  });

  it("jenis hak karangan ditolak, dan pesannya menyebut NIB-nya", () => {
    const g = periksaUbahLegalitas({
      projectId: "p1",
      baris: [{ ...baris, jenisHak: "Hak Warisan" }],
    });
    assert.ok(g && /NIB 123/.test(g), g ?? "(lolos)");
  });

  it("nomor hak kosong ditolak — barisnya tak bisa dicek ke BPN", () => {
    const g = periksaUbahLegalitas({ projectId: "p1", baris: [{ ...baris, nomorHak: " " }] });
    assert.ok(g && /Nomor hak/.test(g), g ?? "(lolos)");
  });
});

describe("periksaSimpanTipeUnit", () => {
  const m = { id: null, projectId: "p1", kode: "T45", nama: "Tipe 45", luasBangunan: 45, luasTanah: 90 };

  it("tipe lengkap lolos", () => {
    assert.equal(periksaSimpanTipeUnit(m, { kodeBentrok: false }), null);
  });

  it("luas bangunan nol ditolak — RAB acuannya akan nol", () => {
    assert.ok(periksaSimpanTipeUnit({ ...m, luasBangunan: 0 }, { kodeBentrok: false }));
  });

  it("luas tanah nol ditolak", () => {
    assert.ok(periksaSimpanTipeUnit({ ...m, luasTanah: 0 }, { kodeBentrok: false }));
  });

  it("kode tipe bentrok di proyek yang sama ditolak", () => {
    assert.ok(periksaSimpanTipeUnit(m, { kodeBentrok: true }));
  });
});

describe("periksaHapusTipeUnit", () => {
  it("tipe yang belum dipakai boleh dihapus", () => {
    assert.equal(periksaHapusTipeUnit({ id: "t1" }, { jumlahUnit: 0, kode: "T45" }), null);
  });

  it("tipe yang dipakai unit ditolak", () => {
    assert.ok(periksaHapusTipeUnit({ id: "t1" }, { jumlahUnit: 8, kode: "T45" }));
  });
});

describe("periksaUnit", () => {
  const m = {
    projectId: "p1", phaseId: "f1", unitTypeId: "t1",
    nomor: 3, luasTanah: 90, statusJual: "Tersedia", hargaJual: 500_000_000,
  };
  const konteks = { kodeBentrok: false, kodeUnit: "F1-3" };

  it("unit lengkap lolos", () => {
    assert.equal(periksaUnit(m, konteks), null);
  });

  it("nomor unit nol ditolak — nomor ikut membentuk kode unit", () => {
    assert.ok(periksaUnit({ ...m, nomor: 0 }, konteks));
  });

  it("harga jual nol diterima — harga bisa ditetapkan belakangan", () => {
    assert.equal(periksaUnit({ ...m, hargaJual: 0 }, konteks), null);
  });

  it("status jual karangan ditolak", () => {
    assert.ok(periksaUnit({ ...m, statusJual: "Hampir Akad" }, konteks));
  });

  it("kode unit bentrok ditolak dengan menyebut kodenya", () => {
    const g = periksaUnit(m, { kodeBentrok: true, kodeUnit: "F1-3" });
    assert.ok(g && /F1-3/.test(g), g ?? "(lolos)");
  });
});

describe("periksaSimpanSarpras", () => {
  const m = {
    id: null, projectId: "p1", kode: "JL01", nama: "Jalan Lingkungan",
    jenis: "Prasarana", volume: "3.400 m²", progress: 40,
  };

  it("sarpras lengkap lolos", () => {
    assert.equal(periksaSimpanSarpras(m, { kodeBentrok: false }), null);
  });

  it("jenis di luar Sarana/Prasarana ditolak", () => {
    assert.ok(periksaSimpanSarpras({ ...m, jenis: "Fasilitas" }, { kodeBentrok: false }));
  });

  it("progres di luar 0–100 ditolak", () => {
    assert.ok(periksaSimpanSarpras({ ...m, progress: 120 }, { kodeBentrok: false }));
  });

  it("kode bentrok ditolak", () => {
    assert.ok(periksaSimpanSarpras(m, { kodeBentrok: true }));
  });
});

describe("periksaBarisTabel", () => {
  const m = { id: "b1", uraian: "Pembesian", satuan: "kg", volume: 1200, hargaSatuan: 18_500 };

  it("baris lengkap lolos", () => {
    assert.equal(periksaBarisTabel(m), null);
  });

  it("volume dan harga nol diterima — nilainya menyusul", () => {
    assert.equal(periksaBarisTabel({ ...m, volume: 0, hargaSatuan: 0 }), null);
  });

  it("volume negatif ditolak", () => {
    assert.ok(periksaBarisTabel({ ...m, volume: -1 }));
  });

  it("uraian kosong ditolak", () => {
    assert.ok(periksaBarisTabel({ ...m, uraian: "" }));
  });
});
