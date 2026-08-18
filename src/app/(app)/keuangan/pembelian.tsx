"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { BarisField, Field, FieldTerkunci, FormModal, TombolHapus, TombolTambah } from "@/components/form";
import { AlokasiBiaya } from "@/components/alokasi-biaya";
import { Badge } from "@/components/ui";
import { Tabel } from "@/components/kartu-tabel";
import { METODE_TUNAI, PERUNTUKAN_BIAYA, SASARAN_PERUNTUKAN } from "@/lib/domain/enums";
import { rp, tanggal, tanggalJam } from "@/lib/format";
import { bayarPembelian, buatPembelian, hapusPembayaran, hapusPembelian, terimaPembelian } from "./actions";

/**
 * Pembelian material (PO) sebuah proyek — SATU-SATUNYA tempat belanja material
 * dicatat. Dulu di modul Estimasi (Pemasok); dipindah ke sini agar uang keluar
 * hanya punya satu pintu.
 *
 * "Bayar" lepas dari "terima": pembayaran boleh dicatat kapan saja — DP/uang
 * muka atau pelunasan di depan sebelum barang datang, maupun termin biasa
 * setelah barang diterima. `Diterima` murni penanda barang fisik sudah datang.
 * Label status menggabungkan dua sumbu itu (lihat `statusPO`).
 */

const WARNA_STATUS_PO: Record<string, [string, string]> = {
  Draft: ["var(--rona-amber)", "var(--amber)"],
  DP: ["var(--rona-brass)", "var(--brass)"],
  "Dibayar Penuh": ["var(--rona-ungu)", "var(--ungu)"],
  Diterima: ["var(--rona-biru)", "var(--blue)"],
  Lunas: ["var(--rona-hijau2)", "var(--green)"],
};

/**
 * Label status gabungan dari dua sumbu independen: barang sudah diterima?
 * (`diterima`) dan seberapa banyak sudah dibayar (`terbayar` vs `total`).
 *
 *  Belum diterima : Draft (belum bayar) · DP (sebagian) · Dibayar Penuh (lunas di muka)
 *  Sudah diterima : Diterima (masih ada sisa) · Lunas (sisa habis)
 */
function statusPO(diterima: boolean, total: number, terbayar: number): string {
  const lunasBayar = total > 0 && terbayar >= total;
  if (diterima) return lunasBayar ? "Lunas" : "Diterima";
  if (terbayar <= 0) return "Draft";
  return lunasBayar ? "Dibayar Penuh" : "DP";
}

export interface PemasokPilih {
  id: string;
  nama: string;
  kategori: string;
}

export interface HargaDasarPilih {
  id: string;
  kode: string;
  uraian: string;
  satuan: string;
  hargaAcuan: number;
}

export interface ObjekPilih {
  id: string;
  label: string;
}

export interface PembelianRow {
  id: string;
  nomor: string;
  status: string;
  tanggal: Date | string;
  keterangan: string | null;
  tanggalTerima: Date | string | null;
  penerima: string | null;
  pemasok: { id: string; nama: string; kategori: string };
  items: { id: string; uraian: string; satuan: string; qty: number; harga: number }[];
  pembayaran: { id: string; tanggal: Date | string; uraian: string; total: number; metode: string; status: string }[];
}

// ---------------------------------------------------------------------------
// Item barang (dipakai form Buat PO) — diserialkan ke JSON "items".
// ---------------------------------------------------------------------------

interface ItemBeli {
  uraian: string;
  satuan: string;
  qty: string;
  harga: string;
  hargaDasarId: string;
}
const ITEM_KOSONG: ItemBeli = { uraian: "", satuan: "", qty: "", harga: "", hargaDasarId: "" };

function IsianItemPembelian({ hargaDasar }: { hargaDasar: HargaDasarPilih[] }) {
  const [baris, setBaris] = useState<ItemBeli[]>([{ ...ITEM_KOSONG }]);
  const petaHd = new Map(hargaDasar.map((h) => [h.id, h]));

  const ubah = (i: number, patch: Partial<ItemBeli>) =>
    setBaris((b) => b.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  // Memilih harga dasar mengisi uraian/satuan/harga bila masih kosong.
  const pilihHd = (i: number, id: string) => {
    const hd = petaHd.get(id);
    setBaris((b) =>
      b.map((x, k) =>
        k === i
          ? {
              ...x, hargaDasarId: id,
              uraian: x.uraian || (hd?.uraian ?? ""),
              satuan: x.satuan || (hd?.satuan ?? ""),
              harga: x.harga || (hd ? String(hd.hargaAcuan) : ""),
            }
          : x,
      ),
    );
  };

  const total = baris.reduce((s, b) => s + (Number(b.qty) || 0) * (Number(b.harga) || 0), 0);

  return (
    <div>
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          baris.map((b) => ({
            uraian: b.uraian, satuan: b.satuan, qty: Number(b.qty), harga: Number(b.harga),
            hargaDasarId: b.hargaDasarId || null,
          })),
        )}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Barang Dibeli</label>
        <button
          type="button"
          className="btn-garis"
          style={{ fontSize: 11, padding: "3px 8px" }}
          onClick={() => setBaris((b) => [...b, { ...ITEM_KOSONG }])}
        >
          <Plus size={12} style={{ verticalAlign: "-2px" }} /> Baris
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {baris.map((b, i) => {
          const jml = (Number(b.qty) || 0) * (Number(b.harga) || 0);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 64px 96px 92px 26px", gap: 6, alignItems: "center" }}>
              <input className="inp" placeholder="Uraian barang" value={b.uraian} onChange={(e) => ubah(i, { uraian: e.target.value })} />
              <input className="inp" placeholder="satuan" value={b.satuan} onChange={(e) => ubah(i, { satuan: e.target.value })} />
              <input className="inp" inputMode="decimal" placeholder="qty" value={b.qty} onChange={(e) => ubah(i, { qty: e.target.value })} />
              <input className="inp" inputMode="numeric" placeholder="harga" value={b.harga} onChange={(e) => ubah(i, { harga: e.target.value })} />
              <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>{jml ? rp(jml) : "—"}</div>
              <button
                type="button"
                onClick={() => setBaris((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : x))}
                title="Hapus baris"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 2 }}
              >
                <Trash2 size={13} />
              </button>
              {hargaDasar.length > 0 && (
                <select
                  className="inp"
                  value={b.hargaDasarId}
                  onChange={(e) => pilihHd(i, e.target.value)}
                  style={{ gridColumn: "1 / span 5", fontSize: 11, color: "var(--muted)" }}
                >
                  <option value="">— taut price book (opsional) —</option>
                  {hargaDasar.map((h) => (
                    <option key={h.id} value={h.id}>{h.kode} · {h.uraian} ({h.satuan})</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "var(--rona-abu)", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span style={{ color: "var(--muted)" }}>Total pembelian</span>
        <span style={{ fontWeight: 700 }}>{rp(total)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aksi
// ---------------------------------------------------------------------------

export function BuatPO({
  projectId, proyekNama, pemasok, hargaDasar,
}: {
  projectId: string;
  proyekNama: string;
  pemasok: PemasokPilih[];
  hargaDasar: HargaDasarPilih[];
}) {
  if (pemasok.length === 0) return null;
  return (
    <FormModal
      judul="Buat PO Material"
      keterangan={`Pesanan pembelian material untuk ${proyekNama}. Satu PO bisa memuat banyak material; barang ditandai "Terima" saat datang, lalu dibayar bertermin.`}
      aksi={buatPembelian}
      labelSimpan="Buat PO"
      lebar={660}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Buat PO" />}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <BarisField>
        <Field label="Supplier" nama="pemasokId" pilihan={pemasok.map((p) => ({ nilai: p.id, label: `${p.nama} · ${p.kategori}` }))} wajib />
        <Field label="No. PO / Nota" nama="nomor" wajib petunjuk="mis. PO-2026-014" />
      </BarisField>
      <BarisField>
        <Field label="Tanggal" nama="tanggal" tipe="tanggal" />
        <Field label="Keterangan" nama="keterangan" petunjuk="opsional" />
      </BarisField>
      <IsianItemPembelian hargaDasar={hargaDasar} />
    </FormModal>
  );
}

/** Waktu sekarang dalam format yang diminta <input type="datetime-local">. */
function waktuLokalSekarang(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function TerimaPO({ id, nomor, namaPengguna }: { id: string; nomor: string; namaPengguna: string }) {
  return (
    <FormModal
      judul={`Terima Barang — ${nomor}`}
      keterangan="Catat kapan barang benar-benar datang dan siapa yang menerimanya. Ini bukti serah-terima fisik, terpisah dari tanggal PO diterbitkan."
      aksi={terimaPembelian}
      labelSimpan="Tandai Diterima"
      lebar={520}
      pemicu={(buka) => (
        <button
          type="button"
          className="btn-garis"
          onClick={buka}
          title={`Tandai barang PO ${nomor} diterima`}
          style={{ fontSize: 11, padding: "4px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <Check size={13} /> Terima Barang
        </button>
      )}
    >
      <input type="hidden" name="id" value={id} />
      <BarisField>
        <Field label="Tanggal & jam terima" nama="tanggalTerima" tipe="waktu" nilai={waktuLokalSekarang()} wajib />
        <Field label="Diterima oleh" nama="penerima" nilai={namaPengguna} petunjuk="nama penerima barang" wajib />
      </BarisField>
    </FormModal>
  );
}

function BayarPO({
  pembelianId, nomor, sisa, units, sarpras,
}: {
  pembelianId: string;
  nomor: string;
  sisa: number;
  units: ObjekPilih[];
  sarpras: ObjekPilih[];
}) {
  const [total, setTotal] = useState("");
  const [peruntukan, setPeruntukan] = useState<string>(PERUNTUKAN_BIAYA[0]);
  const nominal = Number(total) || 0;

  // Peruntukan menentukan sasaran yang boleh dibebani: unit-saja, sarpras-saja,
  // atau tidak keduanya (Perijinan/Pengolahan → biaya level proyek, tanpa panel
  // pembebanan). Sama persis seperti Catat Pengeluaran.
  const sasaran = SASARAN_PERUNTUKAN[peruntukan as keyof typeof SASARAN_PERUNTUKAN]
    ?? { unit: false, sarpras: false };
  const adaObjek = sasaran.unit || sasaran.sarpras;

  return (
    <FormModal
      judul={`Bayar — ${nomor}`}
      keterangan={
        `Sisa hutang ${rp(sisa)}. ` +
        "Tiap pembayaran menjadi satu pengeluaran proyek (jenis biaya Material)."
      }
      aksi={bayarPembelian}
      labelSimpan="Catat Pembayaran"
      lebar={560}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka} style={{ fontSize: 11, padding: "4px 9px" }}>
          Bayar
        </button>
      )}
    >
      <input type="hidden" name="pembelianId" value={pembelianId} />
      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Jumlah Bayar <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="inp"
              type="number"
              name="total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              required
              min={1}
              max={sisa}
              style={{ paddingRight: 34 }}
            />
            <span style={{ position: "absolute", right: 10, top: 9, fontSize: 11.5, color: "var(--muted)", pointerEvents: "none" }}>Rp</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Maks {rp(sisa)}</div>
        </div>
        <Field label="Tanggal" nama="tanggal" tipe="tanggal" />
      </BarisField>
      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Peruntukan <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select
            name="peruntukan"
            className="inp"
            value={peruntukan}
            onChange={(e) => setPeruntukan(e.target.value)}
          >
            {PERUNTUKAN_BIAYA.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <FieldTerkunci label="Jenis Biaya" nilai="Material" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Metode" nama="metode" nilai={METODE_TUNAI[0]} pilihan={METODE_TUNAI} />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Uraian" nama="uraian" petunjuk="opsional" />
      </BarisField>

      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 6, marginBottom: 5 }}>
        Dibebankan ke{adaObjek && <span style={{ color: "var(--red)" }}> *</span>}
      </label>
      {adaObjek ? (
        <>
          <AlokasiBiaya
            // Di-remount saat peruntukan berubah supaya sasaran lama (mis. unit)
            // tidak tertinggal saat peruntukan diganti ke sarpras.
            key={`${pembelianId}_${peruntukan}`}
            total={nominal}
            pilihan={{
              units: sasaran.unit ? units : [],
              sarpras: sasaran.sarpras ? sarpras : [],
            }}
          />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
            Pembayaran dibebankan ke objek sesuai <b>Peruntukan</b> di atas —{" "}
            {sasaran.unit ? "unit rumah" : "sarana & prasarana"}. Satu pembayaran tak boleh
            mencampur keduanya; pisahkan jadi beberapa pembayaran bila perlu.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
          Peruntukan <b>{peruntukan}</b> adalah <b>biaya level proyek</b> — tidak menempel pada
          unit maupun sarana &amp; prasarana, jadi tak perlu dibebankan ke objek tertentu.
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Field label="Nama berkas bukti" nama="bukti" petunjuk="opsional — berkasnya belum diunggah pada demo ini" />
      </div>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Panel utama
// ---------------------------------------------------------------------------

export function PanelPembelian({
  bolehKelola, pembelian, units, sarpras, namaPengguna,
}: {
  bolehKelola: boolean;
  pembelian: PembelianRow[];
  units: ObjekPilih[];
  sarpras: ObjekPilih[];
  /** Nama pengguna aktif — prisian awal "Diterima oleh" saat terima barang. */
  namaPengguna: string;
}) {
  const daftar = pembelian.map((b) => {
    const total = b.items.reduce((s, it) => s + it.qty * it.harga, 0);
    const terbayar = b.pembayaran.reduce((s, e) => s + e.total, 0);
    const hutang = total - terbayar;
    const lunas = total > 0 && hutang <= 0;
    const diterima = b.status === "Diterima";
    const statusTampil = statusPO(diterima, total, terbayar);
    return { ...b, total, terbayar, hutang, lunas, diterima, statusTampil };
  });

  if (daftar.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "6px 2px" }}>
        Belum ada PO material untuk proyek ini.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {daftar.map((b) => (
        <div key={b.id} className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                {b.nomor}
                <Badge nilai={b.statusTampil} peta={WARNA_STATUS_PO} />
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {b.pemasok.nama}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                {tanggal(b.tanggal)}{b.keterangan ? ` · ${b.keterangan}` : ""}
              </div>
              {b.diterima && b.tanggalTerima && (
                <div style={{ fontSize: 11.5, color: "var(--blue)", marginTop: 2 }}>
                  Barang diterima {tanggalJam(b.tanggalTerima)}
                  {b.penerima ? ` · oleh ${b.penerima}` : ""}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {bolehKelola && !b.diterima && <TerimaPO id={b.id} nomor={b.nomor} namaPengguna={namaPengguna} />}
              {bolehKelola && b.hutang > 0 && (
                <BayarPO
                  pembelianId={b.id}
                  nomor={b.nomor}
                  sisa={b.hutang}
                  units={units}
                  sarpras={sarpras}
                />
              )}
              {bolehKelola && b.terbayar === 0 && <HapusPembelian id={b.id} nomor={b.nomor} />}
            </div>
          </div>

          <Tabel
            kolom={[
              { label: "Barang", minLebar: 220 }, { label: "Satuan" }, { label: "Qty", rata: "kanan" },
              { label: "Harga", rata: "kanan" }, { label: "Jumlah", rata: "kanan" },
            ]}
            kosong="Tidak ada barang."
          >
            {b.items.map((it) => (
              <tr key={it.id}>
                <td>{it.uraian}</td>
                <td style={{ color: "var(--muted)" }}>{it.satuan}</td>
                <td style={{ textAlign: "right" }}>{it.qty.toLocaleString("id-ID")}</td>
                <td className="num" style={{ textAlign: "right" }}>{rp(it.harga)}</td>
                <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{rp(it.qty * it.harga)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--line)" }}>
              <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Total PO</td>
              <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{rp(b.total)}</td>
            </tr>
          </Tabel>

          {/* Termin pembayaran */}
          <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--line)", background: "var(--rona-abu)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
              Pembayaran · terbayar {rp(b.terbayar)} dari {rp(b.total)}
            </div>
            {b.pembayaran.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Belum ada pembayaran.
                {!b.diterima && " Pembayaran boleh dicatat walau barang belum diterima."}
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 11.5 }}>
                <tbody>
                  {b.pembayaran.map((e) => (
                    <tr key={e.id}>
                      <td style={{ padding: "2px 6px", color: "var(--muted)", width: 96 }}>{tanggal(e.tanggal)}</td>
                      <td style={{ padding: "2px 6px" }}>{e.uraian}</td>
                      <td style={{ padding: "2px 6px", color: "var(--muted)", width: 90 }}>{e.metode}</td>
                      <td className="num" style={{ padding: "2px 6px", textAlign: "right", fontWeight: 600, width: 120 }}>{rp(e.total)}</td>
                      {bolehKelola && (
                        <td style={{ padding: "2px 6px", width: 30, textAlign: "right" }}>
                          <HapusPembayaranPO id={e.id} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Sisa pembayaran — ditaruh di bawah termin agar terbaca sebagai
                penutup: total dikurangi seluruh termin di atasnya. */}
            <div
              style={{
                display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 8,
                marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", fontSize: 12,
              }}
            >
              <span style={{ color: "var(--muted)" }}>Sisa pembayaran</span>
              <span style={{ fontWeight: 700, color: b.hutang > 0 ? "var(--red)" : "var(--green)" }}>
                {rp(b.hutang)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HapusPembelian({ id, nomor }: { id: string; nomor: string }) {
  return <TombolHapus aksi={hapusPembelian} id={id} nama={`PO ${nomor}`} />;
}

function HapusPembayaranPO({ id }: { id: string }) {
  return <TombolHapus aksi={hapusPembayaran} id={id} nama="pembayaran ini" />;
}
