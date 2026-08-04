"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Navigasi antar-objek: dropdown untuk melompat langsung + tombol
 * Sebelumnya/Berikutnya mengikuti urutan. Dipakai di Detail Progress Unit,
 * Detail Sarpras, dan opname objek Progress Vendor — semuanya berbagi pola
 * yang sama, hanya berbeda `basis` URL-nya.
 */
export function NavObjek({
  basis,
  sekarang,
  daftar,
  ariaLabel = "Pilih objek",
}: {
  /** Awalan URL, mis. "/konstruksi/NT4/unit". Tujuan = `${basis}/${kode}`. */
  basis: string;
  /** Kode/segmen objek yang sedang dibuka. */
  sekarang: string;
  daftar: { kode: string; label: string }[];
  ariaLabel?: string;
}) {
  const router = useRouter();
  const idx = daftar.findIndex((d) => d.kode === sekarang);
  const prev = idx > 0 ? daftar[idx - 1] : null;
  const next = idx >= 0 && idx < daftar.length - 1 ? daftar[idx + 1] : null;

  const buka = (kode: string) => router.push(`${basis}/${encodeURIComponent(kode)}`);

  const gaya = (aktif: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 3, padding: "6px 9px",
    border: "1px solid var(--line)", borderRadius: 8, background: "var(--kartu, #fff)",
    color: aktif ? "var(--text)" : "var(--muted)", fontSize: 12,
    cursor: aktif ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: aktif ? 1 : 0.5,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button type="button" style={gaya(!!prev)} disabled={!prev} onClick={() => prev && buka(prev.kode)}>
        <ChevronLeft size={14} /> Sebelumnya
      </button>

      <select
        className="inp"
        value={sekarang}
        onChange={(e) => buka(e.target.value)}
        aria-label={ariaLabel}
        style={{ fontSize: 12, padding: "6px 8px", maxWidth: 260 }}
      >
        {daftar.map((d) => (
          <option key={d.kode} value={d.kode}>{d.label}</option>
        ))}
      </select>

      <button type="button" style={gaya(!!next)} disabled={!next} onClick={() => next && buka(next.kode)}>
        Berikutnya <ChevronRight size={14} />
      </button>
    </div>
  );
}
