"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Star } from "lucide-react";
import { Badge } from "@/components/ui";
import { BoqTable, type BarisBoqUI } from "@/components/boq-table";
import { PanelTabel } from "@/components/panel-tabel";
import { KELOMPOK_AHSP } from "@/lib/domain/templates";
import { rp, tanggal } from "@/lib/format";

const URUT_KATEGORI_DASAR = ["UPAH", "BAHAN", "ALAT"] as const;
const URUT_KATEGORI_PEMASOK = ["Material", "Tenaga Kerja", "Alat"] as const;
import {
  HapusAnalisa, HapusHargaDasar, HapusPemasok, HapusPenawaran,
  HapusRabEstimasi, ImporBarisRab, JadikanAcuan, TambahAnalisa, TambahBarisRab,
  TambahHargaDasar, TambahPemasok, TambahPenawaranPada, TambahRabEstimasi, UbahAnalisa,
  UbahHargaDasar, UbahPemasok, UbahRabEstimasi, type HargaDasarOpsi, type KatalogItem,
} from "./editors";
import { simpanBarisRabEstimasi } from "./actions";
import { biayaKomponen, rekapAnalisa, type KelompokDasar } from "@/lib/calc/ahsp";

const WARNA_STATUS: Record<string, [string, string]> = {
  Draft: ["var(--rona-amber)", "var(--amber)"],
  Diajukan: ["var(--rona-biru)", "var(--blue)"],
  Ditolak: ["var(--rona-merah)", "var(--red)"],
  Final: ["var(--rona-hijau2)", "var(--green)"],
};
const WARNA_KATEGORI: Record<string, [string, string]> = {
  UPAH: ["var(--rona-teal2)", "var(--teal)"],
  BAHAN: ["var(--rona-biru)", "var(--blue)"],
  ALAT: ["var(--rona-amber)", "var(--amber)"],
  Material: ["var(--rona-biru)", "var(--blue)"],
  "Tenaga Kerja": ["var(--rona-teal2)", "var(--teal)"],
  Alat: ["var(--rona-amber)", "var(--amber)"],
};
const WARNA_AKTIF: Record<string, [string, string]> = {
  Aktif: ["var(--rona-hijau2)", "var(--green)"],
  Nonaktif: ["var(--rona-abu)", "var(--muted)"],
};

// ===========================================================================
// DAFTAR RAB ESTIMASI (halaman /estimasi)
// ===========================================================================

export interface RabRow {
  id: string;
  nomor: string;
  nama: string;
  status: string;
  tanggal: Date | string;
  projectKode: string;
  projectNama: string;
  jumlahBaris: number;
  total: number;
}

export function TabelDaftarRab({
  data, bolehKelola, proyek,
}: {
  data: RabRow[];
  bolehKelola: boolean;
  proyek: { id: string; nama: string }[];
}) {
  return (
    <PanelTabel
      judul="Daftar RAB Estimasi"
      aksi={bolehKelola && proyek.length > 0 && <TambahRabEstimasi proyek={proyek} />}
      data={data}
      kunci={(r) => r.id}
      cari={(r) => `${r.nomor} ${r.nama} ${r.projectKode} ${r.projectNama}`}
      petunjukCari="Cari nomor, nama, atau proyek…"
      filter={[
        { label: "Status", ambil: (r) => r.status, opsi: ["Draft", "Diajukan", "Ditolak", "Final"] },
        { label: "Proyek", ambil: (r) => `${r.projectKode} — ${r.projectNama}`, jenis: "radio" },
      ]}
      grup={(r) => `${r.projectKode} — ${r.projectNama}`}
      kosong="Belum ada RAB Estimasi."
      kolom={[
        { label: "Proyek" }, { label: "Nomor" }, { label: "Nama", minLebar: 240 },
        { label: "Status" }, { label: "Total Nilai", rata: "kanan" },
        { label: "Tanggal" }, bolehKelola && { lebar: 90 },
      ]}
      baris={(r) => (
        <tr>
          <td style={{ color: "var(--muted)" }}>{r.projectKode}</td>
          <td style={{ fontWeight: 600 }}>
            <Link href={`/estimasi/${r.id}`} style={{ color: "var(--blue)", textDecoration: "none" }}>{r.nomor}</Link>
          </td>
          <td>{r.nama}</td>
          <td><Badge nilai={r.status} peta={WARNA_STATUS} /></td>
          <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{rp(r.total)}</td>
          <td style={{ color: "var(--muted)" }}>{tanggal(r.tanggal)}</td>
          {bolehKelola && (
            <td>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {(r.status === "Draft" || r.status === "Ditolak") && (
                  <UbahRabEstimasi rab={{ id: r.id, nomor: r.nomor, nama: r.nama, status: r.status }} ikon />
                )}
                <HapusRabEstimasi id={r.id} nomor={r.nomor} />
              </div>
            </td>
          )}
        </tr>
      )}
    />
  );
}

// ===========================================================================
// ANALISA (pustaka)
// ===========================================================================

export interface AnalisaRow {
  id: string;
  kode: string;
  uraian: string;
  satuan: string;
  kelompok: string;
  overheadPct: number;
  hargaSatuan: number;
  komponen: { hargaDasarId: string; koefisien: number }[];
}

/**
 * Satu baris Analisa yang bisa di-expand menampilkan rincian komponen AHSP:
 * tiap komponen (harga dasar × koefisien) beserta subtotalnya, dijumlah per
 * kelompok (ΣA upah / ΣB bahan / ΣC alat), lalu overhead & harga satuan.
 */
function BarisAnalisa({
  a, mat, bolehKelola, hargaDasarOpsi, kolomN,
}: {
  a: AnalisaRow;
  mat: Map<string, HargaDasarOpsi>;
  bolehKelola: boolean;
  hargaDasarOpsi: HargaDasarOpsi[];
  kolomN: number;
}) {
  const [buka, setBuka] = useState(false);

  const rincian = a.komponen.map((k) => {
    const m = mat.get(k.hargaDasarId);
    return {
      kategori: m?.kategori ?? "—", kode: m?.kode ?? "?", uraian: m?.uraian ?? "(harga dasar terhapus)",
      satuan: m?.satuan ?? "", koefisien: k.koefisien, hargaAcuan: m?.hargaAcuan ?? 0,
      subtotal: biayaKomponen({ koefisien: k.koefisien, hargaAcuan: m?.hargaAcuan ?? 0 }),
    };
  });
  // Rumusnya milik calc/ahsp.ts — komponen tanpa harga dasar bernilai nol, jadi
  // kelompoknya tidak berpengaruh pada jumlah.
  const { langsung, overhead } = rekapAnalisa({
    overheadPct: a.overheadPct,
    komponen: rincian.map((r) => ({
      kelompok: (r.kategori === "UPAH" || r.kategori === "ALAT" ? r.kategori : "BAHAN") as KelompokDasar,
      koefisien: r.koefisien,
      hargaAcuan: r.hargaAcuan,
    })),
  });

  return (
    <>
      <tr>
        <td style={{ fontWeight: 600 }}>{a.kode}</td>
        <td>{a.uraian}</td>
        <td style={{ color: "var(--muted)" }}>{a.kelompok}</td>
        <td style={{ color: "var(--muted)" }}>{a.satuan}</td>
        <td style={{ textAlign: "right", color: "var(--muted)" }}>{a.overheadPct}%</td>
        <td style={{ textAlign: "right" }}>
          <button
            type="button"
            onClick={() => setBuka((b) => !b)}
            title={buka ? "Tutup rincian komponen" : "Lihat rincian komponen"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--teal)", font: "inherit", display: "inline-flex", alignItems: "center", gap: 3, padding: 0 }}
          >
            {a.komponen.length}
            <ChevronDown size={12} style={{ transform: buka ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
          </button>
        </td>
        <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{rp(a.hargaSatuan)}</td>
        {bolehKelola && (
          <td>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <UbahAnalisa
                analisa={{
                  id: a.id, kode: a.kode, uraian: a.uraian, satuan: a.satuan,
                  kelompok: a.kelompok, overheadPct: a.overheadPct, komponen: a.komponen,
                }}
                daftarHargaDasar={hargaDasarOpsi}
              />
              <HapusAnalisa id={a.id} kode={a.kode} />
            </div>
          </td>
        )}
      </tr>
      {buka && (
        <tr>
          <td colSpan={kolomN} style={{ background: "var(--rona-abu)", padding: "8px 16px 12px 32px" }}>
            <table style={{ width: "100%", fontSize: 11.5 }}>
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th style={{ textAlign: "left", fontWeight: 600, padding: "2px 6px" }}>Kelompok</th>
                  <th style={{ textAlign: "left", fontWeight: 600, padding: "2px 6px" }}>Harga Dasar</th>
                  <th style={{ textAlign: "right", fontWeight: 600, padding: "2px 6px" }}>Koefisien</th>
                  <th style={{ textAlign: "right", fontWeight: 600, padding: "2px 6px" }}>Harga Dasar</th>
                  <th style={{ textAlign: "right", fontWeight: 600, padding: "2px 6px" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {rincian.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: "2px 6px", color: "var(--muted)" }}>{r.kategori}</td>
                    <td style={{ padding: "2px 6px" }}>
                      <span style={{ fontWeight: 600 }}>{r.kode}</span> · {r.uraian}
                      <span style={{ color: "var(--muted)" }}> /{r.satuan}</span>
                    </td>
                    <td className="num" style={{ textAlign: "right", padding: "2px 6px" }}>{r.koefisien.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</td>
                    <td className="num" style={{ textAlign: "right", padding: "2px 6px" }}>{rp(r.hargaAcuan)}</td>
                    <td className="num" style={{ textAlign: "right", padding: "2px 6px" }}>{rp(r.subtotal)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "1px solid var(--line)" }}>
                  <td colSpan={4} style={{ textAlign: "right", padding: "3px 6px", color: "var(--muted)" }}>Biaya langsung</td>
                  <td className="num" style={{ textAlign: "right", padding: "3px 6px", fontWeight: 600 }}>{rp(langsung)}</td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", padding: "3px 6px", color: "var(--muted)" }}>Overhead &amp; keuntungan ({a.overheadPct}%)</td>
                  <td className="num" style={{ textAlign: "right", padding: "3px 6px" }}>{rp(overhead)}</td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", padding: "3px 6px", fontWeight: 700 }}>Harga Satuan / {a.satuan}</td>
                  <td className="num" style={{ textAlign: "right", padding: "3px 6px", fontWeight: 700 }}>{rp(a.hargaSatuan)}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export function TabelAnalisa({
  data, bolehKelola, hargaDasarOpsi,
}: {
  data: AnalisaRow[];
  bolehKelola: boolean;
  hargaDasarOpsi: HargaDasarOpsi[];
}) {
  const mat = useMemo(() => new Map(hargaDasarOpsi.map((h) => [h.id, h])), [hargaDasarOpsi]);
  const kolomN = 7 + (bolehKelola ? 1 : 0);
  return (
    <PanelTabel
      judul="Analisa Harga Satuan"
      keterangan="Klik jumlah komponen untuk melihat rincian AHSP."
      aksi={bolehKelola && <TambahAnalisa daftarHargaDasar={hargaDasarOpsi} />}
      data={data}
      kunci={(a) => a.id}
      cari={(a) => `${a.kode} ${a.uraian} ${a.kelompok}`}
      petunjukCari="Cari kode atau uraian…"
      filter={[{ label: "Kelompok", ambil: (a) => a.kelompok, opsi: KELOMPOK_AHSP }]}
      grup={(a) => a.kelompok}
      urutanGrup={KELOMPOK_AHSP}
      kosong="Belum ada analisa."
      kolom={[
        { label: "Kode" }, { label: "Uraian", minLebar: 240 }, { label: "Kelompok" },
        { label: "Satuan" }, { label: "Overhead", rata: "kanan" }, { label: "Komponen", rata: "kanan" },
        { label: "Harga Satuan", rata: "kanan" }, bolehKelola && { lebar: 80 },
      ]}
      baris={(a) => (
        <BarisAnalisa a={a} mat={mat} bolehKelola={bolehKelola} hargaDasarOpsi={hargaDasarOpsi} kolomN={kolomN} />
      )}
    />
  );
}

// ===========================================================================
// HARGA DASAR (pustaka)
// ===========================================================================

export interface PenawaranHD {
  id: string;
  pemasokNama: string;
  harga: number;
  keterangan: string | null;
  acuan: boolean;
}

export interface HargaDasarRow {
  id: string;
  kode: string;
  kategori: string;
  uraian: string;
  satuan: string;
  hargaAcuan: number;
  penawaran: PenawaranHD[];
}

/**
 * Satu baris Harga Dasar yang bisa di-expand menampilkan penawaran tiap pemasok:
 * harga, selisih vs harga acuan (★ = sedang jadi acuan), plus aksi Jadikan
 * Acuan / Hapus / Tambah. Penawaran melebur ke sini — tak lagi tabel terpisah.
 */
function BarisHargaDasar({
  h, bolehKelola, pemasokOpsi, kolomN,
}: {
  h: HargaDasarRow;
  bolehKelola: boolean;
  pemasokOpsi: { id: string; nama: string }[];
  kolomN: number;
}) {
  const [buka, setBuka] = useState(false);
  const n = h.penawaran.length;

  return (
    <>
      <tr>
        <td style={{ fontWeight: 600 }}>{h.kode}</td>
        <td><Badge nilai={h.kategori} peta={WARNA_KATEGORI} /></td>
        <td>{h.uraian}</td>
        <td style={{ color: "var(--muted)" }}>{h.satuan}</td>
        <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{rp(h.hargaAcuan)}</td>
        <td style={{ textAlign: "right" }}>
          <button
            type="button"
            onClick={() => setBuka((b) => !b)}
            title={buka ? "Tutup penawaran" : "Lihat penawaran supplier"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--teal)", font: "inherit", display: "inline-flex", alignItems: "center", gap: 3, padding: 0 }}
          >
            {n}
            <ChevronDown size={12} style={{ transform: buka ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
          </button>
        </td>
        {bolehKelola && (
          <td>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <UbahHargaDasar hargaDasar={{ id: h.id, kode: h.kode, kategori: h.kategori, uraian: h.uraian, satuan: h.satuan, hargaAcuan: h.hargaAcuan }} />
              <HapusHargaDasar id={h.id} kode={h.kode} />
            </div>
          </td>
        )}
      </tr>
      {buka && (
        <tr>
          <td colSpan={kolomN} style={{ background: "var(--rona-abu)", padding: "8px 16px 12px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>
                Penawaran supplier {n > 0 && `· ${n}`}
              </span>
              {bolehKelola && pemasokOpsi.length > 0 && (
                <TambahPenawaranPada hargaDasarId={h.id} hargaDasarLabel={`${h.kode} · ${h.uraian}`} pemasok={pemasokOpsi} />
              )}
            </div>
            {n === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Belum ada penawaran. Harga acuan diisi manual lewat “Ubah”.
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ color: "var(--muted)" }}>
                    <th style={{ textAlign: "left", fontWeight: 600, padding: "2px 6px" }}>Supplier</th>
                    <th style={{ textAlign: "right", fontWeight: 600, padding: "2px 6px" }}>Harga</th>
                    <th style={{ textAlign: "right", fontWeight: 600, padding: "2px 6px" }}>Selisih vs Acuan</th>
                    <th style={{ textAlign: "left", fontWeight: 600, padding: "2px 6px" }}>Keterangan</th>
                    {bolehKelola && <th style={{ width: 150 }} />}
                  </tr>
                </thead>
                <tbody>
                  {h.penawaran.map((t) => {
                    const selisih = t.harga - h.hargaAcuan;
                    return (
                      <tr key={t.id}>
                        <td style={{ padding: "2px 6px" }}>{t.pemasokNama}</td>
                        <td className="num" style={{ textAlign: "right", padding: "2px 6px", fontWeight: t.acuan ? 600 : 400 }}>
                          {t.acuan && <Star size={11} style={{ color: "var(--amber)", verticalAlign: "-1px", marginRight: 3 }} />}
                          {rp(t.harga)}
                        </td>
                        <td
                          className="num"
                          style={{ textAlign: "right", padding: "2px 6px", color: selisih > 0 ? "var(--red)" : selisih < 0 ? "var(--green)" : "var(--muted)" }}
                        >
                          {selisih === 0 ? "—" : `${selisih > 0 ? "+" : "−"}${rp(Math.abs(selisih))}`}
                        </td>
                        <td style={{ padding: "2px 6px", color: "var(--muted)", whiteSpace: "normal" }}>{t.keterangan ?? "—"}</td>
                        {bolehKelola && (
                          <td style={{ padding: "2px 6px" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                              {!t.acuan && <JadikanAcuan id={t.id} />}
                              <HapusPenawaran id={t.id} />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function TabelHargaDasar({
  data, bolehKelola, pemasokOpsi,
}: {
  data: HargaDasarRow[];
  bolehKelola: boolean;
  pemasokOpsi: { id: string; nama: string }[];
}) {
  const kolomN = 6 + (bolehKelola ? 1 : 0);
  return (
    <PanelTabel
      judul="Harga Dasar (Price Book)"
      keterangan="Klik jumlah penawaran untuk membandingkan harga supplier & mengubah acuan."
      aksi={bolehKelola && <TambahHargaDasar />}
      data={data}
      kunci={(h) => h.id}
      cari={(h) => `${h.kode} ${h.uraian} ${h.satuan}`}
      petunjukCari="Cari kode atau uraian…"
      filter={[{ label: "Kategori", ambil: (h) => h.kategori, opsi: URUT_KATEGORI_DASAR }]}
      grup={(h) => h.kategori}
      urutanGrup={URUT_KATEGORI_DASAR}
      kosong="Belum ada harga dasar."
      kolom={[
        { label: "Kode" }, { label: "Kategori" }, { label: "Uraian", minLebar: 240 },
        { label: "Satuan" }, { label: "Harga Acuan", rata: "kanan" }, { label: "Penawaran", rata: "kanan" },
        bolehKelola && { lebar: 80 },
      ]}
      baris={(h) => (
        <BarisHargaDasar h={h} bolehKelola={bolehKelola} pemasokOpsi={pemasokOpsi} kolomN={kolomN} />
      )}
    />
  );
}

// ===========================================================================
// PEMASOK (pustaka)
// ===========================================================================

export interface PemasokRow {
  id: string;
  nama: string;
  kategori: string;
  kontakNama: string;
  kontakTelepon: string;
  alamat: string;
  kecamatan: string;
  provinsi: string;
  status: string;
  jumlahPenawaran: number;
}

export function TabelPemasok({ data, bolehKelola }: { data: PemasokRow[]; bolehKelola: boolean }) {
  return (
    <PanelTabel
      judul="Supplier"
      keterangan="Sumber harga dasar. Entitas terpisah dari Vendor (kontraktor/SPK)."
      aksi={bolehKelola && <TambahPemasok />}
      data={data}
      kunci={(p) => p.id}
      cari={(p) => `${p.nama} ${p.kontakNama} ${p.kontakTelepon} ${p.alamat} ${p.kecamatan} ${p.provinsi}`}
      petunjukCari="Cari nama, kontak, atau alamat…"
      filter={[
        { label: "Kategori", ambil: (p) => p.kategori, opsi: URUT_KATEGORI_PEMASOK },
        { label: "Status", ambil: (p) => p.status, opsi: ["Aktif", "Nonaktif"] },
      ]}
      grup={(p) => p.kategori}
      urutanGrup={URUT_KATEGORI_PEMASOK}
      kosong="Belum ada supplier."
      kolom={[
        { label: "Nama", minLebar: 200 }, { label: "Kategori" }, { label: "Kontak", minLebar: 160 },
        { label: "Alamat", minLebar: 220 }, { label: "Status" }, { label: "Penawaran", rata: "kanan" },
        bolehKelola && { lebar: 80 },
      ]}
      baris={(p) => (
        <tr>
          <td style={{ fontWeight: 600 }}>
            <Link href={`/estimasi/pemasok/${p.id}`} style={{ color: "var(--blue)", textDecoration: "none" }}>{p.nama}</Link>
          </td>
          <td><Badge nilai={p.kategori} peta={WARNA_KATEGORI} /></td>
          <td style={{ color: "var(--muted)" }}>
            {p.kontakNama || p.kontakTelepon ? (
              <>
                {p.kontakNama && <div style={{ color: "var(--text)" }}>{p.kontakNama}</div>}
                {p.kontakTelepon && <div>{p.kontakTelepon}</div>}
              </>
            ) : "—"}
          </td>
          <td style={{ color: "var(--muted)", whiteSpace: "normal" }}>
            {p.alamat || p.kecamatan || p.provinsi ? (
              <>
                {p.alamat && <div>{p.alamat}</div>}
                {(p.kecamatan || p.provinsi) && (
                  <div style={{ fontSize: 11 }}>{[p.kecamatan, p.provinsi].filter(Boolean).join(", ")}</div>
                )}
              </>
            ) : "—"}
          </td>
          <td><Badge nilai={p.status} peta={WARNA_AKTIF} /></td>
          <td style={{ textAlign: "right", color: "var(--muted)" }}>{p.jumlahPenawaran}</td>
          {bolehKelola && (
            <td>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <UbahPemasok pemasok={{ id: p.id, nama: p.nama, kategori: p.kategori, kontakNama: p.kontakNama, kontakTelepon: p.kontakTelepon, alamat: p.alamat, kecamatan: p.kecamatan, provinsi: p.provinsi, status: p.status }} />
                <HapusPemasok id={p.id} nama={p.nama} />
              </div>
            </td>
          )}
        </tr>
      )}
    />
  );
}

// ===========================================================================
// RINCIAN RAB (halaman /estimasi/[id]) — sunting inline seperti tabel RAB Master
// ===========================================================================

export interface RincianItem {
  id: string;
  analisaId: string | null;
  grup: string;
  uraian: string;
  satuan: string;
  spesifikasi: string | null;
  volume: number;
  hargaSatuan: number;
}

/**
 * Rincian pekerjaan RAB Estimasi memakai komponen BoqTable yang sama dengan
 * tabel RAB di Master Proyek: sunting seluruh tabel sekaligus (Ubah → Simpan),
 * tanpa cari/filter/lipat grup. Tombol khas Estimasi — "Tambah dari pustaka
 * AHSP" dan "Impor Excel" — tetap dipasang lewat `aksiTambahan`; tautan AHSP
 * dipertahankan oleh aksi simpan (lihat simpanBarisRabEstimasi).
 */
export function TabelRincianRab({
  rabEstimasiId, bolehKelola, items, katalog,
}: {
  rabEstimasiId: string;
  bolehKelola: boolean;
  items: RincianItem[];
  katalog: KatalogItem[];
}) {
  const baris: BarisBoqUI[] = items.map((it) => ({
    id: it.id, grup: it.grup, uraian: it.uraian, satuan: it.satuan,
    volume: it.volume, hargaSatuan: it.hargaSatuan, spesifikasi: it.spesifikasi,
  }));

  return (
    <BoqTable
      judul="Rincian Pekerjaan"
      baris={baris}
      bolehHarga
      bolehUbah={bolehKelola}
      tanpaImporBawaan
      aksiTambahan={<ImporBarisRab rabEstimasiId={rabEstimasiId} />}
      aksiSuntingTambahan={(tambah) => <TambahBarisRab katalog={katalog} onTambah={tambah} />}
      aksiSimpan={(json) => simpanBarisRabEstimasi(rabEstimasiId, json)}
    />
  );
}
