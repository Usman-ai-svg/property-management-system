"use client";

import { useState } from "react";
import { Tabel } from "@/components/kartu-tabel";

/**
 * Tabel Perbandingan Proyek dengan pemilih proyek. Nilai indikator sudah
 * diformat di server (fungsi tak bisa menyeberang ke klien), jadi komponen ini
 * hanya menyaring KOLOM mana yang tampil.
 */

export interface KolomProyek {
  id: string;
  nama: string;
}

export interface BarisIndikator {
  label: string;
  /** Nilai terformat per proyek: { [projectId]: "Rp …" }. */
  nilai: Record<string, string>;
  sorotHijau?: boolean;
}

export function Perbandingan({
  proyek,
  indikator,
  keterangan,
}: {
  proyek: KolomProyek[];
  indikator: BarisIndikator[];
  keterangan: string;
}) {
  const [pilih, setPilih] = useState<Set<string>>(() => new Set(proyek.map((p) => p.id)));

  const toggle = (id: string) =>
    setPilih((s) => {
      const next = new Set(s);
      // Selalu sisakan minimal satu proyek agar tabel tidak kosong.
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const terpilih = proyek.filter((p) => pilih.has(p.id));

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <div className="eyebrow">Perbandingan Proyek</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{keterangan}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {proyek.map((p) => {
            const aktif = pilih.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="chip"
                aria-pressed={aktif}
                style={{
                  cursor: "pointer",
                  border: "1px solid " + (aktif ? "var(--teal)" : "var(--line)"),
                  background: aktif ? "var(--rona-teal2)" : "transparent",
                  color: aktif ? "var(--teal)" : "var(--muted)",
                  fontWeight: aktif ? 600 : 400,
                }}
              >
                {p.nama}
              </button>
            );
          })}
        </div>
      </div>

      <Tabel
        kolom={[
          { label: "Indikator" },
          ...terpilih.map((p) => ({ label: p.nama, rata: "kanan" as const })),
        ]}
      >
        {indikator.map((row) => (
          <tr key={row.label}>
            <td style={{ fontWeight: 600 }}>{row.label}</td>
            {terpilih.map((p) => (
              <td
                key={p.id}
                className="num"
                style={{ textAlign: "right", color: row.sorotHijau ? "var(--green)" : "inherit" }}
              >
                {row.nilai[p.id]}
              </td>
            ))}
          </tr>
        ))}
      </Tabel>
    </div>
  );
}
