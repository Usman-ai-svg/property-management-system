import { redirect } from "next/navigation";
import { ambilSession } from "@/lib/auth/session";
import { FormLogin } from "./form";

export default async function HalamanLogin() {
  if (await ambilSession()) redirect("/");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--ink)",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 9, background: "var(--brass)",
              display: "grid", placeItems: "center", color: "#12212e",
              fontWeight: 700, fontSize: 19, fontFamily: "var(--font-grotesk)",
            }}
          >
            N
          </div>
          <div>
            <div className="disp" style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
              NANOLAND
            </div>
            <div style={{ fontSize: 10.5, color: "#8fa6ae", letterSpacing: ".08em" }}>
              MANAGEMENT SYSTEM
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <FormLogin />
        </div>

        <p style={{ color: "#7d949c", fontSize: 11.5, marginTop: 16, lineHeight: 1.6 }}>
          Sistem internal. Akun dibuat oleh administrator — tidak ada pendaftaran mandiri.
        </p>
      </div>
    </div>
  );
}
