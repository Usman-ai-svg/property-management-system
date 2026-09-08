import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  periksaHapusKontrak,
  periksaHapusPembayaranKontrak,
  periksaHapusVendor,
  periksaIsiKontrak,
  periksaNilaiVo,
  periksaPembayaranKontrak,
  periksaTambahKontrak,
  periksaTambahVo,
  periksaTandaiSelesai,
  periksaUbahKontrak,
  periksaUbahStatusVo,
  periksaVendor,
  type MasukanKontrak,
  type MasukanVendor,
} from "./vendor";

const TAHUN = 2026;

const vendor: MasukanVendor = {
  nama: "CV Karya Mandiri",
  bidang: "Struktur",
  kontak: "0812-0000-0000",
  alamat: "Jl. Merdeka 10",
  sejak: 2019,
  status: "Aktif",
};

describe("periksaVendor", () => {
  it("vendor lengkap lolos", () => {
    assert.equal(periksaVendor(vendor, { namaBentrok: false }, TAHUN), null);
  });

  it("nama yang sudah terdaftar ditolak — penelusuran pembayaran lewat nama", () => {
    const g = periksaVendor(vendor, { namaBentrok: true }, TAHUN);
    assert.ok(g && /sudah terdaftar/.test(g), g ?? "(lolos)");
  });

  it("tahun mulai di masa depan ditolak", () => {
    assert.ok(periksaVendor({ ...vendor, sejak: TAHUN + 1 }, { namaBentrok: false }, TAHUN));
  });

  it("tahun mulai sebelum 1900 ditolak", () => {
    assert.ok(periksaVendor({ ...vendor, sejak: 1899 }, { namaBentrok: false }, TAHUN));
  });

  it("status karangan ditolak", () => {
    assert.ok(periksaVendor({ ...vendor, status: "Hampir Aktif" }, { namaBentrok: false }, TAHUN));
  });

  it("alamat kosong ditolak", () => {
    assert.ok(periksaVendor({ ...vendor, alamat: " " }, { namaBentrok: false }, TAHUN));
  });
});

describe("periksaHapusVendor", () => {
  it("vendor tanpa keterkaitan boleh dihapus", () => {
    assert.equal(periksaHapusVendor({ id: "v1" }, { jumlahKontrak: 0, nama: "CV A" }), null);
  });

  it("vendor yang masih punya kontrak ditolak", () => {
    const g = periksaHapusVendor({ id: "v1" }, { jumlahKontrak: 3, nama: "CV A" });
    assert.ok(g && /3 kontrak/.test(g), g ?? "(lolos)");
  });
});

const kontrak: MasukanKontrak = {
  jenis: "Unit",
  deskripsi: "Pekerjaan struktur 5 unit",
  jenisBiaya: "Upah Borongan",
  mulai: "2026-03-01",
  retensiPct: 5,
  jatuhTempoBln: 3,
  cakupan: ["u1", "u2"],
};

describe("periksaIsiKontrak", () => {
  it("isi kontrak yang wajar lolos", () => {
    assert.equal(periksaIsiKontrak(kontrak), null);
  });

  it("kontrak TANPA cakupan tetap sah — jadi biaya level proyek", () => {
    assert.equal(periksaIsiKontrak({ ...kontrak, cakupan: [] }), null);
  });

  it("retensi di atas 100% ditolak", () => {
    assert.ok(periksaIsiKontrak({ ...kontrak, retensiPct: 101 }));
  });

  it("retensi nol diterima — tidak semua SPK menahan retensi", () => {
    assert.equal(periksaIsiKontrak({ ...kontrak, retensiPct: 0 }), null);
  });

  it("masa pemeliharaan negatif ditolak", () => {
    assert.ok(periksaIsiKontrak({ ...kontrak, jatuhTempoBln: -1 }));
  });

  it('jenis biaya "Material" ditolak — SPK hanya untuk pekerjaan outsource', () => {
    assert.ok(periksaIsiKontrak({ ...kontrak, jenisBiaya: "Material" }));
  });

  it("tanggal mulai ngawur ditolak", () => {
    assert.ok(periksaIsiKontrak({ ...kontrak, mulai: "besok pagi" }));
  });

  it("tanpa tanggal mulai diterima — dianggap hari ini", () => {
    assert.equal(periksaIsiKontrak({ ...kontrak, mulai: null }), null);
  });
});

describe("periksaTambahKontrak", () => {
  const konteks = { statusVendor: "Aktif", namaVendor: "CV A", adaDokumen: true };

  it("kontrak lengkap dari vendor aktif lolos", () => {
    assert.equal(periksaTambahKontrak(kontrak, konteks), null);
  });

  it("vendor nonaktif ditolak", () => {
    const g = periksaTambahKontrak(kontrak, { ...konteks, statusVendor: "Nonaktif" });
    assert.ok(g && /Nonaktif/.test(g), g ?? "(lolos)");
  });

  it("tanpa dokumen SPK ditolak — tagihan tanpa perjanjian", () => {
    const g = periksaTambahKontrak(kontrak, { ...konteks, adaDokumen: false });
    assert.ok(g && /Dokumen SPK/.test(g), g ?? "(lolos)");
  });
});

describe("periksaUbahKontrak", () => {
  it("penyuntingan yang wajar lolos", () => {
    assert.equal(periksaUbahKontrak({ ...kontrak, id: "k1", tanggalSelesai: null }), null);
  });

  it("tanpa id ditolak", () => {
    assert.ok(periksaUbahKontrak({ ...kontrak, id: "", tanggalSelesai: null }));
  });

  it("tanggal selesai ngawur ditolak", () => {
    assert.ok(periksaUbahKontrak({ ...kontrak, id: "k1", tanggalSelesai: "entah" }));
  });
});

describe("periksaTandaiSelesai", () => {
  const konteks = { progres: 100, sudahSelesai: false };

  it("SPK 100% boleh ditandai selesai", () => {
    assert.equal(periksaTandaiSelesai({ id: "k1", tanggalSelesai: null }, konteks), null);
  });

  it("progres 99% ditolak — retensi tak boleh mulai berjalan lebih awal", () => {
    const g = periksaTandaiSelesai({ id: "k1", tanggalSelesai: null }, { ...konteks, progres: 99 });
    assert.ok(g && /99%/.test(g), g ?? "(lolos)");
  });

  it("progres nol ditolak", () => {
    assert.ok(periksaTandaiSelesai({ id: "k1", tanggalSelesai: null }, { ...konteks, progres: 0 }));
  });

  it("kontrak yang sudah selesai tidak ditandai dua kali", () => {
    const g = periksaTandaiSelesai({ id: "k1", tanggalSelesai: null }, { ...konteks, sudahSelesai: true });
    assert.ok(g && /sudah ditandai selesai/.test(g), g ?? "(lolos)");
  });
});

describe("periksaHapusKontrak", () => {
  it("kontrak tanpa pembayaran boleh dihapus", () => {
    assert.equal(periksaHapusKontrak({ id: "k1" }, { jumlahPembayaran: 0, kode: "SPK-1" }), null);
  });

  it("kontrak yang sudah dibayar ditolak", () => {
    assert.ok(periksaHapusKontrak({ id: "k1" }, { jumlahPembayaran: 2, kode: "SPK-1" }));
  });
});

describe("periksaTambahVo", () => {
  const konteks = { unitCakupan: ["u1", "u2"], sarprasCakupan: ["s1"] };
  const vo = {
    contractId: "k1",
    uraian: "Tambah kanopi",
    status: "Diajukan",
    items: [
      { unitId: "u1", infrastructureId: null, uraian: "Kanopi", satuan: "m2", volume: 12, hargaSatuan: 450_000 },
    ],
  };

  it("VO untuk objek dalam cakupan lolos", () => {
    assert.equal(periksaTambahVo(vo, konteks), null);
  });

  it("harga satuan NEGATIF diterima — itulah pekerjaan kurang", () => {
    assert.equal(
      periksaTambahVo({ ...vo, items: [{ ...vo.items[0], hargaSatuan: -450_000 }] }, konteks),
      null,
    );
  });

  it("harga satuan nol ditolak — tidak mengubah apa pun", () => {
    const g = periksaTambahVo({ ...vo, items: [{ ...vo.items[0], hargaSatuan: 0 }] }, konteks);
    assert.ok(g && /tidak boleh nol/.test(g), g ?? "(lolos)");
  });

  it("volume nol ditolak", () => {
    assert.ok(periksaTambahVo({ ...vo, items: [{ ...vo.items[0], volume: 0 }] }, konteks));
  });

  it("VO tanpa baris ditolak", () => {
    assert.ok(periksaTambahVo({ ...vo, items: [] }, konteks));
  });

  it("baris tanpa objek ditolak", () => {
    const g = periksaTambahVo(
      { ...vo, items: [{ ...vo.items[0], unitId: null, infrastructureId: null }] },
      konteks,
    );
    assert.ok(g && /harus memilih objek/.test(g), g ?? "(lolos)");
  });

  it("unit di luar cakupan kontrak ditolak", () => {
    const g = periksaTambahVo({ ...vo, items: [{ ...vo.items[0], unitId: "u9" }] }, konteks);
    assert.ok(g && /di luar cakupan/.test(g), g ?? "(lolos)");
  });

  it("sarpras di luar cakupan kontrak ditolak", () => {
    assert.ok(
      periksaTambahVo(
        { ...vo, items: [{ ...vo.items[0], unitId: null, infrastructureId: "s9" }] },
        konteks,
      ),
    );
  });
});

describe("periksaNilaiVo", () => {
  it("VO bernilai positif lolos", () => {
    assert.equal(periksaNilaiVo(5_400_000), null);
  });

  it("VO bernilai negatif lolos — pekerjaan kurang", () => {
    assert.equal(periksaNilaiVo(-5_400_000), null);
  });

  it("VO yang totalnya nol ditolak", () => {
    assert.ok(periksaNilaiVo(0));
  });
});

describe("periksaUbahStatusVo", () => {
  it("status sah lolos", () => {
    assert.equal(periksaUbahStatusVo({ id: "vo1", status: "Disetujui" }), null);
  });

  it("status karangan ditolak", () => {
    assert.ok(periksaUbahStatusVo({ id: "vo1", status: "Hampir Setuju" }));
  });
});

describe("periksaPembayaranKontrak", () => {
  const bayar = {
    contractId: "k1",
    nominal: 100_000_000,
    uraian: "Termin 1",
    metode: "Transfer",
    tanggal: null,
  };
  const konteks = { nilaiEfektif: 900_000_000, sudahTerbayar: 300_000_000 };

  it("termin dalam batas sisa lolos", () => {
    assert.equal(periksaPembayaranKontrak(bayar, konteks), null);
  });

  it("membayar tepat sisa lolos", () => {
    assert.equal(periksaPembayaranKontrak({ ...bayar, nominal: 600_000_000 }, konteks), null);
  });

  it("melebihi nilai kontrak ditolak", () => {
    const g = periksaPembayaranKontrak({ ...bayar, nominal: 600_000_001 }, konteks);
    assert.ok(g && /melebihi nilai kontrak/.test(g), g ?? "(lolos)");
  });

  it("VO disetujui menambah ruang bayar — pembanding memakai nilai efektif", () => {
    // Nilai awal 800jt + VO 100jt = 900jt efektif; 600jt masih muat.
    assert.equal(
      periksaPembayaranKontrak({ ...bayar, nominal: 600_000_000 }, { nilaiEfektif: 900_000_000, sudahTerbayar: 300_000_000 }),
      null,
    );
  });

  it("nominal nol ditolak", () => {
    assert.ok(periksaPembayaranKontrak({ ...bayar, nominal: 0 }, konteks));
  });

  it('metode "Hutang" ditolak', () => {
    assert.ok(periksaPembayaranKontrak({ ...bayar, metode: "Hutang" }, konteks));
  });
});

describe("periksaHapusPembayaranKontrak", () => {
  it("pembayaran kontrak boleh dihapus lewat modul Vendor", () => {
    assert.equal(periksaHapusPembayaranKontrak({ id: "e1" }, { contractId: "k1" }), null);
  });

  it("pengeluaran biasa ditolak lewat jalur ini", () => {
    assert.ok(periksaHapusPembayaranKontrak({ id: "e1" }, { contractId: null }));
  });
});
