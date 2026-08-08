"use client";

import { useActionState, useEffect } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useToast } from "@/components/toast";
import { Field, FormModal } from "@/components/form";
import type { HasilAksi } from "@/lib/actions/guard";
import { ajukanRab, setujuiRab, tolakRab } from "../actions";

function useKirim(aksi: (s: HasilAksi | null, f: FormData) => Promise<HasilAksi>) {
  const [hasil, kirim] = useActionState(aksi, null);
  const { tampil } = useToast();
  useEffect(() => {
    if (hasil) tampil(hasil.ok ? (hasil.pesan ?? "Tersimpan.") : hasil.error);
  }, [hasil, tampil]);
  return kirim;
}

/** Ajukan RAB untuk persetujuan (Draft/Ditolak → Diajukan). */
export function AjukanRab({ id }: { id: string }) {
  const kirim = useKirim(ajukanRab);
  return (
    <form action={kirim}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Send size={14} /> Ajukan Persetujuan
      </button>
    </form>
  );
}

/** Setujui RAB (Diajukan → Final). */
export function SetujuiRab({ id }: { id: string }) {
  const kirim = useKirim(setujuiRab);
  return (
    <form action={kirim}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--green)", borderColor: "var(--green)" }}
      >
        <CheckCircle2 size={14} /> Setujui
      </button>
    </form>
  );
}

/** Tolak RAB (Diajukan → Ditolak) dengan catatan wajib. */
export function TolakRab({ id }: { id: string }) {
  return (
    <FormModal
      judul="Tolak RAB"
      keterangan="RAB dikembalikan ke penyusun sebagai Ditolak. Catatan penolakan wajib diisi."
      aksi={tolakRab}
      labelSimpan="Tolak & Kembalikan"
      pemicu={(buka) => (
        <button type="button" className="btn ghost" onClick={buka} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--red)" }}>
          <XCircle size={14} /> Tolak
        </button>
      )}
    >
      <input type="hidden" name="id" value={id} />
      <Field label="Catatan Penolakan" nama="catatan" tipe="textarea" wajib petunjuk="Apa yang perlu diperbaiki penyusun." />
    </FormModal>
  );
}
