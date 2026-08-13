"use client";

import { useState } from "react";
import {
  BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah,
} from "@/components/form";
import {
  JENIS_ASET, JENIS_PENYESUAIAN_ASET, KEPEMILIKAN_ASET, STATUS_PENGGUNAAN,
} from "@/lib/domain/enums";
import {
  catatPenyesuaianAset, catatServis, hapusAset, hapusPenggunaan, selesaikanPenggunaan,
  tambahAset, tambahPenggunaan, ubahAset,
} from "./actions";
import { Petunjuk } from "@/components/ui";

/** Satu alat yang bisa dipilih di form Penggunaan/Penyesuaian/Servis. */
export interface AlatPilihan {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  jumlah: number;
  jumlahRusak: number;
  dipakai: number;
  tersedia: number;
  servisBerikut: string | null;
}

/**
 * Pemilih alat yang mengangkat pilihannya ke pemanggil, sekaligus menampilkan
 * keterangan kontekstual (stok/tersedia) di bawahnya. Dipakai form Penggunaan,
 * Penyesuaian, dan Servis yang kini memilih alat sendiri — bukan lagi dipanggil
 * dari baris tertentu.
 */
function PilihAlat({
  daftar,
  dipilih,
  setDipilih,
  info,
}: {
  daftar: AlatPilihan[];
  dipilih: AlatPilihan | null;
  setDipilih: (a: AlatPilihan | null) => void;
  info?: (a: AlatPilihan) => React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
        Alat <span style={{ color: "var(--red)" }}>*</span>
      </label>
      <select
        name="equipmentId"
        className="inp"
        defaultValue=""
        required
        onChange={(e) => setDipilih(daftar.find((a) => a.id === e.target.value) ?? null)}
      >
        <option value="" disabled>— pilih alat —</option>
        {daftar.map((a) => (
          <option key={a.id} value={a.id}>
            {a.kode} — {a.nama}
          </option>
        ))}
      </select>
      {dipilih && info && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          {info(dipilih)}
        </div>
      )}
    </div>
  );
}

/**
 * Rincian stok satu alat: jumlah unit, yang sedang dipakai, yang rusak, dan yang
 * tersedia. Keempatnya menjumlah tepat ke jumlah total (jumlah = dipakai + rusak
 * + tersedia), memakai istilah yang sama dengan kolom tabel inventaris.
 */
function RincianStok({ alat }: { alat: AlatPilihan }) {
  const sel = (label: string, nilai: number, warna?: string) => (
    <div style={{ flex: "1 1 0", textAlign: "center" }}>
      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: warna ?? "var(--text)" }}>{nilai}</div>
    </div>
  );

  return (
    <div
      style={{
        display: "flex", gap: 8, marginTop: 8, padding: "8px 6px",
        background: "var(--rona-abu)", borderRadius: 8,
      }}
    >
      {sel("Jumlah", alat.jumlah)}
      {sel("Dipakai", alat.dipakai, alat.dipakai > 0 ? "var(--teal)" : "var(--muted)")}
      {sel("Rusak", alat.jumlahRusak, alat.jumlahRusak > 0 ? "var(--red)" : "var(--muted)")}
      {sel("Tersedia", alat.tersedia, alat.tersedia > 0 ? "var(--teal)" : "var(--red)")}
    </div>
  );
}

export interface AsetForm {
  id: string;
  kode: string;
  jenis: string;
  nama: string;
  kategori: string;
  merk: string | null;
  jumlah: number;
  satuan: string;
  kepemilikan: string;
  vendorId: string | null;
  servisTerakhir: string | null;
  servisBerikut: string | null;
  nilai: number;
}

type Pilihan = { id: string; nama: string }[];

/**
 * Isian identitas aset yang dipakai bersama oleh form tambah dan ubah.
 *
 * HANYA identitas & stok — tak ada proyek, PIC, tarif, atau status di sini.
 * Semua itu dicatat lewat Penggunaan. Pemilih vendor hanya muncul saat
 * kepemilikannya Sewa, dan nilai perolehan hanya untuk aset milik sendiri.
 */
function IsianAset({
  nilai,
  vendor,
  jenisAwal,
}: {
  nilai?: AsetForm;
  vendor: Pilihan;
  jenisAwal?: string;
}) {
  const [kepemilikan, setKepemilikan] = useState(nilai?.kepemilikan ?? KEPEMILIKAN_ASET[0]);

  return (
    <>
      <BarisField>
        <Field
          label="Jenis"
          nama="jenis"
          nilai={nilai?.jenis ?? jenisAwal ?? JENIS_ASET[0]}
          pilihan={JENIS_ASET}
        />
        <Field label="Kode" nama="kode" nilai={nilai?.kode} wajib petunjuk="mis. SCF-01, MBL-05" />
      </BarisField>

      <BarisField>
        <Field label="Nama" nama="nama" nilai={nilai?.nama} wajib />
        <Field label="Kategori" nama="kategori" nilai={nilai?.kategori} wajib petunjuk="mis. Perancah, Kendaraan" />
      </BarisField>

      <BarisField>
        <Field label="Merk / Tipe" nama="merk" nilai={nilai?.merk ?? ""} />
        <Field label="Satuan" nama="satuan" nilai={nilai?.satuan ?? "unit"} />
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
        <Field label="Servis Terakhir" nama="servisTerakhir" nilai={nilai?.servisTerakhir ?? ""} tipe="tanggal" />
        <Field label="Servis Berikut" nama="servisBerikut" nilai={nilai?.servisBerikut ?? ""} tipe="tanggal" />
      </BarisField>

      {kepemilikan !== "Sewa" && (
        <BarisField kolom={1}>
          <Field
            label="Nilai Perolehan"
            nama="nilai"
            nilai={nilai?.nilai ?? 0}
            tipe="number"
            satuan="Rp"
            petunjuk="Nilai perolehan aset milik sendiri. Tarif sewa dicatat di tiap Penggunaan."
          />
        </BarisField>
      )}
    </>
  );
}

export function TambahAset({ vendor, jenisAwal }: { vendor: Pilihan; jenisAwal?: string }) {
  const label = jenisAwal === "Aset" ? "Tambah Aset" : "Tambah Peralatan";
  return (
    <FormModal
      judul={label}
      keterangan="Daftar induk hanya berisi identitas & stok. Penempatan ke proyek dicatat lewat Penggunaan."
      aksi={tambahAset}
      labelSimpan="Tambah"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label={label} />}
    >
      <IsianAset vendor={vendor} jenisAwal={jenisAwal} />
    </FormModal>
  );
}

export function UbahAset({ aset, vendor }: { aset: AsetForm; vendor: Pilihan }) {
  return (
    <FormModal
      judul={`Ubah ${aset.kode}`}
      keterangan={`${aset.nama} — hanya identitas barang. Penempatan & pemakaian lewat Penggunaan.`}
      aksi={ubahAset}
      lebar={640}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah ${aset.kode}`} />}
    >
      <input type="hidden" name="id" value={aset.id} />
      <IsianAset nilai={aset} vendor={vendor} />
    </FormModal>
  );
}

export function HapusAset({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusAset} id={id} nama={`aset ${kode}`} />;
}

/* ===================== PENGGUNAAN ===================== */

/**
 * Catat penggunaan alat pada sebuah proyek.
 *
 * Inilah cara alat "keluar" ke proyek — bukan lewat Ubah. Satu alat bisa
 * dipakai beberapa proyek sekaligus; tiap catatan menahan sejumlah unit selama
 * Aktif, dan penambahan yang melebihi stok tersedia ditolak server.
 */
export function TambahPenggunaan({
  daftarAlat,
  proyek,
}: {
  daftarAlat: AlatPilihan[];
  proyek: Pilihan;
}) {
  const [alat, setAlat] = useState<AlatPilihan | null>(null);

  return (
    <FormModal
      judul="Catat Penggunaan"
      keterangan="Tempatkan alat ke sebuah proyek. Satu alat bisa dipakai beberapa proyek sekaligus."
      aksi={tambahPenggunaan}
      labelSimpan="Catat Penggunaan"
      lebar={640}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Penggunaan" />}
    >
      <BarisField kolom={1}>
        <PilihAlat
          daftar={daftarAlat}
          dipilih={alat}
          setDipilih={setAlat}
          info={(a) => <RincianStok alat={a} />}
        />
      </BarisField>

      <BarisField>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Proyek <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select name="projectId" className="inp" defaultValue="" required>
            <option value="" disabled>— pilih proyek —</option>
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
        <Field label="Jumlah Unit" nama="jumlah" tipe="number" satuan={alat?.satuan ?? "unit"} wajib />
      </BarisField>

      <BarisField>
        <Field label="Tanggal Mulai" nama="tanggalMulai" tipe="tanggal" wajib />
        <Field
          label="Tanggal Selesai"
          nama="tanggalSelesai"
          tipe="tanggal"
          petunjuk="Kosongkan bila masih berjalan."
        />
      </BarisField>

      <BarisField>
        <Field
          label="Tarif / hari"
          nama="tarif"
          nilai={0}
          tipe="number"
          satuan="Rp"
          petunjuk="Per unit per hari. Isi 0 untuk alat milik sendiri."
        />
        <Field label="Status" nama="status" pilihan={STATUS_PENGGUNAAN} />
      </BarisField>

      <BarisField kolom={1}>
        <Field
          label="Penanggung Jawab"
          nama="penanggungJawab"
          petunjuk="Nama orang yang bertanggung jawab atas alat selama dipakai."
        />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Catatan" nama="catatan" tipe="textarea" petunjuk="mis. dipakai untuk pengecoran lantai 3" />
      </BarisField>

      <Petunjuk>
        Hanya penggunaan berstatus <b>Aktif</b> yang menahan stok — alokasi yang melebihi
        unit tersedia ditolak. Setelah alat kembali, tandai <b>Selesai</b> lewat tombol di
        tabel Penggunaan agar unitnya tersedia lagi.
      </Petunjuk>
    </FormModal>
  );
}

export function SelesaikanPenggunaan({
  id,
  ringkas,
}: {
  id: string;
  ringkas: string;
}) {
  return (
    <FormModal
      judul="Selesaikan Penggunaan"
      keterangan={ringkas}
      aksi={selesaikanPenggunaan}
      labelSimpan="Selesaikan"
      lebar={480}
      pemicu={(buka) => (
        <button
          type="button"
          className="btn-garis"
          onClick={buka}
          style={{ fontSize: 11, padding: "3px 8px" }}
          title="Tandai penggunaan ini selesai"
        >
          Selesaikan
        </button>
      )}
    >
      <input type="hidden" name="id" value={id} />
      <Petunjuk>
        Menandai penggunaan ini selesai akan mengembalikan unitnya ke stok tersedia.
        Tanggal selesai diisi hari ini bila belum ada.
      </Petunjuk>
    </FormModal>
  );
}

export function HapusPenggunaan({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusPenggunaan} id={id} nama={`penggunaan ${kode}`} />;
}

/* ===================== SERVIS ===================== */

/**
 * Catat servis/perawatan alat.
 *
 * Menandai alat sudah diservis — memperbarui tanggal servis terakhir & jadwal
 * berikutnya sekaligus menambah riwayat. Bukan lewat "Ubah": servis punya jejak
 * tersendiri (kapan, oleh siapa, berapa biayanya), seperti penyesuaian stok.
 */
export function CatatServis({ daftarAlat }: { daftarAlat: AlatPilihan[] }) {
  const [alat, setAlat] = useState<AlatPilihan | null>(null);

  return (
    <FormModal
      judul="Catat Servis"
      keterangan="Tandai alat sudah diservis dan tentukan jadwal servis berikutnya."
      aksi={catatServis}
      labelSimpan="Catat Servis"
      lebar={600}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Servis" />}
    >
      <BarisField kolom={1}>
        <PilihAlat
          daftar={daftarAlat}
          dipilih={alat}
          setDipilih={setAlat}
          info={(a) =>
            a.servisBerikut
              ? `Servis berikutnya dijadwalkan ${a.servisBerikut}.`
              : "Belum ada jadwal servis berikutnya."
          }
        />
      </BarisField>

      <BarisField>
        <Field label="Tanggal Servis" nama="tanggal" tipe="tanggal" wajib petunjuk="Kapan servis dilakukan." />
        <Field
          label="Servis Berikutnya"
          nama="servisBerikut"
          tipe="tanggal"
          petunjuk="Jadwal berikutnya. Boleh dikosongkan."
        />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Biaya Servis" nama="biaya" nilai={0} tipe="number" satuan="Rp" petunjuk="Boleh 0 bila tak dicatat." />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Catatan" nama="catatan" tipe="textarea" petunjuk="mis. ganti oli, cek dinamo, kalibrasi" />
      </BarisField>

      <Petunjuk>
        Servis memperbarui tanggal servis terakhir & berikutnya pada daftar induk, sekaligus
        tercatat sebagai riwayat. Untuk membetulkan identitas alat, gunakan tombol Ubah.
      </Petunjuk>
    </FormModal>
  );
}

/* ===================== PENYESUAIAN STOK ===================== */

/**
 * Catat kehilangan, kerusakan, perbaikan, atau koreksi opname.
 *
 * Inilah satu-satunya jalan mengubah jumlah aset. Formulir Ubah Aset hanya
 * menampilkan jumlahnya sebagai keterangan, supaya tiap pergerakan stok selalu
 * punya alasan dan penanggung jawab.
 */
export function PenyesuaianAset({ daftarAlat }: { daftarAlat: AlatPilihan[] }) {
  const [alat, setAlat] = useState<AlatPilihan | null>(null);

  return (
    <FormModal
      judul="Catat Penyesuaian Stok"
      keterangan="Kehilangan, kerusakan, perbaikan, atau koreksi opname."
      aksi={catatPenyesuaianAset}
      labelSimpan="Catat Penyesuaian"
      lebar={600}
      pemicu={(buka) => <TombolTambah onClick={buka} label="Catat Penyesuaian" />}
    >
      <BarisField kolom={1}>
        <PilihAlat
          daftar={daftarAlat}
          dipilih={alat}
          setDipilih={setAlat}
          info={(a) => <RincianStok alat={a} />}
        />
      </BarisField>

      <BarisField>
        <Field label="Jenis Penyesuaian" nama="jenis" pilihan={JENIS_PENYESUAIAN_ASET} wajib />
        <Field label="Jumlah Unit" nama="banyak" tipe="number" satuan={alat?.satuan ?? "unit"} wajib />
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

      <Petunjuk>
        <b>Hilang</b> mengurangi jumlah tercatat. <b>Rusak</b> tidak — barangnya masih
        dimiliki, hanya tidak bisa dipakai, dan bisa dikembalikan lewat{" "}
        <b>Perbaikan Selesai</b>. <b>Koreksi Stok</b> untuk hasil opname fisik; isi
        angka negatif bila stok nyatanya lebih sedikit.
        <br />
        <br />
        Riwayat penyesuaian bersifat tetap. Pencatatan yang telanjur salah diperbaiki
        dengan Koreksi Stok baru, bukan dengan menghapus catatan lama. Nilai rupiah aset
        tidak berubah — penyusutan dibukukan Finance di luar sistem ini.
      </Petunjuk>
    </FormModal>
  );
}
