import { Segera } from "@/components/segera";

export default function Admin() {
  return (
    <Segera
      judul="Admin"
      keterangan="Pengelolaan pengguna, peran, hak akses, dan log perubahan."
      tersedia={[
        "role_section_permissions — matriks hak akses tersimpan sebagai data, dapat diubah tanpa deploy",
        "audit_logs bersifat append-only, mencatat nilai sebelum dan sesudah perubahan",
        "user_project_access untuk membatasi pengguna pada proyek tertentu",
      ]}
    />
  );
}
