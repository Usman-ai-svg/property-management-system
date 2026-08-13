"use client";

import Link from "next/link";
import { PanelTabel } from "@/components/panel-tabel";
import { Badge, WARNA_STATUS } from "@/components/ui";
import { rp } from "@/lib/format";
import { JENIS_SARPRAS, STATUS_SARPRAS } from "@/lib/domain/enums";
import { AksiSarpras } from "./editors";

export interface BarisSarpras {
  id: string;
  kode: string;
  nama: string;
  jenis: string;
  volume: string;
  status: string;
  progress: number;
  dariBoq: boolean;
  terkontrak: number;
  rab: number | null;
  rap: number | null;
}

export function TabelSarpras({
  kodeProyek,
  data,
  bolehHarga,
  ubahSarprasData,
  aksi,
}: {
  kodeProyek: string;
  data: BarisSarpras[];
  bolehHarga: boolean;
  ubahSarprasData: boolean;
  aksi?: React.ReactNode;
}) {
  return (
    <PanelTabel<BarisSarpras>
      judul="Daftar Sarana & Prasarana"
      keterangan="Klik nama item untuk membuka Detail Data Sarana & Prasarana. Status Bangun otomatis dari progres."
      aksi={aksi}
      data={data}
      kunci={(s) => s.id}
      cari={(s) => `${s.nama} ${s.jenis} ${s.kode} ${s.volume}`}
      petunjukCari="Cari nama, jenis, atau kode…"
      filter={[
        { label: "Jenis", ambil: (s) => s.jenis, opsi: JENIS_SARPRAS, jenis: "radio" },
        { label: "Status Bangun", ambil: (s) => s.status, opsi: STATUS_SARPRAS },
      ]}
      kosong="Belum ada item sarana atau prasarana."
      kolom={[
        { label: "Item" },
        { label: "Jenis" },
        { label: "Volume" },
        { label: "Status Bangun" },
        bolehHarga && { label: "RAB", rata: "kanan" },
        bolehHarga && { label: "RAP", rata: "kanan" },
        ubahSarprasData && { lebar: 70 },
      ]}
      footer={
        bolehHarga
          ? (rows) => (
              <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)", background: "var(--rona-baris)" }}>
                <td colSpan={4}>TOTAL</td>
                <td className="num" style={{ textAlign: "right", color: "var(--brass)" }}>
                  {rp(rows.reduce((s, x) => s + (x.rab ?? 0), 0))}
                </td>
                <td className="num" style={{ textAlign: "right", color: "var(--brass)" }}>
                  {rp(rows.reduce((s, x) => s + (x.rap ?? 0), 0))}
                </td>
                {ubahSarprasData && <td />}
              </tr>
            )
          : undefined
      }
      baris={(s) => (
        <tr>
          <td>
            <Link
              href={`/master/${kodeProyek}/sarpras/${encodeURIComponent(s.kode)}`}
              style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
            >
              {s.nama}
            </Link>
          </td>
          <td style={{ color: "var(--muted)" }}>{s.jenis}</td>
          <td>{s.volume}</td>
          <td><Badge nilai={s.status} peta={WARNA_STATUS.bangun} /></td>
          {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(s.rab ?? 0)}</td>}
          {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(s.rap ?? 0)}</td>}
          {ubahSarprasData && (
            <td>
              <AksiSarpras
                kode={kodeProyek}
                data={{
                  id: s.id, nama: s.nama, jenis: s.jenis, volume: s.volume,
                  status: s.status, progress: s.progress, dariBoq: s.dariBoq,
                }}
                terkontrak={s.terkontrak}
              />
            </td>
          )}
        </tr>
      )}
    />
  );
}
