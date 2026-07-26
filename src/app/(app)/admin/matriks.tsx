"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { HasilAksi } from "@/lib/actions/guard";
import { ubahIzin, ubahStatusUser } from "./actions";

type Tingkat = "tidak" | "lihat" | "ubah";

const WARNA: Record<Tingkat, [string, string, string]> = {
  tidak: ["var(--rona-kosong)", "var(--redup)", "—"],
  lihat: ["var(--rona-teal2)", "var(--teal)", "Lihat"],
  ubah: ["var(--rona-hijau2)", "var(--green)", "Ubah"],
};

/**
 * Satu sel matriks hak akses.
 *
 * Diklik untuk memutar tingkat izin: tidak → lihat → ubah → tidak.
 * Perubahan langsung dikirim; penolakan dari server ditampilkan sebagai
 * pesan dan selnya kembali ke keadaan semula.
 */
export function SelIzin({
  roleId,
  section,
  tingkat,
  bolehUbah,
}: {
  roleId: string;
  section: string;
  tingkat: Tingkat;
  bolehUbah: boolean;
}) {
  const [hasil, kirim, menunggu] = useActionState(ubahIzin, null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (hasil && !hasil.ok) {
      setGalat(hasil.error);
      const t = setTimeout(() => setGalat(null), 6000);
      return () => clearTimeout(t);
    }
  }, [hasil]);

  const berikutnya: Record<Tingkat, Tingkat> = { tidak: "lihat", lihat: "ubah", ubah: "tidak" };
  const [bg, warna, label] = WARNA[tingkat];

  if (!bolehUbah) {
    return (
      <span className="chip" style={{ background: bg, color: warna }}>
        {label}
      </span>
    );
  }

  return (
    <form action={kirim} style={{ display: "inline" }}>
      <input type="hidden" name="roleId" value={roleId} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="tingkat" value={berikutnya[tingkat]} />
      <button
        type="submit"
        className="chip"
        disabled={menunggu}
        title={galat ?? `Klik untuk mengubah ke "${WARNA[berikutnya[tingkat]][2]}"`}
        style={{
          background: galat ? "var(--rona-merah)" : bg,
          color: galat ? "var(--red)" : warna,
          border: "none",
          cursor: menunggu ? "default" : "pointer",
          fontFamily: "inherit",
          opacity: menunggu ? 0.5 : 1,
        }}
      >
        {galat ? <AlertTriangle size={11} /> : null}
        {galat ? "ditolak" : label}
      </button>
    </form>
  );
}

export function TombolStatusUser({
  userId,
  aktif,
  bolehUbah,
}: {
  userId: string;
  aktif: boolean;
  bolehUbah: boolean;
}) {
  const [hasil, kirim, menunggu] = useActionState(ubahStatusUser, null);

  if (!bolehUbah) {
    return (
      <span
        className="chip"
        style={{
          background: aktif ? "var(--rona-hijau2)" : "var(--rona-abu)",
          color: aktif ? "var(--green)" : "var(--muted)",
        }}
      >
        {aktif ? "Aktif" : "Nonaktif"}
      </span>
    );
  }

  return (
    <form action={kirim} style={{ display: "inline" }}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="chip"
        disabled={menunggu}
        title={hasil && !hasil.ok ? hasil.error : aktif ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"}
        style={{
          background: hasil && !hasil.ok ? "var(--rona-merah)" : aktif ? "var(--rona-hijau2)" : "var(--rona-abu)",
          color: hasil && !hasil.ok ? "var(--red)" : aktif ? "var(--green)" : "var(--muted)",
          border: "none", cursor: menunggu ? "default" : "pointer",
          fontFamily: "inherit", opacity: menunggu ? 0.5 : 1,
        }}
      >
        {hasil && !hasil.ok ? "ditolak" : aktif ? "Aktif" : "Nonaktif"}
      </button>
    </form>
  );
}
