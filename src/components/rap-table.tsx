"use client";

import { Fragment, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import type { HasilAksi } from "@/lib/actions/guard";
import { rp } from "@/lib/format";
import { PORSI_LAIN_LAIN, isSubkon } from "@/lib/calc/boq";
import { ModalImpor } from "./impor";
import { totalBaris } from "@/lib/calc/boq";

/**
 * Tabel RAP dengan EMPAT kelompok tetap, sesuai kesepakatan:
 *
 *   I.   Material          — baris material (kategori Material)
 *   II.  Subkon            — baris subkon (kategori Subkon)
 *   III. Upah Tenaga Kerja — upah (volume OH × harga), satu baris
 *   IV.  Lain-lain Proyek  — 5% dari (Material + Subkon + Upah), TANPA sub-isian
 *
 * Tiap kelompok (kecuali Lain-lain) punya baris isiannya sendiri dan bisa
 * disunting seperti baris material. Subtotal tampil di kepala tiap kelompok,
 * dan TOTAL RAP di kaki. Struktur ini persis sama dengan rincian pada kartu
 * "Ringkasan RAB & RAP" supaya angka keduanya selalu konsisten.
 */

export interface BarisRapUI {
  id?: string;
  grup: string;
  kategori?: string | null;
  nama: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  keterangan?: string | null;
}

const sel = { fontSize: 11, padding: "3px 6px" } as const;

const jumlah = totalBaris;

const barisBaru = (kategori: "Material" | "Subkon"): BarisRapUI => ({
  grup: kategori, kategori, nama: `${kategori === "Subkon" ? "Pekerjaan subkon" : "Material"} baru`,
  satuan: "ls", volume: 1, hargaSatuan: 0, keterangan: "",
});

/** Pisahkan baris datar menjadi dua kelompok kategori. */
function pisah(baris: BarisRapUI[]): { material: BarisRapUI[]; subkon: BarisRapUI[] } {
  const material: BarisRapUI[] = [];
  const subkon: BarisRapUI[] = [];
  for (const b of baris) (isSubkon(b) ? subkon : material).push(b);
  return { material, subkon };
}

export function RapTable({
  judul,
  keterangan,
  baris,
  upahVolume,
  upahHarga,
  bolehHarga,
  bolehUbah,
  aksiSimpan,
  konteksImpor,
  sasaranImpor,
  idImpor,
  aksiImpor,
}: {
  judul: string;
  keterangan?: string;
  baris: BarisRapUI[];
  /** Upah tenaga kerja disatuankan OH (orang-hari): jumlah = volume × harga. */
  upahVolume: number;
  upahHarga: number;
  bolehHarga: boolean;
  bolehUbah: boolean;
  /** Menerima kelompok + upah sebagai JSON. */
  aksiSimpan: (dataJson: string) => Promise<HasilAksi>;
  konteksImpor: string;
  sasaranImpor: "unit" | "kerjaTambah" | "sarpras" | "tipeUnit";
  idImpor: string;
  aksiImpor: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
}) {
  const [sunting, setSunting] = useState(false);
  const [mat, setMat] = useState<BarisRapUI[]>([]);
  const [sub, setSub] = useState<BarisRapUI[]>([]);
  const [uVol, setUVol] = useState(upahVolume);
  const [uHrg, setUHrg] = useState(upahHarga);
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();

  if (!bolehHarga) {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{judul}</div>
        <div className="card" style={{ padding: 22, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
          RAP tidak ditampilkan untuk peran Anda.
        </div>
      </div>
    );
  }

  const asal = pisah(baris);
  const material = sunting ? mat : asal.material;
  const subkon = sunting ? sub : asal.subkon;
  const volUpah = sunting ? uVol : upahVolume;
  const hargaUpah = sunting ? uHrg : upahHarga;

  const totMaterial = jumlah(material);
  const totSubkon = jumlah(subkon);
  const totUpah = volUpah * hargaUpah;
  const totLain = (totMaterial + totSubkon + totUpah) * PORSI_LAIN_LAIN;
  const totalRap = totMaterial + totSubkon + totUpah + totLain;

  const mulaiSunting = () => {
    setMat(asal.material.map((r) => ({ ...r })));
    setSub(asal.subkon.map((r) => ({ ...r })));
    setUVol(upahVolume);
    setUHrg(upahHarga);
    setGalat(null);
    setSunting(true);
  };

  const batal = () => {
    setSunting(false);
    setGalat(null);
  };

  const simpan = () =>
    mulai(async () => {
      const hasil = await aksiSimpan(
        JSON.stringify({
          kelompok: [
            { nama: "Material", kategori: "Material", items: mat },
            { nama: "Subkon", kategori: "Subkon", items: sub },
          ],
          upahVolume: uVol,
          upahHarga: uHrg,
        }),
      );
      if (hasil.ok) {
        setSunting(false);
        setGalat(null);
      } else {
        setGalat(hasil.error);
      }
    });

  const setter = (kat: "Material" | "Subkon") => (kat === "Subkon" ? setSub : setMat);
  const ubahItem = (kat: "Material" | "Subkon", i: number, field: keyof BarisRapUI, nilai: string | number) =>
    setter(kat)((rows) => rows.map((r, x) => (x === i ? { ...r, [field]: nilai } : r)));
  const tambahItem = (kat: "Material" | "Subkon") =>
    setter(kat)((rows) => [...rows, barisBaru(kat)]);
  const hapusItem = (kat: "Material" | "Subkon", i: number) =>
    setter(kat)((rows) => rows.filter((_, x) => x !== i));

  const isian = (
    rows: BarisRapUI[], kat: "Material" | "Subkon", i: number, field: keyof BarisRapUI, lebar: number, angka?: boolean,
  ) => (
    <input
      className="inp"
      type={angka ? "number" : "text"}
      value={String(rows[i][field] ?? "")}
      onChange={(e) => ubahItem(kat, i, field, angka ? Number(e.target.value) || 0 : e.target.value)}
      style={{ ...sel, width: lebar, textAlign: angka ? "right" : "left" }}
    />
  );

  const kolomTotal = 7; // No, Uraian, Volume, Sat, Harga, Jumlah, Keterangan

  /** Satu kelompok kategori (Material / Subkon) beserta baris dan tombol. */
  const renderSeksi = (
    romawi: string, judulSeksi: string, kat: "Material" | "Subkon", rows: BarisRapUI[], subtotal: number,
  ) => (
    <Fragment key={kat}>
      <tr style={{ background: "var(--rona-teal)" }}>
        <td style={{ fontWeight: 700 }}>{romawi}</td>
        <td colSpan={4} style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10.5, letterSpacing: ".04em" }}>
          {judulSeksi}
        </td>
        <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(subtotal)}</td>
        <td />
        {sunting && <td />}
      </tr>

      {rows.map((it, i) => (
        <tr key={it.id ?? `${kat}-${i}`}>
          <td style={{ color: "var(--muted)" }}>{i + 1}</td>
          <td>{sunting ? isian(rows, kat, i, "nama", 200) : it.nama}</td>
          <td style={{ textAlign: "right" }}>
            {sunting
              ? isian(rows, kat, i, "volume", 64, true)
              : it.volume.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td>{sunting ? isian(rows, kat, i, "satuan", 54) : it.satuan}</td>
          <td style={{ textAlign: "right" }}>
            {sunting ? isian(rows, kat, i, "hargaSatuan", 96, true) : rp(it.hargaSatuan)}
          </td>
          <td className="num" style={{ textAlign: "right" }}>{rp(it.volume * it.hargaSatuan)}</td>
          <td style={{ whiteSpace: "normal", color: "var(--muted)" }}>
            {sunting ? isian(rows, kat, i, "keterangan", 140) : it.keterangan || "—"}
          </td>
          {sunting && (
            <td>
              <button
                type="button"
                title="Hapus baris"
                onClick={() => hapusItem(kat, i)}
                style={{ color: "var(--red)", cursor: "pointer", fontWeight: 700, background: "none", border: "none", fontSize: 15, padding: 0 }}
              >
                ×
              </button>
            </td>
          )}
        </tr>
      ))}

      {sunting && (
        <tr>
          <td />
          <td colSpan={kolomTotal}>
            <button
              type="button"
              onClick={() => tambahItem(kat)}
              style={{ color: "var(--teal)", cursor: "pointer", fontSize: 11, fontWeight: 600, background: "none", border: "none", padding: 0, fontFamily: "inherit" }}
            >
              + Tambah baris {judulSeksi}
            </button>
          </td>
        </tr>
      )}
    </Fragment>
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div className="eyebrow">{judul}</div>
        {bolehUbah && (
          <div style={{ display: "flex", gap: 6 }}>
            <ModalImpor
              jenis="RAP"
              konteks={konteksImpor}
              kolom="Kelompok · Material · Satuan · Volume · Harga · Keterangan · Upah Tenaga Kerja"
              sasaran={sasaranImpor}
              id={idImpor}
              aksiImpor={aksiImpor}
            />
            {sunting && (
              <button type="button" className="btn-garis" style={{ color: "var(--muted)" }} onClick={batal}>
                Batal
              </button>
            )}
            <button
              type="button"
              className={sunting ? "btn-utama aktif" : "btn-utama"}
              onClick={sunting ? simpan : mulaiSunting}
              disabled={menyimpan}
            >
              {menyimpan ? "Menyimpan…" : sunting ? "Simpan" : "Ubah"}
            </button>
          </div>
        )}
      </div>

      {galat && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8,
            padding: "9px 12px", borderRadius: 9, background: "var(--rona-merah)",
            color: "var(--red)", fontSize: 12.5, lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {galat}
        </div>
      )}

      <div className="card tablewrap" style={{ maxHeight: 520, overflowY: "auto" }}>
        {keterangan && (
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: 11.5, color: "var(--muted)" }}>
            {keterangan}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>No.</th>
              <th style={{ minWidth: 210 }}>Uraian</th>
              <th style={{ textAlign: "right" }}>Volume</th>
              <th>Sat</th>
              <th style={{ textAlign: "right" }}>Harga</th>
              <th style={{ textAlign: "right" }}>Jumlah Harga</th>
              <th style={{ minWidth: 150 }}>Keterangan</th>
              {sunting && <th style={{ width: 34 }} />}
            </tr>
          </thead>
          <tbody>
            {renderSeksi("I", "Material", "Material", material, totMaterial)}
            {renderSeksi("II", "Subkon", "Subkon", subkon, totSubkon)}

            {/* III. Upah Tenaga Kerja — satu baris (volume OH × harga) */}
            <tr style={{ background: "var(--rona-teal)" }}>
              <td style={{ fontWeight: 700 }}>III</td>
              <td colSpan={4} style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10.5, letterSpacing: ".04em" }}>
                Upah Tenaga Kerja
              </td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(totUpah)}</td>
              <td />
              {sunting && <td />}
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>1</td>
              <td>Tenaga kerja (borongan / harian)</td>
              <td style={{ textAlign: "right" }}>
                {sunting ? (
                  <input
                    className="inp"
                    type="number"
                    value={uVol}
                    onChange={(e) => setUVol(Number(e.target.value) || 0)}
                    style={{ ...sel, width: 64, textAlign: "right" }}
                  />
                ) : (
                  volUpah.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                )}
              </td>
              <td>OH</td>
              <td style={{ textAlign: "right" }}>
                {sunting ? (
                  <input
                    className="inp"
                    type="number"
                    value={uHrg}
                    onChange={(e) => setUHrg(Number(e.target.value) || 0)}
                    style={{ ...sel, width: 96, textAlign: "right" }}
                  />
                ) : (
                  rp(hargaUpah)
                )}
              </td>
              <td className="num" style={{ textAlign: "right" }}>{rp(totUpah)}</td>
              <td style={{ color: "var(--muted)" }}>Satuan OH (orang-hari)</td>
              {sunting && <td />}
            </tr>

            {/* IV. Lain-lain Proyek — 5%, tanpa sub-isian */}
            <tr style={{ background: "var(--rona-teal)" }}>
              <td style={{ fontWeight: 700 }}>IV</td>
              <td colSpan={4} style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10.5, letterSpacing: ".04em" }}>
                Lain-lain Proyek (5%)
              </td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(totLain)}</td>
              <td style={{ color: "var(--muted)", fontSize: 10.5 }}>5% dari Material + Subkon + Upah</td>
              {sunting && <td />}
            </tr>

            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)", background: "var(--rona-baris)" }}>
              <td colSpan={5}>TOTAL RAP</td>
              <td className="num" style={{ textAlign: "right", color: "var(--brass)" }}>{rp(totalRap)}</td>
              <td />
              {sunting && <td />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
