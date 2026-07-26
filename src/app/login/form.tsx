"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { login, type HasilLogin } from "./actions";

function TombolMasuk() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" style={{ width: "100%", marginTop: 18 }} disabled={pending}>
      {pending ? "Memeriksa…" : "Masuk"}
    </button>
  );
}

export function FormLogin() {
  const [hasil, aksi] = useActionState<HasilLogin, FormData>(login, {});

  return (
    <form action={aksi}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
        Email kantor
      </label>
      <input
        className="inp"
        type="email"
        name="email"
        autoComplete="username"
        placeholder="nama@nanoland.id"
        required
        autoFocus
      />

      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, marginTop: 14 }}>
        Kata sandi
      </label>
      <input className="inp" type="password" name="password" autoComplete="current-password" required />

      {hasil.error && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 14,
            padding: "9px 12px", borderRadius: 9, background: "var(--rona-merah)",
            color: "var(--red)", fontSize: 12.5, fontWeight: 500,
          }}
        >
          <AlertTriangle size={15} />
          {hasil.error}
        </div>
      )}

      <TombolMasuk />
    </form>
  );
}
