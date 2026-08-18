"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { BarisField, Field, FormModal } from "@/components/form";
import { JENIS_KONTRAK } from "@/lib/domain/enums";
import { rp } from "@/lib/format";
import { buatKontrakDariRab } from "../actions";

type Objek = { id: string; nama: string };

/**
 * Buat SPK dari baris yang dimenangkan seorang vendor pada RAB. Nilai & deskripsi
 * terisi dari baris menang; QS memilih cakupan unit/sarpras. Kode kontrak
 * digenerate otomatis; dokumen SPK opsional.
 */
export function BuatSpkDariMenang({
  rabEstimasiId, vendorId, namaVendor, jumlahBaris, nilai, proyek, projectKode, nomorBerikut,
}: {
  rabEstimasiId: string;
  vendorId: string;
  namaVendor: string;
  jumlahBaris: number;
  nilai: number;
  proyek: { units: Objek[]; sarpras: Objek[] };
  projectKode: string;
  /** Nomor urut SPK berikutnya (3 digit) per jenis, untuk pratinjau kode. */
  nomorBerikut: { K: string; S: string; tahun: number };
}) {
  const [jenis, setJenis] = useState<string>(JENIS_KONTRAK[0]);
  const [cakupan, setCakupan] = useState<string[]>([]);
  const daftar = jenis === "Unit" ? proyek.units : proyek.sarpras;
  const toggle = (id: string) =>
    setCakupan((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const huruf = jenis === "Unit" ? "K" : "S";
  const urutPreview = huruf === "K" ? nomorBerikut.K : nomorBerikut.S;
  const kodePreview = `${projectKode}/${huruf}/${nomorBerikut.tahun}/${urutPreview}`;

  // Nilai Kontrak = total baris menang × jumlah objek cakupan. BOQ SPK berlaku
  // untuk TIAP objek ("satu BOQ per unit"), jadi nilai kontrak ikut jumlah objek
  // agar "Nilai BOQ Terinci" = "Nilai SPK". Nominal ini ditetapkan ulang di server.
  const jumlahObjek = cakupan.length;
  const nominalHitung = Math.round(nilai * jumlahObjek);

  return (
    <FormModal
      judul={`Buat SPK — ${namaVendor}`}
      keterangan={`${jumlahBaris} baris menang · ${rp(nilai)}.`}
      aksi={buatKontrakDariRab}
      labelSimpan="Buat SPK"
      lebar={640}
      pemicu={(buka) => (
        <button type="button" className="pill" onClick={buka} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <FileSignature size={12} /> Buat SPK
        </button>
      )}
    >
      <input type="hidden" name="rabEstimasiId" value={rabEstimasiId} />
      <input type="hidden" name="vendorId" value={vendorId} />
      {cakupan.map((id) => (
        <input key={id} type="hidden" name="cakupanId" value={id} />
      ))}

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Kode Kontrak
          </label>
          <div
            className="inp"
            style={{ color: "var(--muted)", background: "var(--rona-abu)", display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}
          >
            {kodePreview} · otomatis
          </div>
        </div>
        <Field label="Mulai" nama="mulai" tipe="tanggal" />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Deskripsi Pekerjaan" nama="deskripsi" nilai={`Pemenang RAB · ${namaVendor}`} wajib />
      </BarisField>

      <BarisField kolom={1}>
        <Field
          label="Dokumen SPK"
          nama="spk"
          tipe="berkas"
          petunjuk="Opsional — bisa diunggah nanti dari halaman SPK."
        />
      </BarisField>

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Nilai Kontrak
          </label>
          <div
            className="inp"
            style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 1, minHeight: 40, background: "var(--rona-abu)", fontVariantNumeric: "tabular-nums" }}
          >
            {jumlahObjek === 0 ? (
              <span style={{ color: "var(--muted)", fontSize: 12 }}>— · pilih objek cakupan dulu</span>
            ) : (
              <>
                <span style={{ fontWeight: 600 }}>{rp(nominalHitung)}</span>
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
                  {rp(Math.round(nilai))} × {jumlahObjek} objek · otomatis
                </span>
              </>
            )}
          </div>
        </div>
        <Field label="Retensi" nama="retensiPct" nilai={5} tipe="number" satuan="%" />
      </BarisField>

      <BarisField>
        <Field label="Masa Pemeliharaan" nama="jatuhTempoBln" nilai={3} tipe="number" satuan="bulan" />
        <div />
      </BarisField>

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Jenis &amp; cakupan <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {JENIS_KONTRAK.map((j) => (
              <button
                key={j}
                type="button"
                className={jenis === j ? "pill active" : "pill"}
                onClick={() => { setJenis(j); setCakupan([]); }}
              >
                {j}
              </button>
            ))}
          </div>
          <input type="hidden" name="jenis" value={jenis} />

          <div style={{ maxHeight: 170, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 10px" }}>
            {daftar.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Proyek ini belum punya {jenis === "Unit" ? "unit" : "item sarpras"}.
              </div>
            ) : (
              daftar.map((x) => (
                <label key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "3px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={cakupan.includes(x.id)} onChange={() => toggle(x.id)} />
                  {x.nama}
                </label>
              ))
            )}
          </div>
        </div>
      </BarisField>
    </FormModal>
  );
}
