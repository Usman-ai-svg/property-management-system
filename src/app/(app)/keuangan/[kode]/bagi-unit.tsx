"use client";

import { useActionState, useEffect, useState } from "react";
import { bagikanBiayaUnitRata } from "../actions";
import { rp } from "@/lib/format";

/**
 * Bagikan biaya level-proyek (unit) ke semua unit, rata sama besar.
 *
 * Aksinya menulis alokasi permanen dan tak bisa dibatalkan otomatis, jadi
 * diberi konfirmasi dua langkah seperti tombol hapus: klik pertama mengubah
 * tombol jadi "Yakin?", klik kedua baru mengirim. Konfirmasi batal sendiri
 * setelah 4 detik agar tidak menggantung.
 */
export function BagikanKeUnit({
  projectId,
  nilai,
  jumlahUnit,
}: {
  projectId: string;
  nilai: number;
  jumlahUnit: number;
}) {
  const [siap, setSiap] = useState(false);
  const [hasil, kirim] = useActionState(bagikanBiayaUnitRata, null);

  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => setSiap(false), 4000);
    return () => clearTimeout(t);
  }, [siap]);

  // Setelah aksinya selesai — berhasil maupun ditolak — kembali ke keadaan
  // semula supaya tombol tidak tertinggal di "Yakin?".
  useEffect(() => {
    if (hasil) setSiap(false);
  }, [hasil]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {siap ? (
        <form action={kirim} style={{ display: "inline" }}>
          <input type="hidden" name="projectId" value={projectId} />
          <button
            type="submit"
            style={{ ...gaya, background: "var(--amber)", color: "#fff", borderColor: "transparent" }}
          >
            Yakin? bagi {rp(nilai)} ke {jumlahUnit} unit — tak bisa dibatalkan
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSiap(true)}
          title="Bagi rata biaya ini ke semua unit; alokasi tersimpan permanen"
          style={gaya}
        >
          Bagikan rata ke unit
        </button>
      )}
      {hasil && !hasil.ok && (
        <span style={{ color: "var(--red)", fontSize: 11, fontWeight: 600 }}>{hasil.error}</span>
      )}
    </span>
  );
}

const gaya: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--line)",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 9px",
  cursor: "pointer",
  fontFamily: "inherit",
  color: "var(--teal)",
};
