"use client";

import { BarisField, Field, FormModal, TombolUbah } from "@/components/form";
import { BoqTable, type BarisBoqUI } from "@/components/boq-table";
import { RapTable, type BarisRapUI } from "@/components/rap-table";
import { JENIS_SARPRAS, STATUS_SARPRAS } from "@/lib/domain/enums";
import { simpanSarpras } from "../../../actions";
import { simpanBoqSarpras, simpanRapSarpras } from "../../../tabel-actions";

export function EditDeskripsiSarpras({
  kodeProyek,
  data,
}: {
  kodeProyek: string;
  data: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number;
  };
}) {
  return (
    <FormModal
      judul="Ubah Data Sarana & Prasarana"
      keterangan="Nilai RAB & RAP mengikuti tabel BOQ dan RAP di bawah — ubah lewat tabelnya."
      aksi={simpanSarpras}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
    >
      <input type="hidden" name="kode" value={kodeProyek} />
      <input type="hidden" name="id" value={data.id} />

      <BarisField kolom={1}>
        <Field label="Nama Item" nama="nama" nilai={data.nama} wajib />
      </BarisField>
      <BarisField>
        <Field label="Jenis" nama="jenis" nilai={data.jenis} pilihan={JENIS_SARPRAS} />
        <Field label="Volume" nama="volume" nilai={data.volume} wajib />
      </BarisField>
      <BarisField>
        <Field label="Status Bangun" nama="status" nilai={data.status} pilihan={STATUS_SARPRAS} />
        <Field label="Progres" nama="progress" nilai={data.progress} tipe="number" satuan="%" />
      </BarisField>
    </FormModal>
  );
}

export function TabelBoqSarpras({
  id, baris, bolehHarga, bolehUbah, konteks,
}: {
  id: string; baris: BarisBoqUI[]; bolehHarga: boolean; bolehUbah: boolean; konteks: string;
}) {
  return (
    <BoqTable
      judul="BOQ · RAB · Spesifikasi"
      baris={baris}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="sarpras"
      idImpor={id}
      aksiSimpan={(json) => simpanBoqSarpras(id, json)}
    />
  );
}

export function TabelRapSarpras({
  id, nama, baris, upah, bolehHarga, bolehUbah, konteks,
}: {
  id: string; nama: string; baris: BarisRapUI[]; upah: number;
  bolehHarga: boolean; bolehUbah: boolean; konteks: string;
}) {
  return (
    <RapTable
      judul="RAP · rincian material & upah"
      keterangan={`Rencana Anggaran Pelaksana — ${nama}`}
      baris={baris}
      upah={upah}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="sarpras"
      idImpor={id}
      aksiSimpan={(json) => simpanRapSarpras(id, json)}
    />
  );
}
