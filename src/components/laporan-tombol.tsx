"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Printer, X } from "lucide-react";

/**
 * Tombol "Laporan" yang membuka modal ringkas berisi seluruh progres proyek
 * (bahan meeting). Isi laporannya di-render di server dan diteruskan sebagai
 * `children`, jadi modal ini tak perlu tahu bentuk datanya.
 *
 * Untuk cetak/PDF yang rapi, modal menautkan ke halaman laporan tersendiri —
 * mencetak dari dalam modal ikut membawa seluruh kerangka aplikasi.
 */
export function TombolLaporan({
  kodeProyek,
  children,
}: {
  kodeProyek: string;
  children: React.ReactNode;
}) {
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => {
    if (!terbuka) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setTerbuka(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [terbuka]);

  return (
    <>
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="btn-garis"
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <FileText size={14} /> Laporan
      </button>

      {terbuka && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Laporan progres konstruksi"
          onClick={() => setTerbuka(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(18,33,46,.55)",
            display: "grid", placeItems: "start center", padding: 20, zIndex: 80, overflowY: "auto",
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 900, marginTop: 20 }}
          >
            <div
              style={{
                padding: "14px 20px", borderBottom: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                position: "sticky", top: 0, background: "var(--kartu, #fff)",
              }}
            >
              <div className="disp" style={{ fontWeight: 700, fontSize: 15 }}>Laporan Progres — Meeting</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  href={`/konstruksi/${kodeProyek}/laporan`}
                  target="_blank"
                  className="btn-garis"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                >
                  <Printer size={14} /> Cetak / PDF
                </Link>
                <button
                  type="button"
                  onClick={() => setTerbuka(false)}
                  aria-label="Tutup"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: 20 }}>{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
