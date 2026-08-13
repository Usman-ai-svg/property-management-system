"use client";

import { useState } from "react";
import { BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah } from "@/components/form";
import { STATUS_PROYEK } from "@/lib/domain/enums";
import { aturJumlahFase, hapusProyek, tambahProyek, ubahProyek } from "./actions";
import { Petunjuk } from "@/components/ui";

/**
 * Pengelolaan proyek & fase.
 *
 * Dipindahkan dari Admin → "Pengelolaan Proyek": lokasi, legalitas, luas,
 * unit, dan sarpras sudah disunting dari Master Proyek, jadi pembuatan dan
 * penyuntingan proyek serta fasenya juga lebih wajar di sini.
 */

/* ===================== PROYEK ===================== */

export function TambahProyek() {
  return (
    <FormModal
      judul="Buat Proyek Baru"
      keterangan="Proyek dibuat beserta fase pertamanya dan business plan kosong."
      aksi={tambahProyek}
      labelSimpan="Buat Proyek"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Buat Proyek" />}
    >
      <BarisField>
        <Field label="Kode" nama="kode" wajib petunjuk="2–8 huruf/angka, mis. NT5" />
        <Field label="Status" nama="status" nilai={STATUS_PROYEK[0]} pilihan={STATUS_PROYEK} />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Nama Proyek" nama="nama" wajib />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Alamat" nama="alamat" wajib />
      </BarisField>

      <BarisField>
        <Field label="Kelurahan" nama="kelurahan" wajib />
        <Field label="Kecamatan" nama="kecamatan" wajib />
      </BarisField>

      <BarisField>
        <Field label="Kota / Kabupaten" nama="kota" wajib />
        <Field label="Provinsi" nama="provinsi" wajib />
      </BarisField>

      <BarisField>
        <Field label="Luas Kavling Efektif" nama="luasKavlingEfektif" nilai={0} tipe="number" satuan="m²" />
        <Field label="Luas Sarana" nama="luasSarana" nilai={0} tipe="number" satuan="m²" />
      </BarisField>

      <BarisField>
        <Field label="Luas Prasarana" nama="luasPrasarana" nilai={0} tipe="number" satuan="m²" />
        <Field label="Luas RTH" nama="luasRth" nilai={0} tipe="number" satuan="m²" />
      </BarisField>

      <Petunjuk>
        Proyek dibuat dengan fase pertama <b>F1</b> otomatis; jumlah fase diatur dari
        kartu Fase. Biaya perolehan lahan diisi kemudian dari halaman Landbank.
      </Petunjuk>
    </FormModal>
  );
}

export function UbahProyek({
  proyek,
}: {
  proyek: { id: string; kode: string; nama: string; status: string };
}) {
  return (
    <FormModal
      judul={`Ubah Proyek ${proyek.kode}`}
      aksi={ubahProyek}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah proyek ${proyek.kode}`} />}
    >
      <input type="hidden" name="id" value={proyek.id} />
      <BarisField kolom={1}>
        <Field label="Nama Proyek" nama="nama" nilai={proyek.nama} wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Status" nama="status" nilai={proyek.status} pilihan={STATUS_PROYEK} />
      </BarisField>
    </FormModal>
  );
}

export function HapusProyek({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusProyek} id={id} nama={`proyek ${kode}`} />;
}

/* ===================== FASE ===================== */

/**
 * Atur jumlah fase. Fase tergenerate otomatis F1..Fn; pengguna hanya menaikkan
 * atau menurunkan jumlahnya — tidak ada nama fase, dan penghapusan selalu dari
 * belakang (hanya fase kosong yang boleh dilepas).
 */
export function AturJumlahFase({
  projectId,
  kodeProyek,
  jumlah,
}: {
  projectId: string;
  kodeProyek: string;
  jumlah: number;
}) {
  const [n, setN] = useState(jumlah);

  return (
    <FormModal
      judul={`Atur Jumlah Fase · ${kodeProyek}`}
      keterangan="Fase digenerate otomatis F1, F2, … Menaikkan menambah fase di belakang; menurunkan menghapus fase paling belakang bila kosong."
      aksi={aturJumlahFase}
      labelSimpan="Simpan"
      pemicu={(buka) => <TombolTambah onClick={() => { setN(jumlah); buka(); }} label="Atur Fase" />}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Jumlah Fase
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="btn-garis" onClick={() => setN((v) => Math.max(1, v - 1))} style={{ width: 34 }}>−</button>
            <input
              name="jumlah"
              type="number"
              min={1}
              className="inp"
              value={n}
              onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 90, textAlign: "center" }}
            />
            <button type="button" className="btn-garis" onClick={() => setN((v) => v + 1)} style={{ width: 34 }}>+</button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
            Menjadi: {Array.from({ length: n }, (_, i) => `F${i + 1}`).join(", ")}
          </div>
        </div>
      </BarisField>
      <Petunjuk>
        Kode unit memuat kode fase (mis. {kodeProyek}-F1-3). Karena itu fase yang
        sudah berisi unit tidak bisa dihapus dari sini — pindahkan atau hapus unitnya
        lebih dulu sebelum menurunkan jumlah fase.
      </Petunjuk>
    </FormModal>
  );
}
