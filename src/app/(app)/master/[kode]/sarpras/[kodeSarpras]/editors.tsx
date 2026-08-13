"use client";

import { BarisField, Field, FormModal, TombolUbah } from "@/components/form";
import { BoqTable, type BarisBoqUI } from "@/components/boq-table";
import { RapTable, type BarisRapUI } from "@/components/rap-table";
import { JENIS_SARPRAS } from "@/lib/domain/enums";
import { simpanSarpras } from "../../../actions";
import { imporTabel, simpanBoqSarpras, simpanRapSarpras } from "../../../tabel-actions";
import { Petunjuk } from "@/components/ui";

export function EditDeskripsiSarpras({
  kodeProyek,
  data,
}: {
  kodeProyek: string;
  data: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number;
    /** Benar bila item ini sudah punya baris BOQ — progres jadi turunan opname. */
    dariBoq: boolean;
  };
}) {
  return (
    <FormModal
      judul="Ubah Data Sarana & Prasarana"
      keterangan="RAB mengikuti tabel BOQ di bawah — ubah lewat tabelnya, bukan di sini."
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

      <BarisField kolom={1}>
        {data.dariBoq ? (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Progres
            </label>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              <b>{data.progress}%</b> — dari opname BOQ, tidak bisa diisi di sini.
            </div>
          </div>
        ) : (
          <Field label="Progres" nama="progress" nilai={data.progress} tipe="number" satuan="%" petunjuk="Status bangun otomatis dari progres" />
        )}
      </BarisField>

      <Petunjuk jarak="8px 0 0">
        Status Bangun dihitung otomatis dari progres (Belum Terbangun / Progress /
        Selesai).{data.dariBoq ? " Isi progres lewat tabel opname di halaman Konstruksi." : ""}
      </Petunjuk>
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
      judul="RAB · Spesifikasi"
      baris={baris}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="sarpras"
      idImpor={id}
      aksiImpor={imporTabel}
      aksiSimpan={(json) => simpanBoqSarpras(id, json)}
    />
  );
}

export function TabelRapSarpras({
  id, nama, baris, upahVolume, upahHarga, bolehHarga, bolehUbah, konteks,
}: {
  id: string; nama: string; baris: BarisRapUI[]; upahVolume: number; upahHarga: number;
  bolehHarga: boolean; bolehUbah: boolean; konteks: string;
}) {
  return (
    <RapTable
      judul="RAP · rincian material & upah"
      keterangan={`Rencana Anggaran Pelaksana — ${nama}`}
      baris={baris}
      upahVolume={upahVolume}
      upahHarga={upahHarga}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="sarpras"
      idImpor={id}
      aksiImpor={imporTabel}
      aksiSimpan={(json) => simpanRapSarpras(id, json)}
    />
  );
}
