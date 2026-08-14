"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah } from "@/components/form";
import { pct, rp, tanggal as fmtTanggal } from "@/lib/format";
import { hapusPembayaranJual, simpanPembayaranJual } from "./plan-real-actions";
import { Petunjuk } from "@/components/ui";

export interface PembayaranJual {
  id: string;
  tanggal: string;
  uraian: string;
  nominal: number;
}

export interface UnitPencairan {
  id: string;
  no: string;
  tipe: string;
  /** Plafon realisasi = harga dasar rencana (target penjualan) unit. */
  plafon: number;
  sudahCair: number;
  riwayat: PembayaranJual[];
}

/**
 * Pencairan pembayaran dari pembeli — TERPUSAT.
 *
 * Dulu tiap baris unit punya tombol "+ Cair" sendiri. Kini satu tombol "Catat
 * Pencairan" di kepala tabel: unit dipilih di dalam form, dan begitu dipilih
 * ringkasan plafon / terealisasi / sisa (beserta persentasenya) langsung tampil
 * sebagai konteks sebelum nominal diisi. Riwayat unit terpilih ikut ditampilkan.
 */
export function CatatPencairan({ units }: { units: UnitPencairan[] }) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");

  if (units.length === 0) return null;

  const u = units.find((x) => x.id === unitId) ?? units[0];
  const plafon = u.plafon;
  const cair = u.sudahCair;
  const sisa = plafon - cair;

  const ringkas: [string, string, string | null, string?][] = [
    ["Plafon realisasi", rp(plafon), null],
    ["Terealisasi", rp(cair), plafon ? pct(cair / plafon) : "0%", "var(--green)"],
    ["Sisa", rp(Math.max(sisa, 0)), plafon ? pct(Math.max(sisa, 0) / plafon) : "0%", sisa <= 0 ? "var(--green)" : "var(--amber)"],
  ];

  return (
    <FormModal
      judul="Catat Pencairan"
      keterangan="Pencairan pembayaran dari pembeli. Pilih unit, lalu isi nominal & tanggalnya."
      aksi={simpanPembayaranJual}
      labelSimpan="Catat"
      lebar={600}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Pencairan" />}
    >
      <input type="hidden" name="id" value="" />

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Unit<span style={{ color: "var(--red)" }}> *</span>
          </label>
          <select name="unitId" className="inp" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((x) => (
              <option key={x.id} value={x.id}>{x.no} · {x.tipe}</option>
            ))}
          </select>
        </div>
      </BarisField>

      {/* Ringkasan realisasi unit terpilih — konteks sebelum mengisi nominal. */}
      <div className="card" style={{ background: "var(--rona-panel)", padding: "8px 12px", marginBottom: 14 }}>
        {ringkas.map(([label, nilai, persen, warna], i) => (
          <div
            key={label}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
              fontSize: 12.5, padding: i === 0 ? "3px 0" : "5px 0 3px",
              borderTop: i > 0 ? "1px solid var(--garis-halus)" : undefined,
              marginTop: i > 0 ? 2 : 0,
            }}
          >
            <span style={{ color: "var(--muted)" }}>{label}</span>
            <span>
              <span className="num" style={{ fontWeight: 600, color: warna }}>{nilai}</span>
              {persen && <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: 11.5 }}>· {persen}</span>}
            </span>
          </div>
        ))}
      </div>

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" petunjuk="opsional — mis. Pencairan KPR tahap 1" />
      </BarisField>
      <BarisField>
        <Field label="Nominal Pencairan" nama="nominal" tipe="number" satuan="Rp" wajib />
        <Field label="Tanggal" nama="tanggal" tipe="tanggal" />
      </BarisField>

      {u.riwayat.length > 0 && (
        <div className="card" style={{ padding: "10px 12px", background: "var(--rona-panel)", marginBottom: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Riwayat pencairan unit {u.no} · {u.riwayat.length} kali — sunting/hapus di sini
          </div>
          {u.riwayat.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                fontSize: 11.5, padding: "4px 0", color: "var(--muted)",
                borderTop: i > 0 ? "1px solid var(--garis-halus)" : undefined,
              }}
            >
              <span>Cair ke-{i + 1} · {fmtTanggal(r.tanggal)} · {r.uraian}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span className="num" style={{ color: "var(--text)", fontWeight: 600 }}>{rp(r.nominal)}</span>
                <UbahPembayaranJual bayar={r} labelUnit={`${u.no} · cair ke-${i + 1}`} />
                <HapusPembayaranJual id={r.id} uraian={`pencairan ke-${i + 1} unit ${u.no}`} />
              </span>
            </div>
          ))}
        </div>
      )}

      <Petunjuk>
        Pencairan boleh dicatat sebelum akad — booking fee biasanya dibayar lebih dulu.
        Bila totalnya melampaui plafon, aplikasi tetap menyimpannya tetapi memberi tahu,
        karena bisa jadi memang ada biaya tambahan.
      </Petunjuk>
    </FormModal>
  );
}

export function UbahPembayaranJual({
  bayar,
  labelUnit,
}: {
  bayar: PembayaranJual;
  labelUnit: string;
}) {
  return (
    <FormModal
      judul={`Ubah Pencairan · Unit ${labelUnit}`}
      aksi={simpanPembayaranJual}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah pencairan ${bayar.uraian}`} />}
    >
      <input type="hidden" name="id" value={bayar.id} />
      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" nilai={bayar.uraian} wajib />
      </BarisField>
      <BarisField>
        <Field label="Nominal" nama="nominal" nilai={bayar.nominal} tipe="number" satuan="Rp" wajib />
        <Field label="Tanggal" nama="tanggal" nilai={bayar.tanggal} tipe="tanggal" />
      </BarisField>
    </FormModal>
  );
}

export function HapusPembayaranJual({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusPembayaranJual} id={id} nama={`pencairan ${uraian}`} />;
}
