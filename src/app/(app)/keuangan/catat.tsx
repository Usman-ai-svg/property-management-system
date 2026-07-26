"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolTambah } from "@/components/form";
import { bagiRata } from "@/lib/calc/keuangan";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";
import { rp } from "@/lib/format";
import { catatPengeluaran } from "./actions";

type Sasaran = "proyek" | "unit" | "sarpras";

export function CatatPengeluaran({
  proyek,
}: {
  proyek: {
    id: string;
    nama: string;
    units: { id: string; label: string }[];
    sarpras: { id: string; label: string }[];
  }[];
}) {
  const [projectId, setProjectId] = useState(proyek[0]?.id ?? "");
  const [sasaran, setSasaran] = useState<Sasaran>("proyek");
  const [unitDipilih, setUnitDipilih] = useState<string[]>([]);
  const [sarprasId, setSarprasId] = useState("");
  const [total, setTotal] = useState("");

  const aktif = proyek.find((p) => p.id === projectId);
  const units = aktif?.units ?? [];
  const sarpras = aktif?.sarpras ?? [];

  const gantiProyek = (id: string) => {
    setProjectId(id);
    // Unit dan sarpras dari proyek lama tidak sah untuk proyek yang baru.
    setUnitDipilih([]);
    setSarprasId("");
  };

  const toggleUnit = (id: string) =>
    setUnitDipilih((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const nominal = Number(total) || 0;
  const bagian = sasaran === "unit" && unitDipilih.length > 1
    ? bagiRata(nominal, unitDipilih.length)
    : [];

  if (proyek.length === 0) return null;

  return (
    <FormModal
      judul="Catat Pengeluaran"
      keterangan="Pos HPP ditentukan otomatis dari peruntukannya."
      aksi={catatPengeluaran}
      labelSimpan="Catat"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Pengeluaran" />}
    >
      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Proyek <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select
            name="projectId"
            className="inp"
            value={projectId}
            onChange={(e) => gantiProyek(e.target.value)}
            required
          >
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
        <Field label="Peruntukan" nama="peruntukan" nilai={PERUNTUKAN_BIAYA[0]} pilihan={PERUNTUKAN_BIAYA} />
      </BarisField>

      <BarisField>
        <Field label="Jenis Biaya" nama="jenis" nilai={JENIS_BIAYA[0]} pilihan={JENIS_BIAYA} />
        <Field label="Metode" nama="metode" nilai={METODE_BAYAR[0]} pilihan={METODE_BAYAR} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" wajib petunjuk="mis. Termin 2 borongan struktur F1" />
      </BarisField>

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Total <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="inp"
              type="number"
              name="total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              required
              min={1}
              style={{ paddingRight: 34 }}
            />
            <span
              style={{
                position: "absolute", right: 10, top: 9,
                fontSize: 11.5, color: "var(--muted)", pointerEvents: "none",
              }}
            >
              Rp
            </span>
          </div>
        </div>
        <Field label="Status Bayar" nama="status" nilai="Lunas" pilihan={STATUS_BAYAR} />
      </BarisField>

      {/* ---------- pembebanan ---------- */}
      <input type="hidden" name="infrastructureId" value={sasaran === "sarpras" ? sarprasId : ""} />
      {sasaran === "unit" &&
        unitDipilih.map((id) => <input key={id} type="hidden" name="unitId" value={id} />)}

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Dibebankan ke
          </label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {(
              [
                ["proyek", "Level proyek"],
                ["unit", `Unit${units.length ? ` (${units.length})` : ""}`],
                ["sarpras", `Sarana & Prasarana${sarpras.length ? ` (${sarpras.length})` : ""}`],
              ] as [Sasaran, string][]
            ).map(([nilai, label]) => (
              <button
                key={nilai}
                type="button"
                className={sasaran === nilai ? "pill active" : "pill"}
                onClick={() => setSasaran(nilai)}
              >
                {label}
              </button>
            ))}
          </div>

          {sasaran === "proyek" && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
              Biaya yang tidak menempel pada unit maupun sarpras — perijinan dan
              pengolahan lahan.
            </div>
          )}

          {sasaran === "unit" && (
            <>
              <div
                style={{
                  maxHeight: 190, overflowY: "auto", border: "1px solid var(--line)",
                  borderRadius: 9, padding: "8px 10px",
                }}
              >
                {units.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    Proyek ini belum punya unit.
                  </div>
                ) : (
                  units.map((u) => (
                    <label
                      key={u.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 12, padding: "3px 0", cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={unitDipilih.includes(u.id)}
                        onChange={() => toggleUnit(u.id)}
                      />
                      {u.label}
                    </label>
                  ))
                )}
              </div>

              <div
                style={{
                  display: "flex", justifyContent: "space-between", gap: 10,
                  marginTop: 6, flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {unitDipilih.length} unit dipilih
                </span>
                <span style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setUnitDipilih(units.map((u) => u.id))}
                    style={tautan}
                  >
                    Pilih semua
                  </button>
                  <button type="button" onClick={() => setUnitDipilih([])} style={tautan}>
                    Kosongkan
                  </button>
                </span>
              </div>

              {unitDipilih.length > 1 && (
                <div
                  style={{
                    marginTop: 8, padding: "9px 12px", borderRadius: 9,
                    background: "#e8f5ef", fontSize: 11.5, color: "var(--teal)", lineHeight: 1.6,
                  }}
                >
                  Akan tersimpan sebagai <b>{unitDipilih.length} baris</b>, satu per unit.
                  {nominal > 0 && (
                    <>
                      {" "}Tiap unit dibebani <b>{rp(bagian[bagian.length - 1])}</b>
                      {bagian[0] !== bagian[bagian.length - 1] && (
                        <> — kecuali unit pertama {rp(bagian[0])}, menampung sisa pembagian</>
                      )}
                      , jumlahnya persis {rp(nominal)}.
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {sasaran === "sarpras" && (
            <>
              <select
                className="inp"
                value={sarprasId}
                onChange={(e) => setSarprasId(e.target.value)}
              >
                <option value="">— pilih item —</option>
                {sarpras.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                Sarpras dibebani satu item per transaksi. Bila satu pembayaran mencakup
                beberapa item, catat terpisah per item.
              </div>
            </>
          )}
        </div>
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Nama berkas bukti" nama="bukti" petunjuk="Berkasnya belum diunggah pada demo ini" />
      </BarisField>
    </FormModal>
  );
}

const tautan = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "var(--teal)", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit",
} as const;
