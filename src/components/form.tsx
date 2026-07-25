"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import type { HasilAksi } from "@/lib/actions/guard";

// ---------------------------------------------------------------------------
// Kolom isian
// ---------------------------------------------------------------------------

export function Field({
  label,
  nama,
  nilai,
  tipe = "text",
  satuan,
  petunjuk,
  wajib,
  pilihan,
  lebar,
}: {
  label: string;
  nama: string;
  nilai?: string | number | null;
  tipe?: "text" | "number" | "textarea";
  satuan?: string;
  petunjuk?: string;
  wajib?: boolean;
  pilihan?: readonly string[];
  lebar?: "penuh" | "separuh";
}) {
  const id = useId();

  return (
    <div style={{ gridColumn: lebar === "penuh" ? "1 / -1" : undefined }}>
      <label
        htmlFor={id}
        style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}
      >
        {label}
        {wajib && <span style={{ color: "var(--red)" }}> *</span>}
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {pilihan ? (
          <select id={id} name={nama} className="inp" defaultValue={nilai ?? undefined} required={wajib}>
            {pilihan.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : tipe === "textarea" ? (
          <textarea
            id={id}
            name={nama}
            className="inp"
            defaultValue={nilai ?? ""}
            required={wajib}
            rows={3}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        ) : (
          <input
            id={id}
            name={nama}
            className="inp"
            type="text"
            inputMode={tipe === "number" ? "decimal" : undefined}
            defaultValue={nilai ?? ""}
            required={wajib}
          />
        )}
        {satuan && (
          <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{satuan}</span>
        )}
      </div>

      {petunjuk && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
          {petunjuk}
        </div>
      )}
    </div>
  );
}

export function BarisField({ children, kolom = 2 }: { children: React.ReactNode; kolom?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${kolom}, minmax(0, 1fr))`,
        gap: 14,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tombol
// ---------------------------------------------------------------------------

function TombolSimpan({ label = "Simpan" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Menyimpan…" : label}
    </button>
  );
}

export function TombolIkon({
  onClick,
  judul,
  jenis = "ubah",
}: {
  onClick: () => void;
  judul: string;
  jenis?: "ubah" | "hapus";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={judul}
      aria-label={judul}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 4,
        display: "inline-grid",
        placeItems: "center",
        color: jenis === "hapus" ? "var(--red)" : "var(--muted)",
        borderRadius: 6,
      }}
    >
      {jenis === "hapus" ? <Trash2 size={14} /> : <Pencil size={14} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Modal + form
// ---------------------------------------------------------------------------

/**
 * Form dalam modal yang terhubung ke sebuah Server Action.
 *
 * Modal ditutup sendiri hanya bila aksi mengembalikan ok. Bila gagal, pesan
 * galat ditampilkan di dalam modal dan isian tetap utuh — pengguna tidak
 * kehilangan apa yang sudah diketik.
 */
export function FormModal({
  judul,
  keterangan,
  aksi,
  children,
  pemicu,
  labelSimpan,
  lebar = 560,
}: {
  judul: string;
  keterangan?: string;
  aksi: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  children: React.ReactNode;
  pemicu: (buka: () => void) => React.ReactNode;
  labelSimpan?: string;
  lebar?: number;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const [hasil, kirim] = useActionState(aksi, null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasil?.ok) setTerbuka(false);
  }, [hasil]);

  useEffect(() => {
    if (!terbuka) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setTerbuka(false);
    document.addEventListener("keydown", esc);
    dialog.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [terbuka]);

  return (
    <>
      {pemicu(() => setTerbuka(true))}

      {terbuka && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={judul}
          onClick={(e) => e.target === e.currentTarget && setTerbuka(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(18,33,46,.55)",
            display: "grid", placeItems: "center", padding: 20, zIndex: 60,
          }}
        >
          <div
            ref={dialog}
            className="card"
            style={{ width: "100%", maxWidth: lebar, maxHeight: "88vh", display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                padding: "16px 20px", borderBottom: "1px solid var(--line)",
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
              }}
            >
              <div>
                <div className="disp" style={{ fontWeight: 700, fontSize: 15.5 }}>{judul}</div>
                {keterangan && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.55 }}>
                    {keterangan}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTerbuka(false)}
                aria-label="Tutup"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
              >
                <X size={18} />
              </button>
            </div>

            <form action={kirim} style={{ overflow: "auto", padding: 20 }}>
              {children}

              {hasil && !hasil.ok && (
                <div
                  role="alert"
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, marginBottom: 14,
                    padding: "9px 12px", borderRadius: 9, background: "#fbeae8",
                    color: "var(--red)", fontSize: 12.5, lineHeight: 1.5,
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  {hasil.error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button type="button" className="btn ghost" onClick={() => setTerbuka(false)}>
                  Batal
                </button>
                <TombolSimpan label={labelSimpan} />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** Tombol "Ubah" berlabel, dipakai di kepala kartu. */
export function TombolUbah({ onClick, label = "Ubah" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pill"
      style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
    >
      <Pencil size={12} />
      {label}
    </button>
  );
}

/** Tombol "Tambah". */
export function TombolTambah({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pill"
      style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
    >
      <Plus size={13} />
      {label}
    </button>
  );
}

/**
 * Tombol hapus dengan konfirmasi dua langkah.
 *
 * Klik pertama mengubah tombol jadi "Yakin?"; klik kedua baru mengirim.
 * Konfirmasi otomatis batal setelah 4 detik agar tidak tertinggal aktif.
 */
export function TombolHapus({
  aksi,
  id,
  nama,
}: {
  aksi: (form: FormData) => Promise<void> | void;
  id: string;
  nama: string;
}) {
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => setSiap(false), 4000);
    return () => clearTimeout(t);
  }, [siap]);

  if (!siap) {
    return <TombolIkon jenis="hapus" judul={`Hapus ${nama}`} onClick={() => setSiap(true)} />;
  }

  return (
    <form action={aksi} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        style={{
          background: "var(--red)", color: "#fff", border: "none", borderRadius: 6,
          fontSize: 11, fontWeight: 600, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Yakin?
      </button>
    </form>
  );
}
