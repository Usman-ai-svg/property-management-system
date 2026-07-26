"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolTambah } from "@/components/form";
import { AlokasiBiaya } from "@/components/alokasi-biaya";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";
import { catatPengeluaran } from "./actions";

/**
 * Catat pengeluaran.
 *
 * Satu pengisian menghasilkan **satu** baris transaksi, seberapa pun banyak
 * unit yang ditanggungnya. Itu yang membuat baris di sini cocok satu-lawan-satu
 * dengan baris di rekening koran — mutasi bank memang datang sebagai lumsum,
 * bukan sudah terpecah per unit.
 */

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
  const [total, setTotal] = useState("");
  // Kunci memaksa AlokasiBiaya dipasang ulang saat proyek berganti: unit dan
  // sarpras dari proyek lama tidak sah untuk proyek yang baru.
  const aktif = proyek.find((p) => p.id === projectId);
  const nominal = Number(total) || 0;

  if (proyek.length === 0) return null;

  return (
    <FormModal
      judul="Catat Pengeluaran"
      keterangan="Pos HPP ditentukan otomatis dari peruntukannya."
      aksi={catatPengeluaran}
      labelSimpan="Catat"
      lebar={640}
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
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Total <span style={{ color: "var(--red)" }}>*</span>
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
              style={{ paddingRight: 34 }}
            />
            <span
              style={{
                position: "absolute", right: 10, top: 9,
                fontSize: 11.5, color: "var(--muted)", pointerEvents: "none",
              }}
            >
              Rp
            </span>
          </div>
        </div>
        <Field label="Status Bayar" nama="status" nilai="Lunas" pilihan={STATUS_BAYAR} />
      </BarisField>

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Dibebankan ke
          </label>
          <AlokasiBiaya
            key={projectId}
            total={nominal}
            pilihan={{ units: aktif?.units ?? [], sarpras: aktif?.sarpras ?? [] }}
          />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
            Satu pembayaran tetap tersimpan sebagai <b>satu baris transaksi</b> — cocok
            satu-lawan-satu dengan satu baris mutasi bank. Yang dipecah hanya
            pembebanannya, dan jumlahnya harus pas dengan total di atas.
          </div>
        </div>
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Nama berkas bukti" nama="bukti" petunjuk="Berkasnya belum diunggah pada demo ini" />
      </BarisField>
    </FormModal>
  );
}
