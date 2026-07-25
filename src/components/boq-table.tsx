"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import type { HasilAksi } from "@/lib/actions/guard";
import { rp } from "@/lib/format";
import { ModalImpor } from "./impor";

/**
 * Tabel BOQ dengan mode sunting menyeluruh, meniru artifact.
 *
 * Tombol "Ubah" mengubah seluruh sel jadi isian sekaligus, lalu "Simpan"
 * mengirim semuanya dalam satu aksi. Ini disengaja mengikuti cara kerja
 * artifact — bukan sunting per baris — karena penyusunan BOQ memang biasanya
 * dilakukan sekaligus, bukan satu-satu.
 *
 * "Batal" mengembalikan ke keadaan sebelum disunting tanpa menyentuh database.
 */

export interface BarisBoqUI {
  id?: string;
  grup?: string | null;
  uraian: string;
  satuan: string;
  volume: number;
  hargaSatuan: number;
  spesifikasi?: string | null;
}

const sel = {
  fontSize: 11,
  padding: "3px 6px",
} as const;

export function BoqTable({
  judul,
  baris,
  bolehHarga,
  bolehUbah,
  aksiSimpan,
  konteksImpor,
  grupBaru = "Tambahan",
}: {
  judul: string;
  baris: BarisBoqUI[];
  bolehHarga: boolean;
  bolehUbah: boolean;
  /** Menerima seluruh baris sebagai JSON dan menyimpannya. */
  aksiSimpan: (barisJson: string) => Promise<HasilAksi>;
  konteksImpor: string;
  grupBaru?: string;
}) {
  const [sunting, setSunting] = useState(false);
  const [draft, setDraft] = useState<BarisBoqUI[]>(baris);
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();

  const rows = sunting ? draft : baris;
  const total = rows.reduce((s, r) => s + r.volume * r.hargaSatuan, 0);

  const ubahSel = (i: number, field: keyof BarisBoqUI, nilai: string | number) =>
    setDraft((d) => d.map((r, y) => (y === i ? { ...r, [field]: nilai } : r)));

  const mulaiSunting = () => {
    setDraft(baris.map((r) => ({ ...r })));
    setGalat(null);
    setSunting(true);
  };

  const batal = () => {
    setSunting(false);
    setDraft(baris);
    setGalat(null);
  };

  const simpan = () =>
    mulai(async () => {
      const hasil = await aksiSimpan(JSON.stringify(draft));
      if (hasil.ok) {
        setSunting(false);
        setGalat(null);
      } else {
        setGalat(hasil.error);
      }
    });

  const isian = (
    i: number,
    field: keyof BarisBoqUI,
    lebar: number,
    angka?: boolean,
  ) => (
    <input
      className="inp"
      type={angka ? "number" : "text"}
      value={String(rows[i][field] ?? "")}
      onChange={(e) =>
        ubahSel(i, field, angka ? Number(e.target.value) || 0 : e.target.value)
      }
      style={{ ...sel, width: lebar, textAlign: angka ? "right" : "left" }}
    />
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8, flexWrap: "wrap", gap: 8,
        }}
      >
        <div className="eyebrow">{judul}</div>
        {bolehHarga && bolehUbah && (
          <div style={{ display: "flex", gap: 6 }}>
            <ModalImpor jenis="BOQ / RAB" konteks={konteksImpor} kolom="Uraian Pekerjaan · Volume · Satuan · Harga Satuan · Spesifikasi" />
            {sunting && (
              <button
                type="button"
                className="btn-garis"
                onClick={() =>
                  setDraft((d) => [
                    ...d,
                    { grup: grupBaru, uraian: "Pekerjaan baru", satuan: "ls", volume: 1, hargaSatuan: 0, spesifikasi: "" },
                  ])
                }
              >
                + Tambah Baris
              </button>
            )}
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
            padding: "9px 12px", borderRadius: 9, background: "#fbeae8",
            color: "var(--red)", fontSize: 12.5, lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          {galat}
        </div>
      )}

      <div className="card tablewrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 170 }}>Uraian Pekerjaan</th>
              <th style={{ textAlign: "right" }}>Vol</th>
              <th>Sat</th>
              {bolehHarga && <th style={{ textAlign: "right" }}>Harga Satuan</th>}
              {bolehHarga && <th style={{ textAlign: "right" }}>Subtotal</th>}
              <th style={{ textAlign: "right" }}>Bobot</th>
              <th style={{ minWidth: 220 }}>Spesifikasi</th>
              {sunting && <th style={{ width: 34 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sub = r.volume * r.hargaSatuan;
              return (
                <tr key={r.id ?? `baru-${i}`}>
                  <td>
                    {r.grup && (
                      <span style={{ fontSize: 9.5, color: "var(--muted)", display: "block" }}>{r.grup}</span>
                    )}
                    {sunting ? isian(i, "uraian", 160) : r.uraian}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {sunting ? isian(i, "volume", 58, true) : r.volume.toLocaleString("id-ID")}
                  </td>
                  <td>{sunting ? isian(i, "satuan", 44) : r.satuan}</td>
                  {bolehHarga && (
                    <td style={{ textAlign: "right" }}>
                      {sunting ? isian(i, "hargaSatuan", 96, true) : rp(r.hargaSatuan)}
                    </td>
                  )}
                  {bolehHarga && (
                    <td className="num" style={{ textAlign: "right" }}>{rp(sub)}</td>
                  )}
                  <td style={{ textAlign: "right", color: "var(--muted)" }}>
                    {total ? ((sub / total) * 100).toFixed(2) : "0.00"}%
                  </td>
                  <td style={{ whiteSpace: "normal", color: "var(--muted)", lineHeight: 1.45 }}>
                    {sunting ? isian(i, "spesifikasi", 210) : r.spesifikasi || "—"}
                  </td>
                  {sunting && (
                    <td>
                      <button
                        type="button"
                        title="Hapus baris"
                        onClick={() => setDraft((d) => d.filter((_, y) => y !== i))}
                        style={{
                          color: "var(--red)", cursor: "pointer", fontWeight: 700,
                          background: "none", border: "none", fontSize: 15, padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            <tr style={{ fontWeight: 700 }}>
              <td colSpan={bolehHarga ? 4 : 2}>TOTAL RAB</td>
              {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(total)}</td>}
              <td style={{ textAlign: "right" }}>100%</td>
              <td />
              {sunting && <td />}
            </tr>
          </tbody>
        </table>

        {!bolehHarga && (
          <div
            style={{
              padding: "10px 14px", fontSize: 11.5, color: "var(--muted)",
              borderTop: "1px solid var(--line)",
            }}
          >
            Kolom harga tidak ditampilkan untuk peran Anda.
          </div>
        )}
      </div>
    </div>
  );
}
