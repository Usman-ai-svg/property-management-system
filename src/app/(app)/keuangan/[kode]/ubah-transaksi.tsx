"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolHapus, TombolIkon } from "@/components/form";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";
import { hapusPengeluaran, ubahPengeluaran } from "../actions";

/**
 * Penyuntingan satu baris transaksi pengeluaran.
 *
 * Pembebanan ke unit dan ke sarana & prasarana disatukan dalam satu pemilih,
 * bukan dua pemilih terpisah, karena keduanya saling meniadakan — satu
 * pengeluaran tidak boleh membebani unit sekaligus sarpras, dan dua pemilih
 * terpisah justru mengundang kesalahan itu.
 */
export function UbahTransaksi({
  transaksi,
  units,
  sarpras,
}: {
  transaksi: {
    id: string;
    peruntukan: string;
    jenis: string;
    metode: string;
    uraian: string;
    total: number;
    status: string;
    bukti: string | null;
    unitId: string | null;
    infrastructureId: string | null;
  };
  units: { id: string; label: string }[];
  sarpras: { id: string; label: string }[];
}) {
  const awal = transaksi.unitId
    ? `unit:${transaksi.unitId}`
    : transaksi.infrastructureId
      ? `sarpras:${transaksi.infrastructureId}`
      : "";
  const [beban, setBeban] = useState(awal);

  const [jenisBeban, idBeban] = beban ? beban.split(":") : ["", ""];

  return (
    <FormModal
      judul="Ubah Transaksi Pengeluaran"
      keterangan="Pos HPP ikut menyesuaikan bila peruntukannya diubah."
      aksi={ubahPengeluaran}
      lebar={620}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah transaksi ${transaksi.uraian}`} />}
    >
      <input type="hidden" name="id" value={transaksi.id} />
      <input type="hidden" name="unitId" value={jenisBeban === "unit" ? idBeban : ""} />
      <input type="hidden" name="infrastructureId" value={jenisBeban === "sarpras" ? idBeban : ""} />

      <BarisField>
        <Field label="Peruntukan" nama="peruntukan" nilai={transaksi.peruntukan} pilihan={PERUNTUKAN_BIAYA} />
        <Field label="Jenis Biaya" nama="jenis" nilai={transaksi.jenis} pilihan={JENIS_BIAYA} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" nilai={transaksi.uraian} wajib />
      </BarisField>

      <BarisField>
        <Field label="Total" nama="total" nilai={transaksi.total} tipe="number" satuan="Rp" wajib />
        <Field label="Status Bayar" nama="status" nilai={transaksi.status} pilihan={STATUS_BAYAR} />
      </BarisField>

      <BarisField>
        <Field label="Metode" nama="metode" nilai={transaksi.metode} pilihan={METODE_BAYAR} />
        <Field label="Nama berkas bukti" nama="bukti" nilai={transaksi.bukti ?? ""} />
      </BarisField>

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Dibebankan ke
          </label>
          <select
            className="inp"
            value={beban}
            onChange={(e) => setBeban(e.target.value)}
          >
            <option value="">— biaya level proyek —</option>
            {units.length > 0 && (
              <optgroup label="Unit">
                {units.map((u) => (
                  <option key={u.id} value={`unit:${u.id}`}>{u.label}</option>
                ))}
              </optgroup>
            )}
            {sarpras.length > 0 && (
              <optgroup label="Sarana &amp; Prasarana">
                {sarpras.map((s) => (
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
      </BarisField>

      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        Tiap field yang berubah dicatat sendiri-sendiri di Log Perubahan, lengkap
        dengan nilai sebelum dan sesudahnya.
      </p>
    </FormModal>
  );
}

export function HapusTransaksi({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusPengeluaran} id={id} nama={uraian} />;
}
