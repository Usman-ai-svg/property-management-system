"use client";

import { BoqTable, type BarisBoqUI } from "@/components/boq-table";
import { RapTable, type BarisRapUI } from "@/components/rap-table";
import { imporTabel, simpanBoqTipe, simpanRapTipe } from "../../../tabel-actions";

export function TabelBoqTipe({
  unitTypeId, baris, bolehHarga, bolehUbah, konteks,
}: {
  unitTypeId: string; baris: BarisBoqUI[]; bolehHarga: boolean; bolehUbah: boolean; konteks: string;
}) {
  return (
    <BoqTable
      judul="RAB Tipe · dasar disalin ke unit baru"
      baris={baris}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="tipeUnit"
      idImpor={unitTypeId}
      aksiImpor={imporTabel}
      aksiSimpan={(json) => simpanBoqTipe(unitTypeId, json)}
    />
  );
}

export function TabelRapTipe({
  unitTypeId, baris, upahVolume, upahHarga, bolehHarga, bolehUbah, konteks,
}: {
  unitTypeId: string; baris: BarisRapUI[]; upahVolume: number; upahHarga: number;
  bolehHarga: boolean; bolehUbah: boolean; konteks: string;
}) {
  return (
    <RapTable
      judul="RAP Tipe · rincian material & upah"
      keterangan={`Rencana Anggaran Pelaksana master — ${konteks}. Disalin ke setiap unit baru bertipe ini.`}
      baris={baris}
      upahVolume={upahVolume}
      upahHarga={upahHarga}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="tipeUnit"
      idImpor={unitTypeId}
      aksiImpor={imporTabel}
      aksiSimpan={(json) => simpanRapTipe(unitTypeId, json)}
    />
  );
}
