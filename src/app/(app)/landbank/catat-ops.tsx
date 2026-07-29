"use client";

import { BarisField, Field, FormModal, TombolTambah } from "@/components/form";
import { STATUS_BAYAR } from "@/lib/domain/enums";
import { catatBiayaOperasional } from "./plan-real-actions";
import { Petunjuk } from "@/components/ui";

export function CatatBiayaOperasional({
  projectId,
  namaProyek,
  pos,
}: {
  projectId: string;
  namaProyek: string;
  pos: string[];
}) {
  if (pos.length === 0) return null;

  return (
    <FormModal
      judul="Catat Biaya Operasional"
      keterangan={`${namaProyek} · di luar HPP`}
      aksi={catatBiayaOperasional}
      labelSimpan="Catat"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Biaya Operasional" />}
    >
      <input type="hidden" name="projectId" value={projectId} />

      <BarisField kolom={1}>
        <Field
          label="Pos Biaya"
          nama="kategori"
          nilai={pos[0]}
          pilihan={pos}
        />
      </BarisField>
      <Petunjuk jarak={"-6px 0 14px"}>
        Pilihan pos mengikuti business plan proyek ini, supaya realisasinya bisa
        dibandingkan langsung dengan rencananya.
      </Petunjuk>

      <BarisField kolom={1}>
        <Field label="Keterangan" nama="uraian" wajib petunjuk="mis. Biaya iklan properti kuartal III" />
      </BarisField>

      <BarisField>
        <Field label="Nominal" nama="nominal" tipe="number" satuan="Rp" wajib />
        <Field label="Status Bayar" nama="status" nilai="Lunas" pilihan={STATUS_BAYAR} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Nama berkas bukti" nama="bukti" />
      </BarisField>
    </FormModal>
  );
}
