"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useActionState } from "react";
import { ChevronDown, Download, Trash2, Trophy } from "lucide-react";
import { useToast } from "@/components/toast";
import { FormModal, TombolTambah } from "@/components/form";
import type { HasilAksi } from "@/lib/actions/guard";
import { rp } from "@/lib/format";
import {
  hapusVendorPembanding, simpanPemenang, simpanPenawaranVendor, tambahVendorPembanding,
} from "../actions";

/**
 * Tabel perbandingan penawaran vendor atas sebuah RAB Estimasi Final.
 *
 * Melebur dari modul Tender lama. HPS = harga satuan RAB (rahasia dari vendor).
 * QS memasukkan total harga per baris tiap vendor; pemenang ditetapkan PER GRUP
 * (satu vendor mengerjakan seluruh grup), disimpan per baris di
 * `RabEstimasiItem.pemenangVendorId`.
 */

export interface VendorKolom {
  vendorId: string;
  nama: string;
  bidang: string;
}

export interface BarisRabUi {
  id: string;
  grup: string;
  uraian: string;
  satuan: string;
  volume: number;
  hpsHargaSatuan: number;
  pemenangVendorId: string | null;
  bids: { vendorId: string; hargaSatuan: number }[];
}

const sel = (itemId: string, vendorId: string) => `${itemId}__${vendorId}`;
const styInput: CSSProperties = { textAlign: "right", padding: "4px 8px", fontSize: 12, width: 118, fontVariantNumeric: "tabular-nums" };
const RONA_MENANG = "var(--rona-hijau2)";
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

function useKirim(aksi: (s: HasilAksi | null, f: FormData) => Promise<HasilAksi>) {
  const [hasil, kirim] = useActionState(aksi, null);
  const { tampil } = useToast();
  useEffect(() => {
    if (hasil) tampil(hasil.ok ? (hasil.pesan ?? "Tersimpan.") : hasil.error);
  }, [hasil, tampil]);
  return kirim;
}

export function TambahVendorPembanding({
  rabEstimasiId, kandidat,
}: {
  rabEstimasiId: string;
  kandidat: { id: string; nama: string; bidang: string }[];
}) {
  if (kandidat.length === 0) return null;
  return (
    <FormModal
      judul="Tambah Vendor Pembanding"
      keterangan="Vendor yang penawarannya akan Anda bandingkan. Harga diisi setelah ini di tabel."
      aksi={tambahVendorPembanding}
      labelSimpan="Tambah"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Vendor Pembanding" />}
    >
      <input type="hidden" name="rabEstimasiId" value={rabEstimasiId} />
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
          Vendor <span style={{ color: "var(--red)" }}>*</span>
        </label>
        <select name="vendorId" className="inp" required defaultValue="">
          <option value="" disabled>— pilih vendor —</option>
          {kandidat.map((v) => (
            <option key={v.id} value={v.id}>{v.nama} · {v.bidang}</option>
          ))}
        </select>
      </div>
    </FormModal>
  );
}

export function MatriksPerbandingan({
  rabEstimasiId, bolehKelola, vendors, items,
}: {
  rabEstimasiId: string;
  bolehKelola: boolean;
  vendors: VendorKolom[];
  items: BarisRabUi[];
}) {
  const bisaSunting = bolehKelola;
  const namaVendor = useMemo(() => new Map(vendors.map((v) => [v.vendorId, v.nama])), [vendors]);

  const totalAwal = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of items) for (const b of it.bids) m[sel(it.id, b.vendorId)] = String(b.hargaSatuan * it.volume);
    return m;
  }, [items]);
  const [total, setTotal] = useState<Record<string, string>>(totalAwal);

  const grup = useMemo(() => {
    const peta = new Map<string, BarisRabUi[]>();
    for (const it of items) (peta.get(it.grup) ?? peta.set(it.grup, []).get(it.grup)!).push(it);
    return [...peta.entries()].map(([nama, list]) => ({ nama, list }));
  }, [items]);

  const pemenangAwal = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of grup) {
      const first = g.list[0]?.pemenangVendorId ?? "";
      m[g.nama] = first && g.list.every((it) => it.pemenangVendorId === first) ? first : "";
    }
    return m;
  }, [grup]);
  const [pemenang, setPemenang] = useState<Record<string, string>>(pemenangAwal);

  useEffect(() => setTotal(totalAwal), [totalAwal]);
  useEffect(() => setPemenang(pemenangAwal), [pemenangAwal]);

  const [tutup, setTutup] = useState<Record<string, boolean>>({});
  const kirimPenawaran = useKirim(simpanPenawaranVendor);
  const kirimPemenang = useKirim(simpanPemenang);

  const angka = (s?: string) => {
    const n = Number((s ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const adaBidTersimpan = (it: BarisRabUi, vendorId: string) => it.bids.some((b) => b.vendorId === vendorId);
  const terendahBaris = (it: BarisRabUi) => (it.bids.length ? Math.min(...it.bids.map((b) => b.hargaSatuan)) : null);

  const rekapGrupVendor = (list: BarisRabUi[], vid: string) => {
    let total = 0;
    let terisi = 0;
    for (const it of list) {
      const b = it.bids.find((x) => x.vendorId === vid);
      if (b) { total += b.hargaSatuan * it.volume; terisi += 1; }
    }
    return { total, terisi, lengkap: terisi === list.length };
  };
  const vendorLengkap = (list: BarisRabUi[]) =>
    vendors.filter((v) => list.every((it) => adaBidTersimpan(it, v.vendorId)));
  const terendahGrup = (list: BarisRabUi[]) => {
    const lengkap = vendorLengkap(list);
    if (lengkap.length === 0) return null;
    return lengkap.reduce((best, v) =>
      rekapGrupVendor(list, v.vendorId).total < rekapGrupVendor(list, best.vendorId).total ? v : best,
    ).vendorId;
  };

  const satuanDari = (totalStr: string | undefined, volume: number) =>
    volume > 0 ? angka(totalStr) / volume : 0;

  const kolomBerubah = (vendorId: string) =>
    items.some((it) => angka(totalAwal[sel(it.id, vendorId)]) !== angka(total[sel(it.id, vendorId)]));
  const pemenangBerubah = grup.some((g) => (pemenang[g.nama] ?? "") !== (pemenangAwal[g.nama] ?? ""));

  const payloadKolom = (vendorId: string) =>
    JSON.stringify(items.map((it) => ({ rabEstimasiItemId: it.id, hargaSatuan: satuanDari(total[sel(it.id, vendorId)], it.volume) })));
  const payloadPemenang = JSON.stringify(items.map((it) => ({ rabEstimasiItemId: it.id, vendorId: pemenang[it.grup] ?? "" })));

  const totalVendor = (vendorId: string) => items.reduce((s, it) => s + angka(total[sel(it.id, vendorId)]), 0);
  const totalHps = items.reduce((s, it) => s + it.hpsHargaSatuan * it.volume, 0);

  return (
    <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div className="eyebrow">Perbandingan Penawaran Vendor</div>
        {bisaSunting && (
          <FormPemenang rabEstimasiId={rabEstimasiId} kirim={kirimPemenang} payload={payloadPemenang} aktif={pemenangBerubah} />
        )}
      </div>

      <div className="tablewrap" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 680 }}>
          <thead>
            <tr>
              <th style={{ width: 34 }}>No.</th>
              <th style={{ textAlign: "left", minWidth: 230 }}>Uraian Pekerjaan</th>
              <th style={{ textAlign: "right", width: 64 }}>Vol</th>
              <th style={{ textAlign: "left", width: 52 }}>Sat</th>
              <th style={{ textAlign: "right", width: 132 }}>HPS</th>
              {vendors.map((v) => (
                <th key={v.vendorId} style={{ textAlign: "right", minWidth: 132 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontWeight: 700, lineHeight: 1.2 }}>{v.nama}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>{v.bidang}</span>
                    {bisaSunting && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                        <FormSimpanKolom rabEstimasiId={rabEstimasiId} vendorId={v.vendorId} kirim={kirimPenawaran} payload={payloadKolom(v.vendorId)} aktif={kolomBerubah(v.vendorId)} />
                        <HapusVendorKolom rabEstimasiId={rabEstimasiId} vendorId={v.vendorId} nama={v.nama} />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {grup.map((g, gi) => {
              const dilipat = tutup[g.nama];
              const totalGrupHps = g.list.reduce((s, it) => s + it.hpsHargaSatuan * it.volume, 0);
              const menang = pemenang[g.nama] ?? "";
              const lengkap = vendorLengkap(g.list);
              const terendahVid = terendahGrup(g.list);
              const opsi = vendors.filter((v) => lengkap.some((l) => l.vendorId === v.vendorId) || menang === v.vendorId);

              return (
                <Fragment key={g.nama}>
                  <tr style={{ background: "var(--rona-abu)" }}>
                    <td style={{ fontWeight: 700, verticalAlign: "middle", textAlign: "left" }}>{ROMAWI[gi] ?? gi + 1}</td>
                    <td colSpan={4} style={{ verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setTutup((s) => ({ ...s, [g.nama]: !s[g.nama] }))}
                          style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", padding: 0, display: "inline-flex", alignItems: "center", gap: 4, color: "inherit" }}
                        >
                          <ChevronDown size={13} style={{ color: "var(--muted)", transform: dilipat ? "rotate(-90deg)" : "none", transition: "transform .15s" }} />
                          <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>{g.nama}</span>
                          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 11.5 }}>
                            {" · "}{g.list.length} baris · HPS {rp(totalGrupHps)}
                          </span>
                        </button>

                        {bisaSunting ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>Pemenang grup</span>
                            {opsi.length === 0 ? (
                              <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>lengkapi harga semua baris dulu</span>
                            ) : (
                              <select
                                className="inp"
                                value={menang}
                                onChange={(e) => setPemenang((p) => ({ ...p, [g.nama]: e.target.value }))}
                                style={{ width: "auto", fontSize: 11.5, padding: "3px 8px" }}
                              >
                                <option value="">— belum —</option>
                                {opsi.map((v) => (
                                  <option key={v.vendorId} value={v.vendorId}>{namaVendor.get(v.vendorId)}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : menang ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--green)", fontWeight: 700, fontSize: 12 }}>
                            <Trophy size={12} /> {namaVendor.get(menang)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic" }}>belum ditetapkan</span>
                        )}
                      </div>
                    </td>

                    {vendors.map((v) => {
                      const { total, terisi, lengkap: komplet } = rekapGrupVendor(g.list, v.vendorId);
                      const isMenang = menang === v.vendorId;
                      const isTerendah = komplet && v.vendorId === terendahVid;
                      return (
                        <td key={v.vendorId} style={{ textAlign: "right", verticalAlign: "middle", background: isMenang ? RONA_MENANG : undefined }}>
                          {terisi === 0 ? (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span className="num" style={{ fontWeight: 700, color: isMenang || isTerendah ? "var(--green)" : undefined }}>{rp(total)}</span>
                              {!komplet && <span style={{ fontSize: 9.5, color: "var(--amber)" }}>{terisi}/{g.list.length} baris</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {!dilipat &&
                    g.list.map((it, ii) => {
                      const min = terendahBaris(it);
                      return (
                        <tr key={it.id}>
                          <td style={{ color: "var(--muted)", verticalAlign: "top", textAlign: "left" }}>{ii + 1}</td>
                          <td style={{ verticalAlign: "top" }}>{it.uraian}</td>
                          <td style={{ textAlign: "right", verticalAlign: "top" }}>{it.volume.toLocaleString("id-ID")}</td>
                          <td style={{ color: "var(--muted)", verticalAlign: "top" }}>{it.satuan}</td>
                          <td style={{ textAlign: "right", verticalAlign: "top" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span className="num" style={{ fontWeight: 600 }}>{rp(it.hpsHargaSatuan * it.volume)}</span>
                              <span style={{ fontSize: 10, color: "var(--muted)" }}>{rp(it.hpsHargaSatuan)}/{it.satuan}</span>
                            </div>
                          </td>
                          {vendors.map((v) => {
                            const k = sel(it.id, v.vendorId);
                            const totalCell = angka(total[k]);
                            const satuanCell = it.volume > 0 ? totalCell / it.volume : 0;
                            const tersimpan = adaBidTersimpan(it, v.vendorId);
                            const terendah = min != null && tersimpan && it.bids.find((b) => b.vendorId === v.vendorId)?.hargaSatuan === min;
                            const isMenang = (pemenang[it.grup] ?? "") === v.vendorId;
                            return (
                              <td key={v.vendorId} style={{ textAlign: "right", verticalAlign: "top", background: isMenang ? RONA_MENANG : undefined }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                  {bisaSunting ? (
                                    <input
                                      className="inp"
                                      inputMode="decimal"
                                      value={total[k] ?? ""}
                                      onChange={(e) => setTotal((t) => ({ ...t, [k]: e.target.value }))}
                                      placeholder="—"
                                      style={{ ...styInput, ...(terendah && { borderColor: "var(--green)", color: "var(--green)", fontWeight: 600 }) }}
                                    />
                                  ) : (
                                    <span className="num" style={{ color: terendah ? "var(--green)" : undefined, fontWeight: terendah ? 700 : 400 }}>
                                      {totalCell > 0 ? rp(totalCell) : "—"}
                                    </span>
                                  )}
                                  <span style={{ fontSize: 10, color: "var(--muted)", minHeight: 13 }}>
                                    {totalCell > 0 ? `${rp(satuanCell)}/${it.satuan}` : " "}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>

          <tfoot>
            <tr style={{ borderTop: "2px solid var(--line)" }}>
              <td colSpan={4} style={{ fontWeight: 700, textAlign: "right" }}>TOTAL RAB</td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(totalHps)}</td>
              {vendors.map((v) => {
                const t = totalVendor(v.vendorId);
                return (
                  <td key={v.vendorId} className="num" style={{ textAlign: "right", fontWeight: 700, color: t > 0 && t <= totalHps ? "var(--green)" : undefined }}>
                    {t > 0 ? rp(t) : "—"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function FormSimpanKolom({
  rabEstimasiId, vendorId, kirim, payload, aktif,
}: {
  rabEstimasiId: string; vendorId: string; kirim: (f: FormData) => void; payload: string; aktif: boolean;
}) {
  return (
    <form action={kirim} style={{ display: "inline" }}>
      <input type="hidden" name="rabEstimasiId" value={rabEstimasiId} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="penawaran" value={payload} />
      <button type="submit" className="pill" disabled={!aktif} style={{ fontSize: 10, padding: "1px 8px", opacity: aktif ? 1 : 0.5 }}>
        Simpan
      </button>
    </form>
  );
}

function FormPemenang({
  rabEstimasiId, kirim, payload, aktif,
}: {
  rabEstimasiId: string; kirim: (f: FormData) => void; payload: string; aktif: boolean;
}) {
  return (
    <form action={kirim} style={{ display: "inline" }}>
      <input type="hidden" name="rabEstimasiId" value={rabEstimasiId} />
      <input type="hidden" name="pemenang" value={payload} />
      <button type="submit" className="btn" disabled={!aktif} style={{ opacity: aktif ? 1 : 0.5 }}>
        <Trophy size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
        Simpan Pemenang
      </button>
    </form>
  );
}

function HapusVendorKolom({ rabEstimasiId, vendorId, nama }: { rabEstimasiId: string; vendorId: string; nama: string }) {
  const [siap, setSiap] = useState(false);
  const kirim = useKirim(hapusVendorPembanding);
  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => setSiap(false), 4000);
    return () => clearTimeout(t);
  }, [siap]);
  if (!siap) {
    return (
      <button
        type="button"
        title={`Keluarkan ${nama} dari perbandingan`}
        onClick={() => setSiap(true)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}
      >
        <Trash2 size={12} />
      </button>
    );
  }
  return (
    <form action={kirim} style={{ display: "inline" }}>
      <input type="hidden" name="rabEstimasiId" value={rabEstimasiId} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <button type="submit" style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 600, padding: "2px 6px", cursor: "pointer" }}>
        Yakin?
      </button>
    </form>
  );
}

export function UnduhTemplateBoq({ rabEstimasiId }: { rabEstimasiId: string }) {
  return (
    <a
      className="pill"
      href={`/estimasi/${rabEstimasiId}/template`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}
    >
      <Download size={13} />
      Template BOQ
    </a>
  );
}
