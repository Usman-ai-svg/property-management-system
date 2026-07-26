"use client";

import { useState } from "react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import { KEPEMILIKAN_ASET, SATUAN_PAKAI, STATUS_ASET } from "@/lib/domain/enums";
import { hapusAset, tambahAset, ubahAset } from "./actions";

export interface AsetForm {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  merk: string | null;
  jumlah: number;
  satuan: string;
  kepemilikan: string;
  vendorId: string | null;
  projectId: string | null;
  penanggungJawab: string | null;
  status: string;
  satuanPakai: string;
  pemakaian: number;
  servisTerakhir: string | null;
  servisBerikut: string | null;
  nilai: number;
}

type Pilihan = { id: string; nama: string }[];

/**
 * Isian aset yang dipakai bersama oleh form tambah dan ubah.
 *
 * Pemilih vendor hanya muncul saat kepemilikannya Sewa: aset milik sendiri
 * tidak punya vendor, dan menampilkannya tetap membuat orang mengisinya.
 */
function IsianAset({
  nilai,
  vendor,
  proyek,
}: {
  nilai?: AsetForm;
  vendor: Pilihan;
  proyek: Pilihan;
}) {
  const [kepemilikan, setKepemilikan] = useState(nilai?.kepemilikan ?? KEPEMILIKAN_ASET[0]);

  return (
    <>
      <BarisField>
        <Field label="Kode" nama="kode" nilai={nilai?.kode} wajib petunjuk="mis. EX-02, TRK-05" />
        <Field label="Kategori" nama="kategori" nilai={nilai?.kategori} wajib petunjuk="mis. Alat Berat" />
      </BarisField>

      <BarisField>
        <Field label="Nama" nama="nama" nilai={nilai?.nama} wajib />
        <Field label="Merk / Tipe" nama="merk" nilai={nilai?.merk ?? ""} />
      </BarisField>

      <BarisField>
        <Field label="Jumlah" nama="jumlah" nilai={nilai?.jumlah ?? 1} tipe="number" wajib />
        <Field label="Satuan" nama="satuan" nilai={nilai?.satuan ?? "unit"} />
      </BarisField>

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Kepemilikan
          </label>
          <select
            name="kepemilikan"
            className="inp"
            value={kepemilikan}
            onChange={(e) => setKepemilikan(e.target.value)}
          >
            {KEPEMILIKAN_ASET.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <Field label="Status" nama="status" nilai={nilai?.status ?? STATUS_ASET[0]} pilihan={STATUS_ASET} />
      </BarisField>

      {kepemilikan === "Sewa" && (
        <BarisField kolom={1}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Vendor penyewa
            </label>
            <select name="vendorId" className="inp" defaultValue={nilai?.vendorId ?? ""}>
              <option value="">— belum ditentukan —</option>
              {vendor.map((v) => (
                <option key={v.id} value={v.id}>{v.nama}</option>
              ))}
            </select>
          </div>
        </BarisField>
      )}

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Penempatan
          </label>
          <select name="projectId" className="inp" defaultValue={nilai?.projectId ?? ""}>
            <option value="">— belum ditempatkan —</option>
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
        <Field label="Penanggung Jawab" nama="penanggungJawab" nilai={nilai?.penanggungJawab ?? ""} />
      </BarisField>

      <BarisField>
        <Field label="Pemakaian" nama="pemakaian" nilai={nilai?.pemakaian ?? 0} tipe="number" />
        <Field
          label="Satuan Pakai"
          nama="satuanPakai"
          nilai={nilai?.satuanPakai ?? SATUAN_PAKAI[0]}
          pilihan={SATUAN_PAKAI}
        />
      </BarisField>

      <BarisField>
        <Field label="Servis Terakhir" nama="servisTerakhir" nilai={nilai?.servisTerakhir ?? ""} tipe="tanggal" />
        <Field label="Servis Berikut" nama="servisBerikut" nilai={nilai?.servisBerikut ?? ""} tipe="tanggal" />
      </BarisField>

      <BarisField kolom={1}>
        <Field
          label={kepemilikan === "Sewa" ? "Tarif Sewa" : "Nilai Perolehan"}
          nama="nilai"
          nilai={nilai?.nilai ?? 0}
          tipe="number"
          satuan="Rp"
          petunjuk={
            kepemilikan === "Sewa"
              ? "Tarif per satuan pakai yang dipilih di atas."
              : "Nilai perolehan aset."
          }
        />
      </BarisField>
    </>
  );
}

export function TambahAset({ vendor, proyek }: { vendor: Pilihan; proyek: Pilihan }) {
  return (
    <FormModal
      judul="Tambah Peralatan"
      keterangan="Aset boleh belum ditempatkan pada proyek mana pun."
      aksi={tambahAset}
      labelSimpan="Tambah"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Peralatan" />}
    >
      <IsianAset vendor={vendor} proyek={proyek} />
    </FormModal>
  );
}

export function UbahAset({
  aset,
  vendor,
  proyek,
}: {
  aset: AsetForm;
  vendor: Pilihan;
  proyek: Pilihan;
}) {
  return (
    <FormModal
      judul={`Ubah ${aset.kode}`}
      keterangan={aset.nama}
      aksi={ubahAset}
      lebar={640}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah aset ${aset.kode}`} />}
    >
      <input type="hidden" name="id" value={aset.id} />
      <IsianAset nilai={aset} vendor={vendor} proyek={proyek} />
    </FormModal>
  );
}

export function HapusAset({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusAset} id={id} nama={`aset ${kode}`} />;
}
