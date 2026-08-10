import { bersihkanNamaFile, periksaBerkas, simpanBerkas } from "@/lib/storage";

/**
 * Baca & simpan berkas bukti OPSIONAL dari sebuah formulir pengeluaran.
 *
 * Formulir mengirim berkasnya lewat kolom bernama `berkas`. Bila tak ada berkas
 * yang dipilih, kembalikan pasangan kosong — bukti memang tidak wajib. Bila ada,
 * berkasnya diperiksa (jenis, ukuran, nama) lalu disimpan; `bukti` menyimpan
 * nama aslinya untuk ditampilkan, `buktiKey` menyimpan kunci objek untuk diunduh.
 *
 * Dipakai bersama oleh Catat Pengeluaran (manual), pembayaran PO, dan pembayaran
 * kontrak vendor — satu pintu supaya aturan berkasnya tidak bercabang. Berada di
 * modul biasa (bukan berkas "use server") agar bisa diimpor lintas berkas aksi.
 */
export async function simpanBuktiOpsional(
  form: FormData,
): Promise<{ bukti: string | null; buktiKey: string | null }> {
  const berkas = form.get("berkas");
  if (!(berkas instanceof File) || berkas.size === 0) {
    return { bukti: null, buktiKey: null };
  }

  const nama = bersihkanNamaFile(berkas.name);
  periksaBerkas(nama, berkas.type, berkas.size);
  const { objectKey } = await simpanBerkas(await berkas.arrayBuffer(), nama);
  return { bukti: nama, buktiKey: objectKey };
}
