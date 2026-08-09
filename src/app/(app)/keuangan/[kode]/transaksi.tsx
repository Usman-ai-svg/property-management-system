"use client";

import Link from "next/link";
import { PanelTabel, type FilterTabel } from "@/components/panel-tabel";
import { Badge, WARNA_STATUS } from "@/components/ui";
import { rp, tanggal } from "@/lib/format";
import { PERUNTUKAN_BIAYA } from "@/lib/domain/enums";
import { UbahTransaksi, HapusTransaksi } from "./ubah-transaksi";

/**
 * Daftar Transaksi proyek dengan pencarian & filter (Sumber / Peruntukan /
 * Jenis). "Sumber" bukan kolom fisik di basis data melainkan diturunkan dari
 * tautannya — pembayaran kontrak punya `contractId`, pembayaran PO punya
 * `pembelianId`, sisanya pengeluaran manual — sehingga tak perlu migrasi skema.
 *
 * Baris tertaut tidak menampilkan tombol Ubah/Hapus generik: kontrak dikelola
 * di modul Vendor, PO di kartu Pembelian Material. Chip-nya menjadi tautan
 * penelusuran ke termin di modul asal.
 */
export type BarisTransaksi = {
  id: string;
  tanggal: Date;
  jenis: string;
  peruntukan: string;
  metode: string;
  uraian: string;
  total: number;
  status: string;
  pic: string | null;
  bukti: string | null;
  contractId: string | null;
  pembelianId: string | null;
  alokasi: { id: string; unitId: string | null; infrastructureId: string | null; nominal: number }[];
  contract: { kode: string; vendorId: string; vendor: { nama: string } } | null;
  pembelian: { nomor: string; pemasok: { nama: string } } | null;
};

const SUMBER = ["Kontrak", "PO", "Manual"] as const;

/** Asal transaksi, diturunkan dari tautannya. */
export function sumberTransaksi(e: Pick<BarisTransaksi, "contractId" | "pembelianId">): string {
  if (e.contractId) return "Kontrak";
  if (e.pembelianId) return "PO";
  return "Manual";
}

export function PanelTransaksi({
  expenses,
  bolehUbah,
  units,
  sarpras,
  warnaJenis,
}: {
  expenses: BarisTransaksi[];
  bolehUbah: boolean;
  units: { id: string; label: string }[];
  sarpras: { id: string; label: string }[];
  warnaJenis: Record<string, string>;
}) {
  const filter: FilterTabel<BarisTransaksi>[] = [
    { label: "Sumber", ambil: sumberTransaksi, opsi: SUMBER, jenis: "radio" },
    {
      label: "Peruntukan",
      ambil: (e) => e.peruntukan,
      opsi: PERUNTUKAN_BIAYA,
      jenis: "checkbox",
    },
    { label: "Jenis", ambil: (e) => e.jenis, jenis: "checkbox" },
  ];

  return (
    <PanelTabel<BarisTransaksi>
      judul="Transaksi"
      keterangan="Kontrak vendor dikelola di modul Vendor Management. Belanja material dicatat lewat PO di atas."
      data={expenses}
      kunci={(e) => e.id}
      cari={(e) =>
        [
          e.uraian, e.jenis, e.peruntukan, e.pic ?? "",
          e.contract?.vendor.nama ?? "", e.contract?.kode ?? "",
          e.pembelian?.pemasok.nama ?? "", e.pembelian?.nomor ?? "",
          sumberTransaksi(e),
        ].join(" ")
      }
      petunjukCari="Cari uraian, vendor, PIC…"
      filter={filter}
      tinggiMaks={360}
      kolom={[
        { label: "Tanggal" },
        { label: "Jenis" },
        { label: "Keterangan" },
        { label: "Bukti" },
        { label: "Total", rata: "kanan" },
        { label: "Status" },
        bolehUbah && { lebar: 74 },
      ]}
      kosong="Belum ada transaksi tercatat."
      baris={(e) => (
        <tr>
          <td style={{ color: "var(--muted)" }}>{tanggal(e.tanggal)}</td>
          <td>
            <span style={{ color: warnaJenis[e.jenis] ?? "var(--muted)", marginRight: 4 }}>■</span>
            {e.jenis}
          </td>
          <td>
            <div>
              {e.uraian}
              {e.alokasi.length > 1 && (
                <span
                  className="chip"
                  title="Satu pembayaran yang dibebankan ke beberapa tujuan"
                  style={{ background: "var(--rona-teal)", color: "var(--teal)", marginLeft: 6 }}
                >
                  dibagi ke {e.alokasi.length} tujuan
                </span>
              )}
            </div>
            {(e.pic || e.contract) && (
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                {e.pic ? `oleh ${e.pic}` : ""}
                {e.pic && e.contract ? " · " : ""}
                {e.contract ? e.contract.vendor.nama : ""}
              </div>
            )}
          </td>
          <td>
            {e.bukti ? (
              <span style={{ color: "var(--teal)", fontSize: 11 }}>📎 {e.bukti}</span>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
            )}
          </td>
          <td className="num" style={{ textAlign: "right" }}>{rp(e.total)}</td>
          <td>
            <Badge nilai={e.status} peta={WARNA_STATUS.bayar} />
          </td>
          {bolehUbah && (
            <td>
              {e.contractId && e.contract ? (
                <Link
                  href={`/vendor/${e.contract.vendorId}?tab=bayar`}
                  className="chip"
                  style={{ background: "var(--rona-teal)", color: "var(--teal)", whiteSpace: "nowrap" }}
                  title={`Pembayaran kontrak ${e.contract.kode} — kelola di Vendor`}
                >
                  ↗ Kontrak {e.contract.kode}
                </Link>
              ) : e.pembelianId ? (
                <span
                  className="chip"
                  style={{ background: "var(--rona-amber)", color: "var(--muted)", whiteSpace: "nowrap" }}
                  title="Pembayaran PO — kelola di kartu Pembelian Material"
                >
                  PO {e.pembelian?.nomor ?? ""}
                </span>
              ) : (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <UbahTransaksi
                    transaksi={{
                      id: e.id, peruntukan: e.peruntukan, jenis: e.jenis,
                      metode: e.metode, uraian: e.uraian, total: e.total,
                      status: e.status, bukti: e.bukti,
                      alokasi: e.alokasi.map((a) => ({
                        unitId: a.unitId, infrastructureId: a.infrastructureId, nominal: a.nominal,
                      })),
                    }}
                    units={units}
                    sarpras={sarpras}
                  />
                  <HapusTransaksi id={e.id} uraian={e.uraian} />
                </div>
              )}
            </td>
          )}
        </tr>
      )}
    />
  );
}
