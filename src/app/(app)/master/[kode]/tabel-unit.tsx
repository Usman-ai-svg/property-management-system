"use client";

import Link from "next/link";
import { PanelTabel } from "@/components/panel-tabel";
import { Badge, WARNA_STATUS } from "@/components/ui";
import { rp } from "@/lib/format";
import { STATUS_JUAL, STATUS_PEMBANGUNAN } from "@/lib/domain/enums";
import { EditUnit, HapusUnit } from "./editors";

export interface BarisUnit {
  id: string;
  kode: string;
  nomor: number;
  faseKode: string;
  phaseId: string;
  tipeNama: string;
  luasBangunan: number;
  luasTanah: number;
  custom: boolean;
  statusPembangunan: string;
  statusJual: string;
  /** ISO yyyy-mm-dd atau null. */
  tanggalSerahTerima: string | null;
  progress: number;
  rab: number | null;
  rap: number | null;
}

export function TabelUnit({
  kodeProyek,
  data,
  fases,
  bolehHarga,
  ubahProgres,
  ubahData,
  aksi,
}: {
  kodeProyek: string;
  data: BarisUnit[];
  fases: { id: string; kode: string }[];
  bolehHarga: boolean;
  ubahProgres: boolean;
  ubahData: boolean;
  aksi?: React.ReactNode;
}) {
  const adaAksi = ubahProgres || ubahData;

  return (
    <PanelTabel<BarisUnit>
      judul="Daftar Unit"
      keterangan="Klik nomor unit untuk membuka Detail Data Unit. Status Bangun dihitung otomatis dari progres, status jual, dan tanggal serah terima."
      aksi={aksi}
      data={data}
      kunci={(u) => u.id}
      cari={(u) => `${u.nomor} ${u.faseKode} ${u.tipeNama} ${u.kode}`}
      petunjukCari="Cari nomor, fase, atau tipe…"
      filter={[
        { label: "Fase", ambil: (u) => u.faseKode },
        { label: "Tipe", ambil: (u) => u.tipeNama },
        { label: "Status Bangun", ambil: (u) => u.statusPembangunan, opsi: STATUS_PEMBANGUNAN },
        { label: "Status Jual", ambil: (u) => u.statusJual, opsi: STATUS_JUAL },
      ]}
      kosong="Belum ada unit pada proyek ini."
      tinggiMaks={440}
      kolom={[
        { label: "Unit" },
        { label: "Fase" },
        { label: "Tipe" },
        { label: "LB", rata: "kanan" },
        { label: "LT", rata: "kanan" },
        { label: "Konfigurasi" },
        { label: "Status Bangun" },
        { label: "Status Jual" },
        bolehHarga && { label: "RAB", rata: "kanan" },
        bolehHarga && { label: "RAP", rata: "kanan" },
        adaAksi && { lebar: 70 },
      ]}
      footer={
        bolehHarga
          ? (rows) => (
              <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)", background: "var(--rona-baris)" }}>
                <td colSpan={8}>TOTAL</td>
                <td className="num" style={{ textAlign: "right", color: "var(--brass)" }}>
                  {rp(rows.reduce((s, u) => s + (u.rab ?? 0), 0))}
                </td>
                <td className="num" style={{ textAlign: "right", color: "var(--brass)" }}>
                  {rp(rows.reduce((s, u) => s + (u.rap ?? 0), 0))}
                </td>
                {adaAksi && <td />}
              </tr>
            )
          : undefined
      }
      baris={(u) => (
        <tr>
          <td>
            <Link
              href={`/master/${kodeProyek}/unit/${encodeURIComponent(u.kode)}`}
              style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}
            >
              {u.nomor}
            </Link>
          </td>
          <td>{u.faseKode}</td>
          <td>{u.tipeNama}</td>
          <td style={{ textAlign: "right" }}>{u.luasBangunan} m²</td>
          <td style={{ textAlign: "right" }}>{u.luasTanah} m²</td>
          <td>
            {u.custom ? (
              <span className="chip" style={{ background: "var(--rona-amber)", color: "var(--amber)" }}>Custom</span>
            ) : (
              <span className="chip" style={{ background: "var(--rona-abu)", color: "var(--muted)" }}>Default</span>
            )}
          </td>
          <td><Badge nilai={u.statusPembangunan} peta={WARNA_STATUS.bangun} /></td>
          <td><Badge nilai={u.statusJual} peta={WARNA_STATUS.jual} /></td>
          {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(u.rab ?? 0)}</td>}
          {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(u.rap ?? 0)}</td>}
          {adaAksi && (
            <td>
              <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                {ubahProgres && (
                  <EditUnit
                    data={{
                      id: u.id, label: `${u.faseKode}-${u.nomor}`, nomor: u.nomor,
                      phaseId: u.phaseId, luasTanah: u.luasTanah, statusJual: u.statusJual,
                      tanggalSerahTerima: u.tanggalSerahTerima,
                    }}
                    fases={fases}
                  />
                )}
                {ubahData && u.progress === 0 && <HapusUnit id={u.id} label={`${u.faseKode}-${u.nomor}`} />}
              </div>
            </td>
          )}
        </tr>
      )}
    />
  );
}
