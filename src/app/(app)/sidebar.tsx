"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2, Calculator, ChevronDown, LayoutGrid, LogOut, Map, ShieldCheck, Wallet,
} from "lucide-react";
import type { ItemNav } from "@/lib/nav";
import { gantiPeran, logout } from "@/app/login/actions";

const IKON = { LayoutGrid, Building2, Wallet, Map, ShieldCheck, Calculator };

export function Sidebar({
  nav,
  nama,
  peranAktif,
  peran,
}: {
  nav: ItemNav[];
  nama: string;
  peranAktif: string;
  peran: string[];
}) {
  const path = usePathname();
  const [terbuka, setTerbuka] = useState<string[]>(["manpro"]);

  // Highlight menu dengan aturan "paling spesifik menang": di antara semua href
  // yang cocok dengan path saat ini, hanya yang TERPANJANG yang aktif. Tanpa ini,
  // href pendek seperti "/estimasi" ikut menyala di "/estimasi/pemasok".
  const cocok = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  const semuaHref = nav.flatMap((n) => [n.href, ...(n.anak?.map((a) => a.href) ?? [])]);
  const terbaik = semuaHref.filter(cocok).sort((a, b) => b.length - a.length)[0] ?? "";
  const aktif = (href: string) => href === terbaik;

  return (
    <aside className="side">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
        <div
          style={{
            width: 34, height: 34, borderRadius: 8, background: "var(--brass)",
            display: "grid", placeItems: "center",
          }}
        >
          <Building2 size={18} color="#12212e" />
        </div>
        <div>
          <div className="disp" style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
            NANOLAND
          </div>
          <div style={{ fontSize: 10.5, color: "#8fa6ae", letterSpacing: ".08em" }}>
            MANAGEMENT SYSTEM
          </div>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        {nav.map((n) => {
          const Ikon = IKON[n.ikon];
          const anak = n.anak ?? [];

          if (anak.length === 0) {
            return (
              <Link key={n.id} href={n.href} className={"navitem" + (aktif(n.href) ? " active" : "")}>
                <Ikon size={17} />
                {n.label}
              </Link>
            );
          }

          const adaAnakAktif = anak.some((c) => aktif(c.href));
          const buka = terbuka.includes(n.id) || adaAnakAktif;

          return (
            <div key={n.id}>
              <button
                type="button"
                className={"navitem" + (adaAnakAktif ? " parent-active" : "")}
                onClick={() =>
                  setTerbuka((b) => (b.includes(n.id) ? b.filter((x) => x !== n.id) : [...b, n.id]))
                }
                aria-expanded={buka}
              >
                <Ikon size={17} />
                {n.label}
                <ChevronDown
                  size={14}
                  style={{
                    marginLeft: "auto",
                    transform: buka ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform .15s",
                  }}
                />
              </button>
              {buka &&
                anak.map((c) => (
                  <Link
                    key={c.id}
                    href={c.href}
                    className={"navitem subitem" + (aktif(c.href) ? " active" : "")}
                  >
                    {c.label}
                  </Link>
                ))}
            </div>
          );
        })}
      </nav>

      <div style={{ marginTop: 16 }}>
        {peran.length > 1 && (
          <>
            <div
              style={{
                fontSize: 10.5, color: "#8fa6ae", letterSpacing: ".08em",
                marginBottom: 6, paddingLeft: 4,
              }}
            >
              PERAN AKTIF
            </div>
            <form action={gantiPeran}>
              <div style={{ position: "relative" }}>
                <select
                  className="roleSel"
                  name="peran"
                  defaultValue={peranAktif}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                >
                  {peran.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  style={{
                    position: "absolute", right: 10, top: 11,
                    pointerEvents: "none", color: "#8fa6ae",
                  }}
                />
              </div>
            </form>
          </>
        )}

        <div
          style={{
            marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.09)",
            display: "flex", alignItems: "center", gap: 9,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                color: "#fff", fontSize: 12.5, fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {nama}
            </div>
            <div
              style={{
                color: "#8fa6ae", fontSize: 10.5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {peranAktif}
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Keluar"
              aria-label="Keluar"
              style={{
                background: "none", border: "none", color: "#8fa6ae",
                cursor: "pointer", padding: 6, display: "grid", placeItems: "center",
              }}
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
