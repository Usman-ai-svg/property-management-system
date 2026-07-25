"use client";

import { BarisField, Field, FormModal, TombolUbah } from "@/components/form";
import { ubahBiayaLahan } from "../../master/actions";

/**
 * Penyunting biaya perolehan lahan.
 *
 * Berada di Landbank, bukan Master Proyek, mengikuti artifact — kartu Luas
 * Lahan di Master Proyek hanya menunjuk ke sini.
 */
export function EditBiayaLahan({
  kode,
  biaya,
}: {
  kode: string;
  biaya: {
    hargaPerM2: number; biayaPembelian: number; biayaNotaris: number;
    biayaBalikNama: number; biayaLegalLain: number;
  };
}) {
  return (
    <FormModal
      judul="Ubah Biaya Perolehan Lahan"
      keterangan="Perubahan di sini ikut menggeser pos Perolehan Tanah pada Plan vs Realisasi."
      aksi={ubahBiayaLahan}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
    >
      <input type="hidden" name="kode" value={kode} />
      <BarisField>
        <Field label="Harga per m²" nama="hargaPerM2" nilai={biaya.hargaPerM2} tipe="number" satuan="Rp" />
        <Field label="Biaya Pembelian" nama="biayaPembelian" nilai={biaya.biayaPembelian} tipe="number" satuan="Rp" />
      </BarisField>
      <BarisField>
        <Field label="Notaris" nama="biayaNotaris" nilai={biaya.biayaNotaris} tipe="number" satuan="Rp" />
        <Field label="Balik Nama" nama="biayaBalikNama" nilai={biaya.biayaBalikNama} tipe="number" satuan="Rp" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Legal Lain-lain" nama="biayaLegalLain" nilai={biaya.biayaLegalLain} tipe="number" satuan="Rp" />
      </BarisField>
    </FormModal>
  );
}
