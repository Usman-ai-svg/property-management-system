"use client";

import { BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah, TombolUbah } from "@/components/form";
import { JENIS_SARPRAS, STATUS_JUAL, STATUS_PEMBANGUNAN, STATUS_SARPRAS } from "@/lib/domain/enums";
import {
  hapusLegalitas, hapusSarpras, hapusTipeUnit, hapusUnit, simpanLegalitas,
  simpanSarpras, simpanTipeUnit, tambahUnit, ubahBiayaLahan, ubahDeskripsiProyek, ubahUnit,
} from "../actions";

/* ===================== DESKRIPSI PROYEK ===================== */

export function EditDeskripsi({
  kode,
  proyek,
}: {
  kode: string;
  proyek: {
    nama: string; alamat: string; kelurahan: string; kecamatan: string;
    kota: string; provinsi: string;
    luasKavlingEfektif: number; luasSarana: number; luasPrasarana: number; luasRth: number;
  };
}) {
  return (
    <FormModal
      judul="Ubah deskripsi proyek"
      keterangan="Lokasi dan pembagian luas lahan."
      aksi={ubahDeskripsiProyek}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
      lebar={640}
    >
      <input type="hidden" name="kode" value={kode} />

      <BarisField kolom={1}>
        <Field label="Nama proyek" nama="nama" nilai={proyek.nama} wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Alamat" nama="alamat" nilai={proyek.alamat} wajib />
      </BarisField>
      <BarisField>
        <Field label="Kelurahan" nama="kelurahan" nilai={proyek.kelurahan} wajib />
        <Field label="Kecamatan" nama="kecamatan" nilai={proyek.kecamatan} wajib />
      </BarisField>
      <BarisField>
        <Field label="Kota / Kabupaten" nama="kota" nilai={proyek.kota} wajib />
        <Field label="Provinsi" nama="provinsi" nilai={proyek.provinsi} wajib />
      </BarisField>

      <div className="eyebrow" style={{ marginTop: 20, marginBottom: 10 }}>Pembagian luas</div>
      <BarisField>
        <Field label="Kavling efektif" nama="luasKavlingEfektif" nilai={proyek.luasKavlingEfektif} tipe="number" satuan="m²" />
        <Field label="Sarana" nama="luasSarana" nilai={proyek.luasSarana} tipe="number" satuan="m²" />
      </BarisField>
      <BarisField>
        <Field label="Prasarana" nama="luasPrasarana" nilai={proyek.luasPrasarana} tipe="number" satuan="m²" />
        <Field label="Ruang terbuka hijau" nama="luasRth" nilai={proyek.luasRth} tipe="number" satuan="m²" />
      </BarisField>
    </FormModal>
  );
}

/* ===================== BIAYA LAHAN ===================== */

export function EditBiayaLahan({
  kode,
  biaya,
}: {
  kode: string;
  biaya: {
    hargaPerM2: number; biayaPembelian: number; biayaNotaris: number;
    biayaBalikNama: number; biayaLegalLain: number;
  };
}) {
  return (
    <FormModal
      judul="Ubah biaya perolehan lahan"
      keterangan="Perubahan di sini ikut menggeser pos Perolehan Tanah pada Plan vs Realisasi."
      aksi={ubahBiayaLahan}
      pemicu={(buka) => <TombolUbah onClick={buka} />}
    >
      <input type="hidden" name="kode" value={kode} />
      <BarisField>
        <Field label="Harga per m²" nama="hargaPerM2" nilai={biaya.hargaPerM2} tipe="number" satuan="Rp" />
        <Field label="Biaya pembelian" nama="biayaPembelian" nilai={biaya.biayaPembelian} tipe="number" satuan="Rp" />
      </BarisField>
      <BarisField>
        <Field label="Notaris" nama="biayaNotaris" nilai={biaya.biayaNotaris} tipe="number" satuan="Rp" />
        <Field label="Balik nama" nama="biayaBalikNama" nilai={biaya.biayaBalikNama} tipe="number" satuan="Rp" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Legal lain-lain" nama="biayaLegalLain" nilai={biaya.biayaLegalLain} tipe="number" satuan="Rp" />
      </BarisField>
    </FormModal>
  );
}

/* ===================== LEGALITAS ===================== */

function FormLegalitas({
  kode,
  data,
  pemicu,
}: {
  kode: string;
  data?: { id: string; nib: string; sertifikat: string; luas: number };
  pemicu: (buka: () => void) => React.ReactNode;
}) {
  return (
    <FormModal
      judul={data ? "Ubah legalitas" : "Tambah legalitas"}
      aksi={simpanLegalitas}
      pemicu={pemicu}
    >
      <input type="hidden" name="kode" value={kode} />
      {data && <input type="hidden" name="id" value={data.id} />}
      <BarisField>
        <Field label="NIB" nama="nib" nilai={data?.nib} wajib />
        <Field label="Luas" nama="luas" nilai={data?.luas} tipe="number" satuan="m²" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field
          label="Sertifikat"
          nama="sertifikat"
          nilai={data?.sertifikat}
          tipe="textarea"
          wajib
          petunjuk="Contoh: SHM No. 412 — Induk, pemecahan selesai 8 unit"
        />
      </BarisField>
    </FormModal>
  );
}

export function TambahLegalitas({ kode }: { kode: string }) {
  return <FormLegalitas kode={kode} pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah legalitas" />} />;
}

export function AksiLegalitas({
  kode,
  data,
}: {
  kode: string;
  data: { id: string; nib: string; sertifikat: string; luas: number };
}) {
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
      <FormLegalitas
        kode={kode}
        data={data}
        pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah legalitas ${data.nib}`} />}
      />
      <TombolHapus aksi={hapusLegalitas} id={data.id} nama={`legalitas ${data.nib}`} />
    </div>
  );
}

/* ===================== TIPE UNIT ===================== */

function FormTipeUnit({
  kode,
  data,
  pemicu,
}: {
  kode: string;
  data?: { id: string; kode: string; nama: string; luasBangunan: number; luasTanah: number };
  pemicu: (buka: () => void) => React.ReactNode;
}) {
  return (
    <FormModal
      judul={data ? "Ubah tipe unit" : "Tambah tipe unit"}
      keterangan={
        data
          ? "Mengubah luas bangunan tidak menghitung ulang RAB unit yang sudah ada — baris BOQ mereka adalah snapshot."
          : "Tipe baru bisa langsung dipakai saat menambah unit."
      }
      aksi={simpanTipeUnit}
      pemicu={pemicu}
    >
      <input type="hidden" name="kode" value={kode} />
      {data && <input type="hidden" name="id" value={data.id} />}
      <BarisField>
        <Field label="Kode tipe" nama="kodeTipe" nilai={data?.kode} wajib petunjuk="Mis. T36, NWT, GLL" />
        <Field label="Nama" nama="nama" nilai={data?.nama} wajib />
      </BarisField>
      <BarisField>
        <Field label="Luas bangunan" nama="luasBangunan" nilai={data?.luasBangunan} tipe="number" satuan="m²" wajib />
        <Field label="Luas tanah" nama="luasTanah" nilai={data?.luasTanah} tipe="number" satuan="m²" wajib />
      </BarisField>
    </FormModal>
  );
}

export function TambahTipeUnit({ kode }: { kode: string }) {
  return <FormTipeUnit kode={kode} pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah tipe" />} />;
}

export function AksiTipeUnit({
  kode,
  data,
  dipakai,
}: {
  kode: string;
  data: { id: string; kode: string; nama: string; luasBangunan: number; luasTanah: number };
  dipakai: number;
}) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      <FormTipeUnit
        kode={kode}
        data={data}
        pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah tipe ${data.nama}`} />}
      />
      {/* Tombol hapus disembunyikan bila tipe masih dipakai — server juga
          menolaknya, ini sekadar tidak menawarkan yang pasti gagal. */}
      {dipakai === 0 && <TombolHapus aksi={hapusTipeUnit} id={data.id} nama={`tipe ${data.nama}`} />}
    </div>
  );
}

/* ===================== UNIT ===================== */

export function EditUnit({
  data,
}: {
  data: {
    id: string; label: string; luasTanah: number;
    statusPembangunan: string; statusJual: string; progress: number;
  };
}) {
  return (
    <FormModal
      judul={`Ubah unit ${data.label}`}
      keterangan="Perubahan progres dicatat sebagai titik riwayat baru, bukan menimpa angka sebelumnya."
      aksi={ubahUnit}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah unit ${data.label}`} />}
    >
      <input type="hidden" name="id" value={data.id} />
      <BarisField>
        <Field label="Status pembangunan" nama="statusPembangunan" nilai={data.statusPembangunan} pilihan={STATUS_PEMBANGUNAN} />
        <Field label="Status jual" nama="statusJual" nilai={data.statusJual} pilihan={STATUS_JUAL} />
      </BarisField>
      <BarisField>
        <Field label="Progres" nama="progress" nilai={data.progress} tipe="number" satuan="%" />
        <Field label="Luas tanah" nama="luasTanah" nilai={data.luasTanah} tipe="number" satuan="m²" />
      </BarisField>
    </FormModal>
  );
}

export function TambahUnit({
  kode,
  fases,
  tipes,
}: {
  kode: string;
  fases: { id: string; kode: string }[];
  tipes: { id: string; nama: string; luasBangunan: number }[];
}) {
  return (
    <FormModal
      judul="Tambah unit"
      keterangan="Unit baru mendapat salinan BOQ dan RAP dari template harga yang berlaku saat ini."
      aksi={tambahUnit}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah unit" />}
    >
      <input type="hidden" name="kode" value={kode} />
      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Fase <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select name="phaseId" className="inp" required>
            {fases.map((f) => (
              <option key={f.id} value={f.id}>{f.kode}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Tipe unit <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select name="unitTypeId" className="inp" required>
            {tipes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama} — LB {t.luasBangunan} m²
              </option>
            ))}
          </select>
        </div>
      </BarisField>
      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        Nomor unit ditentukan otomatis dari nomor terakhir pada fase yang dipilih.
      </p>
    </FormModal>
  );
}

export function HapusUnit({ id, label }: { id: string; label: string }) {
  return <TombolHapus aksi={hapusUnit} id={id} nama={`unit ${label}`} />;
}

/* ===================== SARPRAS ===================== */

function FormSarpras({
  kode,
  data,
  pemicu,
  bolehHarga,
}: {
  kode: string;
  data?: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number; rab?: number;
  };
  pemicu: (buka: () => void) => React.ReactNode;
  bolehHarga: boolean;
}) {
  return (
    <FormModal
      judul={data ? "Ubah sarana / prasarana" : "Tambah sarana / prasarana"}
      aksi={simpanSarpras}
      pemicu={pemicu}
    >
      <input type="hidden" name="kode" value={kode} />
      {data && <input type="hidden" name="id" value={data.id} />}
      <BarisField>
        <Field label="Nama" nama="nama" nilai={data?.nama} wajib />
        <Field label="Jenis" nama="jenis" nilai={data?.jenis ?? "Prasarana"} pilihan={JENIS_SARPRAS} />
      </BarisField>
      <BarisField>
        <Field label="Volume" nama="volume" nilai={data?.volume} wajib petunjuk="Beserta satuannya, mis. 3.400 m²" />
        <Field label="Status" nama="status" nilai={data?.status ?? "Belum terbangun"} pilihan={STATUS_SARPRAS} />
      </BarisField>
      <BarisField>
        <Field label="Progres" nama="progress" nilai={data?.progress ?? 0} tipe="number" satuan="%" />
        {bolehHarga && <Field label="RAB" nama="rab" nilai={data?.rab ?? 0} tipe="number" satuan="Rp" />}
      </BarisField>
    </FormModal>
  );
}

export function TambahSarpras({ kode, bolehHarga }: { kode: string; bolehHarga: boolean }) {
  return (
    <FormSarpras
      kode={kode}
      bolehHarga={bolehHarga}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah item" />}
    />
  );
}

export function AksiSarpras({
  kode,
  data,
  terkontrak,
  bolehHarga,
}: {
  kode: string;
  data: {
    id: string; nama: string; jenis: string; volume: string;
    status: string; progress: number; rab?: number;
  };
  terkontrak: number;
  bolehHarga: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
      <FormSarpras
        kode={kode}
        data={data}
        bolehHarga={bolehHarga}
        pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah ${data.nama}`} />}
      />
      {terkontrak === 0 && <TombolHapus aksi={hapusSarpras} id={data.id} nama={data.nama} />}
    </div>
  );
}
