"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolTambah } from "@/components/form";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";
import { catatPengeluaran } from "./actions";

export function CatatPengeluaran({
  proyek,
}: {
  proyek: {
    id: string;
    nama: string;
    units: { id: string; label: string }[];
    sarpras: { id: string; label: string }[];
  }[];
}) {
  const [projectId, setProjectId] = useState(proyek[0]?.id ?? "");
  const [beban, setBeban] = useState("");
  const aktif = proyek.find((p) => p.id === projectId);

  const [jenisBeban, idBeban] = beban ? beban.split(":") : ["", ""];

  if (proyek.length === 0) return null;

  return (
    <FormModal
      judul="Catat Pengeluaran"
      keterangan="Pos HPP ditentukan otomatis dari peruntukannya."
      aksi={catatPengeluaran}
      labelSimpan="Catat"
      lebar={600}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Pengeluaran" />}
    >
      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Proyek <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select
            name="projectId"
            className="inp"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              // Pembebanan ikut dikosongkan: unit atau sarpras dari proyek lama
              // tidak sah untuk proyek yang baru dipilih.
              setBeban("");
            }}
            required
          >
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
        <Field label="Peruntukan" nama="peruntukan" nilai={PERUNTUKAN_BIAYA[0]} pilihan={PERUNTUKAN_BIAYA} />
      </BarisField>

      <BarisField>
        <Field label="Jenis Biaya" nama="jenis" nilai={JENIS_BIAYA[0]} pilihan={JENIS_BIAYA} />
        <Field label="Metode" nama="metode" nilai={METODE_BAYAR[0]} pilihan={METODE_BAYAR} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" wajib petunjuk="mis. Termin 2 borongan struktur F1" />
      </BarisField>

      <BarisField>
        <Field label="Total" nama="total" tipe="number" satuan="Rp" wajib />
        <Field label="Status Bayar" nama="status" nilai="Lunas" pilihan={STATUS_BAYAR} />
      </BarisField>

      <input type="hidden" name="unitId" value={jenisBeban === "unit" ? idBeban : ""} />
      <input type="hidden" name="infrastructureId" value={jenisBeban === "sarpras" ? idBeban : ""} />

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Dibebankan ke
          </label>
          {/* Unit dan sarpras disatukan dalam satu pemilih karena keduanya
              saling meniadakan — satu pengeluaran tidak boleh membebani
              dua-duanya, dan pemilih terpisah justru mengundang kesalahan itu. */}
          <select className="inp" value={beban} onChange={(e) => setBeban(e.target.value)}>
            <option value="">— biaya level proyek —</option>
            {(aktif?.units.length ?? 0) > 0 && (
              <optgroup label="Unit">
                {aktif!.units.map((u) => (
                  <option key={u.id} value={`unit:${u.id}`}>{u.label}</option>
                ))}
              </optgroup>
            )}
            {(aktif?.sarpras.length ?? 0) > 0 && (
              <optgroup label="Sarana &amp; Prasarana">
                {aktif!.sarpras.map((s) => (
                  <option key={s.id} value={`sarpras:${s.id}`}>{s.label}</option>
                ))}
              </optgroup>
            )}
          </select>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            Biaya level proyek adalah yang tidak menempel pada unit maupun sarpras —
            perijinan dan pengolahan lahan.
          </div>
        </div>
        <Field label="Nama berkas bukti" nama="bukti" petunjuk="Berkasnya belum diunggah pada demo ini" />
      </BarisField>
    </FormModal>
  );
}
