# Menyiapkan Google Drive untuk penyimpanan berkas

Drive **belum disiapkan**, dan aplikasi memang tidak menunggunya: tanpa satu pun
variabel Drive, berkas ditulis ke disk aplikasi dan semuanya jalan penuh —
unggah, unduh, hapus, ekspor. Ada tes yang menjaga itu tetap benar.

Dokumen ini untuk saat Drive mulai dipakai. Alasannya satu: berkas `.skp` pada
proyek ini berukuran **24–38 MB**. Ribuan berkas sebesar itu di disk aplikasi —
atau di object storage yang ditagih per GB — jadi mahal jauh lebih cepat
daripada seluruh sisa data proyek digabung. Drive menampungnya di kuota
organisasi yang memang sudah dibayar.

Sesudah selesai, jalankan `npm run cek:drive`. Skrip itu tidak cuma memeriksa
variabel: ia benar-benar mengambil token, mengunggah berkas kecil, membacanya
lagi, membandingkan isinya, lalu menghapusnya.

---

## Langkah

### 1. Buat project di Google Cloud

<https://console.cloud.google.com> → **New Project**. Namai apa saja yang
dikenali, misalnya `nanoland-erp-storage`.

### 2. Aktifkan Drive API

Di project itu: **APIs & Services → Library → Google Drive API → Enable**.

Kalau langkah ini terlewat, unggahan gagal dengan pesan yang menyebut API belum
diaktifkan — dan pesannya menyertakan tautan untuk mengaktifkannya.

### 3. Buat service account

**IAM & Admin → Service Accounts → Create Service Account**. Nama bebas, misalnya
`nanoland-storage`. Peran di level project **tidak perlu diisi** — aksesnya
nanti datang dari sharing folder, bukan dari IAM.

Masuk lewat service account, bukan OAuth pengguna, karena berkasnya milik
organisasi — bukan milik orang yang kebetulan mengunggahnya, dan tidak boleh
ikut hilang saat orang itu keluar dari perusahaan.

### 4. Unduh kunci JSON

Service account → tab **Keys → Add Key → Create new key → JSON**. Berkasnya
terunduh sekali dan tidak bisa diunduh ulang.

### 5. Ambil dua nilai dari JSON itu

```json
{
  "client_email": "nanoland-storage@....iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
}
```

- `client_email` → `GDRIVE_CLIENT_EMAIL`
- `private_key` → `GDRIVE_PRIVATE_KEY`

> Kunci privat memuat baris baru. Di berkas `.env`, tulis dalam satu baris
> dengan `\n` **literal** persis seperti di JSON-nya, dan bungkus dengan tanda
> kutip. Kunci yang terpotong saat disalin adalah kesalahan kedua tersering;
> `npm run cek:drive` mengenalinya dan menyebutkan penyebabnya.

### 6. Buat folder di Drive, bagikan ke service account

Buat folder di Drive Workspace Nanoland — **bukan** di Drive pribadi siapa pun.

Klik kanan folder → **Share** → tempelkan alamat `client_email` tadi → beri peran
**Editor** → Send.

> Ini kesalahan penyiapan yang **paling sering**, dan paling membingungkan.
> Tanpa langkah ini Drive menjawab 403 dengan pesan yang tidak menyebut sharing
> sama sekali. `npm run cek:drive` menangkap kasus ini dan menyebut langkahnya.

Jangan setel folder ini "siapa pun dengan tautan" — lihat bagian keamanan.

### 7. Ambil ID folder dari URL

```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv
                                        └──────── ID-nya ───────┘
```

→ `GDRIVE_FOLDER_ID`

### 8. Isi `.env`, lalu periksa

```bash
GDRIVE_CLIENT_EMAIL="nanoland-storage@....iam.gserviceaccount.com"
GDRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
GDRIVE_FOLDER_ID="1AbCdEfGhIjKlMnOpQrStUv"

# Baru setel ini SESUDAH cek:drive berhasil.
STORAGE_ENGINE="gdrive"
```

```bash
npm run cek:drive
```

Berkas lama yang telanjur di disk **tetap terbaca** setelah peralihan: routing
pembacaan mengikuti kunci berkasnya, bukan konfigurasi yang sedang aktif. Jadi
peralihannya tidak perlu sekali jalan, dan tidak ada dokumen lama yang jadi
tautan mati.

---

## Yang hilang, dan apa gantinya

Ini bagian yang tidak boleh disepakati diam-diam.

**Berkas yang isinya kita pegang** — disimpan lewat aplikasi, entah di disk atau
di Drive lewat service account — tetap melewati pemeriksaan penuh setiap kali
dibuka: sesi, izin sub-bagian, lalu akses proyek. Tidak ada yang berubah untuk
kelompok ini.

**Berkas yang cuma dicatat alamat Drive-nya** kehilangan lima hal sekaligus:
pemeriksaan izin per permintaan, bukti keaslian, penghapusan, ketahanan tautan,
dan jejak siapa membuka apa. Rinciannya beserta penggantinya ada di
[`berkas.md`](berkas.md) bagian 4 — baca sebelum memakai jalur itu.

Satu kalimat yang paling penting dari sana: **dengan tautan Drive, siapa pun
yang memegang tautan bisa membuka berkasnya**, sejauh sharing Drive
mengizinkan. Karena itu foldernya dibatasi ke Workspace Nanoland dan dibagikan
hanya ke service account — bukan disetel "siapa pun dengan tautan".

## Berkas apa yang tetap layak di object storage

| Kelas | Contoh | Tempatnya |
| --- | --- | --- |
| Berat | `.skp` 24–38 MB, `.dwg` | Drive |
| Ringan | foto progres, bukti transaksi, nota, PDF gambar kerja, spek | object storage yang kita kendalikan |

Alasannya bukan ukuran, melainkan tiga hal: yang ringan dibuka lewat halaman
setiap hari sehingga tiap pembukaan harus melewati pemeriksaan izin; isinya
sering menjadi bukti sehingga harus bisa dibuktikan tidak berubah; dan volumenya
kecil — seluruh berkas ringan digabung masih jauh di bawah satu berkas `.skp`.

Aturan berat/ringan ini ditegakkan kode, bukan kebiasaan: lihat
`periksaBerkasKategori` di `src/lib/storage/index.ts`.
