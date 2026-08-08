"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import { Petunjuk } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { HasilAksi } from "@/lib/actions/guard";
import {
  KATEGORI_HARGA_DASAR, KATEGORI_PEMASOK, STATUS_PEMASOK,
} from "@/lib/domain/enums";
import { rekapAnalisa, type KelompokDasar } from "@/lib/calc/ahsp";
import { KELOMPOK_AHSP } from "@/lib/domain/templates";
import { rp } from "@/lib/format";
import {
  hapusAnalisa, hapusBarisRab, hapusHargaDasar, hapusPemasok, hapusPenawaran,
  hapusRabEstimasi, imporBarisRab, jadikanAcuan, segarkanHargaBaris,
  simpanAnalisa, tambahBarisRab, tambahHargaDasar, tambahPemasok, tambahPenawaran,
  tambahRabEstimasi, ubahBarisRab, ubahHargaDasar, ubahPemasok, ubahRabEstimasi,
} from "./actions";

type Opsi = { id: string; nama: string }[];

/**
 * Tombol untuk aksi ber-satu-id yang bukan penghapusan (mis. "jadikan acuan",
 * "segarkan harga"). Menampilkan hasilnya sebagai toast, galatnya sebagai
 * tooltip singkat. Untuk penghapusan pakai `TombolHapus` yang sudah ada.
 */
function TombolAksiId({
  aksi, id, judul, children,
}: {
  aksi: (s: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  id: string;
  judul: string;
  children: React.ReactNode;
}) {
  const [hasil, kirim] = useActionState(aksi, null);
  const { tampil } = useToast();

  useEffect(() => {
    if (hasil?.ok) tampil(hasil.pesan ?? "Tersimpan.");
  }, [hasil, tampil]);

  return (
    <form action={kirim} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="btn-garis"
        title={hasil && !hasil.ok ? hasil.error : judul}
        style={{ fontSize: 11, padding: "3px 8px", color: hasil && !hasil.ok ? "var(--red)" : undefined }}
      >
        {children}
      </button>
    </form>
  );
}

// ===========================================================================
// PEMASOK
// ===========================================================================

export interface PemasokForm {
  id: string;
  nama: string;
  kategori: string;
  kontak: string;
  alamat: string;
  status: string;
}

function IsianPemasok({ nilai }: { nilai?: PemasokForm }) {
  return (
    <>
      <BarisField>
        <Field label="Nama" nama="nama" nilai={nilai?.nama} wajib />
        <Field label="Kategori" nama="kategori" nilai={nilai?.kategori ?? KATEGORI_PEMASOK[0]} pilihan={KATEGORI_PEMASOK} />
      </BarisField>
      <BarisField>
        <Field label="Kontak" nama="kontak" nilai={nilai?.kontak ?? ""} petunjuk="Telepon / narahubung" />
        <Field label="Status" nama="status" nilai={nilai?.status ?? STATUS_PEMASOK[0]} pilihan={STATUS_PEMASOK} />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Alamat" nama="alamat" nilai={nilai?.alamat ?? ""} />
      </BarisField>
    </>
  );
}

export function TambahPemasok() {
  return (
    <FormModal
      judul="Tambah Pemasok"
      keterangan="Pemasok material, tenaga kerja, atau alat — sumber harga dasar AHSP."
      aksi={tambahPemasok}
      labelSimpan="Tambah"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Pemasok" />}
    >
      <IsianPemasok />
    </FormModal>
  );
}

export function UbahPemasok({ pemasok }: { pemasok: PemasokForm }) {
  return (
    <FormModal
      judul={`Ubah ${pemasok.nama}`}
      aksi={ubahPemasok}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah pemasok ${pemasok.nama}`} />}
    >
      <input type="hidden" name="id" value={pemasok.id} />
      <IsianPemasok nilai={pemasok} />
    </FormModal>
  );
}

export function HapusPemasok({ id, nama }: { id: string; nama: string }) {
  return <TombolHapus aksi={hapusPemasok} id={id} nama={`pemasok ${nama}`} />;
}

// ===========================================================================
// HARGA DASAR + PENAWARAN
// ===========================================================================

export interface HargaDasarForm {
  id: string;
  kode: string;
  kategori: string;
  uraian: string;
  satuan: string;
  hargaAcuan: number;
}

function IsianHargaDasar({ nilai }: { nilai?: HargaDasarForm }) {
  return (
    <>
      <BarisField>
        <Field label="Kode" nama="kode" nilai={nilai?.kode} wajib petunjuk="mis. M.01, L.02, E.01" />
        <Field label="Kategori" nama="kategori" nilai={nilai?.kategori ?? KATEGORI_HARGA_DASAR[0]} pilihan={KATEGORI_HARGA_DASAR} />
      </BarisField>
      <BarisField>
        <Field label="Uraian" nama="uraian" nilai={nilai?.uraian} wajib />
        <Field label="Satuan" nama="satuan" nilai={nilai?.satuan} wajib petunjuk="mis. kg, m3, OH" />
      </BarisField>
      <BarisField kolom={1}>
        <Field
          label="Harga Acuan"
          nama="hargaAcuan"
          nilai={nilai?.hargaAcuan ?? 0}
          tipe="number"
          satuan="Rp"
          petunjuk="Harga yang dipakai perhitungan AHSP. Untuk bahan/alat biasanya diambil dari salah satu penawaran; untuk upah diisi manual."
        />
      </BarisField>
    </>
  );
}

export function TambahHargaDasar() {
  return (
    <FormModal
      judul="Tambah Harga Dasar"
      keterangan="Upah, bahan, atau alat — masukan perhitungan AHSP."
      aksi={tambahHargaDasar}
      labelSimpan="Tambah"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Harga Dasar" />}
    >
      <IsianHargaDasar />
    </FormModal>
  );
}

export function UbahHargaDasar({ hargaDasar }: { hargaDasar: HargaDasarForm }) {
  return (
    <FormModal
      judul={`Ubah ${hargaDasar.kode}`}
      keterangan={hargaDasar.uraian}
      aksi={ubahHargaDasar}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah harga dasar ${hargaDasar.kode}`} />}
    >
      <input type="hidden" name="id" value={hargaDasar.id} />
      <IsianHargaDasar nilai={hargaDasar} />
      <Petunjuk>
        Mengubah harga acuan menggeser harga satuan analisa yang memakainya, tapi <b>tidak</b>{" "}
        menggeser baris RAB yang sudah tersnapshot. Gunakan &quot;Segarkan harga&quot; pada baris RAB
        bila ingin baris itu ikut memakai harga baru.
      </Petunjuk>
    </FormModal>
  );
}

export function HapusHargaDasar({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusHargaDasar} id={id} nama={`harga dasar ${kode}`} />;
}

/**
 * Tambah penawaran untuk SATU harga dasar tertentu (dipakai di baris Harga Dasar
 * yang di-expand). Harga dasarnya sudah terkunci, jadi tinggal pilih pemasok.
 */
export function TambahPenawaranPada({
  hargaDasarId, hargaDasarLabel, pemasok,
}: {
  hargaDasarId: string;
  hargaDasarLabel: string;
  pemasok: Opsi;
}) {
  return (
    <FormModal
      judul="Tambah Penawaran"
      keterangan={`Penawaran pemasok atas ${hargaDasarLabel}.`}
      aksi={tambahPenawaran}
      labelSimpan="Tambah"
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka} style={{ fontSize: 11, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Plus size={12} /> Penawaran
        </button>
      )}
    >
      <input type="hidden" name="hargaDasarId" value={hargaDasarId} />
      <BarisField>
        <Field label="Pemasok" nama="pemasokId" pilihan={pemasok.map((p) => ({ nilai: p.id, label: p.nama }))} wajib />
        <Field label="Harga Penawaran" nama="harga" tipe="number" satuan="Rp" wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Keterangan" nama="keterangan" petunjuk="mis. franco lokasi, min. order" />
      </BarisField>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: 4 }}>
        <input type="checkbox" name="jadikanAcuan" />
        Jadikan harga acuan (dipakai perhitungan AHSP)
      </label>
    </FormModal>
  );
}

export function JadikanAcuan({ id }: { id: string }) {
  return (
    <TombolAksiId aksi={jadikanAcuan} id={id} judul="Jadikan penawaran ini sebagai harga acuan">
      Jadikan acuan
    </TombolAksiId>
  );
}

export function HapusPenawaran({ id }: { id: string }) {
  return <TombolHapus aksi={hapusPenawaran} id={id} nama="penawaran ini" />;
}

// ===========================================================================
// ANALISA + KOMPONEN
// ===========================================================================

export interface HargaDasarOpsi {
  id: string;
  kode: string;
  kategori: string;
  uraian: string;
  satuan: string;
  hargaAcuan: number;
}

export interface AnalisaForm {
  id: string;
  kode: string;
  uraian: string;
  satuan: string;
  kelompok: string;
  overheadPct: number;
  komponen: { hargaDasarId: string; koefisien: number }[];
}

/**
 * Isian komponen analisa dengan pratinjau harga satuan LANGSUNG.
 *
 * Baris komponen dikelola di state, lalu diserialkan ke satu kolom tersembunyi
 * "komponen" (JSON) — pola yang sama dipakai `ubahLegalitas` di Master. Harga
 * satuannya dihitung memakai `rekapAnalisa` dari lapisan calc yang sama persis
 * dengan server, jadi angka pratinjau = angka yang nanti tersimpan.
 */
function IsianKomponen({
  daftar, awal, overheadAwal,
}: {
  daftar: HargaDasarOpsi[];
  awal?: { hargaDasarId: string; koefisien: number }[];
  overheadAwal: number;
}) {
  const [baris, setBaris] = useState<{ hargaDasarId: string; koefisien: string }[]>(
    awal && awal.length > 0
      ? awal.map((k) => ({ hargaDasarId: k.hargaDasarId, koefisien: String(k.koefisien) }))
      : [{ hargaDasarId: daftar[0]?.id ?? "", koefisien: "" }],
  );
  const [overheadPct, setOverheadPct] = useState(String(overheadAwal));

  const petaHd = new Map(daftar.map((h) => [h.id, h]));

  const komponenValid = baris
    .filter((b) => b.hargaDasarId && Number(b.koefisien) > 0)
    .map((b) => {
      const hd = petaHd.get(b.hargaDasarId)!;
      return {
        kelompok: hd.kategori as KelompokDasar,
        koefisien: Number(b.koefisien),
        hargaAcuan: hd.hargaAcuan,
      };
    });

  const rekap = rekapAnalisa({ overheadPct: Number(overheadPct) || 0, komponen: komponenValid });

  const ubah = (i: number, patch: Partial<{ hargaDasarId: string; koefisien: string }>) =>
    setBaris((b) => b.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div>
      {/* JSON yang dikirim ke server. */}
      <input
        type="hidden"
        name="komponen"
        value={JSON.stringify(
          baris.map((b) => ({ hargaDasarId: b.hargaDasarId, koefisien: Number(b.koefisien) })),
        )}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Komponen Analisa</label>
        <button
          type="button"
          className="btn-garis"
          style={{ fontSize: 11, padding: "3px 8px" }}
          onClick={() => setBaris((b) => [...b, { hargaDasarId: daftar[0]?.id ?? "", koefisien: "" }])}
        >
          <Plus size={12} style={{ verticalAlign: "-2px" }} /> Baris
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {baris.map((b, i) => {
          const hd = petaHd.get(b.hargaDasarId);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 88px 28px", gap: 6, alignItems: "center" }}>
              <select
                className="inp"
                value={b.hargaDasarId}
                onChange={(e) => ubah(i, { hargaDasarId: e.target.value })}
              >
                {daftar.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.kode} · {h.uraian} ({h.kategori})
                  </option>
                ))}
              </select>
              <input
                className="inp"
                inputMode="decimal"
                placeholder="koef"
                value={b.koefisien}
                onChange={(e) => ubah(i, { koefisien: e.target.value })}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
                {hd ? `/${hd.satuan}` : ""}
                <div>{hd && Number(b.koefisien) > 0 ? rp(Number(b.koefisien) * hd.hargaAcuan) : "—"}</div>
              </div>
              <button
                type="button"
                onClick={() => setBaris((x) => x.filter((_, k) => k !== i))}
                title="Hapus baris"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 2 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center", marginTop: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Overhead (%)</label>
          <input
            className="inp"
            name="overheadPct"
            inputMode="decimal"
            value={overheadPct}
            onChange={(e) => setOverheadPct(e.target.value)}
          />
        </div>
        <div
          style={{
            marginTop: 20, padding: "10px 12px", borderRadius: 9,
            background: "var(--rona-biru)", color: "var(--blue)", fontSize: 12.5,
          }}
        >
          <div style={{ color: "var(--muted)", fontSize: 11 }}>
            Upah {rp(rekap.upah)} · Bahan {rp(rekap.bahan)} · Alat {rp(rekap.alat)} · Overhead {rp(rekap.overhead)}
          </div>
          <div style={{ fontWeight: 700, marginTop: 2 }}>Harga satuan = {rp(rekap.hargaSatuan)}</div>
        </div>
      </div>
    </div>
  );
}

function IsianAnalisa({ nilai, daftar }: { nilai?: AnalisaForm; daftar: HargaDasarOpsi[] }) {
  return (
    <>
      <BarisField>
        <Field label="Kode" nama="kode" nilai={nilai?.kode} wajib petunjuk="mis. A.05" />
        <Field
          label="Kelompok"
          nama="kelompok"
          nilai={nilai?.kelompok ?? KELOMPOK_AHSP[0]}
          pilihan={KELOMPOK_AHSP}
          petunjuk="Grup RAB mengikuti struktur AHSP standar."
        />
      </BarisField>
      <BarisField>
        <Field label="Uraian Pekerjaan" nama="uraian" nilai={nilai?.uraian} wajib />
        <Field label="Satuan" nama="satuan" nilai={nilai?.satuan} wajib petunjuk="mis. m2, m3, m'" />
      </BarisField>
      <IsianKomponen daftar={daftar} awal={nilai?.komponen} overheadAwal={nilai?.overheadPct ?? 13} />
    </>
  );
}

export function TambahAnalisa({ daftarHargaDasar }: { daftarHargaDasar: HargaDasarOpsi[] }) {
  return (
    <FormModal
      judul="Tambah Analisa Harga Satuan"
      keterangan="Uraikan sebuah pekerjaan menjadi komponen upah, bahan, dan alat."
      aksi={simpanAnalisa}
      labelSimpan="Simpan"
      lebar={680}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Analisa" />}
    >
      <IsianAnalisa daftar={daftarHargaDasar} />
    </FormModal>
  );
}

export function UbahAnalisa({ analisa, daftarHargaDasar }: { analisa: AnalisaForm; daftarHargaDasar: HargaDasarOpsi[] }) {
  return (
    <FormModal
      judul={`Ubah ${analisa.kode}`}
      keterangan={analisa.uraian}
      aksi={simpanAnalisa}
      labelSimpan="Simpan"
      lebar={680}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah analisa ${analisa.kode}`} />}
    >
      <input type="hidden" name="id" value={analisa.id} />
      <IsianAnalisa nilai={analisa} daftar={daftarHargaDasar} />
    </FormModal>
  );
}

export function HapusAnalisa({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusAnalisa} id={id} nama={`analisa ${kode}`} />;
}

// ===========================================================================
// RAB ESTIMASI
// ===========================================================================

export function TambahRabEstimasi({ proyek }: { proyek: Opsi }) {
  return (
    <FormModal
      judul="Buat RAB Estimasi"
      keterangan="RAB baru untuk sebuah proyek. Nomor dibuat otomatis (RAB-<KODE>-NNN). Baris pekerjaannya ditambahkan setelah ini."
      aksi={tambahRabEstimasi}
      labelSimpan="Buat"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Buat RAB Estimasi" />}
    >
      <BarisField kolom={1}>
        <Field label="Proyek" nama="projectId" pilihan={proyek.map((p) => ({ nilai: p.id, label: p.nama }))} wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Nama / Judul" nama="nama" wajib petunjuk="mis. RAB Estimasi Awal — Struktur Bawah" />
      </BarisField>
    </FormModal>
  );
}

export interface RabForm {
  id: string;
  nomor: string;
  nama: string;
  status: string;
}

export function UbahRabEstimasi({ rab }: { rab: RabForm }) {
  return (
    <FormModal
      judul={`Ubah ${rab.nomor}`}
      aksi={ubahRabEstimasi}
      pemicu={(buka) => <button type="button" className="pill" onClick={buka}>Ubah info</button>}
    >
      <input type="hidden" name="id" value={rab.id} />
      <BarisField kolom={1}>
        <Field label="Nama / Judul" nama="nama" nilai={rab.nama} wajib />
      </BarisField>
      <Petunjuk>Status berpindah lewat tombol Ajukan / Setujui / Tolak, bukan di sini.</Petunjuk>
    </FormModal>
  );
}

export function HapusRabEstimasi({ id, nomor }: { id: string; nomor: string }) {
  return <TombolHapus aksi={hapusRabEstimasi} id={id} nama={`RAB ${nomor}`} />;
}

// ===========================================================================
// BARIS RAB
// ===========================================================================

export interface KatalogItem {
  id: string;
  kode: string;
  uraian: string;
  satuan: string;
  kelompok: string;
  hargaSatuan: number;
}

/**
 * Tambah baris RAB — inti alurnya: QS memilih pekerjaan dari katalog AHSP,
 * harga satuannya terisi otomatis (snapshot), lalu mengetik volume. Ada juga
 * mode manual untuk pekerjaan yang belum ada analisanya.
 */
export function TambahBarisRab({ rabEstimasiId, katalog }: { rabEstimasiId: string; katalog: KatalogItem[] }) {
  const [mode, setMode] = useState<"katalog" | "manual">(katalog.length > 0 ? "katalog" : "manual");
  const [pilih, setPilih] = useState(katalog[0]?.id ?? "");
  const [volume, setVolume] = useState("");

  const item = katalog.find((k) => k.id === pilih);
  const jumlah = item && Number(volume) > 0 ? item.hargaSatuan * Number(volume) : 0;

  return (
    <FormModal
      judul="Tambah Baris RAB"
      keterangan="Pilih pekerjaan dari pustaka AHSP, atau isi manual."
      aksi={tambahBarisRab}
      labelSimpan="Tambah"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Baris" />}
    >
      <input type="hidden" name="rabEstimasiId" value={rabEstimasiId} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button
          type="button"
          className={mode === "katalog" ? "btn" : "btn-garis"}
          style={{ fontSize: 12, padding: "5px 12px" }}
          onClick={() => setMode("katalog")}
          disabled={katalog.length === 0}
        >
          Dari Katalog AHSP
        </button>
        <button
          type="button"
          className={mode === "manual" ? "btn" : "btn-garis"}
          style={{ fontSize: 12, padding: "5px 12px" }}
          onClick={() => setMode("manual")}
        >
          Manual
        </button>
      </div>

      {mode === "katalog" ? (
        <>
          <BarisField kolom={1}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Pekerjaan</label>
              <select name="analisaId" className="inp" value={pilih} onChange={(e) => setPilih(e.target.value)}>
                {katalog.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.kode} · {k.uraian} — {rp(k.hargaSatuan)}/{k.satuan}
                  </option>
                ))}
              </select>
            </div>
          </BarisField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Volume ({item?.satuan ?? "—"}) <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className="inp"
                name="volume"
                inputMode="decimal"
                required
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Perkiraan Jumlah</label>
              <div style={{ padding: "9px 12px", borderRadius: 8, background: "var(--rona-abu)", fontWeight: 600, fontSize: 13 }}>
                {jumlah ? rp(jumlah) : "—"}
              </div>
            </div>
          </div>
          <BarisField kolom={1}>
            <Field label="Spesifikasi" nama="spesifikasi" petunjuk="opsional, mis. K-225 / Kayu meranti" />
          </BarisField>
          <Petunjuk>
            Harga satuan <b>{item ? rp(item.hargaSatuan) : "—"}</b> diambil (snapshot) dari AHSP saat ini —
            grup, uraian, dan satuan ikut disalin. Perubahan pustaka AHSP setelahnya tidak menggeser baris ini.
          </Petunjuk>
        </>
      ) : (
        <>
          <BarisField>
            <Field label="Grup" nama="grup" wajib petunjuk="mis. Persiapan, Tanah, Struktur" />
            <Field label="Satuan" nama="satuan" wajib />
          </BarisField>
          <BarisField kolom={1}>
            <Field label="Uraian" nama="uraian" wajib />
          </BarisField>
          <BarisField kolom={1}>
            <Field label="Spesifikasi" nama="spesifikasi" petunjuk="opsional, mis. K-225 / Kayu meranti" />
          </BarisField>
          <BarisField>
            <Field label="Volume" nama="volume" tipe="number" wajib />
            <Field label="Harga Satuan" nama="hargaSatuan" tipe="number" satuan="Rp" wajib />
          </BarisField>
        </>
      )}
    </FormModal>
  );
}

/** Impor massal baris RAB dari Excel (mengganti seluruh isi). */
export function ImporBarisRab({ rabEstimasiId }: { rabEstimasiId: string }) {
  return (
    <FormModal
      judul="Impor Baris dari Excel"
      keterangan="Mengganti SELURUH baris RAB dengan isi berkas. Hanya saat Draft/Ditolak."
      aksi={imporBarisRab}
      labelSimpan="Impor & Ganti"
      pemicu={(buka) => (
        <button type="button" className="pill" onClick={buka} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Upload size={13} /> Impor Excel
        </button>
      )}
    >
      <input type="hidden" name="rabEstimasiId" value={rabEstimasiId} />
      <BarisField kolom={1}>
        <Field label="Berkas Excel (.xlsx)" nama="berkas" tipe="berkas" wajib />
      </BarisField>
      <Petunjuk>
        Kolom: Grup · Uraian · Satuan · Volume · Harga Satuan · Spesifikasi. Belum punya berkasnya?{" "}
        <a href="/api/template/boq" style={{ color: "var(--teal)", fontWeight: 600 }}>Unduh template</a> lalu isi.
      </Petunjuk>
    </FormModal>
  );
}

export interface BarisRabForm {
  id: string;
  grup: string;
  uraian: string;
  satuan: string;
  spesifikasi: string | null;
  volume: number;
  hargaSatuan: number;
  adaAnalisa: boolean;
}

export function UbahBarisRab({ item }: { item: BarisRabForm }) {
  return (
    <FormModal
      judul="Ubah Baris RAB"
      keterangan={item.uraian}
      aksi={ubahBarisRab}
      lebar={640}
      pemicu={(buka) => <TombolIkon onClick={buka} judul="Ubah baris RAB" />}
    >
      <input type="hidden" name="id" value={item.id} />
      <BarisField>
        <Field label="Grup" nama="grup" nilai={item.grup} wajib />
        <Field label="Satuan" nama="satuan" nilai={item.satuan} wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Uraian" nama="uraian" nilai={item.uraian} wajib />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Spesifikasi" nama="spesifikasi" nilai={item.spesifikasi ?? ""} petunjuk="opsional" />
      </BarisField>
      <BarisField>
        <Field label="Volume" nama="volume" nilai={item.volume} tipe="number" wajib />
        <Field label="Harga Satuan" nama="hargaSatuan" nilai={item.hargaSatuan} tipe="number" satuan="Rp" wajib />
      </BarisField>
      {item.adaAnalisa && (
        <Petunjuk>
          Baris ini bertaut ke sebuah analisa. Menyunting harga di sini menggantikan snapshot-nya;
          untuk menariknya kembali dari AHSP terkini, pakai tombol segarkan pada baris.
        </Petunjuk>
      )}
    </FormModal>
  );
}

export function SegarkanHargaBaris({ id }: { id: string }) {
  return (
    <TombolAksiId aksi={segarkanHargaBaris} id={id} judul="Tarik ulang harga satuan dari AHSP terkini">
      <RefreshCw size={12} />
    </TombolAksiId>
  );
}

export function HapusBarisRab({ id, uraian }: { id: string; uraian: string }) {
  return <TombolHapus aksi={hapusBarisRab} id={id} nama={uraian} />;
}
