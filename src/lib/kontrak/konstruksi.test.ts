import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  periksaImporBoqSpk,
  periksaResetOverrideBoq,
  periksaSimpanProgresBoqSpk,
  periksaTambahBarisBoqSpk,
  periksaUbahBarisBoqSpk,
  periksaUbahOverrideBoq,
} from "./boq-spk";
import { periksaSimpanOpname, periksaUbahProgresManual } from "./konstruksi";

// ---------------------------------------------------------------------------
// Progres manual (Konstruksi)
// ---------------------------------------------------------------------------

describe("periksaUbahProgresManual", () => {
  const konteks = { punyaBoq: false, sebutan: "unit" };

  it("progres dalam rentang pada objek tanpa BOQ lolos", () => {
    assert.equal(periksaUbahProgresManual({ id: "u1", progress: 45 }, konteks), null);
  });

  it("nol dan seratus keduanya sah", () => {
    assert.equal(periksaUbahProgresManual({ id: "u1", progress: 0 }, konteks), null);
    assert.equal(periksaUbahProgresManual({ id: "u1", progress: 100 }, konteks), null);
  });

  it("di luar rentang ditolak", () => {
    assert.ok(periksaUbahProgresManual({ id: "u1", progress: 101 }, konteks));
    assert.ok(periksaUbahProgresManual({ id: "u1", progress: -1 }, konteks));
  });

  it("objek yang sudah punya BOQ Master ditolak — angkanya akan tertulis ulang", () => {
    const g = periksaUbahProgresManual({ id: "u1", progress: 50 }, { ...konteks, punyaBoq: true });
    assert.ok(g && /BOQ Master/.test(g), g ?? "(lolos)");
  });

  it("sebutan objek ikut ke pesannya", () => {
    const g = periksaUbahProgresManual(
      { id: "s1", progress: 50 },
      { punyaBoq: true, sebutan: "item" },
    );
    assert.ok(g && /halaman item/.test(g), g ?? "(lolos)");
  });
});

describe("periksaSimpanOpname", () => {
  const nama = (id: string) => `baris ${id}`;

  it("kiriman lengkap dan masuk akal lolos", () => {
    assert.equal(
      periksaSimpanOpname(
        { objekId: "u1", baris: [{ id: "b1", persen: 40 }, { id: "b2", persen: 100 }] },
        { kirimanLengkap: true },
        nama,
      ),
      null,
    );
  });

  it("kiriman tak lengkap ditolak — id bisa berpasangan dengan nilai yang salah", () => {
    const g = periksaSimpanOpname(
      { objekId: "u1", baris: [{ id: "b1", persen: 40 }] },
      { kirimanLengkap: false },
      nama,
    );
    assert.ok(g && /tidak lengkap/.test(g), g ?? "(lolos)");
  });

  it("progres di luar rentang ditolak, dan pesannya menyebut barisnya", () => {
    const g = periksaSimpanOpname(
      { objekId: "u1", baris: [{ id: "b7", persen: 150 }] },
      { kirimanLengkap: true },
      nama,
    );
    assert.ok(g && /baris b7/.test(g), g ?? "(lolos)");
  });

  it("opname tanpa baris sama sekali lolos — tidak ada yang berubah", () => {
    assert.equal(
      periksaSimpanOpname({ objekId: "u1", baris: [] }, { kirimanLengkap: true }, nama),
      null,
    );
  });
});

// ---------------------------------------------------------------------------
// BOQ SPK
// ---------------------------------------------------------------------------

describe("periksaTambahBarisBoqSpk", () => {
  const baris = {
    contractId: "k1",
    grup: "Struktur",
    uraian: "Pembesian",
    satuan: "kg",
    volume: 1200,
    hargaSatuan: 18_500,
  };

  it("baris lengkap lolos", () => {
    assert.equal(periksaTambahBarisBoqSpk(baris), null);
  });

  it("tanpa kontrak ditolak", () => {
    assert.ok(periksaTambahBarisBoqSpk({ ...baris, contractId: "" }));
  });

  it("uraian kosong ditolak", () => {
    assert.ok(periksaTambahBarisBoqSpk({ ...baris, uraian: "  " }));
  });

  it("volume negatif ditolak", () => {
    assert.ok(periksaTambahBarisBoqSpk({ ...baris, volume: -1 }));
  });

  it("volume dan harga nol diterima — baris yang nilainya diisi belakangan", () => {
    assert.equal(periksaTambahBarisBoqSpk({ ...baris, volume: 0, hargaSatuan: 0 }), null);
  });
});

describe("periksaUbahBarisBoqSpk", () => {
  it("penyuntingan baris lolos", () => {
    assert.equal(
      periksaUbahBarisBoqSpk({
        id: "b1", grup: "Struktur", uraian: "Pembesian", satuan: "kg", volume: 1, hargaSatuan: 1,
      }),
      null,
    );
  });

  it("tanpa id ditolak", () => {
    assert.ok(
      periksaUbahBarisBoqSpk({
        id: "", grup: "Struktur", uraian: "Pembesian", satuan: "kg", volume: 1, hargaSatuan: 1,
      }),
    );
  });
});

describe("periksaUbahOverrideBoq", () => {
  const kosong = {
    boqItemId: "b1",
    objek: "unit:u1",
    uraian: null,
    satuan: null,
    volume: null,
    hargaSatuan: null,
  };

  it("override yang seluruhnya kosong lolos — berarti ikut template", () => {
    assert.equal(periksaUbahOverrideBoq(kosong), null);
  });

  it("override volume yang wajar lolos", () => {
    assert.equal(periksaUbahOverrideBoq({ ...kosong, volume: 15 }), null);
  });

  it("override volume negatif ditolak", () => {
    assert.ok(periksaUbahOverrideBoq({ ...kosong, volume: -3 }));
  });

  it("override uraian kosong ditolak — beda dari uraian yang tidak diisi", () => {
    assert.ok(periksaUbahOverrideBoq({ ...kosong, uraian: "   " }));
  });

  it("tanpa objek tujuan ditolak", () => {
    assert.ok(periksaUbahOverrideBoq({ ...kosong, objek: "" }));
  });
});

describe("periksaResetOverrideBoq", () => {
  it("reset dengan objek jelas lolos", () => {
    assert.equal(periksaResetOverrideBoq({ boqItemId: "b1", objek: "unit:u1" }), null);
  });

  it("tanpa objek ditolak", () => {
    assert.ok(periksaResetOverrideBoq({ boqItemId: "b1", objek: "" }));
  });
});

describe("periksaImporBoqSpk", () => {
  it("berkas berisi baris lolos", () => {
    assert.equal(
      periksaImporBoqSpk({ contractId: "k1" }, { adaBerkas: true, jumlahBaris: 12 }),
      null,
    );
  });

  it("tanpa berkas ditolak", () => {
    const g = periksaImporBoqSpk({ contractId: "k1" }, { adaBerkas: false, jumlahBaris: 0 });
    assert.ok(g && /Pilih berkas/.test(g), g ?? "(lolos)");
  });

  it("berkas terbaca tapi nol baris ditolak — biasanya kolomnya tak dikenali", () => {
    const g = periksaImporBoqSpk({ contractId: "k1" }, { adaBerkas: true, jumlahBaris: 0 });
    assert.ok(g && /Tidak ada baris/.test(g), g ?? "(lolos)");
  });
});

describe("periksaSimpanProgresBoqSpk", () => {
  const nama = (id: string) => `pekerjaan ${id}`;

  it("kiriman progres yang sah lolos", () => {
    assert.equal(
      periksaSimpanProgresBoqSpk(
        { contractId: "k1", objek: "unit:u1", baris: [{ id: "b1", persen: 60 }] },
        nama,
      ),
      null,
    );
  });

  it("progres di luar rentang ditolak dengan nama pekerjaannya", () => {
    const g = periksaSimpanProgresBoqSpk(
      { contractId: "k1", objek: "unit:u1", baris: [{ id: "b3", persen: -5 }] },
      nama,
    );
    assert.ok(g && /pekerjaan b3/.test(g), g ?? "(lolos)");
  });

  it("tanpa objek tujuan ditolak", () => {
    assert.ok(periksaSimpanProgresBoqSpk({ contractId: "k1", objek: "", baris: [] }, nama));
  });
});
