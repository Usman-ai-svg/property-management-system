"use client";

import { BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah } from "@/components/form";
import {
  hapusCashflow, hapusPembanding, hapusPosHpp, hapusPosOmzet, hapusPosOperasional,
  simpanCashflow, simpanPembanding, simpanPosHpp, simpanPosOmzet, simpanPosOperasional,
} from "./actions";
import { Petunjuk } from "@/components/ui";

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

/* ---------- Pos HPP ---------- */

export function FormPosHpp({
  businessPlanId,
  pos,
}: {
  businessPlanId: string;
  pos?: { id: string; nama: string; nilai: number };
}) {
  return (
    <FormModal
      judul={pos ? `Ubah Pos ${pos.nama}` : "Tambah Pos HPP"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanPosHpp}
      labelSimpan={pos ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        pos ? (
          <TombolIkon onClick={buka} judul={`Ubah pos ${pos.nama}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Pos" />
        )
      }
    >
      <input type="hidden" name="id" value={pos?.id ?? ""} />
      <input type="hidden" name="businessPlanId" value={businessPlanId} />
      <BarisField kolom={1}>
        <Field label="Nama Komponen" nama="nama" nilai={pos?.nama} wajib petunjuk="mis. E — Konstruksi" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Anggaran" nama="nilai" nilai={pos?.nilai ?? 0} tipe="number" satuan="Rp" wajib />
      </BarisField>
    </FormModal>
  );
}

export function HapusPosHpp({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusPosHpp} id={id} nama={`pos ${nama}`} />;
}

/* ---------- Pos Omzet ---------- */

export function FormPosOmzet({
  businessPlanId,
  pos,
}: {
  businessPlanId: string;
  pos?: { id: string; tipe: string; jumlah: number; harga: number };
}) {
  return (
    <FormModal
      judul={pos ? `Ubah Omzet ${pos.tipe}` : "Tambah Pos Omzet"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanPosOmzet}
      labelSimpan={pos ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        pos ? (
          <TombolIkon onClick={buka} judul={`Ubah omzet ${pos.tipe}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Pos" />
        )
      }
    >
      <input type="hidden" name="id" value={pos?.id ?? ""} />
      <input type="hidden" name="businessPlanId" value={businessPlanId} />
      <BarisField kolom={1}>
        <Field label="Tipe Unit" nama="tipe" nilai={pos?.tipe} wajib />
      </BarisField>
      <BarisField>
        <Field label="Jumlah Unit" nama="jumlah" nilai={pos?.jumlah ?? 0} tipe="number" wajib />
        <Field label="Harga Satuan" nama="harga" nilai={pos?.harga ?? 0} tipe="number" satuan="Rp" wajib />
      </BarisField>
    </FormModal>
  );
}

export function HapusPosOmzet({ id, tipe }: { id: string; tipe: string }) {
  return <TombolHapus aksi={hapusPosOmzet} id={id} nama={`omzet ${tipe}`} />;
}

/* ---------- Pos Operasional ---------- */

export function FormPosOperasional({
  businessPlanId,
  pos,
}: {
  businessPlanId: string;
  pos?: { id: string; nama: string; nilai: number };
}) {
  return (
    <FormModal
      judul={pos ? `Ubah Pos ${pos.nama}` : "Tambah Pos Operasional"}
      keterangan={CATATAN_RENCANA}
      aksi={simpanPosOperasional}
      labelSimpan={pos ? "Simpan" : "Tambah"}
      pemicu={(buka) =>
        pos ? (
          <TombolIkon onClick={buka} judul={`Ubah pos ${pos.nama}`} />
        ) : (
          <TombolTambah onClick={buka} label="Tambah Pos" />
        )
      }
    >
      <input type="hidden" name="id" value={pos?.id ?? ""} />
      <input type="hidden" name="businessPlanId" value={businessPlanId} />
      <BarisField kolom={1}>
        <Field label="Nama Pos" nama="nama" nilai={pos?.nama} wajib petunjuk="mis. Pemasaran" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Anggaran" nama="nilai" nilai={pos?.nilai ?? 0} tipe="number" satuan="Rp" wajib />
      </BarisField>
      {pos && (
        <Petunjuk>
          Biaya operasional yang sudah dicatat dicocokkan lewat <b>nama pos</b>. Bila namanya
          diganti, biaya yang sudah ada ikut dipindahkan supaya realisasinya tidak hilang.
        </Petunjuk>
      )}
    </FormModal>
  );
}

export function HapusPosOperasional({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusPosOperasional} id={id} nama={`pos ${nama}`} />;
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
        <Field label="Periode" nama="periode" nilai={baris?.periode} wajib petunjuk="mis. 2026 Q3" />
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
