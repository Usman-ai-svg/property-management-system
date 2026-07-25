"use client";

import { BarisField, Field, FormModal, TombolIkon, TombolUbah } from "@/components/form";
import { ubahBarisBoq, ubahBarisRap, ubahUpahRap } from "../../../actions";

export function EditBarisBoq({
  data,
}: {
  data: {
    id: string; uraian: string; satuan: string; volume: number;
    hargaSatuan: number; spesifikasi: string | null;
  };
}) {
  return (
    <FormModal
      judul="Ubah baris BOQ"
      keterangan="Perubahan hanya berlaku untuk unit ini. Unit lain memiliki salinan barisnya sendiri."
      aksi={ubahBarisBoq}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah ${data.uraian}`} />}
      lebar={620}
    >
      <input type="hidden" name="id" value={data.id} />
      <BarisField kolom={1}>
        <Field label="Uraian pekerjaan" nama="uraian" nilai={data.uraian} wajib />
      </BarisField>
      <BarisField kolom={3}>
        <Field label="Satuan" nama="satuan" nilai={data.satuan} wajib />
        <Field label="Volume" nama="volume" nilai={data.volume} tipe="number" wajib />
        <Field label="Harga satuan" nama="hargaSatuan" nilai={data.hargaSatuan} tipe="number" satuan="Rp" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Spesifikasi" nama="spesifikasi" nilai={data.spesifikasi} tipe="textarea" />
      </BarisField>
    </FormModal>
  );
}

export function EditBarisRap({
  data,
}: {
  data: {
    id: string; nama: string; satuan: string; volume: number;
    hargaSatuan: number; keterangan: string | null;
  };
}) {
  return (
    <FormModal
      judul="Ubah baris RAP"
      keterangan="Rincian material untuk unit ini."
      aksi={ubahBarisRap}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah ${data.nama}`} />}
      lebar={620}
    >
      <input type="hidden" name="id" value={data.id} />
      <BarisField kolom={1}>
        <Field label="Nama material" nama="nama" nilai={data.nama} wajib />
      </BarisField>
      <BarisField kolom={3}>
        <Field label="Satuan" nama="satuan" nilai={data.satuan} wajib />
        <Field label="Volume" nama="volume" nilai={data.volume} tipe="number" wajib />
        <Field label="Harga satuan" nama="hargaSatuan" nilai={data.hargaSatuan} tipe="number" satuan="Rp" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Keterangan" nama="keterangan" nilai={data.keterangan} />
      </BarisField>
    </FormModal>
  );
}

export function EditUpahDanHarga({
  data,
}: {
  data: { id: string; rapUpah: number; hargaJual: number };
}) {
  return (
    <FormModal
      judul="Ubah upah RAP & harga jual"
      keterangan="Upah tenaga kerja adalah pasangan dari rincian material pada RAP."
      aksi={ubahUpahRap}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
    >
      <input type="hidden" name="id" value={data.id} />
      <BarisField>
        <Field label="Upah tenaga kerja (RAP)" nama="rapUpah" nilai={data.rapUpah} tipe="number" satuan="Rp" />
        <Field label="Harga jual" nama="hargaJual" nilai={data.hargaJual} tipe="number" satuan="Rp" />
      </BarisField>
    </FormModal>
  );
}
