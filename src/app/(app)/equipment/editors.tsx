"use client";

import { useState } from "react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import {
  JENIS_PENYESUAIAN_ASET, KEPEMILIKAN_ASET, SATUAN_PAKAI, STATUS_ASET,
} from "@/lib/domain/enums";
import { catatPenyesuaianAset, hapusAset, tambahAset, ubahAset } from "./actions";

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
        {nilai ? (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Jumlah
            </label>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              <b>
                {nilai.jumlah} {nilai.satuan}
              </b>{" "}
              — diubah lewat Penyesuaian, bukan di sini.
            </div>
          </div>
        ) : (
          <Field label="Jumlah Awal" nama="jumlah" nilai={1} tipe="number" wajib />
        )}
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

/* ===================== PENYESUAIAN STOK ===================== */

/**
 * Catat kehilangan, kerusakan, perbaikan, atau koreksi opname.
 *
 * Inilah satu-satunya jalan mengubah jumlah aset. Formulir Ubah Aset hanya
 * menampilkan jumlahnya sebagai keterangan, supaya tiap pergerakan stok selalu
 * punya alasan dan penanggung jawab.
 */
export function PenyesuaianAset({
  aset,
}: {
  aset: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    jumlah: number;
    jumlahRusak: number;
  };
}) {
  const terpakai = aset.jumlah - aset.jumlahRusak;

  return (
    <FormModal
      judul={`Penyesuaian Stok · ${aset.kode}`}
      keterangan={
        `${aset.nama} — ${aset.jumlah} ${aset.satuan} tercatat, ` +
        `${terpakai} terpakai, ${aset.jumlahRusak} rusak`
      }
      aksi={catatPenyesuaianAset}
      labelSimpan="Catat Penyesuaian"
      lebar={600}
      pemicu={(buka) => (
        <button
          type="button"
          className="btn-garis"
          onClick={buka}
          style={{ fontSize: 11, padding: "3px 8px" }}
          title={`Catat kehilangan atau kerusakan ${aset.kode}`}
        >
          Sesuaikan
        </button>
      )}
    >
      <input type="hidden" name="equipmentId" value={aset.id} />

      <BarisField>
        <Field label="Jenis Penyesuaian" nama="jenis" pilihan={JENIS_PENYESUAIAN_ASET} wajib />
        <Field label="Banyaknya" nama="banyak" tipe="number" satuan={aset.satuan} wajib />
      </BarisField>

      <BarisField kolom={1}>
        <Field
          label="Keterangan"
          nama="keterangan"
          wajib
          petunjuk="mis. hilang di lokasi NT4 saat pemindahan, atau pecah tertimpa material"
        />
      </BarisField>

      <BarisField kolom={1}>
        <Field
          label="Penanggung Jawab"
          nama="penanggungJawab"
          petunjuk="Nama orang yang bertanggung jawab atas barang saat kejadian. Boleh dikosongkan."
        />
      </BarisField>

      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        <b>Hilang</b> mengurangi jumlah tercatat. <b>Rusak</b> tidak — barangnya masih
        dimiliki, hanya tidak bisa dipakai, dan bisa dikembalikan lewat{" "}
        <b>Perbaikan Selesai</b>. <b>Koreksi Stok</b> untuk hasil opname fisik; isi
        angka negatif bila stok nyatanya lebih sedikit.
        <br />
        <br />
        Riwayat penyesuaian bersifat tetap. Pencatatan yang telanjur salah diperbaiki
        dengan Koreksi Stok baru, bukan dengan menghapus catatan lama. Nilai rupiah aset
        tidak berubah — penyusutan dibukukan Finance di luar sistem ini.
      </p>
    </FormModal>
  );
}
