"use client";

import { useState } from "react";
import { BarisField, Field, FieldTerkunci, FormModal, TombolHapus } from "@/components/form";
import { METODE_TUNAI, STATUS_VO } from "@/lib/domain/enums";
import {
  batalSelesai, hapusPembayaran, hapusVo, tambahPembayaran, tambahVo, tandaiSelesai, ubahStatusVo,
} from "../actions";

type ObjekVo = { nilai: string; label: string };

/**
 * Tambah Variation Order — kini BER-BARIS per objek. Tiap baris melekat ke satu
 * unit/sarpras (harga boleh negatif untuk pekerjaan kurang), sehingga VO ikut
 * masuk Nilai BOQ Terinci objek itu dan nilai kontrak tetap = BOQ terinci.
 */
export function TambahVo({ contractId, objek }: { contractId: string; objek: ObjekVo[] }) {
  const [baris, setBaris] = useState<number[]>([0]);
  const [urut, setUrut] = useState(1);

  const tambahBaris = () => {
    setBaris((b) => [...b, urut]);
    setUrut((n) => n + 1);
  };
  const hapusBaris = (id: number) => setBaris((b) => (b.length > 1 ? b.filter((x) => x !== id) : b));

  return (
    <FormModal
      judul="Tambah Variation Order"
      keterangan="Rinci pekerjaan tambah/kurang per objek. Harga negatif = pekerjaan kurang. Baris VO ikut menghitung Nilai BOQ Terinci."
      aksi={tambahVo}
      labelSimpan="Tambah VO"
      lebar={760}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          + Tambah VO
        </button>
      )}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <BarisField>
        <Field label="Uraian VO" nama="uraian" wajib petunjuk="mis. Addendum tambah kuda-kuda baja" />
        <Field label="Status" nama="status" nilai="Diajukan" pilihan={STATUS_VO} petunjuk="Hanya VO Disetujui yang masuk nilai kontrak" />
      </BarisField>

      <div style={{ marginTop: 4 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          Baris pekerjaan VO <span style={{ color: "var(--red)" }}>*</span>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {baris.map((id) => (
            <div
              key={id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1.8fr 0.7fr 0.7fr 1fr auto",
                gap: 6, alignItems: "center",
              }}
            >
              <select name="itemObjek" className="inp" defaultValue={objek[0]?.nilai ?? ""} required>
                {objek.map((o) => (
                  <option key={o.nilai} value={o.nilai}>{o.label}</option>
                ))}
              </select>
              <input name="itemUraian" className="inp" placeholder="Uraian pekerjaan" />
              <input name="itemSatuan" className="inp" placeholder="ls" defaultValue="ls" />
              <input name="itemVolume" className="inp" type="number" step="any" placeholder="Vol" defaultValue={1} />
              <input name="itemHarga" className="inp" type="number" step="any" placeholder="Harga (−kurang)" />
              <button
                type="button"
                onClick={() => hapusBaris(id)}
                title="Hapus baris"
                style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-garis" onClick={tambahBaris} style={{ marginTop: 8 }}>
          + Baris
        </button>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          Nilai VO dihitung otomatis dari Σ (volume × harga) seluruh baris. Pekerjaan
          kurang: isi harga satuan negatif.
        </div>
      </div>
    </FormModal>
  );
}

/** Hapus sebuah VO beserta baris pekerjaannya. */
export function HapusVo({ id, nomor }: { id: string; nomor: string }) {
  return <TombolHapus aksi={hapusVo} id={id} nama={`${nomor} dan seluruh barisnya`} />;
}

/** Ubah status VO (Diajukan/Disetujui/Ditolak). */
export function StatusVo({ id, status }: { id: string; status: string }) {
  return (
    <FormModal
      judul="Ubah Status VO"
      keterangan="Hanya VO 'Disetujui' yang barisnya masuk Nilai BOQ Terinci & nilai kontrak."
      aksi={ubahStatusVo}
      labelSimpan="Simpan"
      pemicu={(buka) => (
        <button type="button" onClick={buka} className="chip" style={{ cursor: "pointer", border: "none" }}>
          ubah status
        </button>
      )}
    >
      <input type="hidden" name="id" value={id} />
      <BarisField kolom={1}>
        <Field label="Status" nama="status" nilai={status} pilihan={STATUS_VO} />
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
        <Field label="Metode" nama="metode" nilai={METODE_TUNAI[0]} pilihan={METODE_TUNAI} />
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
        <Field
          label="Berkas bukti"
          nama="berkas"
          tipe="berkas"
          petunjuk="Opsional — nota, kwitansi, atau berita acara (PDF/gambar/Office)"
        />
      </BarisField>
    </FormModal>
  );
}

export function HapusPembayaran({ id }: { id: string }) {
  return <TombolHapus aksi={hapusPembayaran} id={id} nama="pembayaran ini" />;
}

/**
 * Tandai kontrak selesai. Tombol ini hanya dirender saat Progress Vendor SPK
 * sudah 100% (dijaga pemanggil), dan server memverifikasi ulang syarat itu.
 */
export function TandaiSelesai({ id }: { id: string }) {
  const hariIni = new Date().toISOString().slice(0, 10);
  return (
    <FormModal
      judul="Tandai Kontrak Selesai"
      keterangan="Menandai pekerjaan selesai. Tanggal ini jadi acuan jatuh tempo retensi (tanggal selesai + masa pemeliharaan)."
      aksi={tandaiSelesai}
      labelSimpan="Tandai Selesai"
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          Tandai Selesai
        </button>
      )}
    >
      <input type="hidden" name="id" value={id} />
      <BarisField kolom={1}>
        <Field label="Tanggal Selesai" nama="tanggalSelesai" nilai={hariIni} tipe="tanggal" wajib />
      </BarisField>
    </FormModal>
  );
}

/** Batalkan tanda selesai (mengosongkan tanggal selesai). */
export function BatalSelesai({ id }: { id: string }) {
  return (
    <FormModal
      judul="Batalkan Tanda Selesai"
      keterangan="Mengosongkan tanggal selesai kontrak. Perhitungan jatuh tempo retensi kembali memakai tanggal pelunasan."
      aksi={batalSelesai}
      labelSimpan="Batalkan"
      pemicu={(buka) => (
        <button
          type="button"
          onClick={buka}
          style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          Batalkan
        </button>
      )}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}
