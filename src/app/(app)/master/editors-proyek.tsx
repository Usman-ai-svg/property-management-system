"use client";

import { BarisField, Field, FormModal, TombolHapus, TombolIkon, TombolTambah } from "@/components/form";
import { STATUS_LAHAN, STATUS_PROYEK } from "@/lib/domain/enums";
import { hapusFase, hapusProyek, simpanFase, tambahProyek, ubahProyek } from "./actions";
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
        <Field label="Fase Pertama" nama="kodeFase" nilai="F1" petunjuk="bisa ditambah lagi nanti" />
      </BarisField>

      <BarisField kolom={1}>
        <Field label="Nama Proyek" nama="nama" wajib />
      </BarisField>

      <BarisField>
        <Field label="Status" nama="status" nilai={STATUS_PROYEK[0]} pilihan={STATUS_PROYEK} />
        <Field label="Status Lahan" nama="statusLahan" nilai={STATUS_LAHAN[0]} pilihan={STATUS_LAHAN} />
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
        Biaya perolehan lahan diisi kemudian dari halaman Landbank. Pin lokasi, legalitas,
        dan sisanya diisi setelah proyek terbuat.
      </Petunjuk>
    </FormModal>
  );
}

export function UbahProyek({
  proyek,
}: {
  proyek: { id: string; kode: string; nama: string; status: string; statusLahan: string };
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
      <BarisField>
        <Field label="Status" nama="status" nilai={proyek.status} pilihan={STATUS_PROYEK} />
        <Field label="Status Lahan" nama="statusLahan" nilai={proyek.statusLahan} pilihan={STATUS_LAHAN} />
      </BarisField>
    </FormModal>
  );
}

export function HapusProyek({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusProyek} id={id} nama={`proyek ${kode}`} />;
}

/* ===================== FASE ===================== */

export function KelolaFase({
  projectId,
  kodeProyek,
  fases,
}: {
  projectId: string;
  kodeProyek: string;
  fases: { id: string; kode: string; nama: string | null; urutan: number; jumlahUnit: number }[];
}) {
  return (
    <FormModal
      judul={`Tambah Fase · ${kodeProyek}`}
      keterangan={`${fases.length} fase saat ini: ${fases.map((f) => f.kode).join(", ") || "belum ada"}`}
      aksi={simpanFase}
      labelSimpan="Tambah Fase"
      pemicu={(buka) => <TombolTambah onClick={buka} label="Tambah Fase" />}
    >
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="projectId" value={projectId} />
      <BarisField>
        <Field label="Kode Fase" nama="kode" wajib petunjuk="mis. F5" />
        <Field label="Nama Fase" nama="nama" petunjuk="opsional" />
      </BarisField>

      {fases.length > 0 && (
        <div className="card" style={{ padding: "10px 12px", background: "var(--rona-panel)", marginBottom: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Fase yang sudah ada</div>
          {fases.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex", justifyContent: "space-between", gap: 10,
                fontSize: 11.5, padding: "3px 0", color: "var(--muted)",
              }}
            >
              <span>{f.kode}{f.nama ? ` · ${f.nama}` : ""}</span>
              <span>{f.jumlahUnit} unit</span>
            </div>
          ))}
        </div>
      )}

      <Petunjuk>
        Fase yang masih dipakai unit tidak bisa dihapus — unitnya akan kehilangan fase.
      </Petunjuk>
    </FormModal>
  );
}

export function UbahFase({
  fase,
}: {
  fase: { id: string; kode: string; nama: string | null; urutan: number };
}) {
  return (
    <FormModal
      judul={`Ubah Fase ${fase.kode}`}
      aksi={simpanFase}
      pemicu={(buka) => <TombolIkon onClick={buka} judul={`Ubah fase ${fase.kode}`} />}
    >
      <input type="hidden" name="id" value={fase.id} />
      <BarisField>
        <Field label="Kode Fase" nama="kode" nilai={fase.kode} wajib />
        <Field label="Urutan" nama="urutan" nilai={fase.urutan} tipe="number" />
      </BarisField>
      <BarisField kolom={1}>
        <Field label="Nama Fase" nama="nama" nilai={fase.nama ?? ""} />
      </BarisField>
    </FormModal>
  );
}

export function HapusFase({ id, kode }: { id: string; kode: string }) {
  return <TombolHapus aksi={hapusFase} id={id} nama={`fase ${kode}`} />;
}
