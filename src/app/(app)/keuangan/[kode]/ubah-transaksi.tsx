"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolHapus, TombolIkon } from "@/components/form";
import { AlokasiBiaya } from "@/components/alokasi-biaya";
import { JENIS_BIAYA_SWAKELOLA, METODE_BAYAR, PERUNTUKAN_BIAYA, SASARAN_PERUNTUKAN } from "@/lib/domain/enums";
import { hapusPengeluaran, ubahPengeluaran } from "../actions";
import { Petunjuk } from "@/components/ui";

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
    bukti: string | null;
    alokasi: { unitId: string | null; infrastructureId: string | null; nominal: number }[];
  };
  units: { id: string; label: string }[];
  sarpras: { id: string; label: string }[];
}) {
  const [total, setTotal] = useState(String(transaksi.total));
  const [peruntukan, setPeruntukan] = useState<string>(transaksi.peruntukan);
  const nominal = Number(total) || 0;

  // Nilai lama bisa saja di luar daftar baku (mis. data pra-perubahan). Ditambah
  // sebagai opsi supaya menyunting field lain tak diam-diam mengubah peruntukan.
  const daftarPeruntukan = (PERUNTUKAN_BIAYA as readonly string[]).includes(transaksi.peruntukan)
    ? PERUNTUKAN_BIAYA
    : [transaksi.peruntukan, ...PERUNTUKAN_BIAYA];

  const sasaran = SASARAN_PERUNTUKAN[peruntukan as keyof typeof SASARAN_PERUNTUKAN]
    ?? { unit: false, sarpras: false };
  const adaObjek = sasaran.unit || sasaran.sarpras;

  const awal = transaksi.alokasi.map((a) => ({
    tujuan: a.unitId ? `unit:${a.unitId}` : a.infrastructureId ? `sarpras:${a.infrastructureId}` : "",
    nominal: a.nominal,
  }));
  // Alokasi awal hanya dipakai selama peruntukan belum diubah. Begitu diganti,
  // sasaran lama bisa tak sah untuk peruntukan baru, jadi dimulai kosong.
  const awalDipakai = peruntukan === transaksi.peruntukan ? awal : undefined;

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
            {daftarPeruntukan.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <Field label="Jenis Biaya" nama="jenis" nilai={transaksi.jenis} pilihan={JENIS_BIAYA_SWAKELOLA} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" nilai={transaksi.uraian} wajib />
      </BarisField>

      <BarisField kolom={1}>
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
          {adaObjek ? (
            <AlokasiBiaya
              key={peruntukan}
              total={nominal}
              pilihan={{
                units: sasaran.unit ? units : [],
                sarpras: sasaran.sarpras ? sarpras : [],
              }}
              awal={awalDipakai}
            />
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
              Peruntukan <b>{peruntukan}</b> adalah <b>biaya level proyek</b> — tidak
              menempel pada unit maupun sarana &amp; prasarana.
            </div>
          )}
        </div>
      </BarisField>

      <Petunjuk>
        Tiap field yang berubah dicatat sendiri-sendiri di Log Perubahan, lengkap
        dengan nilai sebelum dan sesudahnya.
      </Petunjuk>
    </FormModal>
  );
}

export function HapusTransaksi({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusPengeluaran} id={id} nama={uraian} />;
}
