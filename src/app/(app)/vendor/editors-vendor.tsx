"use client";

import { useState } from "react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import { JENIS_BIAYA_KONTRAK, JENIS_KONTRAK, STATUS_VENDOR } from "@/lib/domain/enums";
import {
  hapusKontrak, hapusVendor, tambahKontrak, tambahVendor, ubahKontrak, ubahVendor,
} from "./actions";
import { Petunjuk } from "@/components/ui";

type Pilihan = { id: string; nama: string }[];

/* ===================== VENDOR ===================== */

export interface VendorForm {
  id: string;
  nama: string;
  bidang: string;
  kontak: string;
  alamat: string;
  sejak: number;
  status: string;
}

function IsianVendor({ nilai }: { nilai?: VendorForm }) {
  const tahunIni = new Date().getFullYear();
  return (
    <>
      <BarisField>
        <Field label="Nama Vendor" nama="nama" nilai={nilai?.nama} wajib />
        <Field label="Bidang" nama="bidang" nilai={nilai?.bidang} wajib petunjuk="mis. Struktur & Finishing" />
      </BarisField>
      <BarisField>
        <Field label="Kontak" nama="kontak" nilai={nilai?.kontak} wajib petunjuk="nama PIC atau nomor telepon" />
        <Field label="Vendor Sejak" nama="sejak" nilai={nilai?.sejak ?? tahunIni} tipe="number" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Alamat" nama="alamat" nilai={nilai?.alamat} tipe="textarea" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Status" nama="status" nilai={nilai?.status ?? STATUS_VENDOR[0]} pilihan={STATUS_VENDOR} />
      </BarisField>
    </>
  );
}

export function TambahVendor() {
  return (
    <FormModal
      judul="Tambah Vendor"
      aksi={tambahVendor}
      labelSimpan="Tambah"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Vendor" />}
    >
      <IsianVendor />
    </FormModal>
  );
}

export function UbahVendor({ vendor }: { vendor: VendorForm }) {
  return (
    <FormModal
      judul={`Ubah ${vendor.nama}`}
      aksi={ubahVendor}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah vendor ${vendor.nama}`} />}
    >
      <input type="hidden" name="id" value={vendor.id} />
      <IsianVendor nilai={vendor} />
    </FormModal>
  );
}

export function HapusVendor({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusVendor} id={id} nama={`vendor ${nama}`} />;
}

/* ===================== KONTRAK ===================== */

export interface KontrakForm {
  id: string;
  kode: string;
  deskripsi: string;
  jenisBiaya: string;
  nominal: number;
  retensiPct: number;
  jatuhTempoBln: number;
  mulai: string;
  /** ISO yyyy-mm-dd, atau string kosong bila belum ditandai selesai. */
  tanggalSelesai: string;
  /** true bila SPK sudah punya baris BOQ — nilai kontrak lalu mengikuti BOQ. */
  adaBoq: boolean;
}

/**
 * Pembuatan kontrak.
 *
 * Cakupan unit atau sarpras dipilih di sini karena itulah yang menentukan ke
 * mana pembayarannya dialokasikan pada laporan realisasi. Daftar cakupannya
 * berganti mengikuti proyek dan jenis kontrak yang dipilih.
 */
export function TambahKontrak({
  vendorId,
  namaVendor,
  proyek,
}: {
  vendorId: string;
  namaVendor: string;
  proyek: { kode: string; nama: string; units: Pilihan; sarpras: Pilihan }[];
}) {
  const [kodeProyek, setKodeProyek] = useState(proyek[0]?.kode ?? "");
  const [jenis, setJenis] = useState<string>(JENIS_KONTRAK[0]);
  const [cakupan, setCakupan] = useState<string[]>([]);

  const aktif = proyek.find((p) => p.kode === kodeProyek);
  const daftar = jenis === "Unit" ? (aktif?.units ?? []) : (aktif?.sarpras ?? []);

  const toggle = (id: string) =>
    setCakupan((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  if (proyek.length === 0) return null;

  return (
    <FormModal
      judul="Buat Kontrak"
      keterangan={`Vendor: ${namaVendor}`}
      aksi={tambahKontrak}
      labelSimpan="Buat Kontrak"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Buat Kontrak" />}
    >
      <input type="hidden" name="vendorId" value={vendorId} />
      {cakupan.map((id) => (
        <input key={id} type="hidden" name="cakupanId" value={id} />
      ))}

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Proyek <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select
            name="kodeProyek"
            className="inp"
            value={kodeProyek}
            onChange={(e) => { setKodeProyek(e.target.value); setCakupan([]); }}
            required
          >
            {proyek.map((p) => (
              <option key={p.kode} value={p.kode}>{p.nama}</option>
            ))}
          </select>
        </div>
      </BarisField>
      <Petunjuk>
        Kode SPK dibuat otomatis sesuai standar penomoran{" "}
        <b>{`{PROYEK}/{K|S}/{TAHUN}/{urut}`}</b> — mis. {kodeProyek || "NT4"}/
        {jenis === "Unit" ? "K" : "S"}/{new Date().getFullYear()}/001.
      </Petunjuk>

      <BarisField kolom={1}>
        <Field label="Deskripsi Pekerjaan" nama="deskripsi" wajib />
      </BarisField>

      <BarisField kolom={1}>
        <Field
          label="Jenis Biaya"
          nama="jenisBiaya"
          nilai="Upah Borongan"
          pilihan={JENIS_BIAYA_KONTRAK}
          petunjuk="Diwariskan ke tiap pembayaran kontrak ini. Pilih Kontraktor untuk paket menyeluruh (material+upah+subkon)."
        />
      </BarisField>

      <BarisField kolom={1}>
        <Field
          label="Dokumen SPK"
          nama="spk"
          tipe="berkas"
          wajib
          petunjuk="Surat Perintah Kerja yang mendasari kontrak ini. Tersimpan sebagai revisi R1 dan bisa diperbarui dari halaman SPK."
        />
      </BarisField>

      <BarisField>
        <Field label="Nilai Kontrak" nama="nominal" tipe="number" satuan="Rp" wajib />
        <Field label="Mulai" nama="mulai" tipe="tanggal" />
      </BarisField>
      <Petunjuk>
        Nilai kontrak ini bersifat sementara: begitu BOQ terinci SPK diisi, Nilai
        SPK mengikuti BOQ (nilai per objek × jumlah objek) secara otomatis.
      </Petunjuk>

      <BarisField>
        <Field label="Retensi" nama="retensiPct" nilai={5} tipe="number" satuan="%" />
        <Field label="Masa Pemeliharaan" nama="jatuhTempoBln" nilai={3} tipe="number" satuan="bulan" />
      </BarisField>

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Jenis &amp; cakupan
          </label>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {JENIS_KONTRAK.map((j) => (
              <button
                key={j}
                type="button"
                className={jenis === j ? "pill active" : "pill"}
                onClick={() => { setJenis(j); setCakupan([]); }}
              >
                {j}
              </button>
            ))}
          </div>
          <input type="hidden" name="jenis" value={jenis} />

          <div
            style={{
              maxHeight: 170, overflowY: "auto", border: "1px solid var(--line)",
              borderRadius: 9, padding: "8px 10px",
            }}
          >
            {daftar.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Proyek ini belum punya {jenis === "Unit" ? "unit" : "item sarpras"}.
              </div>
            ) : (
              daftar.map((x) => (
                <label
                  key={x.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12, padding: "3px 0", cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={cakupan.includes(x.id)} onChange={() => toggle(x.id)} />
                  {x.nama}
                </label>
              ))
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, lineHeight: 1.55 }}>
            {cakupan.length} dipilih. Nilai kontrak dibagi rata ke seluruh cakupan saat
            dialokasikan ke laporan realisasi. Kontrak tanpa cakupan tetap sah — nilainya
            lalu tidak dialokasikan ke unit mana pun.
          </div>
        </div>
      </BarisField>
    </FormModal>
  );
}

export function UbahKontrak({ kontrak }: { kontrak: KontrakForm }) {
  return (
    <FormModal
      judul={`Ubah Kontrak ${kontrak.kode}`}
      keterangan="Cakupan unit/sarpras tidak disunting di sini — mengubahnya menggeser alokasi biaya yang sudah tercatat."
      aksi={ubahKontrak}
      lebar={600}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah kontrak ${kontrak.kode}`} />}
    >
      <input type="hidden" name="id" value={kontrak.id} />
      <BarisField kolom={1}>
        <Field label="Deskripsi Pekerjaan" nama="deskripsi" nilai={kontrak.deskripsi} wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Jenis Biaya" nama="jenisBiaya" nilai={kontrak.jenisBiaya} pilihan={JENIS_BIAYA_KONTRAK} />
      </BarisField>
      <BarisField>
        <Field label="Nilai Kontrak" nama="nominal" nilai={kontrak.nominal} tipe="number" satuan="Rp" wajib />
        <Field label="Mulai" nama="mulai" nilai={kontrak.mulai} tipe="tanggal" />
      </BarisField>
      <BarisField>
        <Field label="Retensi" nama="retensiPct" nilai={kontrak.retensiPct} tipe="number" satuan="%" />
        <Field label="Masa Pemeliharaan" nama="jatuhTempoBln" nilai={kontrak.jatuhTempoBln} tipe="number" satuan="bulan" />
      </BarisField>
      <BarisField kolom={1}>
        <Field
          label="Tanggal Selesai"
          nama="tanggalSelesai"
          nilai={kontrak.tanggalSelesai}
          tipe="tanggal"
          petunjuk="Diisi saat pekerjaan dinyatakan selesai. Retensi jatuh tempo dihitung sejak tanggal ini + masa pemeliharaan."
        />
      </BarisField>
      {kontrak.adaBoq && (
        <Petunjuk>
          Nilai kontrak SPK ini mengikuti BOQ terinci (nilai per objek × jumlah
          objek) dan disetel ulang otomatis tiap kali BOQ berubah — koreksi manual
          di sini hanya bertahan sampai baris BOQ berikutnya disunting.
        </Petunjuk>
      )}
      <Petunjuk>
        Menaikkan nilai kontrak di sini berbeda dari Variation Order: VO menyimpan
        riwayat pekerjaan tambah/kurang, sedangkan ini mengoreksi nilai awalnya.
      </Petunjuk>
    </FormModal>
  );
}

export function HapusKontrak({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusKontrak} id={id} nama={`kontrak ${kode}`} />;
}
