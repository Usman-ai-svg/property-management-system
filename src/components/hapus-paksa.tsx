"use client";

import { Trash2 } from "lucide-react";
import { Field, FormModal } from "@/components/form";
import type { HasilAksi } from "@/lib/actions/guard";

/**
 * "Zona berbahaya": hapus paksa sebuah objek yang biasanya terkunci karena
 * sudah punya progress. Meminta pengetikan kode proyek sebagai konfirmasi, dan
 * hanya dirender bila pemanggil memang berhak (peran Administrator Sistem —
 * diperiksa lagi di server, penyembunyian di sini hanya kenyamanan).
 *
 * Aksinya melakukan redirect ke halaman proyek saat berhasil, karena objek yang
 * sedang dibuka sudah tidak ada lagi.
 */
export function HapusPaksa({
  aksi,
  id,
  kodeProyek,
  label,
  keterangan,
}: {
  aksi: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  id: string;
  kodeProyek: string;
  label: string;
  keterangan: string;
}) {
  return (
    <div
      className="card"
      style={{ marginTop: 16, padding: "16px 20px", border: "1px solid var(--rona-merah)" }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "var(--red)" }}>Zona Berbahaya</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.55 }}>
            {keterangan}
          </div>
        </div>

        <FormModal
          judul={`Hapus Paksa ${label}`}
          keterangan="Tindakan ini permanen dan tidak bisa dibatalkan."
          aksi={aksi}
          labelSimpan="Hapus Permanen"
          pemicu={(buka) => (
            <button
              type="button"
              onClick={buka}
              className="btn-garis"
              style={{ color: "var(--red)", borderColor: "var(--red)", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Trash2 size={14} /> Hapus Paksa
            </button>
          )}
        >
          <input type="hidden" name="id" value={id} />

          <div
            style={{
              padding: "10px 12px", borderRadius: 9, background: "var(--rona-merah)",
              color: "var(--red)", fontSize: 12, lineHeight: 1.55, marginBottom: 14,
            }}
          >
            Menghapus <b>{label}</b> ikut menghapus seluruh riwayat progress/opname
            dan rincian BOQ/RAP-nya secara permanen.
          </div>

          <Field
            label={`Ketik kode proyek "${kodeProyek}" untuk mengonfirmasi`}
            nama="konfirmasi"
            wajib
          />
        </FormModal>
      </div>
    </div>
  );
}
