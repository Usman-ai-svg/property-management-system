"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolHapus, TombolIkon } from "@/components/form";
import { AlokasiBiaya } from "@/components/alokasi-biaya";
import { JENIS_BIAYA, METODE_BAYAR, PERUNTUKAN_BIAYA, STATUS_BAYAR } from "@/lib/domain/enums";
import { hapusPengeluaran, ubahPengeluaran } from "../actions";

/**
 * Penyuntingan satu baris transaksi pengeluaran.
 *
 * Baris ini adalah satu pembayaran — satu baris mutasi bank. Mengubah totalnya
 * mengharuskan pembebanannya ikut diseimbangkan, karena keduanya tidak boleh
 * berbeda: angka per unit harus selalu bisa dijumlahkan balik ke angka bank.
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
    alokasi: { unitId: string | null; infrastructureId: string | null; nominal: number }[];
  };
  units: { id: string; label: string }[];
  sarpras: { id: string; label: string }[];
}) {
  const [total, setTotal] = useState(String(transaksi.total));
  const nominal = Number(total) || 0;

  const awal = transaksi.alokasi.map((a) => ({
    tujuan: a.unitId ? `unit:${a.unitId}` : a.infrastructureId ? `sarpras:${a.infrastructureId}` : "",
    nominal: a.nominal,
  }));

  return (
    <FormModal
      judul="Ubah Transaksi Pengeluaran"
      keterangan="Pos HPP ikut menyesuaikan bila peruntukannya diubah."
      aksi={ubahPengeluaran}
      lebar={620}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah transaksi ${transaksi.uraian}`} />}
    >
      <input type="hidden" name="id" value={transaksi.id} />

      <BarisField>
        <Field label="Peruntukan" nama="peruntukan" nilai={transaksi.peruntukan} pilihan={PERUNTUKAN_BIAYA} />
        <Field label="Jenis Biaya" nama="jenis" nilai={transaksi.jenis} pilihan={JENIS_BIAYA} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" nilai={transaksi.uraian} wajib />
      </BarisField>

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Total <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <input
              className="inp"
              type="number"
              name="total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              required
              min={1}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Rp</span>
          </div>
        </div>
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
          <AlokasiBiaya total={nominal} pilihan={{ units, sarpras }} awal={awal} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
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
