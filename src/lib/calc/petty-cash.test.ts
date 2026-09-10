import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  bolehTransisi,
  cariTransisi,
  laporanTerkunci,
  saldoDana,
  totalLaporan,
  transisiDari,
  transisiUntuk,
} from "./petty-cash";
import { JABATAN_PEMEGANG_PETTY } from "@/lib/domain/jabatan";

describe("saldoDana", () => {
  it("saldo = Σ topUp − Σ pengeluaran", () => {
    const saldo = saldoDana(
      [{ nominal: 2_000_000 }, { nominal: 1_500_000 }],
      [{ total: 800_000 }, { total: 300_000 }],
    );
    assert.equal(saldo, 2_400_000);
  });

  it("boleh negatif — pemegang menalangi lebih dari kas di tangan", () => {
    const saldo = saldoDana([{ nominal: 1_000_000 }], [{ total: 1_250_000 }]);
    assert.equal(saldo, -250_000);
  });

  it("tanpa mutasi apa pun saldonya nol", () => {
    assert.equal(saldoDana([], []), 0);
  });
});

describe("totalLaporan", () => {
  it("menjumlah total tiap pengeluaran", () => {
    assert.equal(totalLaporan([{ total: 100 }, { total: 250 }]), 350);
  });
});

describe("transisi status", () => {
  it("Draft hanya bisa diajukan oleh pemegang", () => {
    const t = transisiDari("Draft");
    assert.equal(t.length, 1);
    assert.equal(t[0]?.ke, "Diajukan");
    assert.equal(t[0]?.olehPemegang, true);
  });

  it("Diajukan bisa diverifikasi atau dikembalikan QS", () => {
    const t = transisiDari("Diajukan").map((x) => x.ke).sort();
    assert.deepEqual(t, ["DiverifikasiQS", "Draft"]);
  });

  it("reimburse menuntut jabatan keuangan DAN izin ubah keuangan", () => {
    const t = cariTransisi("Disetujui", "Direimburse");
    assert.ok(t);
    assert.equal(t?.perluIzinKeuangan, true);
    assert.deepEqual([...(t?.jabatan ?? [])], ["finance_tax", "staff_administration"]);
  });

  it("transisi yang melompati tahap tidak sah", () => {
    assert.equal(cariTransisi("Draft", "Disetujui"), undefined);
    assert.equal(cariTransisi("Direimburse", "Draft"), undefined);
  });

  it("baris terkunci di semua status kecuali Draft", () => {
    assert.equal(laporanTerkunci("Draft"), false);
    assert.equal(laporanTerkunci("Diajukan"), true);
    assert.equal(laporanTerkunci("Direimburse"), true);
  });
});

describe("bolehTransisi — dua aturan lintas transisi", () => {
  const ajukan = cariTransisi("Draft", "Diajukan")!;
  const verifikasi = cariTransisi("Diajukan", "DiverifikasiQS")!;
  const setujui = cariTransisi("DiverifikasiQS", "Disetujui")!;
  const reimburse = cariTransisi("Disetujui", "Direimburse")!;

  const pelaku = (jabatan: string[], pemegangDana = false, bolehKeuangan = false) => ({
    jabatan, pemegangDana, bolehKeuangan,
  });

  it("hanya pemegang dana yang boleh mengajukan", () => {
    assert.equal(bolehTransisi(ajukan, pelaku(["logistic_staff"], true)), true);
    assert.equal(bolehTransisi(ajukan, pelaku(["logistic_staff"])), false);
    // Bahkan director tidak bisa mengajukan atas nama orang lain: saldo petty
    // cash adalah uang fisik di tangan satu orang.
    assert.equal(bolehTransisi(ajukan, pelaku(["director"])), false);
  });

  it("manager proyek boleh memegang dana, bukan cuma logistic staff", () => {
    assert.equal(bolehTransisi(ajukan, pelaku(["manager_proyek"], true)), true);
    assert.deepEqual([...JABATAN_PEMEGANG_PETTY], ["logistic_staff", "manager_proyek"]);
  });

  it("PEMEGANG DANA TIDAK MEMERIKSA PENGAJUANNYA SENDIRI", () => {
    // Gerbang yang paling penting di seluruh alur ini. Kalau hilang, laporan
    // petty cash tinggal selembar catatan pribadi: satu orang mencatat,
    // mengajukan, memverifikasi, menyetujui, dan mencairkan uangnya sendiri.
    const pemegangYangJugaQs = pelaku(["logistic_staff", "quantity_surveyor_asst"], true);
    assert.equal(bolehTransisi(verifikasi, pemegangYangJugaQs), false);
    assert.equal(bolehTransisi(setujui, pemegangYangJugaQs), false);
    assert.equal(bolehTransisi(reimburse, pelaku(["finance_tax"], true, true)), false);
  });

  it("director menembus batas jabatan — laporan tersangkut tetap bisa didorong", () => {
    assert.equal(bolehTransisi(verifikasi, pelaku(["director"])), true);
    assert.equal(bolehTransisi(setujui, pelaku(["director"])), true);
    assert.equal(bolehTransisi(reimburse, pelaku(["director"])), true);
  });

  it("penembusan director TIDAK berlaku atas dana yang ia pegang sendiri", () => {
    // Keputusan Usman: aturan (a) menang untuk laporan orang lain, aturan (b)
    // tetap mengikat untuk dana sendiri. Diperiksa lebih dulu, jadi tidak bisa
    // dilangkahi.
    const directorPemegang = pelaku(["director"], true);
    assert.equal(bolehTransisi(verifikasi, directorPemegang), false);
    assert.equal(bolehTransisi(setujui, directorPemegang), false);
    assert.equal(bolehTransisi(reimburse, directorPemegang), false);
    // ...tapi ia tetap boleh mengajukan dananya sendiri.
    assert.equal(bolehTransisi(ajukan, directorPemegang), true);
  });

  it("verifikasi hanya untuk QS asst dan head of operation", () => {
    assert.equal(bolehTransisi(verifikasi, pelaku(["quantity_surveyor_asst"])), true);
    assert.equal(bolehTransisi(verifikasi, pelaku(["head_of_operation"])), true);
    assert.equal(bolehTransisi(verifikasi, pelaku(["manager_proyek"])), false);
    assert.equal(bolehTransisi(verifikasi, pelaku(["sales_marketing"])), false);
  });

  it("persetujuan cuma head of operation, bukan verifikatornya", () => {
    // Yang memverifikasi dan yang menyetujui sengaja bisa berbeda orang.
    assert.equal(bolehTransisi(setujui, pelaku(["quantity_surveyor_asst"])), false);
    assert.equal(bolehTransisi(setujui, pelaku(["head_of_operation"])), true);
  });

  it("reimburse menuntut jabatan keuangan DAN izin ubah keuangan", () => {
    assert.equal(bolehTransisi(reimburse, pelaku(["finance_tax"], false, true)), true);
    assert.equal(bolehTransisi(reimburse, pelaku(["finance_tax"], false, false)), false);
    assert.equal(bolehTransisi(reimburse, pelaku(["logistic_staff"], false, true)), false);
  });

  it("transisiUntuk menyaring dengan aturan yang sama", () => {
    // Tombol yang tampil di layar harus persis sama dengan yang diterima
    // server; dua salinan aturan berarti tombol yang ada tapi ditolak.
    const pemegang = transisiUntuk("Draft", pelaku(["logistic_staff"], true));
    assert.deepEqual(pemegang.map((t) => t.ke), ["Diajukan"]);
    assert.deepEqual(transisiUntuk("Draft", pelaku(["quantity_surveyor_asst"])), []);
  });
});
