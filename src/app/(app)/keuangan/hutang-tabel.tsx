"use client";

import { PanelTabel } from "@/components/panel-tabel";
import { rp } from "@/lib/format";
import { subtotalHutang } from "@/lib/tampilan/keuangan-proyek";

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
        const { total: t, terbayar: b, sisa: s } = subtotalHutang(rows);
        return [
          rp(t),
          b > 0 ? <span style={{ color: "var(--muted)" }}>{rp(b)}</span> : "—",
          rp(s),
        ];
      }}
      kosong="Tidak ada hutang berjalan."
      // Lebar kolom dipatok agar tabel TIDAK bergeser saat baris tersaring
      // berubah: dengan table-layout auto, lebar kolom dihitung ulang dari
      // konten (subtotal grup & footer Total) tiap kali filter aktif. Kolom
      // teks (Uraian/Proyek) dibiarkan membungkus mengisi sisa ruang.
      kolom={[
        { label: "Uraian", minLebar: 240 },
        { label: "Proyek", lebar: 160 },
        { label: "Tenggat", rata: "kanan", lebar: 120 },
        { label: "Hutang", rata: "kanan", lebar: 150 },
        { label: "Terbayar", rata: "kanan", lebar: 150 },
        { label: "Sisa", rata: "kanan", lebar: 150 },
      ]}
      baris={(h) => (
        <tr>
          <td style={{ fontSize: 12.5, whiteSpace: "normal" }}>{h.uraian}</td>
          <td style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "normal" }}>{h.proyek}</td>
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
        const { total: t, terbayar: b, sisa: s } = subtotalHutang(rows);
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
