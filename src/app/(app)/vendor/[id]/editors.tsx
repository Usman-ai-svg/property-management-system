"use client";

import { BarisField, Field, FormModal } from "@/components/form";
import { STATUS_VO } from "@/lib/domain/enums";
import { tambahPembayaran, tambahVo } from "../actions";

export function TambahVo({ contractId }: { contractId: string }) {
  return (
    <FormModal
      judul="Tambah Variation Order"
      keterangan="Nominal negatif untuk pekerjaan kurang. VO baru menggeser nilai kontrak setelah disetujui."
      aksi={tambahVo}
      labelSimpan="Tambah VO"
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          + Tambah VO
        </button>
      )}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <BarisField kolom={1}>
        <Field
          label="Uraian"
          nama="uraian"
          tipe="textarea"
          wajib
          petunjuk="mis. Tambah kuda-kuda baja bentang 6 m (2 unit)"
        />
      </BarisField>
      <BarisField>
        <Field label="Nominal" nama="nominal" tipe="number" satuan="Rp" wajib petunjuk="Negatif untuk pekerjaan kurang" />
        <Field label="Status" nama="status" nilai="Diajukan" pilihan={STATUS_VO} />
      </BarisField>
    </FormModal>
  );
}

export function TambahPembayaran({
  contractId,
  sisa,
}: {
  contractId: string;
  sisa: number;
}) {
  return (
    <FormModal
      judul="Catat Pembayaran"
      keterangan={`Sisa yang bisa dibayar: Rp ${Math.round(sisa).toLocaleString("id-ID")}`}
      aksi={tambahPembayaran}
      labelSimpan="Catat"
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          + Catat Pembayaran
        </button>
      )}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <BarisField kolom={1}>
        <Field label="Uraian" nama="uraian" wajib petunjuk="mis. Termin 3 borongan struktur" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Nominal" nama="nominal" tipe="number" satuan="Rp" wajib />
      </BarisField>
    </FormModal>
  );
}
