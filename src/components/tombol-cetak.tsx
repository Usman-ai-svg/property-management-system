"use client";

import { Printer } from "lucide-react";

/** Tombol cetak halaman lewat dialog cetak peramban (juga jalur "Simpan PDF"). */
export function TombolCetak({ label = "Cetak / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn"
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <Printer size={14} /> {label}
    </button>
  );
}
