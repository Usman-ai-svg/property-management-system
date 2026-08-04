import { redirect } from "next/navigation";
import { ambilPengguna, bolehLihat } from "@/lib/auth/rbac";
import { navUntuk } from "@/lib/nav";
import { Sidebar } from "./sidebar";
import { ToastProvider } from "@/components/toast";

export default async function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect("/login");

  // Menu disaring di server berdasarkan izin sesungguhnya. Halaman yang tidak
  // muncul di sini juga menolak akses langsung lewat URL — penyaringan menu
  // adalah kenyamanan, bukan pengamanan.
  const nav = navUntuk(pengguna.peranAktif, (s) => bolehLihat(pengguna, s));

  return (
    <div className="shell">
      <Sidebar
        nav={nav}
        nama={pengguna.nama}
        peranAktif={pengguna.peranAktif}
        peran={pengguna.peran}
      />
      <main className="main">
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}
