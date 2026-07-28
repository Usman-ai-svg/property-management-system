"use client";

import { BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah, TombolUbah } from "@/components/form";
import { BoqTable, type BarisBoqUI } from "@/components/boq-table";
import { RapTable, type BarisRapUI } from "@/components/rap-table";
import { STATUS_JUAL, STATUS_PEMBANGUNAN } from "@/lib/domain/enums";
import { ubahUnit } from "../../../actions";
import {
  hapusKerjaTambah, imporTabel, simpanBoqKerjaTambah, simpanBoqUnit,
  simpanRapKerjaTambah, simpanRapUnit, tambahKerjaTambah, ubahJudulKerjaTambah,
} from "../../../tabel-actions";
import { Petunjuk } from "@/components/ui";

/* ===================== DESKRIPSI UNIT ===================== */

export function EditDeskripsiUnit({
  unit,
  fases,
  tipes,
}: {
  unit: {
    id: string; nomor: number; luasTanah: number; phaseId: string; unitTypeId: string;
    statusPembangunan: string; statusJual: string; progress: number;
    /** Benar bila progres unit ini turunan dari BOQ Master, bukan isian satu angka. */
    dariBoq: boolean;
  };
  fases: { id: string; kode: string }[];
  tipes: { id: string; nama: string; luasBangunan: number }[];
}) {
  return (
    <FormModal
      judul="Ubah Deskripsi Unit"
      aksi={ubahUnit}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
      lebar={600}
    >
      <input type="hidden" name="id" value={unit.id} />

      <BarisField>
        <Field label="Nomor Unit" nama="nomor" nilai={unit.nomor} tipe="number" wajib />
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Fase</label>
          <select name="phaseId" className="inp" defaultValue={unit.phaseId}>
            {fases.map((f) => (
              <option key={f.id} value={f.id}>{f.kode}</option>
            ))}
          </select>
        </div>
      </BarisField>

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Tipe Unit</label>
          <select name="unitTypeId" className="inp" defaultValue={unit.unitTypeId}>
            {tipes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama} · LB {t.luasBangunan} m²
              </option>
            ))}
          </select>
        </div>
        <Field label="Luas Tanah" nama="luasTanah" nilai={unit.luasTanah} tipe="number" satuan="m²" wajib />
      </BarisField>

      <Petunjuk jarak={"0 0 14px"}>
        Tipe menentukan luas bangunan dan dokumen. Luas tanah diisi per unit karena
        bisa berbeda meski tipenya sama. Mengubah tipe tidak menghitung ulang baris
        BOQ dan RAP unit ini — keduanya salinan milik unit.
      </Petunjuk>

      <BarisField>
        <Field label="Status Bangun" nama="statusPembangunan" nilai={unit.statusPembangunan} pilihan={STATUS_PEMBANGUNAN} />
        <Field label="Status Jual" nama="statusJual" nilai={unit.statusJual} pilihan={STATUS_JUAL} />
      </BarisField>

      {unit.dariBoq ? (
        <>
          <input type="hidden" name="progress" value={unit.progress} />
          <Petunjuk>
            Progres unit ini <b>{unit.progress}%</b>, dihitung dari BOQ Master Proyek dan
            tertimbang nilai tiap pekerjaan — karena itu tidak bisa diisi di sini.
            Isi lewat tabel opname di halaman Konstruksi unit ini. Status bangun mengikuti angka itu
            selama belum 100%.
          </Petunjuk>
        </>
      ) : (
        <>
          <BarisField kolom={1}>
            <Field label="Progres" nama="progress" nilai={unit.progress} tipe="number" satuan="%" />
          </BarisField>
          <Petunjuk>
            Angka progres ini sama dengan yang tampil di halaman Konstruksi — keduanya
            membaca kolom yang sama. Status bangun mengikuti progres selama belum
            100%; setelah 100% barulah Serah Terima dan Habis Masa Garansi bisa dipilih.
          </Petunjuk>
        </>
      )}
    </FormModal>
  );
}

/* ===================== KERJA TAMBAH ===================== */

export function TambahKerjaTambah({ unitId }: { unitId: string }) {
  return (
    <FormModal
      judul="Tambah Kerja Tambah"
      aksi={tambahKerjaTambah}
      labelSimpan="Buat Kerja Tambah"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Kerja Tambah" />}
    >
      <input type="hidden" name="unitId" value={unitId} />
      <BarisField kolom={1}>
        <Field label="Judul Kerja Tambah" nama="judul" wajib petunjuk="mis. Kanopi carport & pagar depan" />
      </BarisField>
      <Petunjuk>
        Satu unit boleh punya beberapa kerja tambah. Tiap kerja tambah punya dokumen
        sendiri (Desain, 3D Model, Gambar Kerja) serta tabel BOQ dan RAP-nya sendiri.
      </Petunjuk>
    </FormModal>
  );
}

export function UbahJudulKerjaTambah({ id, judul }: { id: string; judul: string }) {
  return (
    <FormModal
      judul="Ubah Judul Kerja Tambah"
      aksi={ubahJudulKerjaTambah}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah judul ${judul}`} />}
    >
      <input type="hidden" name="id" value={id} />
      <BarisField kolom={1}>
        <Field label="Judul Kerja Tambah" nama="judul" nilai={judul} wajib />
      </BarisField>
      <Petunjuk>
        Tabel BOQ dan RAP kerja tambah ini disunting langsung dari tabelnya di bawah.
      </Petunjuk>
    </FormModal>
  );
}

export function HapusKerjaTambah({ id, judul }: { id: string; judul: string }) {
  return <TombolHapus aksi={hapusKerjaTambah} id={id} nama={judul} />;
}

/* ===================== TABEL ===================== */

export function TabelBoqUnit({
  unitId, baris, bolehHarga, bolehUbah, konteks, judul,
}: {
  unitId: string; baris: BarisBoqUI[]; bolehHarga: boolean;
  bolehUbah: boolean; konteks: string; judul: string;
}) {
  return (
    <BoqTable
      judul={judul}
      baris={baris}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="unit"
      idImpor={unitId}
      aksiImpor={imporTabel}
      aksiSimpan={(json) => simpanBoqUnit(unitId, json)}
    />
  );
}

export function TabelRapUnit({
  unitId, baris, upah, bolehHarga, bolehUbah, konteks, keterangan,
}: {
  unitId: string; baris: BarisRapUI[]; upah: number; bolehHarga: boolean;
  bolehUbah: boolean; konteks: string; keterangan: string;
}) {
  return (
    <RapTable
      judul="RAP Unit · rincian material & upah"
      keterangan={keterangan}
      baris={baris}
      upah={upah}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="unit"
      idImpor={unitId}
      aksiImpor={imporTabel}
      aksiSimpan={(json) => simpanRapUnit(unitId, json)}
    />
  );
}

export function TabelBoqKt({
  ktId, judul, baris, bolehHarga, bolehUbah, konteks,
}: {
  ktId: string; judul: string; baris: BarisBoqUI[];
  bolehHarga: boolean; bolehUbah: boolean; konteks: string;
}) {
  return (
    <BoqTable
      judul={`Tabel RAB Kerja Tambah · ${judul}`}
      baris={baris}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="kerjaTambah"
      idImpor={ktId}
      aksiImpor={imporTabel}
      grupBaru="Kerja Tambah"
      aksiSimpan={(json) => simpanBoqKerjaTambah(ktId, json)}
    />
  );
}

export function TabelRapKt({
  ktId, judul, baris, upah, bolehHarga, bolehUbah, konteks,
}: {
  ktId: string; judul: string; baris: BarisRapUI[]; upah: number;
  bolehHarga: boolean; bolehUbah: boolean; konteks: string;
}) {
  return (
    <RapTable
      judul={`RAP Kerja Tambah · ${judul}`}
      keterangan={`Rencana Anggaran Pelaksana — ${judul}`}
      baris={baris}
      upah={upah}
      bolehHarga={bolehHarga}
      bolehUbah={bolehUbah}
      konteksImpor={konteks}
      sasaranImpor="kerjaTambah"
      idImpor={ktId}
      aksiImpor={imporTabel}
      aksiSimpan={(json) => simpanRapKerjaTambah(ktId, json)}
    />
  );
}
