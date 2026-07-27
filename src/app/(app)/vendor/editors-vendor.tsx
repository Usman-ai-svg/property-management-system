"use client";

import { useState } from "react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import {
  DOKUMEN_TENDER, JENIS_KONTRAK, STATUS_TENDER, STATUS_VENDOR,
} from "@/lib/domain/enums";
import {
  hapusKontrak, hapusTender, hapusVendor, tambahKontrak, tambahPesertaTender,
  tambahTender, tambahVendor, ubahKontrak, ubahStatusTender, ubahVendor,
} from "./actions";

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
  nominal: number;
  retensiPct: number;
  jatuhTempoBln: number;
  mulai: string;
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

      <BarisField>
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
        <Field label="Kode Kontrak" nama="kode" wajib petunjuk="mis. K6, S7" />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Deskripsi Pekerjaan" nama="deskripsi" wajib />
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
      <BarisField>
        <Field label="Nilai Kontrak" nama="nominal" nilai={kontrak.nominal} tipe="number" satuan="Rp" wajib />
        <Field label="Mulai" nama="mulai" nilai={kontrak.mulai} tipe="tanggal" />
      </BarisField>
      <BarisField>
        <Field label="Retensi" nama="retensiPct" nilai={kontrak.retensiPct} tipe="number" satuan="%" />
        <Field label="Masa Pemeliharaan" nama="jatuhTempoBln" nilai={kontrak.jatuhTempoBln} tipe="number" satuan="bulan" />
      </BarisField>
      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        Menaikkan nilai kontrak di sini berbeda dari Variation Order: VO menyimpan
        riwayat pekerjaan tambah/kurang, sedangkan ini mengoreksi nilai awalnya.
      </p>
    </FormModal>
  );
}

export function HapusKontrak({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusKontrak} id={id} nama={`kontrak ${kode}`} />;
}

/* ===================== TENDER ===================== */

export function TambahTender({ proyek }: { proyek: { kode: string; nama: string }[] }) {
  if (proyek.length === 0) return null;
  return (
    <FormModal
      judul="Buat Tender"
      keterangan="Peserta ditambahkan setelah tendernya dibuat."
      aksi={tambahTender}
      labelSimpan="Buat Tender"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Buat Tender" />}
    >
      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Proyek <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select name="kodeProyek" className="inp" defaultValue={proyek[0].kode} required>
            {proyek.map((p) => (
              <option key={p.kode} value={p.kode}>{p.nama}</option>
            ))}
          </select>
        </div>
        <Field label="Kode Tender" nama="kode" wajib petunjuk="mis. TDR-05" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Pekerjaan" nama="pekerjaan" wajib />
      </BarisField>
      <BarisField>
        <Field label="HPS" nama="hps" tipe="number" satuan="Rp" wajib petunjuk="Harga Perkiraan Sendiri" />
        <Field label="Tanggal" nama="tanggal" tipe="tanggal" />
      </BarisField>
    </FormModal>
  );
}

export function TambahPeserta({
  tenderId,
  kodeTender,
  vendor,
}: {
  tenderId: string;
  kodeTender: string;
  vendor: Pilihan;
}) {
  return (
    <FormModal
      judul={`Tambah Peserta · ${kodeTender}`}
      aksi={tambahPesertaTender}
      labelSimpan="Tambah Peserta"
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>+ Peserta</button>
      )}
    >
      <input type="hidden" name="tenderId" value={tenderId} />
      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Vendor <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select name="vendorId" className="inp" required defaultValue="">
            <option value="" disabled>— pilih vendor —</option>
            {vendor.map((v) => (
              <option key={v.id} value={v.id}>{v.nama}</option>
            ))}
          </select>
        </div>
      </BarisField>
      <BarisField>
        <Field label="Nilai Penawaran" nama="nilai" tipe="number" satuan="Rp" wajib />
        <Field label="Dokumen" nama="dokumen" nilai={DOKUMEN_TENDER[0]} pilihan={DOKUMEN_TENDER} />
      </BarisField>
    </FormModal>
  );
}

export function UbahStatusTender({
  tender,
}: {
  tender: {
    id: string;
    kode: string;
    status: string;
    pemenangVendorId: string | null;
    peserta: { vendorId: string; nama: string; nilai: number }[];
  };
}) {
  const [status, setStatus] = useState(tender.status);

  return (
    <FormModal
      judul={`Status Tender ${tender.kode}`}
      aksi={ubahStatusTender}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah status tender ${tender.kode}`} />}
    >
      <input type="hidden" name="id" value={tender.id} />
      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Status
          </label>
          <select
            name="status"
            className="inp"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_TENDER.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </BarisField>

      {status === "Ditetapkan" && (
        <BarisField kolom={1}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Pemenang <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <select
              name="pemenangVendorId"
              className="inp"
              defaultValue={tender.pemenangVendorId ?? ""}
              required
            >
              <option value="" disabled>— pilih pemenang —</option>
              {tender.peserta.map((p) => (
                <option key={p.vendorId} value={p.vendorId}>
                  {p.nama} — Rp {p.nilai.toLocaleString("id-ID")}
                </option>
              ))}
            </select>
            {tender.peserta.length === 0 && (
              <div style={{ fontSize: 11.5, color: "var(--amber)", marginTop: 5, lineHeight: 1.5 }}>
                Tender ini belum punya peserta. Tambahkan peserta lebih dulu sebelum
                menetapkan pemenangnya.
              </div>
            )}
          </div>
        </BarisField>
      )}

      <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
        Status Ditetapkan mengunci tender: pesertanya tidak bisa ditambah lagi.
      </p>
    </FormModal>
  );
}

export function HapusTender({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusTender} id={id} nama={`tender ${kode}`} />;
}
