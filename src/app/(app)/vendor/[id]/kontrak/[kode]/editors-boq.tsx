"use client";

import { useActionState } from "react";
import { BarisField, Field, FormModal, TombolHapus, TombolIkon } from "@/components/form";
import { Petunjuk } from "@/components/ui";
import {
  hapusBarisBoqSpk,
  imporBoqSpk,
  resetOverrideBoq,
  tambahBarisBoqSpk,
  ubahBarisBoqSpk,
  ubahOverrideBoq,
} from "../../../boq-actions";

// ===========================================================================
// TEMPLATE BOQ (level SPK) — tanpa objek, berlaku untuk semua unit
// ===========================================================================

/** Tambah satu baris ke template BOQ SPK. */
export function TambahBarisBoq({ contractId }: { contractId: string }) {
  return (
    <FormModal
      judul="Tambah Baris Pekerjaan"
      keterangan="Baris template ini berlaku untuk seluruh objek SPK. Nilai per objek bisa disesuaikan di laman detail objek."
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
    </FormModal>
  );
}

/** Ubah satu baris template BOQ SPK (berlaku ke semua objek yang belum disesuaikan). */
export function UbahBarisBoq({
  baris,
}: {
  baris: { id: string; grup: string; uraian: string; satuan: string; volume: number; hargaSatuan: number };
}) {
  return (
    <FormModal
      judul="Ubah Baris Pekerjaan (Template)"
      keterangan="Perubahan menurun ke semua objek yang belum menyesuaikan baris ini."
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
        <Field label="Harga Satuan" nama="hargaSatuan" nilai={baris.hargaSatuan} tipe="number" satuan="Rp" wajib />
      </BarisField>
    </FormModal>
  );
}

export function HapusBarisBoq({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusBarisBoqSpk} id={id} nama={`baris ${uraian}`} />;
}

/** Impor template BOQ SPK dari Excel — mengganti seluruh baris template. */
export function ImporBoqSpk({ contractId }: { contractId: string }) {
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
        <Field label="Berkas Excel" nama="berkas" tipe="berkas" wajib />
      </BarisField>
      <Petunjuk>
        Impor <b>mengganti</b> seluruh baris template BOQ SPK ini — mengimpor ulang
        berkas yang sama tidak menggandakan isinya. Penyesuaian & progres per objek
        ikut ter-reset karena barisnya berganti.
      </Petunjuk>
    </FormModal>
  );
}

// ===========================================================================
// OVERRIDE per objek — di laman detail objek
// ===========================================================================

/**
 * Sesuaikan nilai satu baris untuk SATU objek. Field yang dikosongkan mengikuti
 * template (petunjuk menampilkan nilai template-nya).
 */
export function SesuaikanBaris({
  boqItemId,
  objek,
  template,
  override,
}: {
  boqItemId: string;
  /** "unit:<id>" | "sarpras:<id>". */
  objek: string;
  template: { grup: string; uraian: string; satuan: string; volume: number; hargaSatuan: number };
  override: {
    grup: string | null; uraian: string | null; satuan: string | null;
    volume: number | null; hargaSatuan: number | null;
  } | null;
}) {
  return (
    <FormModal
      judul="Sesuaikan Baris untuk Objek Ini"
      keterangan="Hanya berlaku untuk objek ini. Kosongkan sebuah field untuk mengikuti template SPK."
      aksi={ubahOverrideBoq}
      lebar={620}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Sesuaikan ${template.uraian}`} />}
    >
      <input type="hidden" name="boqItemId" value={boqItemId} />
      <input type="hidden" name="objek" value={objek} />
      <BarisField kolom={1}>
        <Field label="Uraian" nama="uraian" nilai={override?.uraian ?? ""} petunjuk={`Template: ${template.uraian}`} />
      </BarisField>
      <BarisField>
        <Field label="Grup" nama="grup" nilai={override?.grup ?? ""} petunjuk={`Template: ${template.grup}`} />
        <Field label="Satuan" nama="satuan" nilai={override?.satuan ?? ""} petunjuk={`Template: ${template.satuan}`} />
      </BarisField>
      <BarisField>
        <Field label="Volume" nama="volume" nilai={override?.volume ?? ""} tipe="number" petunjuk={`Template: ${template.volume}`} />
        <Field label="Harga Satuan" nama="hargaSatuan" nilai={override?.hargaSatuan ?? ""} tipe="number" satuan="Rp" petunjuk={`Template: ${template.hargaSatuan}`} />
      </BarisField>
    </FormModal>
  );
}

/** Kembalikan sebuah baris objek ke nilai template (buang penyesuaiannya). */
export function SamakanKeTemplate({ boqItemId, objek }: { boqItemId: string; objek: string }) {
  const [, kirim] = useActionState(resetOverrideBoq, null);
  return (
    <form action={kirim} style={{ display: "inline" }}>
      <input type="hidden" name="boqItemId" value={boqItemId} />
      <input type="hidden" name="objek" value={objek} />
      <button
        type="submit"
        title="Samakan baris ini ke template SPK"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--muted)", font: "inherit", fontSize: 11, padding: "2px 4px",
        }}
      >
        ↺ template
      </button>
    </form>
  );
}
