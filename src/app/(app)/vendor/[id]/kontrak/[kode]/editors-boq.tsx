"use client";

import { BarisField, Field, FormModal, TombolHapus, TombolIkon } from "@/components/form";
import {
  hapusBarisBoqSpk,
  imporBoqSpk,
  salinBoqKeSemua,
  tambahBarisBoqSpk,
  ubahBarisBoqSpk,
} from "../../../boq-actions";

export interface PilihanObjek {
  kunci: string;
  label: string;
}

/** Tambah satu baris pekerjaan ke BOQ SPK. */
export function TambahBarisBoq({
  contractId,
  objek,
}: {
  contractId: string;
  objek: PilihanObjek[];
}) {
  return (
    <FormModal
      judul="Tambah Baris Pekerjaan"
      keterangan="Rincian pekerjaan yang diperintahkan SPK ini. Progres diisi belakangan saat opname."
      aksi={tambahBarisBoqSpk}
      lebar={620}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          + Baris
        </button>
      )}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <BarisField kolom={1}>
        <Field
          label="Dikerjakan untuk"
          nama="tujuan"
          pilihan={objek.map((o) => ({ nilai: o.kunci, label: o.label }))}
          wajib
        />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Uraian Pekerjaan" nama="uraian" wajib petunjuk="mis. Pek. Pondasi Batu Kali" />
      </BarisField>
      <BarisField>
        <Field label="Grup" nama="grup" petunjuk="mis. Struktur" />
        <Field label="Satuan" nama="satuan" petunjuk="mis. m³" />
      </BarisField>
      <BarisField>
        <Field label="Volume" nama="volume" tipe="number" wajib />
        <Field label="Harga Satuan" nama="hargaSatuan" tipe="number" satuan="Rp" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field
          label="Progres Awal"
          nama="progress"
          tipe="number"
          satuan="%"
          nilai={0}
          petunjuk="Biarkan 0 bila pekerjaan belum dimulai."
        />
      </BarisField>
    </FormModal>
  );
}

/** Ubah satu baris BOQ SPK. Objek tujuannya tidak bisa dipindah. */
export function UbahBarisBoq({
  baris,
}: {
  baris: {
    id: string;
    grup: string;
    uraian: string;
    satuan: string;
    volume: number;
    hargaSatuan: number;
    progress: number;
  };
}) {
  return (
    <FormModal
      judul="Ubah Baris Pekerjaan"
      aksi={ubahBarisBoqSpk}
      lebar={620}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah baris ${baris.uraian}`} />}
    >
      <input type="hidden" name="id" value={baris.id} />
      <BarisField kolom={1}>
        <Field label="Uraian Pekerjaan" nama="uraian" nilai={baris.uraian} wajib />
      </BarisField>
      <BarisField>
        <Field label="Grup" nama="grup" nilai={baris.grup} />
        <Field label="Satuan" nama="satuan" nilai={baris.satuan} />
      </BarisField>
      <BarisField>
        <Field label="Volume" nama="volume" nilai={baris.volume} tipe="number" wajib />
        <Field
          label="Harga Satuan"
          nama="hargaSatuan"
          nilai={baris.hargaSatuan}
          tipe="number"
          satuan="Rp"
          wajib
        />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Progres" nama="progress" nilai={baris.progress} tipe="number" satuan="%" />
      </BarisField>
    </FormModal>
  );
}

export function HapusBarisBoq({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusBarisBoqSpk} id={id} nama={`baris ${uraian}`} />;
}

/** Impor BOQ satu objek dari Excel. Menggantikan baris objek itu, bukan menambah. */
export function ImporBoqSpk({
  contractId,
  objek,
}: {
  contractId: string;
  objek: PilihanObjek[];
}) {
  return (
    <FormModal
      judul="Impor BOQ dari Excel"
      keterangan="Berkas mengikuti format BOQ yang sama dengan impor BOQ unit."
      aksi={imporBoqSpk}
      labelSimpan="Impor"
      lebar={560}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          Impor Excel
        </button>
      )}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <BarisField kolom={1}>
        <Field
          label="Dikerjakan untuk"
          nama="tujuan"
          pilihan={objek.map((o) => ({ nilai: o.kunci, label: o.label }))}
          wajib
        />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Berkas Excel" nama="berkas" tipe="berkas" wajib />
      </BarisField>
      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        Impor <b>mengganti</b> seluruh baris BOQ objek yang dipilih pada SPK ini,
        supaya mengimpor ulang berkas yang sama tidak menggandakan isinya. Kolom
        progres tidak ikut diimpor — berkas SPK berisi lingkup pekerjaan,
        sedangkan progres adalah hasil opname.
      </p>
    </FormModal>
  );
}

/**
 * Salin BOQ satu unit ke seluruh unit lain dalam kontrak.
 *
 * SPK borongan untuk sepuluh unit tipe sama berisi rincian yang sama sepuluh
 * kali; tanpa ini QS harus mengetik atau mengimpor sepuluh kali.
 */
export function SalinBoqKeSemua({
  contractId,
  objek,
  jumlahUnitLain,
}: {
  contractId: string;
  objek: PilihanObjek[];
  jumlahUnitLain: number;
}) {
  return (
    <FormModal
      judul="Salin BOQ ke Seluruh Unit"
      keterangan={`Menyalin rincian pekerjaan satu unit ke ${jumlahUnitLain} unit lain dalam SPK ini.`}
      aksi={salinBoqKeSemua}
      labelSimpan="Salin"
      lebar={560}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          Salin ke Semua Unit
        </button>
      )}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <BarisField kolom={1}>
        <Field
          label="Unit sumber"
          nama="sumber"
          pilihan={objek.map((o) => ({ nilai: o.kunci, label: o.label }))}
          wajib
        />
      </BarisField>
      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        BOQ unit lain akan <b>diganti</b>, dan progresnya dimulai dari nol —
        yang disalin lingkup pekerjaannya, bukan capaian lapangannya.
      </p>
    </FormModal>
  );
}
