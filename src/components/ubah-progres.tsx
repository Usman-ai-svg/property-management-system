"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Pencil } from "lucide-react";
import type { HasilAksi } from "@/lib/actions/guard";

function TombolSimpan() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn"
      style={{ padding: "6px 14px", fontSize: 12.5 }}
      disabled={pending}
    >
      {pending ? "Menyimpan…" : "Simpan"}
    </button>
  );
}

/**
 * Pengubah progres di kepala halaman opname.
 *
 * Meniru artifact: tombol "Ubah Progress" berubah jadi isian angka dengan
 * Simpan dan Batal, bukan modal — karena yang diubah cuma satu angka.
 */
export function UbahProgres({
  id,
  nilai,
  aksi,
}: {
  id: string;
  nilai: number;
  aksi: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
}) {
  const [sunting, setSunting] = useState(false);
  const [hasil, kirim] = useActionState(aksi, null);

  if (!sunting) {
    return (
      <button
        type="button"
        className="btn-garis"
        onClick={() => setSunting(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
      >
        <Pencil size={11} />
        Ubah Progress
      </button>
    );
  }

  return (
    <form
      action={(form) => {
        kirim(form);
        setSunting(false);
      }}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <input type="hidden" name="id" value={id} />
      <input
        className="inp"
        type="number"
        name="progress"
        defaultValue={nilai}
        min={0}
        max={100}
        style={{ width: 80, fontSize: 12 }}
        autoFocus
      />
      <span style={{ fontSize: 12, color: "var(--muted)" }}>%</span>
      <TombolSimpan />
      <button
        type="button"
        onClick={() => setSunting(false)}
        style={{
          border: "none", background: "none", color: "var(--muted)",
          fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Batal
      </button>
      {hasil && !hasil.ok && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--red)", fontSize: 12 }}>
          <AlertTriangle size={13} />
          {hasil.error}
        </span>
      )}
    </form>
  );
}
