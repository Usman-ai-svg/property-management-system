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
  tipe?: "text" | "number" | "textarea" | "tanggal";
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
            type={tipe === "tanggal" ? "date" : "text"}
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
 *
 * Mempertahankan isian itu perlu usaha: React mengosongkan form tak terkendali
 * setelah sebuah Server Action selesai, termasuk saat aksinya ditolak. Karena
 * itu FormData yang dikirim disimpan, lalu nilainya ditulis balik ke tiap
 * kolom begitu hasilnya diketahui gagal. Tanpa ini, satu kesalahan kecil
 * memaksa mengetik ulang seluruh formulir.
 *
 * Bila aksi mengembalikan pesan saat berhasil, pesan itu ditampilkan di tempat
 * pemicunya setelah modal tertutup. Ada aksi yang perlu memberi tahu sesuatu
 * yang tidak terlihat dari layar — misalnya impor yang mempertahankan nilai
 * upah lama karena berkasnya tidak memuat baris upah.
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
  const [catatan, setCatatan] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const dataTerakhir = useRef<FormData | null>(null);

  const [hasil, kirim] = useActionState(
    async (sebelumnya: HasilAksi | null, form: FormData) => {
      dataTerakhir.current = form;
      return aksi(sebelumnya, form);
    },
    null,
  );

  useEffect(() => {
    if (!hasil?.ok) return;
    setTerbuka(false);
    setCatatan(hasil.pesan ?? null);
  }, [hasil]);

  // Kembalikan isian yang dikosongkan React setelah aksi yang ditolak.
  //
  // Nilainya diambil per nama SEKALIGUS per urutan, bukan sekadar yang pertama:
  // ada formulir yang punya beberapa kolom bernama sama — baris pembebanan
  // pengeluaran, misalnya — dan mengembalikan nilai baris pertama ke seluruh
  // baris akan diam-diam mengubah angkanya.
  //
  // Kolom berkas dilewati: peramban melarang mengisi <input type="file"> lewat
  // skrip, jadi berkasnya memang harus dipilih ulang.
  useEffect(() => {
    if (!hasil || hasil.ok) return;
    const data = dataTerakhir.current;
    const form = dialog.current?.querySelector("form");
    if (!data || !form) return;

    const urutanPakai = new Map<string, number>();

    for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    )) {
      if (!el.name || el.type === "file" || el.type === "hidden") continue;

      const ke = urutanPakai.get(el.name) ?? 0;
      urutanPakai.set(el.name, ke + 1);

      const nilai = data.getAll(el.name)[ke];
      if (typeof nilai === "string" && el.value !== nilai) el.value = nilai;
    }
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
      {pemicu(() => {
        setCatatan(null);
        setTerbuka(true);
      })}

      {catatan && (
        <div
          role="status"
          style={{
            display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8,
            padding: "9px 12px", borderRadius: 9, background: "#e8f5ef",
            color: "var(--teal)", fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-line",
          }}
        >
          <span style={{ flex: 1 }}>{catatan}</span>
          <button
            type="button"
            onClick={() => setCatatan(null)}
            aria-label="Tutup pesan"
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
                    // Impor melaporkan satu baris per kesalahan; tanpa ini
                    // semuanya menyatu jadi satu paragraf yang sulit dibaca.
                    whiteSpace: "pre-line",
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
/**
 * Tombol hapus dua langkah.
 *
 * Aksinya mengembalikan `HasilAksi`, bukan void, supaya penolakan — "vendor ini
 * masih punya kontrak" — tampil sebagai pesan yang bisa dibaca alih-alih
 * halaman galat. Rambu pengaman yang menghasilkan galat 500 lebih buruk
 * daripada tidak ada rambu, karena pengguna tidak tahu apa yang terjadi.
 */
export function TombolHapus({
  aksi,
  id,
  nama,
}: {
  aksi: (sebelumnya: HasilAksi | null, form: FormData) => Promise<HasilAksi>;
  id: string;
  nama: string;
}) {
  const [siap, setSiap] = useState(false);
  const [hasil, kirim] = useActionState(aksi, null);

  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => setSiap(false), 4000);
    return () => clearTimeout(t);
  }, [siap]);

  // Setelah aksinya selesai — berhasil maupun ditolak — tombol kembali ke
  // keadaan semula supaya tidak menggantung di "Yakin?".
  useEffect(() => {
    if (hasil) setSiap(false);
  }, [hasil]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {siap ? (
        <form action={kirim} style={{ display: "inline" }}>
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
      ) : (
        <TombolIkon jenis="hapus" judul={`Hapus ${nama}`} onClick={() => setSiap(true)} />
      )}

      {hasil && !hasil.ok && (
        <span
          role="alert"
          style={{
            display: "inline-flex", alignItems: "flex-start", gap: 5, maxWidth: 320,
            padding: "5px 9px", borderRadius: 8, background: "#fbeae8",
            color: "var(--red)", fontSize: 11, lineHeight: 1.45, whiteSpace: "normal",
          }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {hasil.error}
        </span>
      )}
    </span>
  );
}
