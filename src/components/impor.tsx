"use client";

import { BarisField, FormModal } from "@/components/form";
import { imporTabel } from "@/app/(app)/master/tabel-actions";

/**
 * Modal impor tabel dari Excel.
 *
 * Berkas benar-benar dibaca. Bila ada baris yang tidak sah, seluruh
 * kesalahannya dilaporkan sekaligus dan tidak ada yang tersimpan — supaya
 * pengguna bisa memperbaiki berkasnya dalam satu kali putaran.
 */
export function ModalImpor({
  jenis,
  konteks,
  kolom,
  sasaran,
  id,
}: {
  /** "BOQ / RAB" atau "RAP" — untuk judul modal. */
  jenis: string;
  konteks: string;
  kolom: string;
  /** unit | kerjaTambah | sarpras */
  sasaran: "unit" | "kerjaTambah" | "sarpras";
  id: string;
}) {
  const jenisTabel = jenis.toLowerCase().includes("rap") ? "rap" : "boq";

  return (
    <FormModal
      judul={`Impor ${jenis}`}
      keterangan={konteks}
      aksi={imporTabel}
      labelSimpan="Impor"
      lebar={620}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          Impor Excel
        </button>
      )}
    >
      <input type="hidden" name="sasaran" value={sasaran} />
      <input type="hidden" name="jenis" value={jenisTabel} />
      <input type="hidden" name="id" value={id} />

      <BarisField kolom={1}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Berkas Excel <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <input
            className="inp"
            type="file"
            name="berkas"
            accept=".xlsx,.xlsm"
            required
            style={{ padding: "8px 10px" }}
          />
        </div>
      </BarisField>

      <div className="card" style={{ padding: "12px 14px", background: "#f8fafb", marginBottom: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Kolom yang dikenali</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.7 }}>{kolom}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7, marginTop: 8 }}>
          Baris judul dicari otomatis sampai baris ke-10. Nama kolom tidak
          harus persis — &ldquo;Vol&rdquo;, &ldquo;Qty&rdquo;, dan &ldquo;Kuantitas&rdquo; sama-sama
          dikenali. Baris Total dan Jumlah dilewati.
          {jenisTabel === "rap" && " Baris yang namanya memuat “upah” dibaca sebagai upah tenaga kerja."}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--amber)", marginBottom: 14, lineHeight: 1.6 }}>
        Impor <b>mengganti seluruh baris</b> pada tabel ini. Bila ada baris yang tidak
        sah, tidak ada yang disimpan dan seluruh kesalahannya ditampilkan sekaligus.
        Perubahan tercatat di Log Perubahan.
      </div>
    </FormModal>
  );
}
