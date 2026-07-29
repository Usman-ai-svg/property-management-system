"use client";

import { BarisField, Field, FormModal, TombolHapus, TombolIkon } from "@/components/form";
import { rp, tanggal as fmtTanggal } from "@/lib/format";
import { hapusPembayaranJual, simpanPembayaranJual } from "./plan-real-actions";
import { Petunjuk } from "@/components/ui";

/**
 * Pencairan pembayaran dari pembeli.
 *
 * Riwayat pembayaran ditampilkan di dalam modalnya sendiri, bukan pada tabel
 * penjualan, supaya tabel itu tetap terbaca sebagai ringkasan per unit.
 */
export interface PembayaranJual {
  id: string;
  tanggal: string;
  uraian: string;
  nominal: number;
}

export function KelolaPembayaranJual({
  unitId,
  labelUnit,
  hargaJual,
  riwayat,
}: {
  unitId: string;
  labelUnit: string;
  hargaJual: number;
  riwayat: PembayaranJual[];
}) {
  const sudah = riwayat.reduce((s, r) => s + r.nominal, 0);
  const sisa = hargaJual - sudah;

  return (
    <FormModal
      judul={`Catat Pencairan · Unit ${labelUnit}`}
      keterangan={`Harga jual ${rp(hargaJual)} · sudah cair ${rp(sudah)} · sisa ${rp(sisa)}`}
      aksi={simpanPembayaranJual}
      labelSimpan="Catat"
      lebar={600}
      pemicu={(buka) => (
        <button
          type="button"
          className="btn-garis"
          onClick={buka}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          + Cair
        </button>
      )}
    >
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="unitId" value={unitId} />

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" wajib petunjuk="mis. Pencairan KPR tahap 1" />
      </BarisField>
      <BarisField>
        <Field label="Nominal" nama="nominal" tipe="number" satuan="Rp" wajib />
        <Field label="Tanggal" nama="tanggal" tipe="tanggal" />
      </BarisField>

      {riwayat.length > 0 && (
        <div className="card" style={{ padding: "10px 12px", background: "var(--rona-panel)", marginBottom: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Riwayat pencairan · {riwayat.length} kali
          </div>
          {riwayat.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex", justifyContent: "space-between", gap: 10,
                fontSize: 11.5, padding: "3px 0", color: "var(--muted)",
              }}
            >
              <span>{fmtTanggal(r.tanggal)} · {r.uraian}</span>
              <span className="num">{rp(r.nominal)}</span>
            </div>
          ))}
        </div>
      )}

      <Petunjuk>
        Pencairan boleh dicatat sebelum akad — booking fee biasanya dibayar lebih dulu.
        Bila totalnya melampaui harga jual, aplikasi tetap menyimpannya tetapi
        memberi tahu, karena bisa jadi memang ada biaya tambahan.
      </Petunjuk>
    </FormModal>
  );
}

export function UbahPembayaranJual({
  bayar,
  labelUnit,
}: {
  bayar: PembayaranJual;
  labelUnit: string;
}) {
  return (
    <FormModal
      judul={`Ubah Pencairan · Unit ${labelUnit}`}
      aksi={simpanPembayaranJual}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah pencairan ${bayar.uraian}`} />}
    >
      <input type="hidden" name="id" value={bayar.id} />
      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" nilai={bayar.uraian} wajib />
      </BarisField>
      <BarisField>
        <Field label="Nominal" nama="nominal" nilai={bayar.nominal} tipe="number" satuan="Rp" wajib />
        <Field label="Tanggal" nama="tanggal" nilai={bayar.tanggal} tipe="tanggal" />
      </BarisField>
    </FormModal>
  );
}

export function HapusPembayaranJual({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusPembayaranJual} id={id} nama={`pencairan ${uraian}`} />;
}
