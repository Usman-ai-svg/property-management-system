"use client";

import { FormModal } from "@/components/form";
import { imporPeragaan } from "@/app/(app)/master/actions";

/**
 * Modal impor dari Excel.
 *
 * PERAGAAN: berkas belum benar-benar dibaca. Yang dilakukan baru mencatat
 * percobaan impor ke jejak audit, supaya alurnya bisa dinilai lebih dulu
 * sebelum pembacaan berkas dibangun.
 */
export function ModalImpor({
  jenis,
  konteks,
  kolom,
}: {
  jenis: string;
  konteks: string;
  kolom: string;
}) {
  return (
    <FormModal
      judul={`Impor ${jenis}`}
      keterangan={konteks}
      aksi={imporPeragaan}
      labelSimpan="Impor"
      lebar={600}
      pemicu={(buka) => (
        <button type="button" className="btn-garis" onClick={buka}>
          Impor Excel
        </button>
      )}
    >
      <input type="hidden" name="jenis" value={jenis} />
      <input type="hidden" name="konteks" value={konteks} />

      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
        Berkas Excel
      </label>
      <div
        className="inp"
        style={{
          textAlign: "center", color: "var(--muted)", padding: 22,
          border: "1px dashed var(--line)",
        }}
      >
        ⬆ Pemilihan berkas belum aktif pada demo ini
      </div>

      <div className="card" style={{ marginTop: 12, padding: "12px 14px", background: "#f8fafb" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Kolom yang dikenali</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.7 }}>{kolom}</div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--amber)", margin: "10px 0 14px", lineHeight: 1.6 }}>
        Impor akan menimpa seluruh baris pada tabel ini. Perubahan tercatat di Log Perubahan.
      </div>
    </FormModal>
  );
}
