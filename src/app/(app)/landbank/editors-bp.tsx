"use client";

import { BarisField, Field, FieldTerkunci, FormModal, TombolHapus, TombolIkon, TombolTambah } from "@/components/form";
import {
  hapusBarisHpp, hapusBarisOperasional, hapusCashflow, hapusKategoriHpp,
  hapusKategoriOperasional, hapusPembanding, resetHargaDasarUnit,
  simpanBarisHpp, simpanBarisOperasional, simpanCashflow, simpanHargaDasarUnit,
  simpanKategoriHpp, simpanKategoriOperasional, simpanPembanding,
} from "./actions";
import { Petunjuk } from "@/components/ui";
import { rp } from "@/lib/format";

/**
 * Formulir business plan.
 *
 * Satu komponen melayani tambah maupun ubah: kehadiran `nilai` yang menentukan.
 * Aksinya membaca `id` — kosong berarti membuat baris baru. Ini menghemat
 * separuh kode form tanpa membuat perilakunya samar, karena judul modalnya
 * tetap membedakan keduanya.
 */

const CATATAN_RENCANA =
  "Business plan adalah rencana, bukan realisasi. Mengubahnya tidak menyentuh transaksi yang sudah tercatat — yang bergeser hanya pembandingnya di Plan vs Realisasi.";

/* ---------- HPP: kategori (induk) & baris rincian ---------- */

export function FormKategoriHpp({
  businessPlanId,
  kategori,
}: {
  businessPlanId: string;
  kategori?: { id: string; nama: string };
}) {
  return (
    <FormModal
      judul={kategori ? `Ubah Kategori ${kategori.nama}` : "Tambah Kategori HPP"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanKategoriHpp}
      labelSimpan={kategori ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        kategori ? (
          <TombolIkon onClick={buka} judul={`Ubah kategori ${kategori.nama}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Kategori" />
        )
      }
    >
      <input type="hidden" name="id" value={kategori?.id ?? ""} />
      <input type="hidden" name="businessPlanId" value={businessPlanId} />
      <BarisField kolom={1}>
        <Field label="Nama Kategori" nama="nama" nilai={kategori?.nama} wajib petunjuk="mis. Konstruksi Rumah" />
      </BarisField>
      <Petunjuk>
        Anggaran kategori dihitung otomatis dari baris rinciannya. Nama kategori dipakai untuk
        mencocokkan realisasi di Plan vs Realisasi.
      </Petunjuk>
    </FormModal>
  );
}

export function HapusKategoriHpp({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusKategoriHpp} id={id} nama={`kategori ${nama}`} />;
}

export function FormBarisHpp({
  hppItemId,
  baris,
}: {
  hppItemId: string;
  baris?: { id: string; uraian: string; satuan: string; volume: number; harga: number };
}) {
  return (
    <FormModal
      judul={baris ? `Ubah Baris ${baris.uraian}` : "Tambah Baris HPP"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanBarisHpp}
      labelSimpan={baris ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        baris ? (
          <TombolIkon onClick={buka} judul={`Ubah baris ${baris.uraian}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Baris" />
        )
      }
    >
      <input type="hidden" name="id" value={baris?.id ?? ""} />
      <input type="hidden" name="hppItemId" value={hppItemId} />
      <BarisField kolom={1}>
        <Field label="Uraian" nama="uraian" nilai={baris?.uraian} wajib petunjuk="mis. Pekerjaan struktur & pondasi" />
      </BarisField>
      <BarisField kolom={3}>
        <Field label="Satuan" nama="satuan" nilai={baris?.satuan} wajib petunjuk="mis. m², ls, unit" />
        <Field label="Volume" nama="volume" nilai={baris?.volume ?? 0} tipe="number" wajib />
        <Field label="Harga Satuan" nama="harga" nilai={baris?.harga ?? 0} tipe="number" satuan="Rp" wajib />
      </BarisField>
    </FormModal>
  );
}

export function HapusBarisHpp({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusBarisHpp} id={id} nama={`baris ${uraian}`} />;
}

/* ---------- Omset: harga dasar rencana per unit ---------- */

export function FormHargaDasarUnit({
  businessPlanId,
  unit,
}: {
  businessPlanId: string;
  unit: { unitId: string; no: string; tipe: string; hargaJual: number; hargaDasar: number; dioverride: boolean };
}) {
  return (
    <FormModal
      judul={`Harga Dasar Unit ${unit.no}`}
      keterangan={CATATAN_RENCANA}
      aksi={simpanHargaDasarUnit}
      labelSimpan="Simpan"
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah harga dasar unit ${unit.no}`} />}
    >
      <input type="hidden" name="businessPlanId" value={businessPlanId} />
      <input type="hidden" name="unitId" value={unit.unitId} />
      <BarisField>
        <FieldTerkunci label="Unit" nilai={`${unit.no} · ${unit.tipe}`} catatan="dari daftar unit" />
        <FieldTerkunci label="Harga Jual Unit" nilai={rp(unit.hargaJual)} catatan="default" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Harga Dasar Rencana (non-PPN)" nama="hargaDasar" nilai={unit.hargaDasar} tipe="number" satuan="Rp" wajib />
      </BarisField>
      <Petunjuk>
        Harga+PPN (11%) dan All-In (+10% AJB/notaris/BPHTB) dihitung otomatis dari harga dasar.
        Total omset memakai harga dasar (non-PPN).
      </Petunjuk>
    </FormModal>
  );
}

export function ResetHargaDasarUnit({ unitId, no }: { unitId: string; no: string }) {
  return <TombolHapus aksi={resetHargaDasarUnit} id={unitId} nama={`harga dasar unit ${no} (kembali ke harga jual)`} />;
}

/* ---------- Operasional: kategori (induk) & baris rincian ---------- */

export function FormKategoriOperasional({
  businessPlanId,
  kategori,
}: {
  businessPlanId: string;
  kategori?: { id: string; nama: string };
}) {
  return (
    <FormModal
      judul={kategori ? `Ubah Kategori ${kategori.nama}` : "Tambah Kategori Operasional"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanKategoriOperasional}
      labelSimpan={kategori ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        kategori ? (
          <TombolIkon onClick={buka} judul={`Ubah kategori ${kategori.nama}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Kategori" />
        )
      }
    >
      <input type="hidden" name="id" value={kategori?.id ?? ""} />
      <input type="hidden" name="businessPlanId" value={businessPlanId} />
      <BarisField kolom={1}>
        <Field label="Nama Kategori" nama="nama" nilai={kategori?.nama} wajib petunjuk="mis. Pemasaran" />
      </BarisField>
      <Petunjuk>
        Anggaran kategori dihitung otomatis dari baris rinciannya. Biaya operasional yang
        sudah dicatat dicocokkan lewat <b>nama kategori</b>; bila namanya diganti, biaya yang
        sudah ada ikut dipindahkan supaya realisasinya tidak hilang.
      </Petunjuk>
    </FormModal>
  );
}

export function HapusKategoriOperasional({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusKategoriOperasional} id={id} nama={`kategori ${nama}`} />;
}

export function FormBarisOperasional({
  operasionalItemId,
  baris,
}: {
  operasionalItemId: string;
  baris?: { id: string; nama: string; nilai: number };
}) {
  return (
    <FormModal
      judul={baris ? `Ubah Baris ${baris.nama}` : "Tambah Baris Operasional"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanBarisOperasional}
      labelSimpan={baris ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        baris ? (
          <TombolIkon onClick={buka} judul={`Ubah baris ${baris.nama}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Baris" />
        )
      }
    >
      <input type="hidden" name="id" value={baris?.id ?? ""} />
      <input type="hidden" name="operasionalItemId" value={operasionalItemId} />
      <BarisField kolom={1}>
        <Field label="Uraian" nama="nama" nilai={baris?.nama} wajib petunjuk="mis. Gaji, Bonus, THR" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Anggaran" nama="nilai" nilai={baris?.nilai ?? 0} tipe="number" satuan="Rp" wajib />
      </BarisField>
    </FormModal>
  );
}

export function HapusBarisOperasional({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusBarisOperasional} id={id} nama={`baris ${nama}`} />;
}

/* ---------- Cashflow ---------- */

export function FormCashflow({
  businessPlanId,
  baris,
}: {
  businessPlanId: string;
  baris?: { id: string; periode: string; masuk: number; keluar: number };
}) {
  return (
    <FormModal
      judul={baris ? `Ubah Cashflow ${baris.periode}` : "Tambah Periode Cashflow"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanCashflow}
      labelSimpan={baris ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        baris ? (
          <TombolIkon onClick={buka} judul={`Ubah cashflow ${baris.periode}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Periode" />
        )
      }
    >
      <input type="hidden" name="id" value={baris?.id ?? ""} />
      <input type="hidden" name="businessPlanId" value={businessPlanId} />
      <BarisField kolom={1}>
        <Field label="Bulan" nama="periode" nilai={baris?.periode} tipe="bulan" wajib petunjuk="Cashflow direncanakan per bulan" />
      </BarisField>
      <BarisField>
        <Field label="Kas Masuk" nama="masuk" nilai={baris?.masuk ?? 0} tipe="number" satuan="Rp" />
        <Field label="Kas Keluar" nama="keluar" nilai={baris?.keluar ?? 0} tipe="number" satuan="Rp" />
      </BarisField>
    </FormModal>
  );
}

export function HapusCashflow({ id, periode }: { id: string; periode: string }) {
  return <TombolHapus aksi={hapusCashflow} id={id} nama={`periode ${periode}`} />;
}

/* ---------- Pembanding pasar ---------- */

export function FormPembanding({
  kodeProyek,
  data,
}: {
  kodeProyek: string;
  data?: {
    id: string; nama: string; jarak: number; tipe: string;
    jumlah: number; luasUnit: number; luasLahan: number; harga: number;
  };
}) {
  return (
    <FormModal
      judul={data ? `Ubah ${data.nama} · ${data.tipe}` : "Tambah Pembanding Pasar"}
      keterangan="Proyek pembanding dibuat otomatis bila namanya belum ada."
      aksi={simpanPembanding}
      labelSimpan={data ? "Simpan" : "Tambah"}
      lebar={600}
      pemicu={(buka) =>
        data ? (
          <TombolIkon onClick={buka} judul={`Ubah pembanding ${data.nama} ${data.tipe}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Pembanding" />
        )
      }
    >
      <input type="hidden" name="id" value={data?.id ?? ""} />
      <input type="hidden" name="kodeProyek" value={kodeProyek} />

      <BarisField>
        <Field label="Nama Proyek Pembanding" nama="nama" nilai={data?.nama} wajib />
        <Field label="Jarak" nama="jarak" nilai={data?.jarak ?? 0} tipe="number" satuan="km" />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Tipe" nama="tipe" nilai={data?.tipe} wajib petunjuk="mis. Tipe 45/90" />
      </BarisField>

      <BarisField>
        <Field label="Jumlah Unit" nama="jumlah" nilai={data?.jumlah ?? 0} tipe="number" wajib />
        <Field label="Harga" nama="harga" nilai={data?.harga ?? 0} tipe="number" satuan="Rp" wajib />
      </BarisField>

      <BarisField>
        <Field label="Luas Bangunan" nama="luasUnit" nilai={data?.luasUnit ?? 0} tipe="number" satuan="m²" wajib />
        <Field label="Luas Lahan" nama="luasLahan" nilai={data?.luasLahan ?? 0} tipe="number" satuan="m²" wajib />
      </BarisField>
    </FormModal>
  );
}

export function HapusPembanding({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusPembanding} id={id} nama={nama} />;
}
