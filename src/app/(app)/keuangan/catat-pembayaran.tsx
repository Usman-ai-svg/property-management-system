"use client";

import { useState } from "react";
import { BarisField, Field, FieldTerkunci, FormModal, TombolTambah } from "@/components/form";
import { AlokasiBiaya } from "@/components/alokasi-biaya";
import {
  JENIS_BIAYA_SWAKELOLA, METODE_BAYAR, PERUNTUKAN_BIAYA, SASARAN_PERUNTUKAN,
} from "@/lib/domain/enums";
import { rp } from "@/lib/format";
import { catatPengeluaran, bayarPembelian } from "./actions";
import { tambahPembayaran } from "../vendor/actions";

/**
 * Pintu masuk TUNGGAL pencatatan uang keluar proyek.
 *
 * Langkah 1 memilih SUMBER; itu menentukan ke mesin mana pembayaran disalurkan
 * (kontrak → `tambahPembayaran`, PO → `bayarPembelian`, lain → `catatPengeluaran`).
 * Ketiganya memakai TATA LETAK ISIAN yang sama; yang membedakan hanyalah field
 * mana yang TERKUNCI karena nilainya sudah ditentukan sumbernya:
 *  - Kontrak: peruntukan (dari jenis kontrak), jenis biaya, dan pembebanan
 *    (otomatis per cakupan kontrak) — terkunci.
 *  - PO: jenis biaya "Material" — terkunci; peruntukan & pembebanan tetap dipilih
 *    (material bisa ke unit atau sarpras).
 *  - Pengeluaran lain: semua bebas diisi.
 *
 * Dengan menyalurkan pembayaran kontrak/PO ke jalurnya, pencatatan manual tak
 * bisa lagi menduplikasi pembayaran yang seharusnya tertaut. Semua di bawah izin
 * "keuangan".
 */

type Objek = { id: string; label: string };

export type ProyekBayar = {
  id: string;
  nama: string;
  units: Objek[];
  sarpras: Objek[];
  kontrak: {
    id: string; label: string;
    nilai: number; terbayar: number; sisa: number; retensi: number; retensiPct: number;
    peruntukan: string; jenisBiaya: string; cakupan: number;
  }[];
  po: { id: string; label: string; sisa: number; diterima: boolean }[];
};

const SUMBER = [
  ["kontrak", "Pembayaran Kontrak"],
  ["po", "Pembayaran PO"],
  ["manual", "Pengeluaran Lain"],
] as const;
type Sumber = (typeof SUMBER)[number][0];

export function CatatPembayaran({ proyek }: { proyek: ProyekBayar[] }) {
  const [sumber, setSumber] = useState<Sumber>("kontrak");
  const [projectId, setProjectId] = useState(proyek[0]?.id ?? "");
  const [peruntukan, setPeruntukan] = useState<string>(PERUNTUKAN_BIAYA[0]);
  const [jumlah, setJumlah] = useState("");
  const [kontrakId, setKontrakId] = useState("");
  const [poId, setPoId] = useState("");

  if (proyek.length === 0) return null;

  const aktif = proyek.find((p) => p.id === projectId) ?? proyek[0];
  const nominal = Number(jumlah) || 0;

  const kontrakAktif = aktif.kontrak.find((k) => k.id === (kontrakId || aktif.kontrak[0]?.id));
  const poAktif = aktif.po.find((b) => b.id === (poId || aktif.po[0]?.id));

  // Peruntukan efektif: untuk kontrak diturunkan (terkunci), selain itu dari state.
  const peruntukanEfektif = sumber === "kontrak" ? (kontrakAktif?.peruntukan ?? "") : peruntukan;
  const sasaran = SASARAN_PERUNTUKAN[peruntukanEfektif as keyof typeof SASARAN_PERUNTUKAN]
    ?? { unit: false, sarpras: false };
  const adaObjek = sasaran.unit || sasaran.sarpras;

  const aksi =
    sumber === "kontrak" ? tambahPembayaran : sumber === "po" ? bayarPembelian : catatPengeluaran;

  const keterangan =
    sumber === "kontrak"
      ? "Peruntukan & pembebanan mengikuti kontrak (terkunci). Field lain bebas diisi."
      : sumber === "po"
        ? "Tiap pembayaran PO menjadi satu pengeluaran (jenis biaya Material, terkunci)."
        : "Pengeluaran lepas — bukan pembayaran kontrak atau PO.";

  const gantiProyek = (id: string) => {
    setProjectId(id);
    setKontrakId("");
    setPoId("");
  };

  const kosong =
    (sumber === "kontrak" && aktif.kontrak.length === 0) ||
    (sumber === "po" && aktif.po.length === 0);

  const namaJumlah = sumber === "kontrak" ? "nominal" : "total";
  const sisaMaks = sumber === "kontrak" ? kontrakAktif?.sisa : sumber === "po" ? poAktif?.sisa : undefined;

  return (
    <FormModal
      judul="Catat Pembayaran"
      keterangan={keterangan}
      aksi={aksi}
      labelSimpan="Catat"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Pembayaran" />}
    >
      {/* Langkah 1 — pilih sumber */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          Sumber pembayaran
        </label>
        <select
          className="inp"
          value={sumber}
          onChange={(e) => setSumber(e.target.value as Sumber)}
        >
          {SUMBER.map(([nilai, label]) => (
            <option key={nilai} value={nilai}>{label}</option>
          ))}
        </select>
      </div>

      {/* Proyek + Peruntukan */}
      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Proyek <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select
            // Hanya jalur manual yang butuh projectId; kontrak/PO menurunkannya
            // dari item terpilih. Tetap ditampilkan untuk menyaring daftar.
            name={sumber === "manual" ? "projectId" : undefined}
            className="inp"
            value={projectId}
            onChange={(e) => gantiProyek(e.target.value)}
            required={sumber === "manual"}
          >
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
        {sumber === "kontrak" ? (
          <FieldTerkunci label="Peruntukan" nilai={kontrakAktif?.peruntukan ?? "—"} />
        ) : (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Peruntukan
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
        )}
      </BarisField>

      {/* Pemilih kontrak / PO */}
      {sumber === "kontrak" && !kosong && (
        <>
          <BarisField kolom={1}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Kontrak <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <select
                name="contractId"
                className="inp"
                value={kontrakId || aktif.kontrak[0].id}
                onChange={(e) => setKontrakId(e.target.value)}
                required
              >
                {aktif.kontrak.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
            </div>
          </BarisField>

          {/* Ringkasan nilai kontrak terpilih — sisa pembayaran kini hidup di
              sini, bukan lagi diimpit ke dalam nama pilihan. */}
          {kontrakAktif && (
            <div
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 18px",
                padding: "11px 14px", marginBottom: 14,
                background: "var(--rona-panel)", borderRadius: 8,
              }}
            >
              <InfoNilai label="Nilai kontrak" nilai={rp(kontrakAktif.nilai)} />
              <InfoNilai label="Total terbayar" nilai={rp(kontrakAktif.terbayar)} warna="var(--green)" />
              <InfoNilai label="Sisa pembayaran" nilai={rp(kontrakAktif.sisa)} warna="var(--amber)" />
              <InfoNilai
                label="Retensi"
                nilai={
                  kontrakAktif.retensiPct > 0
                    ? `${kontrakAktif.retensiPct}% · ${rp(kontrakAktif.retensi)}`
                    : "—"
                }
              />
            </div>
          )}
        </>
      )}
      {sumber === "po" && !kosong && (
        <BarisField kolom={1}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              PO Material <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <select
              name="pembelianId"
              className="inp"
              value={poId || aktif.po[0].id}
              onChange={(e) => setPoId(e.target.value)}
              required
            >
              {aktif.po.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} — sisa {rp(b.sisa)}{b.diterima ? "" : " · belum diterima"}
                </option>
              ))}
            </select>
          </div>
        </BarisField>
      )}

      {kosong ? (
        <PesanKosong>
          {sumber === "kontrak"
            ? "Tak ada kontrak dengan sisa bayar pada proyek ini — kelola kontrak di modul Vendor."
            : "Tak ada PO dengan sisa bayar pada proyek ini — buat PO lewat kartu Pembelian Material di halaman proyek."}
        </PesanKosong>
      ) : (
        <>
          {/* Jenis + Metode */}
          <BarisField>
            {sumber === "manual" ? (
              <Field label="Jenis Biaya" nama="jenis" nilai="Upah Borongan" pilihan={JENIS_BIAYA_SWAKELOLA} />
            ) : (
              <FieldTerkunci
                label="Jenis Biaya"
                nilai={sumber === "kontrak" ? (kontrakAktif?.jenisBiaya ?? "—") : "Material"}
              />
            )}
            <Field label="Metode" nama="metode" nilai={METODE_BAYAR[0]} pilihan={METODE_BAYAR} />
          </BarisField>

          {/* Keterangan */}
          <BarisField kolom={1}>
            <Field
              label="Keterangan"
              nama="uraian"
              wajib={sumber !== "po"}
              petunjuk={sumber === "po" ? "opsional" : "mis. Termin 3 borongan struktur"}
            />
          </BarisField>

          {/* Nominal */}
          <BarisField kolom={1}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Nominal <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="inp"
                  type="number"
                  name={namaJumlah}
                  value={jumlah}
                  onChange={(e) => setJumlah(e.target.value)}
                  required
                  min={1}
                  max={sisaMaks}
                  style={{ paddingRight: 34 }}
                />
                <span style={{ position: "absolute", right: 10, top: 9, fontSize: 11.5, color: "var(--muted)", pointerEvents: "none" }}>Rp</span>
              </div>
              {sisaMaks != null && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Maks {rp(sisaMaks)}</div>
              )}
            </div>
          </BarisField>

          {/* Dibebankan ke */}
          {sumber === "kontrak" ? (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Dibebankan ke
              </label>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, padding: "10px 12px", background: "var(--rona-panel)", borderRadius: 8 }}>
                {(kontrakAktif?.cakupan ?? 0) > 0
                  ? <>Otomatis dibagi ke <b>{kontrakAktif?.cakupan} objek</b> cakupan kontrak, menurut porsi nilainya — terkunci.</>
                  : <>Kontrak tanpa cakupan objek → tercatat sebagai <b>biaya level proyek</b>.</>}
              </div>
            </div>
          ) : (
            <Pembebanan
              adaObjek={adaObjek}
              peruntukan={peruntukanEfektif}
              nominal={nominal}
              kunci={`${sumber}_${projectId}_${poId}_${peruntukanEfektif}`}
              units={sasaran.unit ? aktif.units : []}
              sarpras={sasaran.sarpras ? aktif.sarpras : []}
            />
          )}

          {/* Bukti */}
          <BarisField kolom={1}>
            <Field label="Nama berkas bukti" nama="bukti" petunjuk="Berkasnya belum diunggah pada demo ini" />
          </BarisField>
        </>
      )}
    </FormModal>
  );
}

function Pembebanan({
  adaObjek, peruntukan, nominal, kunci, units, sarpras,
}: {
  adaObjek: boolean;
  peruntukan: string;
  nominal: number;
  kunci: string;
  units: Objek[];
  sarpras: Objek[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
        Dibebankan ke{adaObjek && <span style={{ color: "var(--red)" }}> *</span>}
      </label>
      {adaObjek ? (
        <>
          <AlokasiBiaya key={kunci} total={nominal} pilihan={{ units, sarpras }} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
            Satu pembayaran tetap tersimpan sebagai <b>satu baris transaksi</b>; hanya
            pembebanannya yang dipecah, dan jumlahnya harus pas dengan nominal di atas.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
          Peruntukan <b>{peruntukan}</b> adalah <b>biaya level proyek</b> — tidak menempel pada
          unit maupun sarana &amp; prasarana.
        </div>
      )}
    </div>
  );
}

function InfoNilai({ label, nilai, warna }: { label: string; nilai: string; warna?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 12 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="num" style={{ fontWeight: 600, color: warna ?? "var(--text)" }}>{nilai}</span>
    </div>
  );
}

function PesanKosong({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
        padding: "12px 14px", background: "var(--rona-panel)", borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}
