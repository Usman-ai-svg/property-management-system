"use client";

import { PanelTabel } from "@/components/panel-tabel";
import { rp } from "@/lib/format";

export type BarisHutang = {
  id: string;
  kreditur: string;
  uraian: string;
  proyek: string;
  total: number;
  terbayar: number;
  sisa: number;
  tenggat: string;
  jatuhTempo: "lewat" | "dekat" | "aman";
};

const warnaTempo = (t: BarisHutang["jatuhTempo"]) =>
  t === "lewat" ? "var(--red)" : t === "dekat" ? "var(--amber)" : "var(--muted)";

// Label tenggat — dipakai kolom, filter, dan pencarian agar konsisten.
const LABEL_TEMPO: Record<BarisHutang["jatuhTempo"], string> = {
  lewat: "Lewat tenggat",
  dekat: "Mendekati",
  aman: "Aman",
};
const OPSI_TEMPO = ["Lewat tenggat", "Mendekati", "Aman"] as const;

/**
 * Kartu Hutang Jatuh Tempo — tabel yang DIKELOMPOKKAN per supplier (kreditur),
 * dengan subtotal sisa tiap supplier di baris judulnya dan SUM keseluruhan di
 * baris kaki. Pencarian & filter memakai komponen yang sama dengan laman RAB
 * Estimasi (`PanelTabel`: kotak cari + popover Filter + pil aktif + reset).
 *
 * Selalu tampil; saat kosong, kartunya tetap ada dengan pesan kosong supaya
 * posisinya di dashboard konsisten. Klien murni: penyaringan & pengelompokan
 * dihitung dari daftar yang sudah disiapkan server (`hutangBerjalan`).
 */
export function KartuHutang({ hutang }: { hutang: BarisHutang[] }) {
  const ada = hutang.length > 0;

  return (
    <PanelTabel<BarisHutang>
      judul="Hutang Jatuh Tempo"
      keterangan="Pengeluaran metode “Hutang” yang belum lunas, dikelompokkan per supplier."
      data={hutang}
      kunci={(h) => h.id}
      cari={ada ? (h) => `${h.kreditur} ${h.uraian} ${h.proyek} ${LABEL_TEMPO[h.jatuhTempo]}` : undefined}
      petunjukCari="Cari supplier, uraian, atau proyek…"
      filter={
        ada
          ? [
              { label: "Tenggat", ambil: (h) => LABEL_TEMPO[h.jatuhTempo], opsi: OPSI_TEMPO, jenis: "radio" },
              { label: "Proyek", ambil: (h) => h.proyek },
            ]
          : undefined
      }
      grup={(h) => h.kreditur}
      ringkasGrupSpan={3}
      ringkasGrup={(rows) => {
        const t = rows.reduce((s, h) => s + h.total, 0);
        const b = rows.reduce((s, h) => s + h.terbayar, 0);
        const s = rows.reduce((a, h) => a + h.sisa, 0);
        return [
          rp(t),
          b > 0 ? <span style={{ color: "var(--muted)" }}>{rp(b)}</span> : "—",
          rp(s),
        ];
      }}
      kosong="Tidak ada hutang berjalan."
      kolom={[
        { label: "Uraian", minLebar: 220 },
        { label: "Proyek" },
        { label: "Tenggat", rata: "kanan" },
        { label: "Hutang", rata: "kanan" },
        { label: "Terbayar", rata: "kanan" },
        { label: "Sisa", rata: "kanan" },
      ]}
      baris={(h) => (
        <tr>
          <td style={{ fontSize: 12.5 }}>{h.uraian}</td>
          <td style={{ fontSize: 11.5, color: "var(--muted)" }}>{h.proyek}</td>
          <td
            style={{
              textAlign: "right", fontSize: 11, whiteSpace: "nowrap",
              color: warnaTempo(h.jatuhTempo), fontWeight: 600,
            }}
          >
            {h.jatuhTempo === "lewat" ? "⚠ " : h.jatuhTempo === "dekat" ? "⏳ " : ""}
            {h.tenggat}
          </td>
          <td className="num" style={{ textAlign: "right" }}>{rp(h.total)}</td>
          <td className="num" style={{ textAlign: "right", color: "var(--muted)" }}>
            {h.terbayar > 0 ? rp(h.terbayar) : "—"}
          </td>
          <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{rp(h.sisa)}</td>
        </tr>
      )}
      footer={(rows) => {
        const t = rows.reduce((s, h) => s + h.total, 0);
        const b = rows.reduce((s, h) => s + h.terbayar, 0);
        const s = rows.reduce((a, h) => a + h.sisa, 0);
        return (
          <tr style={{ borderTop: "2px solid var(--line)" }}>
            <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>Total</td>
            <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(t)}</td>
            <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(b)}</td>
            <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(s)}</td>
          </tr>
        );
      }}
    />
  );
}
