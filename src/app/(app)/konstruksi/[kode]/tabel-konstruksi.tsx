"use client";

import Link from "next/link";
import { Badge, Track, WARNA_STATUS } from "@/components/ui";
import { PanelTabel } from "@/components/panel-tabel";
import { rp } from "@/lib/format";

/**
 * Tabel-tabel modul Konstruksi per proyek — Unit, Sarpras, dan Progress Vendor.
 *
 * Ketiganya memakai `PanelTabel` (kotak cari + popover Filter + pil aktif +
 * reset), sama dengan laman RAB Estimasi, supaya pengalaman filter & pencarian
 * seragam. Penyaringan klien-murni atas data yang sudah dikirim server; grup
 * pekerjaan berjalan & progres tertimbang sudah dihitung di server.
 */

export type UnitRow = {
  id: string;
  kode: string;
  nomor: number;
  fase: string;
  tipe: string;
  progress: number;
  status: string;
  grup: string[];
};

export type SarprasRow = {
  id: string;
  kode: string;
  nama: string;
  jenis: string;
  volume: string;
  progress: number;
  status: string;
};

export type VendorRow = {
  id: string;
  kode: string;
  vendor: string;
  deskripsi: string;
  nominal: number;
  objek: number;
  progres: number;
  status: string;
};

function BarProgress({ nilai, warna }: { nilai: number; warna: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Track nilai={nilai} tinggi={9} warna={nilai === 100 ? "var(--green)" : warna} />
      <span style={{ fontSize: 11, color: "var(--muted)", width: 30 }}>{nilai}%</span>
    </div>
  );
}

export function TabelUnitKonstruksi({ kodeProyek, data }: { kodeProyek: string; data: UnitRow[] }) {
  return (
    <PanelTabel<UnitRow>
      judul="Progress Unit"
      keterangan="Klik nomor unit untuk membuka rincian mingguan."
      data={data}
      kunci={(u) => u.id}
      cari={(u) => `${u.fase}-${u.nomor} ${u.tipe}`}
      petunjukCari="Cari unit / tipe…"
      filter={[
        { label: "Fase", ambil: (u) => u.fase },
        { label: "Status", ambil: (u) => u.status },
      ]}
      tinggiMaks={400}
      kosong="Tidak ada unit yang cocok dengan saringan ini."
      kolom={[
        { label: "Unit" },
        { label: "Fase" },
        { label: "Tipe" },
        { label: "Progress s.d. Minggu Ini", minLebar: 190 },
        { label: "Keterangan Pekerjaan" },
        { label: "Status" },
      ]}
      baris={(u) => (
        <tr>
          <td>
            <Link
              href={`/konstruksi/${kodeProyek}/unit/${encodeURIComponent(u.kode)}`}
              style={{ color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}
            >
              {u.nomor}
            </Link>
          </td>
          <td>{u.fase}</td>
          <td>{u.tipe}</td>
          <td><BarProgress nilai={u.progress} warna="var(--teal)" /></td>
          <td>
            {u.grup.length === 0 ? (
              <span style={{ color: "var(--muted)" }}>—</span>
            ) : (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {u.grup.map((k) => (
                  <span key={k} className="chip" style={{ background: "var(--rona-teal)", color: "var(--teal)" }}>
                    {k}
                  </span>
                ))}
              </div>
            )}
          </td>
          <td><Badge nilai={u.status} peta={WARNA_STATUS.bangun} /></td>
        </tr>
      )}
    />
  );
}

export function TabelSarprasKonstruksi({ kodeProyek, data }: { kodeProyek: string; data: SarprasRow[] }) {
  return (
    <PanelTabel<SarprasRow>
      judul="Sarana & Prasarana"
      keterangan="Klik nama item untuk membuka rincian mingguan."
      data={data}
      kunci={(s) => s.id}
      cari={(s) => `${s.nama} ${s.jenis}`}
      petunjukCari="Cari item / jenis…"
      filter={[
        { label: "Jenis", ambil: (s) => s.jenis },
        { label: "Status", ambil: (s) => s.status },
      ]}
      kosong="Tidak ada item yang cocok dengan saringan ini."
      kolom={[
        { label: "Item" },
        { label: "Jenis" },
        { label: "Volume" },
        { label: "Progress s.d. Minggu Ini", minLebar: 190 },
        { label: "Status" },
      ]}
      baris={(s) => (
        <tr>
          <td>
            <Link
              href={`/konstruksi/${kodeProyek}/sarpras/${encodeURIComponent(s.kode)}`}
              style={{ color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}
            >
              {s.nama}
            </Link>
          </td>
          <td style={{ color: "var(--muted)" }}>{s.jenis}</td>
          <td>{s.volume}</td>
          <td><BarProgress nilai={s.progress} warna="var(--brass)" /></td>
          <td><Badge nilai={s.status} peta={WARNA_STATUS.bangun} /></td>
        </tr>
      )}
    />
  );
}

export function TabelVendorKonstruksi({
  kodeProyek, data, bolehHarga,
}: {
  kodeProyek: string;
  data: VendorRow[];
  bolehHarga: boolean;
}) {
  return (
    <PanelTabel<VendorRow>
      judul="Progress Vendor"
      keterangan="Capaian per SPK dari BOQ kontrak (lingkup vendor, terpisah dari Progress Konstruksi). Klik untuk membuka objek & opname-nya."
      data={data}
      kunci={(c) => c.id}
      cari={(c) => `${c.kode} ${c.vendor} ${c.deskripsi}`}
      petunjukCari="Cari SPK / vendor / pekerjaan…"
      filter={[
        { label: "Vendor", ambil: (c) => c.vendor },
        { label: "Status", ambil: (c) => c.status },
      ]}
      kosong="Tidak ada SPK yang cocok dengan saringan ini."
      kolom={[
        { label: "SPK" },
        { label: "Vendor" },
        { label: "Pekerjaan" },
        bolehHarga && { label: "Nilai", rata: "kanan" },
        { label: "Objek", rata: "kanan" },
        { label: "Progress Vendor", minLebar: 190 },
        { label: "Status" },
      ]}
      baris={(c) => (
        <tr>
          <td>
            <Link
              href={`/konstruksi/${kodeProyek}/vendor/${encodeURIComponent(c.kode)}`}
              style={{ color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}
            >
              {c.kode}
            </Link>
          </td>
          <td>{c.vendor}</td>
          <td style={{ color: "var(--muted)" }}>{c.deskripsi}</td>
          {bolehHarga && <td className="num" style={{ textAlign: "right" }}>{rp(c.nominal)}</td>}
          <td style={{ textAlign: "right" }}>{c.objek}</td>
          <td><BarProgress nilai={c.progres} warna="var(--brass)" /></td>
          <td><Badge nilai={c.status} peta={WARNA_STATUS.vendor} /></td>
        </tr>
      )}
    />
  );
}
