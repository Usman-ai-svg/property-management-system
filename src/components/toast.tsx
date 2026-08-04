"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

/**
 * Notifikasi "toast" global — pop-up di kanan atas yang lepas dari halaman.
 *
 * Dipasang sekali di layout aplikasi sehingga statusnya bertahan meski konten
 * halaman di-render ulang oleh Server Action (revalidatePath hanya menyegarkan
 * segmen di dalam layout, bukan provider ini). Dengan begitu konfirmasi seperti
 * "Unit dibuat" tetap tampil walau tabelnya baru saja dimuat ulang.
 *
 * Nilai bawaan context-nya berupa no-op, jadi `useToast()` aman dipanggil dari
 * komponen yang kebetulan berada di luar provider — tidak melempar error.
 */

interface Toast {
  id: number;
  pesan: string;
}

const KonteksToast = createContext<{ tampil: (pesan: string) => void }>({ tampil: () => {} });

export const useToast = () => useContext(KonteksToast);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);

  const tutup = useCallback((id: number) => {
    setDaftar((l) => l.filter((t) => t.id !== id));
  }, []);

  const tampil = useCallback(
    (pesan: string) => {
      const id = Date.now() + Math.random();
      setDaftar((l) => [...l, { id, pesan }]);
      // Hilang sendiri setelah beberapa detik; bisa juga ditutup manual.
      setTimeout(() => tutup(id), 4500);
    },
    [tutup],
  );

  return (
    <KonteksToast.Provider value={{ tampil }}>
      {children}
      <div
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 100,
          display: "flex", flexDirection: "column", gap: 8,
          width: "min(360px, calc(100vw - 32px))", pointerEvents: "none",
        }}
      >
        {daftar.map((t) => (
          <div
            key={t.id}
            role="status"
            className="card"
            style={{
              display: "flex", alignItems: "flex-start", gap: 9,
              padding: "11px 13px", background: "var(--rona-hijau)", color: "var(--teal)",
              border: "1px solid var(--rona-hijau2)", borderRadius: 11,
              boxShadow: "0 8px 24px rgba(18,33,46,.18)", fontSize: 12.5, lineHeight: 1.5,
              whiteSpace: "pre-line", pointerEvents: "auto",
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1 }}>{t.pesan}</span>
            <button
              type="button"
              onClick={() => tutup(t.id)}
              aria-label="Tutup notifikasi"
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </KonteksToast.Provider>
  );
}
