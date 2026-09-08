"use client";

import Link from "next/link";
import { PanelTabel, type FilterTabel } from "@/components/panel-tabel";
import { rp, tanggal } from "@/lib/format";
import { PERUNTUKAN_BIAYA } from "@/lib/domain/enums";
import { statusHutang, terbayarCicilan } from "@/lib/calc/keuangan";
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
  buktiKey: string | null;
  kreditur: string | null;
  tenggat: Date | null;
  contractId: string | null;
  pembelianId: string | null;
  alokasi: { id: string; unitId: string | null; infrastructureId: string | null; nominal: number }[];
  cicilan: {
    id: string; tanggal: Date; nominal: number; metode: string;
    bukti: string | null; buktiKey: string | null; pic: string | null;
  }[];
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
              {e.metode === "Hutang" && <ChipHutang e={e} />}
            </div>
            {(e.pic || e.contract || (e.metode === "Hutang" && e.kreditur)) && (
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                {e.pic ? `oleh ${e.pic}` : ""}
                {e.pic && e.contract ? " · " : ""}
                {e.contract ? e.contract.vendor.nama : ""}
                {e.metode === "Hutang" && e.kreditur
                  ? `${e.pic ? " · " : ""}kepada ${e.kreditur}${e.tenggat ? ` · tenggat ${tanggal(e.tenggat)}` : ""}`
                  : ""}
              </div>
            )}
          </td>
          <td>
            {e.buktiKey ? (
              <a
                href={`/api/bukti/${e.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--teal)", fontSize: 11, textDecoration: "none" }}
                title={`Unduh ${e.bukti ?? "berkas bukti"}`}
              >
                📎 {e.bukti ?? "berkas"}
              </a>
            ) : e.bukti ? (
              <span
                style={{ color: "var(--muted)", fontSize: 11 }}
                title="Hanya nama tercatat — berkasnya tidak diunggah"
              >
                {e.bukti}
              </span>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
            )}
          </td>
          <td className="num" style={{ textAlign: "right" }}>{rp(e.total)}</td>
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
                      bukti: e.bukti,
                      kreditur: e.kreditur,
                      tenggat: e.tenggat ? e.tenggat.toISOString().slice(0, 10) : null,
                      terbayar: terbayarCicilan(e.cicilan),
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

/** Penanda status pelunasan sebuah pengeluaran-hutang di daftar Transaksi. */
function ChipHutang({ e }: { e: BarisTransaksi }) {
  const terbayar = terbayarCicilan(e.cicilan);
  const sisa = e.total - terbayar;
  const st = statusHutang(e.total, terbayar);
  const warna = st === "Lunas" ? "var(--green)" : "var(--amber)";
  return (
    <span
      className="chip"
      title={`Hutang — terbayar ${rp(terbayar)} dari ${rp(e.total)}`}
      style={{ background: "var(--rona-amber)", color: warna, marginLeft: 6, whiteSpace: "nowrap" }}
    >
      Hutang · {st}{sisa > 0 ? ` · sisa ${rp(sisa)}` : ""}
    </span>
  );
}
