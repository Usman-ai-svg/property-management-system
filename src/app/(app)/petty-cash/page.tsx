import { redirect } from "next/navigation";
import { ambilPengguna, bolehLihat, bolehUbah } from "@/lib/auth/rbac";
import { Terbatas } from "@/components/ui";
import { pettyCashPengguna } from "@/lib/data/petty-cash";
import { PettyCash } from "../keuangan/[kode]/petty-cash";

/**
 * Menu Petty Cash tersendiri.
 *
 * Ada supaya Supervisor pemegang dana bisa mengelola dananya — catat
 * pengeluaran, ajukan laporan — tanpa perlu izin `keuangan` yang membuka angka
 * RAB/RAP & seluruh transaksi proyek. Peran pengawas keuangan (Finance/QS/Head
 * Ops) juga bisa memakainya sebagai pandangan petty cash lintas proyek. Beri
 * Dana tetap di halaman Keuangan Proyek (jalur Finance).
 */
export default async function PettyCashMenu() {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  if (!bolehLihat(pengguna, "pettyCash")) {
    return (
      <div style={{ padding: 24 }}>
        <Terbatas apa="Petty Cash" />
      </div>
    );
  }

  const grup = await pettyCashPengguna(pengguna);
  const konteks = {
    id: pengguna.id,
    peranAktif: pengguna.peranAktif,
    bolehKeuangan: bolehUbah(pengguna, "keuangan"),
    bolehPetty: bolehUbah(pengguna, "pettyCash"),
  };

  return (
    <div style={{ padding: 24 }}>
      <div className="eyebrow">Manajemen Proyek · Petty Cash</div>
      <h2 className="disp" style={{ margin: "4px 0 14px", fontSize: 20 }}>Petty Cash</h2>

      {grup.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
          Belum ada dana petty cash untuk Anda. Finance yang memberi dana lewat halaman Keuangan Proyek.
        </div>
      ) : (
        grup.map((g) => (
          <div key={g.project.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14, color: "var(--muted)" }}>
              {g.project.nama} · {g.project.kode}
            </div>
            <PettyCash projectId={g.project.id} funds={g.funds} kandidat={[]} konteks={konteks} />
          </div>
        ))
      )}
    </div>
  );
}
