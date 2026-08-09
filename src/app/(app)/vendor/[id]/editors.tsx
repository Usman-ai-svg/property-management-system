"use client";

import { BarisField, Field, FieldTerkunci, FormModal, TombolHapus } from "@/components/form";
import { METODE_BAYAR, STATUS_VO } from "@/lib/domain/enums";
import { hapusPembayaran, tambahPembayaran, tambahVo } from "../actions";

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
  peruntukan,
  jenisBiaya,
  cakupan,
}: {
  contractId: string;
  sisa: number;
  /** Peruntukan otomatis dari lingkup kontrak (Unit/Sarpras) — ditampilkan terkunci. */
  peruntukan: string;
  /** Jenis biaya otomatis dari jenisBiaya kontrak — ditampilkan terkunci. */
  jenisBiaya: string;
  /** Jumlah objek cakupan kontrak — untuk keterangan pembebanan otomatis. */
  cakupan: number;
}) {
  return (
    <FormModal
      judul="Catat Pembayaran"
      keterangan={`Peruntukan & pembebanan mengikuti kontrak (terkunci). Sisa yang bisa dibayar: Rp ${Math.round(sisa).toLocaleString("id-ID")}`}
      aksi={tambahPembayaran}
      labelSimpan="Catat"
      lebar={600}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          + Catat Pembayaran
        </button>
      )}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <BarisField>
        <FieldTerkunci label="Peruntukan" nilai={peruntukan} />
        <FieldTerkunci label="Jenis Biaya" nilai={jenisBiaya} />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Uraian" nama="uraian" wajib petunjuk="mis. Termin 3 borongan struktur" />
      </BarisField>
      <BarisField>
        <Field label="Nominal" nama="nominal" tipe="number" satuan="Rp" wajib />
        <Field label="Metode" nama="metode" nilai={METODE_BAYAR[0]} pilihan={METODE_BAYAR} />
      </BarisField>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
          Dibebankan ke
        </label>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, padding: "10px 12px", background: "var(--rona-panel)", borderRadius: 8 }}>
          {cakupan > 0
            ? <>Otomatis dibagi ke <b>{cakupan} objek</b> cakupan kontrak, menurut porsi nilainya — terkunci.</>
            : <>Kontrak tanpa cakupan objek → tercatat sebagai <b>biaya level proyek</b>.</>}
        </div>
      </div>
      <BarisField kolom={1}>
        <Field label="Nama berkas bukti" nama="bukti" petunjuk="Berkasnya belum diunggah pada demo ini" />
      </BarisField>
    </FormModal>
  );
}

export function HapusPembayaran({ id }: { id: string }) {
  return <TombolHapus aksi={hapusPembayaran} id={id} nama="pembayaran ini" />;
}
