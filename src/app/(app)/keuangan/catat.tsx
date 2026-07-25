"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolTambah } from "@/components/form";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";
import { catatPengeluaran } from "./actions";

export function CatatPengeluaran({
  proyek,
}: {
  proyek: { id: string; nama: string; units: { id: string; label: string }[] }[];
}) {
  const [projectId, setProjectId] = useState(proyek[0]?.id ?? "");
  const unitPilihan = proyek.find((p) => p.id === projectId)?.units ?? [];

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
            onChange={(e) => setProjectId(e.target.value)}
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

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Unit terkait
          </label>
          <select name="unitId" className="inp" defaultValue="">
            <option value="">— tidak menempel pada unit tertentu —</option>
            {unitPilihan.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            Biaya tanpa unit dihitung sebagai biaya level proyek.
          </div>
        </div>
        <Field label="Nama berkas bukti" nama="bukti" petunjuk="Berkasnya belum diunggah pada demo ini" />
      </BarisField>
    </FormModal>
  );
}
