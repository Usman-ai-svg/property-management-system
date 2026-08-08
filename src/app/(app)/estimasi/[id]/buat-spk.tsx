"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { BarisField, Field, FormModal } from "@/components/form";
import { Petunjuk } from "@/components/ui";
import { JENIS_KONTRAK } from "@/lib/domain/enums";
import { rp } from "@/lib/format";
import { buatKontrakDariRab } from "../actions";

type Objek = { id: string; nama: string };

/**
 * Buat SPK dari baris yang dimenangkan seorang vendor pada RAB. Nilai & deskripsi
 * terisi dari baris menang; QS memilih cakupan unit/sarpras & mengunggah SPK.
 */
export function BuatSpkDariMenang({
  rabEstimasiId, vendorId, namaVendor, jumlahBaris, nilai, proyek,
}: {
  rabEstimasiId: string;
  vendorId: string;
  namaVendor: string;
  jumlahBaris: number;
  nilai: number;
  proyek: { units: Objek[]; sarpras: Objek[] };
}) {
  const [jenis, setJenis] = useState<string>(JENIS_KONTRAK[0]);
  const [cakupan, setCakupan] = useState<string[]>([]);
  const daftar = jenis === "Unit" ? proyek.units : proyek.sarpras;
  const toggle = (id: string) =>
    setCakupan((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <FormModal
      judul={`Buat SPK — ${namaVendor}`}
      keterangan={`${jumlahBaris} baris menang · nilai tawaran ${rp(nilai)}. BOQ tersalin otomatis; lengkapi cakupan & unggah SPK.`}
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
        <Field label="Kode Kontrak" nama="kode" wajib petunjuk="mis. K7, S3" />
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
          wajib
          petunjuk="Surat Perintah Kerja. Tersimpan sebagai revisi R1 dan bisa diperbarui dari halaman SPK."
        />
      </BarisField>

      <BarisField>
        <Field label="Nilai Kontrak" nama="nominal" nilai={Math.round(nilai)} tipe="number" satuan="Rp" wajib />
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

      <Petunjuk jarak="2px 0 0">
        Seluruh baris BOQ awalnya ditautkan ke cakupan pertama; pindahkan tiap baris ke objek
        yang benar lewat Progress Vendor setelah SPK dibuat.
      </Petunjuk>
    </FormModal>
  );
}
