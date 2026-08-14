"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Tabel } from "@/components/kartu-tabel";
import { MenuAksi } from "@/components/form";
import { Track } from "@/components/ui";
import { pct, rp } from "@/lib/format";
import { warnaSerapan } from "@/lib/tampilan/plan-realisasi";
import {
  FormBarisHpp, FormBarisOperasional, FormKategoriHpp, FormKategoriOperasional,
  HapusBarisHpp, HapusBarisOperasional, HapusKategoriHpp, HapusKategoriOperasional,
} from "./editors-bp";
import { CatatBiayaOperasional } from "./catat-ops";

/**
 * Tabel rencana HPP / Biaya Operasional — satu tabel, dirinci per kategori,
 * meniru tabel RAB/RAP.
 *
 * Perbaikan dari versi lama yang bertumpuk tombol: kategori kini tak punya
 * tombol tambah/ubah/hapus tersebar. Ada SATU tombol "Tambah Baris" di kepala
 * kartu (kategorinya dipilih di dalam form), tiap grup bisa dilipat, dan sebuah
 * baris dipindah antar kategori cukup lewat form ubahnya. Rename/hapus kategori
 * tinggal dua ikon kecil di baris grup — rename tetap perlu untuk operasional,
 * karena namanya yang mencocokkan realisasi biaya yang sudah dicatat.
 */

interface BarisRencana {
  id: string;
  uraian: string;
  satuan: string;
  volume: number;
  harga: number;
}

export interface KategoriRencana {
  id: string;
  nama: string;
  plan: number;
  real: number;
  /** Hanya HPP: keterangan sumber realisasi. */
  sumber?: string;
  rows: BarisRencana[];
}

/** Bar serapan plan-vs-realisasi dengan penanda progres fisik. */
function SerapanSel({ plan, real, progres }: { plan: number; real: number; progres: number }) {
  const terpakai = plan ? real / plan : 0;
  return (
    <div>
      <Track nilai={Math.min(terpakai, 1) * 100} tanda={progres * 100} warna={warnaSerapan(terpakai, progres)} tinggi={16} />
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
        {plan ? `${pct(terpakai)} terpakai` : "—"}
      </div>
    </div>
  );
}

export function TabelRencanaBp({
  jenis,
  businessPlanId,
  bolehUbah,
  progres,
  kategori,
  totalPlan,
  totalReal,
  projectId,
  namaProyek,
}: {
  jenis: "hpp" | "ops";
  businessPlanId: string;
  bolehUbah: boolean;
  progres: number;
  kategori: KategoriRencana[];
  totalPlan: number;
  totalReal: number;
  /** Operasional saja — untuk tombol "Catat Biaya Operasional". */
  projectId?: string;
  namaProyek?: string;
}) {
  const [tutup, setTutup] = useState<Record<string, boolean>>({});
  const pilihan = kategori.map((k) => ({ id: k.id, nama: k.nama }));

  const judul = jenis === "hpp" ? "Rencana HPP" : "Rencana Biaya Operasional";
  const keterangan =
    jenis === "hpp"
      ? "Satu tabel, dirinci per kategori ala RAB. Klik baris kategori untuk melipat. Kolom Realisasi & Serapan dari pengeluaran tercatat."
      : "Satu tabel, dirinci per kategori ala RAB. Klik baris kategori untuk melipat. Realisasi dicocokkan lewat nama kategori dari biaya operasional yang dicatat.";

  const FormBaris = jenis === "hpp" ? FormBarisHpp : FormBarisOperasional;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px", borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
        }}
      >
        <div>
          <div className="eyebrow">{judul}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, maxWidth: 620, lineHeight: 1.5 }}>
            {keterangan}
          </div>
        </div>
        {bolehUbah && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {jenis === "ops" && projectId && namaProyek && (
              <CatatBiayaOperasional projectId={projectId} namaProyek={namaProyek} pos={kategori.map((k) => k.nama)} />
            )}
            <FormBaris businessPlanId={businessPlanId} pilihanKategori={pilihan} />
          </div>
        )}
      </div>

      <Tabel
        kolom={[
          { label: "Uraian", minLebar: 220 },
          { label: "Volume", rata: "kanan" },
          { label: "Satuan" },
          { label: "Harga Satuan", rata: "kanan" },
          { label: "Plan", rata: "kanan" },
          { label: "Realisasi", rata: "kanan" },
          { label: "Serapan", minLebar: 150 },
          bolehUbah && { lebar: 56 },
        ]}
        kosong="Belum ada kategori. Klik “Tambah Baris” dan pilih “＋ Kategori baru…”."
      >
        {kategori.flatMap((k) => {
          const dilipat = tutup[k.id];
          return [
            <tr
              key={`k-${k.id}`}
              style={{ background: "var(--rona-abu)", cursor: "pointer" }}
              onClick={() => setTutup((s) => ({ ...s, [k.id]: !s[k.id] }))}
            >
              <td colSpan={4} style={{ fontWeight: 700 }}>
                <ChevronDown
                  size={13}
                  style={{ verticalAlign: "-2px", marginRight: 5, color: "var(--muted)", transform: dilipat ? "rotate(-90deg)" : "none", transition: "transform .15s" }}
                />
                {k.nama}
                {k.sumber && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 400, paddingLeft: 18 }}>
                    realisasi: {k.sumber}
                  </div>
                )}
              </td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(k.plan)}</td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(k.real)}</td>
              <td><SerapanSel plan={k.plan} real={k.real} progres={progres} /></td>
              {bolehUbah && (
                <td onClick={(e) => e.stopPropagation()}>
                  <MenuAksi>
                    {jenis === "hpp" ? (
                      <>
                        <FormKategoriHpp businessPlanId={businessPlanId} kategori={k} />
                        <HapusKategoriHpp id={k.id} nama={k.nama} />
                      </>
                    ) : (
                      <>
                        <FormKategoriOperasional businessPlanId={businessPlanId} kategori={k} />
                        <HapusKategoriOperasional id={k.id} nama={k.nama} />
                      </>
                    )}
                  </MenuAksi>
                </td>
              )}
            </tr>,
            ...(dilipat
              ? []
              : k.rows.length === 0
                ? [
                    <tr key={`kosong-${k.id}`}>
                      <td colSpan={bolehUbah ? 8 : 7} style={{ color: "var(--muted)", fontStyle: "italic", paddingLeft: 24 }}>
                        Belum ada baris pada kategori ini.
                      </td>
                    </tr>,
                  ]
                : k.rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ paddingLeft: 24 }}>{row.uraian}</td>
                      <td style={{ textAlign: "right" }}>{row.volume.toLocaleString("id-ID")}</td>
                      <td style={{ color: "var(--muted)" }}>{row.satuan}</td>
                      <td className="num" style={{ textAlign: "right" }}>{rp(row.harga)}</td>
                      <td className="num" style={{ textAlign: "right" }}>{rp(row.volume * row.harga)}</td>
                      <td />
                      <td />
                      {bolehUbah && (
                        <td>
                          <MenuAksi>
                            {jenis === "hpp" ? (
                              <>
                                <FormBarisHpp businessPlanId={businessPlanId} pilihanKategori={pilihan} kategoriTerpilih={k.id} baris={row} />
                                <HapusBarisHpp id={row.id} uraian={row.uraian} />
                              </>
                            ) : (
                              <>
                                <FormBarisOperasional businessPlanId={businessPlanId} pilihanKategori={pilihan} kategoriTerpilih={k.id} baris={{ id: row.id, nama: row.uraian, satuan: row.satuan, volume: row.volume, harga: row.harga }} />
                                <HapusBarisOperasional id={row.id} nama={row.uraian} />
                              </>
                            )}
                          </MenuAksi>
                        </td>
                      )}
                    </tr>
                  ))),
          ];
        })}
        {kategori.length > 0 && (
          <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
            <td colSpan={4} style={{ textAlign: "right" }}>
              {jenis === "hpp" ? "TOTAL HPP" : "TOTAL OPERASIONAL"}
            </td>
            <td className="num" style={{ textAlign: "right" }}>{rp(totalPlan)}</td>
            <td className="num" style={{ textAlign: "right" }}>{rp(totalReal)}</td>
            <td><SerapanSel plan={totalPlan} real={totalReal} progres={progres} /></td>
            {bolehUbah && <td />}
          </tr>
        )}
      </Tabel>
    </div>
  );
}
