/**
 * Data demo, dipindahkan apa adanya dari artifact `NanolandManagementSystem.jsx`.
 *
 * Dipisah dari seed.ts supaya logika penyemaian tidak tenggelam di antara data.
 * Semua nilai di sini fiktif dan hanya untuk peragaan.
 */

export const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "12 Feb 2023" → Date. Mengembalikan null untuk "—" atau string kosong. */
export function tgl(s: string | null | undefined): Date | null {
  if (!s || s === "—") return null;
  const m = s.trim().match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (!m) return null;
  const bulan = BULAN_ID.indexOf(m[2]);
  if (bulan < 0) return null;
  return new Date(Date.UTC(Number(m[3]), bulan, Number(m[1])));
}

/** "21/09/24" → Date */
export function tglPendek(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(2000 + y, m - 1, d));
}

// ---------------------------------------------------------------------------
// PERAN & HAK AKSES
// ---------------------------------------------------------------------------

export const ROLE_GRUP: Record<string, string> = {
  Komisaris: "lead", BOD: "lead",
  "Head Operation Office": "ops", "Head Operation Project": "ops",
  "Project Manager": "ops", Supervisor: "ops",
  "Business Development": "biz",
  Arsitek: "tech", "Quantity Surveyor": "tech", Procurement: "tech",
  "Customer Care": "cc",
  "Consultant Finance": "fin", Finance: "fin", Admin: "fin",
  HRD: "hr",
  "Head Marketing & Sales": "mkt", "Agent Coordinator": "mkt", Sales: "mkt",
  "Head Content & Media": "media", Editor: "media",
};

export const SEMUA_PERAN = Object.keys(ROLE_GRUP);

/** Matriks hak akses awal — sama dengan DEFAULT_ACL pada artifact. */
export const ACL_AWAL: Record<string, string[]> = {
  deskripsi: SEMUA_PERAN,
  daftarUnit: SEMUA_PERAN,
  daftarSarpras: SEMUA_PERAN,
  dokumenTeknis: SEMUA_PERAN,
  hargaRabRap: ["Komisaris", "BOD", "Business Development", "Head Operation Office", "Head Operation Project", "Project Manager", "Quantity Surveyor", "Procurement", "Admin", "Finance", "Consultant Finance"],
  businessPlan: ["Komisaris", "BOD", "Business Development"],
  keuangan: ["BOD", "Business Development", "Head Operation Office", "Head Operation Project", "Project Manager", "Quantity Surveyor", "Admin", "Finance", "Consultant Finance"],
  progress: ["BOD", "Head Operation Project", "Project Manager", "Supervisor", "Quantity Surveyor", "Arsitek", "Procurement"],
};

/** Peran yang boleh MENGUBAH (bukan sekadar melihat) tiap sub-bagian. */
export const ACL_UBAH: Record<string, string[]> = {
  deskripsi: ["BOD", "Business Development", "Head Operation Office"],
  daftarUnit: ["BOD", "Head Operation Office", "Head Operation Project", "Project Manager"],
  daftarSarpras: ["BOD", "Head Operation Office", "Head Operation Project", "Project Manager"],
  dokumenTeknis: ["Arsitek", "Head Operation Project", "Project Manager"],
  hargaRabRap: ["Quantity Surveyor", "Head Operation Office", "BOD"],
  businessPlan: ["BOD", "Business Development"],
  keuangan: ["Finance", "Admin", "Head Operation Office", "BOD"],
  progress: ["Project Manager", "Supervisor", "Head Operation Project"],
};

export const USERS = [
  { nama: "Andra Wijaya", inisial: "AW", peran: ["Business Development"], semua: true, proyek: [] },
  { nama: "H. Nugroho", inisial: "HN", peran: ["Komisaris", "BOD"], semua: true, proyek: [] },
  { nama: "Rina Safitri", inisial: "RS", peran: ["Head Operation Office", "Admin"], semua: true, proyek: [] },
  { nama: "Hendra Kurnia", inisial: "HK", peran: ["Head Operation Project", "Project Manager"], semua: false, proyek: ["NT4", "GN2"] },
  { nama: "Agus Pratama", inisial: "AP", peran: ["Supervisor"], semua: false, proyek: ["NT4", "GN2"] },
  { nama: "Fajar Ramadhan", inisial: "FR", peran: ["Arsitek"], semua: true, proyek: [] },
  { nama: "Sari Kusuma", inisial: "SK", peran: ["Quantity Surveyor"], semua: false, proyek: ["GN2"] },
  { nama: "Budi Hartono", inisial: "BH", peran: ["Quantity Surveyor", "Procurement"], semua: false, proyek: ["NT4", "NT2"] },
  { nama: "Dewi Anggraini", inisial: "DA", peran: ["Quantity Surveyor"], semua: false, proyek: [] },
  { nama: "Maya Larasati", inisial: "ML", peran: ["Customer Care"], semua: false, proyek: ["NT2"] },
  { nama: "Sinta Dewi", inisial: "SD", peran: ["Consultant Finance", "Finance"], semua: true, proyek: [] },
  { nama: "Bayu Aditya", inisial: "BA", peran: ["HRD"], semua: true, proyek: [] },
  { nama: "Rudi Hartawan", inisial: "RH", peran: ["Head Marketing & Sales"], semua: true, proyek: [] },
  { nama: "Lina Marlina", inisial: "LM", peran: ["Agent Coordinator", "Sales"], semua: true, proyek: [] },
  { nama: "Doni Saputra", inisial: "DS", peran: ["Sales"], semua: true, proyek: [] },
  { nama: "Rani Puspita", inisial: "RP", peran: ["Head Content & Media", "Editor"], semua: true, proyek: [] },
];

// ---------------------------------------------------------------------------
// PROYEK
// ---------------------------------------------------------------------------

export const PROYEK = [
  {
    kode: "NT2", nama: "Nano Town 2", status: "Selesai", statusLahan: "Selesai Terbangun",
    fases: { F1: 4, F2: 8 },
    lokasi: { alamat: "Jl. Raya Bojongsari No. 21", kelurahan: "Bojongsari Baru", kecamatan: "Bojongsari", kota: "Kota Depok", provinsi: "Jawa Barat", lat: -6.4021, lng: 106.7532 },
    luas: { kavlingEfektif: 7800, sarana: 620, prasarana: 1450, rth: 780 },
    biaya: { hargaPerM2: 98000, pembelian: 1043300000, notaris: 26000000, balikNama: 21000000, legalLain: 15700000 },
    analisa: { file: "Analisa-Lahan-NT2.pdf", size: "2,1 MB", tgl: "18 Nov 2022" },
    legalitas: [
      { nib: "8120003344215", sertifikat: "SHM No. 412 — Induk, pemecahan selesai 8 unit", luas: 5200, dok: { file: "NT2-SHM-412.pdf", size: "3,1 MB", tgl: "14 Okt 2022" } },
      { nib: "8120003344216", sertifikat: "SHM No. 413 — Induk, pemecahan selesai 4 unit", luas: 3450, dok: { file: "NT2-SHM-413.pdf", size: "2,8 MB", tgl: "14 Okt 2022" } },
    ],
    market: [
      { nama: "Bojongsari Green", jarak: 1.3, tipe: [{ tipe: "Tipe 36", jml: 68, luasUnit: 36, luasLahan: 60, harga: 745000000 }, { tipe: "Tipe 45", jml: 34, luasUnit: 45, luasLahan: 72, harga: 940000000 }] },
      { nama: "Permata Sawangan", jarak: 3.4, tipe: [{ tipe: "Standard", jml: 52, luasUnit: 40, luasLahan: 66, harga: 820000000 }] },
    ],
    bplan: {
      hpp: [{ nama: "Perolehan Tanah", v: 1106000000 }, { nama: "Perijinan & Legalitas", v: 780000000 }, { nama: "Prasarana & Sarana", v: 481000000 }, { nama: "Konstruksi Rumah", v: 4920000000 }],
      omzet: [{ tipe: "Tipe 36", jml: 7, harga: 780000000 }, { tipe: "Tipe 45", jml: 5, harga: 985000000 }],
      operasional: [{ nama: "Pemasaran", v: 522250000 }, { nama: "Umum & Administrasi", v: 334240000 }, { nama: "Bunga & Pajak", v: 490910000 }],
      cashflow: [{ periode: "2023 Q1", masuk: 1200000000, keluar: 2600000000 }, { periode: "2023 Q2", masuk: 2800000000, keluar: 2900000000 }, { periode: "2023 Q3", masuk: 3400000000, keluar: 1800000000 }, { periode: "2023 Q4", masuk: 3045000000, keluar: 900000000 }],
    },
  },
  {
    kode: "NT4", nama: "Nano Town 4", status: "Dalam Pembangunan", statusLahan: "Pembangunan",
    fases: { F1: 11, F2: 11, F3: 13, F4: 16 },
    lokasi: { alamat: "Jl. Raya Tapos No. 104", kelurahan: "Sukatani", kecamatan: "Tapos", kota: "Kota Depok", provinsi: "Jawa Barat", lat: -6.4185, lng: 106.8471 },
    luas: { kavlingEfektif: 24500, sarana: 2100, prasarana: 4600, rth: 2800 },
    biaya: { hargaPerM2: 165000, pembelian: 5610000000, notaris: 62000000, balikNama: 48000000, legalLain: 35000000 },
    analisa: { file: "Analisa-Lahan-NT4.pdf", size: "3,8 MB", tgl: "22 Okt 2024" },
    legalitas: [
      { nib: "8120006677230", sertifikat: "SHGB No. 118 — Induk, proses pemecahan per kavling", luas: 14200, dok: { file: "NT4-SHGB-118.pdf", size: "4,6 MB", tgl: "08 Sep 2024" } },
      { nib: "8120006677231", sertifikat: "SHGB No. 119 — Induk, proses pemecahan per kavling", luas: 11800, dok: { file: "NT4-SHGB-119.pdf", size: "4,2 MB", tgl: "08 Sep 2024" } },
      { nib: "8120006677232", sertifikat: "SHM No. 87 — proses balik nama", luas: 8000, dok: null },
    ],
    market: [
      { nama: "Tapos Residence", jarak: 1.6, tipe: [{ tipe: "Tipe 45", jml: 96, luasUnit: 45, luasLahan: 72, harga: 1080000000 }, { tipe: "Tipe 60", jml: 44, luasUnit: 60, luasLahan: 90, harga: 1520000000 }] },
      { nama: "Grand Cimanggis Estate", jarak: 2.9, tipe: [{ tipe: "Standard", jml: 120, luasUnit: 50, luasLahan: 78, harga: 1240000000 }, { tipe: "Premium 2 Lt", jml: 36, luasUnit: 96, luasLahan: 120, harga: 2180000000 }] },
      { nama: "Bukit Sukatani", jarak: 4.5, tipe: [{ tipe: "Tipe 36", jml: 88, luasUnit: 36, luasLahan: 60, harga: 865000000 }] },
    ],
    bplan: {
      hpp: [{ nama: "Perolehan Tanah", v: 5755000000 }, { nama: "Pengolahan Lahan", v: 1850000000 }, { nama: "Perijinan & Legalitas", v: 3200000000 }, { nama: "Prasarana & Sarana", v: 4305000000 }, { nama: "Konstruksi Rumah", v: 22400000000 }, { nama: "Marketing Gallery", v: 620000000 }],
      omzet: [{ tipe: "Newton", jml: 17, harga: 1250000000 }, { tipe: "Tesla", jml: 17, harga: 1480000000 }, { tipe: "Galileo", jml: 17, harga: 1780000000 }],
      operasional: [{ nama: "Pemasaran", v: 3928500000 }, { nama: "Umum & Administrasi", v: 2514240000 }, { nama: "Bunga & Pajak", v: 3692790000 }],
      cashflow: [{ periode: "2025 Q1", masuk: 4000000000, keluar: 9500000000 }, { periode: "2025 Q2", masuk: 9800000000, keluar: 11200000000 }, { periode: "2025 Q3", masuk: 14500000000, keluar: 10800000000 }, { periode: "2025 Q4", masuk: 18200000000, keluar: 7400000000 }, { periode: "2026 Q1", masuk: 32010000000, keluar: 4200000000 }],
    },
  },
  {
    kode: "GN2", nama: "Griya Nanotech 2", status: "Dalam Pembangunan", statusLahan: "Pembangunan",
    fases: { F1: 15 },
    lokasi: { alamat: "Jl. Raya Karadenan No. 12", kelurahan: "Karadenan", kecamatan: "Cibinong", kota: "Kab. Bogor", provinsi: "Jawa Barat", lat: -6.4692, lng: 106.8281 },
    luas: { kavlingEfektif: 9000, sarana: 700, prasarana: 1800, rth: 900 },
    biaya: { hargaPerM2: 115000, pembelian: 1426000000, notaris: 30000000, balikNama: 25000000, legalLain: 19000000 },
    analisa: { file: "Analisa-Lahan-GN2.pdf", size: "2,6 MB", tgl: "04 Sep 2024" },
    legalitas: [
      { nib: "8120009982114", sertifikat: "SHM No. 271 — Induk, pemecahan selesai 15 unit", luas: 12400, dok: { file: "GN2-SHM-271.pdf", size: "3,4 MB", tgl: "22 Jul 2024" } },
    ],
    market: [
      { nama: "Cibinong Green Park", jarak: 1.1, tipe: [{ tipe: "Tipe 36", jml: 72, luasUnit: 36, luasLahan: 60, harga: 780000000 }, { tipe: "Tipe 45", jml: 40, luasUnit: 45, luasLahan: 72, harga: 985000000 }] },
      { nama: "Permata Cibinong", jarak: 2.3, tipe: [{ tipe: "Tipe 42", jml: 56, luasUnit: 42, luasLahan: 66, harga: 890000000 }, { tipe: "Tipe 54", jml: 28, luasUnit: 54, luasLahan: 84, harga: 1150000000 }] },
      { nama: "Karadenan Residence", jarak: 3.9, tipe: [{ tipe: "Standard", jml: 48, luasUnit: 40, luasLahan: 65, harga: 845000000 }] },
    ],
    bplan: {
      hpp: [{ nama: "Perolehan Tanah", v: 1500000000 }, { nama: "Perijinan & Legalitas", v: 1100000000 }, { nama: "Prasarana & Sarana", v: 1600000000 }, { nama: "Konstruksi Rumah", v: 6070000000 }],
      omzet: [{ tipe: "Tipe F1", jml: 10, harga: 950000000 }, { tipe: "Tipe F2", jml: 5, harga: 1150000000 }],
      operasional: [{ nama: "Pemasaran", v: 695000000 }, { nama: "Umum & Administrasi", v: 444800000 }, { nama: "Bunga & Pajak", v: 653300000 }],
      cashflow: [{ periode: "2025 Q3", masuk: 2000000000, keluar: 3500000000 }, { periode: "2025 Q4", masuk: 4500000000, keluar: 4000000000 }, { periode: "2026 Q1", masuk: 7400000000, keluar: 2400000000 }],
    },
  },
];

// ---------------------------------------------------------------------------
// TIPE UNIT
// ---------------------------------------------------------------------------

export const TIPE_UNIT: Record<string, {
  kode: string; nama: string; lb: number; lt: number;
  docs: { model3d?: Dok | null; gambarKerja?: Dok | null; render?: Dok | null; spek?: Dok | null };
}[]> = {
  NT2: [
    { kode: "T36", nama: "Tipe 36", lb: 36, lt: 60, docs: { model3d: { file: "NT2-T36-3D.skp", size: "24,5 MB", tgl: "12 Feb 2023" }, gambarKerja: { file: "NT2-T36-GambarKerja.pdf", size: "8,2 MB", tgl: "12 Feb 2023" }, render: { file: "NT2-T36-Render.jpg", size: "6,1 MB", tgl: "20 Feb 2023" }, spek: { file: "NT2-T36-SpekMaterial.pdf", size: "1,4 MB", tgl: "20 Feb 2023" } } },
    { kode: "T45", nama: "Tipe 45", lb: 45, lt: 72, docs: { model3d: { file: "NT2-T45-3D.skp", size: "27,8 MB", tgl: "12 Feb 2023" }, gambarKerja: { file: "NT2-T45-GambarKerja.pdf", size: "9,0 MB", tgl: "12 Feb 2023" }, render: { file: "NT2-T45-Render.jpg", size: "6,8 MB", tgl: "20 Feb 2023" }, spek: { file: "NT2-T45-SpekMaterial.pdf", size: "1,5 MB", tgl: "20 Feb 2023" } } },
  ],
  NT4: [
    { kode: "NWT", nama: "Newton", lb: 50, lt: 78, docs: { model3d: { file: "NT4-Newton-3D.skp", size: "31,2 MB", tgl: "05 Jan 2025" }, gambarKerja: { file: "NT4-Newton-GambarKerja.pdf", size: "11,4 MB", tgl: "05 Jan 2025" }, render: { file: "NT4-Newton-Render.jpg", size: "7,3 MB", tgl: "18 Jan 2025" }, spek: { file: "NT4-Newton-SpekMaterial.pdf", size: "1,8 MB", tgl: "18 Jan 2025" } } },
    { kode: "TSL", nama: "Tesla", lb: 60, lt: 90, docs: { model3d: { file: "NT4-Tesla-3D.skp", size: "34,6 MB", tgl: "05 Jan 2025" }, gambarKerja: { file: "NT4-Tesla-GambarKerja.pdf", size: "12,8 MB", tgl: "05 Jan 2025" }, render: { file: "NT4-Tesla-Render.jpg", size: "7,9 MB", tgl: "18 Jan 2025" }, spek: null } },
    { kode: "GLL", nama: "Galileo", lb: 72, lt: 105, docs: { model3d: { file: "NT4-Galileo-3D.skp", size: "38,1 MB", tgl: "22 Feb 2025" }, gambarKerja: { file: "NT4-Galileo-GambarKerja.pdf", size: "13,5 MB", tgl: "22 Feb 2025" }, render: null, spek: null } },
  ],
  GN2: [
    { kode: "F1", nama: "Tipe F1", lb: 36, lt: 45, docs: { model3d: { file: "GN2-F1-3D.skp", size: "22,0 MB", tgl: "10 Agu 2024" }, gambarKerja: { file: "GN2-F1-GambarKerja.pdf", size: "7,6 MB", tgl: "10 Agu 2024" }, render: { file: "GN2-F1-Render.jpg", size: "5,4 MB", tgl: "28 Agu 2024" }, spek: { file: "GN2-F1-SpekMaterial.pdf", size: "1,2 MB", tgl: "28 Agu 2024" } } },
    { kode: "F2", nama: "Tipe F2", lb: 45, lt: 54, docs: { model3d: { file: "GN2-F2-3D.skp", size: "25,3 MB", tgl: "10 Agu 2024" }, gambarKerja: { file: "GN2-F2-GambarKerja.pdf", size: "8,4 MB", tgl: "10 Agu 2024" }, render: { file: "GN2-F2-Render.jpg", size: "5,9 MB", tgl: "28 Agu 2024" }, spek: { file: "GN2-F2-SpekMaterial.pdf", size: "1,3 MB", tgl: "28 Agu 2024" } } },
  ],
};

export interface Dok { file: string; size: string; tgl: string }

// ---------------------------------------------------------------------------
// KERJA TAMBAH (unit custom)
// ---------------------------------------------------------------------------

export const KERJA_TAMBAH: Record<string, {
  judul: string;
  docs: { desain?: Dok | null; model3d?: Dok | null; gambarKerja?: Dok | null };
  boq: { uraian: string; sat: string; vol: number; harga: number; spek: string }[];
  rap: { upah: number; groups: { nama: string; items: { nama: string; sat: string; vol: number; harga: number; ket?: string }[] }[] } | null;
}> = {
  "NT4-F2-3": {
    judul: "Kerja Tambah Opsi 1 — kanopi, railing & finishing",
    docs: { desain: { file: "NT4-F2-3-Desain-Disetujui.pdf", size: "3,4 MB", tgl: "10 Mei 2026" }, model3d: { file: "NT4-F2-3-KerjaTambah-3D.skp", size: "12,8 MB", tgl: "12 Mei 2026" }, gambarKerja: { file: "NT4-F2-3-KerjaTambah-R3.pdf", size: "2,1 MB", tgl: "14 Mei 2026" } },
    boq: [
      { uraian: "Pek. Struktur & dinding tambahan", sat: "ls", vol: 1, harga: 8850000, spek: "Bata ringan hebel 10, sloof praktis besi D12, plester aci" },
      { uraian: "Pek. Plafon & atap tambahan", sat: "ls", vol: 1, harga: 6420000, spek: "Gypsum 9 mm rangka hollow, baja ringan 0,75 + metal pasir" },
      { uraian: "Pek. Lantai & pengecatan", sat: "ls", vol: 1, harga: 7280000, spek: "Keramik 60x60 Valentino gress cream ivory, cat Mowilex" },
      { uraian: "Pek. MEP tambahan", sat: "ls", vol: 1, harga: 4180000, spek: "Kabel NYM 3x2,5, titik lampu & stopkontak Panasonic, pipa Rucika" },
      { uraian: "Pek. Kanopi, railing & pintu", sat: "ls", vol: 1, harga: 9720000, spek: "Kanopi baja ringan + solar tuff, railing tangga, pintu besi samping" },
    ],
    rap: {
      upah: 14700000,
      groups: [
        { nama: "Material Alam", items: [
          { nama: "Pasir", sat: "colt", vol: 2, harga: 400000 }, { nama: "Split", sat: "colt", vol: 1, harga: 500000 },
          { nama: "Bata ringan (hebel 10)", sat: "m3", vol: 2, harga: 550000 }, { nama: "Semen", sat: "sak", vol: 21, harga: 46000 },
          { nama: "Lem Hebel", sat: "sak", vol: 3, harga: 65000 }, { nama: "Semen acian", sat: "sak", vol: 6, harga: 75000 }] },
        { nama: "Bekisting", items: [
          { nama: "Kaso 4/6", sat: "ikat", vol: 2, harga: 175000 }, { nama: "Triplek 9mm", sat: "lbr", vol: 6, harga: 105000 },
          { nama: "Paku 5, 7, 10", sat: "dus", vol: 1, harga: 385000 }] },
        { nama: "Material Besi", items: [
          { nama: "Besi 6 mm - full", sat: "btg", vol: 41, harga: 35000 }, { nama: "Besi 8 mm - full", sat: "btg", vol: 2, harga: 50000 },
          { nama: "Besi 12 mm - full", sat: "btg", vol: 6, harga: 105000 }, { nama: "Kawat beton @25kg", sat: "roll", vol: 0.5, harga: 350000 },
          { nama: "Kawat ayam", sat: "roll", vol: 1, harga: 60000 }] },
        { nama: "Finishing Lantai", items: [
          { nama: "Keramik 60x60", sat: "dus", vol: 12, harga: 142500, ket: "Valentino gress cream ivory" },
          { nama: "Keramik 60x60 kamar mandi", sat: "dus", vol: 1, harga: 160000 }] },
        { nama: "Cat", items: [
          { nama: "Sealer (Avitex)", sat: "peil", vol: 1, harga: 650000 }, { nama: "Cat interior (Mowilex cendana silky white)", sat: "gln", vol: 2, harga: 500000 },
          { nama: "Cat exterior (Mowilex weathercoat)", sat: "gln", vol: 1, harga: 1050000 }, { nama: "Cat aquaproof (RJ London roof sealer)", sat: "peil", vol: 1, harga: 850000 },
          { nama: "Amplas", sat: "m", vol: 15, harga: 10000 }, { nama: "Plamir (Nippon matex 4kg)", sat: "gln", vol: 1, harga: 75000 },
          { nama: "Cat plafon (Avitex interior)", sat: "gln", vol: 1, harga: 350000 }] },
        { nama: "Plumbing", items: [
          { nama: 'Pipa 3" D ex Rucika', sat: "btg", vol: 3, harga: 110000 }, { nama: 'Knee 3" D', sat: "pcs", vol: 9, harga: 20000 },
          { nama: 'Pipa 2 1/2" D ex Rucika', sat: "btg", vol: 2, harga: 90000 }, { nama: "Lem PVC", sat: "klg", vol: 1, harga: 65000 },
          { nama: 'Pipa 1" AW', sat: "btg", vol: 5, harga: 47000 }, { nama: 'Pipa 1/2" AW', sat: "btg", vol: 3, harga: 27000 },
          { nama: "Closet jongkok", sat: "bh", vol: 1, harga: 350000 }, { nama: "Kran", sat: "bh", vol: 1, harga: 80000 },
          { nama: "Floordrain", sat: "bh", vol: 2, harga: 90000 }, { nama: "Aksesoris pipa", sat: "ls", vol: 1, harga: 500000 }] },
        { nama: "Alat Listrik", items: [
          { nama: "Pipa listrik", sat: "btg", vol: 10, harga: 18000 }, { nama: "Kabel NYM 3x2,5", sat: "roll", vol: 0.6, harga: 1095000 },
          { nama: "Saklar single Panasonic oval", sat: "bh", vol: 1, harga: 25000 }, { nama: "Saklar seri Panasonic oval", sat: "bh", vol: 1, harga: 30000 },
          { nama: "Stopkontak Panasonic oval", sat: "bh", vol: 5, harga: 25000 }, { nama: "Downlight outbow", sat: "bh", vol: 1, harga: 65000 },
          { nama: 'Downlight 4"', sat: "bh", vol: 2, harga: 70000 }, { nama: "Lampu LED Philips 6 watt", sat: "bh", vol: 2, harga: 30000 },
          { nama: "Inbowdus", sat: "bh", vol: 7, harga: 5000 }, { nama: "Stopkontak outdoor", sat: "bh", vol: 1, harga: 60000 }] },
        { nama: "Pek. Plafon", items: [
          { nama: "Skrup gypsum", sat: "dus", vol: 0.49, harga: 100000 }, { nama: "Gypsum", sat: "lembar", vol: 4, harga: 68000 },
          { nama: "Hollow 4x4", sat: "btg", vol: 14.84, harga: 32500 }, { nama: "Hollow 2x4", sat: "btg", vol: 10, harga: 27000 },
          { nama: "Kompon", sat: "sak", vol: 2, harga: 65000 }] },
        { nama: "Pek. Atap", items: [
          { nama: "Baja ringan 0,75", sat: "btg", vol: 1.87, harga: 95000 }, { nama: "Skrup baja", sat: "dus", vol: 0.06, harga: 300000 },
          { nama: "Reng baja", sat: "btg", vol: 2.24, harga: 50000 }, { nama: "Alumunium foil", sat: "roll", vol: 0.5, harga: 400000 },
          { nama: "Penutup atap metal pasir", sat: "lbr", vol: 5, harga: 45000 }, { nama: "Roofing 10 x 19", sat: "dus", vol: 0.5, harga: 110000 },
          { nama: "Roofing 12 x 70", sat: "dus", vol: 0.5, harga: 110000 }] },
        { nama: "Material Lain", items: [
          { nama: "Pintu & jendela aluminium", sat: "unit", vol: 1, harga: 3500000 }, { nama: "Pintu besi samping", sat: "unit", vol: 1, harga: 2000000 },
          { nama: "Sika top 107", sat: "set", vol: 1, harga: 400000 }, { nama: "Railing tangga", sat: "m", vol: 1.2, harga: 775000 },
          { nama: "Kanopi - baja ringan", sat: "btg", vol: 2, harga: 95000 }, { nama: "Kanopi - solar tuff", sat: "m2", vol: 3, harga: 200000 },
          { nama: "Kanopi - aksesoris", sat: "ls", vol: 1, harga: 500000 }, { nama: "Paranet", sat: "m2", vol: 4.3, harga: 9533 },
          { nama: "Kerikil", sat: "m3", vol: 0.26, harga: 300000 }] },
      ],
    },
  },
  "NT4-F3-7": {
    judul: "Perluasan ruang keluarga 12 m²",
    docs: { desain: { file: "NT4-F3-7-Desain-Disetujui.pdf", size: "2,9 MB", tgl: "28 Mei 2026" }, model3d: null, gambarKerja: { file: "NT4-F3-7-KerjaTambah.pdf", size: "2,6 MB", tgl: "02 Jun 2026" } },
    boq: [
      { uraian: "Pek. Struktur & dinding perluasan", sat: "m2", vol: 12, harga: 1850000, spek: "Sloof & kolom praktis besi D12, bata ringan hebel 10, plester aci" },
      { uraian: "Pek. Atap perluasan", sat: "m2", vol: 14, harga: 385000, spek: "Baja ringan 0,75 mm + penutup metal pasir" },
    ],
    rap: null,
  },
  "GN2-F1-2": {
    judul: "Perluasan dapur & taman belakang",
    docs: { desain: { file: "GN2-F1-2-Desain-Disetujui.pdf", size: "2,2 MB", tgl: "15 Apr 2026" }, model3d: null, gambarKerja: { file: "GN2-F1-2-KerjaTambah.pdf", size: "1,8 MB", tgl: "20 Apr 2026" } },
    boq: [
      { uraian: "Pek. Perluasan dapur", sat: "m2", vol: 8, harga: 1650000, spek: "Dinding hebel, keramik dinding 30x60, meja beton finishing granit" },
      { uraian: "Pek. Taman & paving belakang", sat: "m2", vol: 15, harga: 320000, spek: "Paving block K-300, kerikil sikat, paranet" },
    ],
    rap: null,
  },
  "NT2-F2-5": {
    judul: "Carport tambahan",
    docs: { desain: null, model3d: null, gambarKerja: { file: "NT2-F2-5-KerjaTambah.pdf", size: "1,1 MB", tgl: "08 Nov 2023" } },
    boq: [{ uraian: "Pek. Carport beton + kanopi", sat: "m2", vol: 15, harga: 520000, spek: "Beton K-225 t-10 cm, kanopi baja ringan + solar tuff" }],
    rap: null,
  },
};

// ---------------------------------------------------------------------------
// SARANA & PRASARANA
// ---------------------------------------------------------------------------

export const SARPRAS: Record<string, {
  id: string; nama: string; jenis: string; vol: string; status: string; progress: number; rab: number;
  docs: { model3d?: Dok | null; gambarKerja?: Dok | null };
}[]> = {
  NT2: [
    { id: "NT2-S1", progress: 100, nama: "Jalan Lingkungan", jenis: "Prasarana", vol: "820 m²", status: "Selesai", rab: 385000000, docs: { model3d: null, gambarKerja: { file: "NT2-Jalan-GambarKerja.pdf", size: "3,2 MB", tgl: "05 Mar 2023" } } },
    { id: "NT2-S2", progress: 100, nama: "Taman & RTH", jenis: "Sarana", vol: "310 m²", status: "Selesai", rab: 96000000, docs: { model3d: null, gambarKerja: { file: "NT2-Taman-Layout.pdf", size: "1,6 MB", tgl: "18 Mar 2023" } } },
  ],
  NT4: [
    { id: "NT4-S1", progress: 72, nama: "Jalan Lingkungan", jenis: "Prasarana", vol: "3.400 m²", status: "Progress", rab: 1620000000, docs: { model3d: { file: "NT4-Jalan-3D.skp", size: "12,4 MB", tgl: "10 Jan 2025" }, gambarKerja: { file: "NT4-Jalan-GambarKerja.pdf", size: "5,8 MB", tgl: "10 Jan 2025" } } },
    { id: "NT4-S2", progress: 58, nama: "Saluran Drainase", jenis: "Prasarana", vol: "1.250 m", status: "Progress", rab: 740000000, docs: { model3d: null, gambarKerja: { file: "NT4-Drainase-GambarKerja.pdf", size: "4,1 MB", tgl: "10 Jan 2025" } } },
    { id: "NT4-S3", progress: 35, nama: "Gerbang & Pos Jaga", jenis: "Sarana", vol: "1 unit", status: "Progress", rab: 385000000, docs: { model3d: { file: "NT4-Gerbang-3D.skp", size: "8,9 MB", tgl: "22 Feb 2025" }, gambarKerja: { file: "NT4-Gerbang-GambarKerja.pdf", size: "2,7 MB", tgl: "22 Feb 2025" } } },
    { id: "NT4-S4", progress: 0, nama: "Taman & RTH", jenis: "Sarana", vol: "1.900 m²", status: "Belum terbangun", rab: 520000000, docs: { model3d: null, gambarKerja: { file: "NT4-Taman-Layout.pdf", size: "3,3 MB", tgl: "04 Mar 2025" } } },
    { id: "NT4-S5", progress: 45, nama: "Jaringan Listrik", jenis: "Prasarana", vol: "51 sambungan", status: "Progress", rab: 612000000, docs: { model3d: null, gambarKerja: { file: "NT4-Listrik-Skematik.pdf", size: "2,2 MB", tgl: "04 Mar 2025" } } },
    { id: "NT4-S6", progress: 0, nama: "Jaringan Air Bersih", jenis: "Prasarana", vol: "51 sambungan", status: "Belum terbangun", rab: 428000000, docs: { model3d: null, gambarKerja: null } },
  ],
  GN2: [
    { id: "GN2-S1", progress: 64, nama: "Jalan Lingkungan", jenis: "Prasarana", vol: "980 m²", status: "Progress", rab: 465000000, docs: { model3d: null, gambarKerja: { file: "GN2-Jalan-GambarKerja.pdf", size: "3,6 MB", tgl: "15 Sep 2024" } } },
    { id: "GN2-S2", progress: 100, nama: "Saluran Drainase", jenis: "Prasarana", vol: "420 m", status: "Selesai", rab: 248000000, docs: { model3d: null, gambarKerja: { file: "GN2-Drainase-GambarKerja.pdf", size: "2,4 MB", tgl: "15 Sep 2024" } } },
    { id: "GN2-S3", progress: 0, nama: "Gerbang & Pos Jaga", jenis: "Sarana", vol: "1 unit", status: "Belum terbangun", rab: 275000000, docs: { model3d: { file: "GN2-Gerbang-3D.skp", size: "7,2 MB", tgl: "02 Okt 2024" }, gambarKerja: { file: "GN2-Gerbang-GambarKerja.pdf", size: "2,1 MB", tgl: "02 Okt 2024" } } },
  ],
};

// ---------------------------------------------------------------------------
// VENDOR, KONTRAK, TENDER
// ---------------------------------------------------------------------------

export const VENDOR = [
  { nama: "CV Baja Jaya Mandiri", bidang: "Struktur & Atap Baja", kontak: "Rudi Santoso · 0812-1122-3344", alamat: "Cibinong, Kab. Bogor", sejak: 2023, status: "Aktif" },
  { nama: "Pemborong Hj. Hasim", bidang: "Borongan Rumah Tapak", kontak: "H. Hasim · 0813-5566-7788", alamat: "Cibinong, Kab. Bogor", sejak: 2022, status: "Aktif" },
  { nama: "CV Cipta Bangun", bidang: "Finishing & Bangunan Pelengkap", kontak: "Andi Wijaya · 0815-2233-4455", alamat: "Depok", sejak: 2024, status: "Aktif" },
  { nama: "CV Tanah Makmur", bidang: "Pekerjaan Tanah & Carport", kontak: "Slamet R. · 0857-9988-1122", alamat: "Bojongsari, Depok", sejak: 2023, status: "Aktif" },
  { nama: "CV Karya Aspal", bidang: "Jalan & Drainase", kontak: "Bambang S. · 0812-7788-9900", alamat: "Cibinong, Kab. Bogor", sejak: 2022, status: "Aktif" },
  { nama: "CV Hijau Lestari", bidang: "Lansekap & Taman", kontak: "Dewi Kartika · 0878-3344-5566", alamat: "Sawangan, Depok", sejak: 2023, status: "Aktif" },
  { nama: "PT Bina Marga Sejahtera", bidang: "Infrastruktur Jalan", kontak: "Ir. Hendarto · 021-8790-1122", alamat: "Jakarta Selatan", sejak: 2024, status: "Aktif" },
  { nama: "CV Elektrindo Jaya", bidang: "Mekanikal & Elektrikal", kontak: "Yusuf A. · 0811-4455-6677", alamat: "Tapos, Depok", sejak: 2025, status: "Aktif" },
];

export const KONTRAK = [
  { kode: "K1", jenis: "Unit", proyek: "NT4", vendor: "CV Baja Jaya Mandiri", deskripsi: "Borongan struktur & atap — tipe Tesla",
    units: ["NT4-F2-1", "NT4-F2-5", "NT4-F3-2", "NT4-F3-6", "NT4-F4-3", "NT4-F4-9"], nominal: 900000000, override: null as Record<string, number> | null,
    vo: [{ no: "VO-01", tgl: "20 Jun 2026", uraian: "Tambah kuda-kuda baja bentang 6 m (2 unit)", nominal: 24000000, status: "Disetujui" },
         { no: "VO-02", tgl: "10 Jul 2026", uraian: "Kurang pekerjaan lisplank (dialihkan ke vendor lain)", nominal: -8500000, status: "Disetujui" }],
    retensiPct: 5, jatuhTempoBln: 3, mulai: "01 Mei 2026",
    riwayat: [{ tgl: "01 Mei 2026", uraian: "DP 33% borongan struktur", nominal: 300000000 }, { tgl: "15 Jun 2026", uraian: "Termin 2 borongan", nominal: 250000000 }, { tgl: "16 Jul 2026", uraian: "Termin 3 borongan", nominal: 70000000 }] },
  { kode: "K2", jenis: "Unit", proyek: "GN2", vendor: "Pemborong Hj. Hasim", deskripsi: "Borongan rumah tipe F1 — 4 unit",
    units: ["GN2-F1-1", "GN2-F1-3", "GN2-F1-5", "GN2-F1-7"], nominal: 320000000, override: null,
    vo: [], retensiPct: 5, jatuhTempoBln: 3, mulai: "20 Mei 2026",
    riwayat: [{ tgl: "20 Mei 2026", uraian: "Termin 1 borongan F1", nominal: 120000000 }, { tgl: "02 Jul 2026", uraian: "Termin 2 borongan F1", nominal: 81000000 }] },
  { kode: "K3", jenis: "Unit", proyek: "NT4", vendor: "CV Cipta Bangun", deskripsi: "Borongan finishing — tipe Galileo (unit sudut dihargai lebih)",
    units: ["NT4-F1-2", "NT4-F1-8", "NT4-F4-1"], nominal: 540000000,
    override: { "NT4-F1-2": 165000000, "NT4-F1-8": 165000000, "NT4-F4-1": 210000000 },
    vo: [], retensiPct: 5, jatuhTempoBln: 3, mulai: "10 Jun 2026",
    riwayat: [{ tgl: "10 Jun 2026", uraian: "DP 30% finishing Galileo", nominal: 162000000 }] },
  { kode: "K4", jenis: "Unit", proyek: "NT2", vendor: "CV Tanah Makmur", deskripsi: "Borongan carport & pagar — tipe 45",
    units: ["NT2-F2-5", "NT2-F2-7"], nominal: 96000000, override: null,
    vo: [], retensiPct: 0, jatuhTempoBln: 0, mulai: "05 Nov 2023",
    riwayat: [{ tgl: "05 Nov 2023", uraian: "Pelunasan carport & pagar", nominal: 96000000 }] },
  { kode: "K5", jenis: "Unit", proyek: "NT4", vendor: "Pemborong Hj. Hasim", deskripsi: "Borongan rumah tipe Newton — 4 unit",
    units: ["NT4-F1-3", "NT4-F1-6", "NT4-F2-2", "NT4-F2-9"], nominal: 520000000, override: null,
    vo: [], retensiPct: 5, jatuhTempoBln: 3, mulai: "15 Mar 2026",
    riwayat: [{ tgl: "15 Mar 2026", uraian: "DP 30% borongan Newton", nominal: 156000000 }, { tgl: "20 Jun 2026", uraian: "Termin 2 borongan Newton", nominal: 130000000 }] },
  { kode: "S1", jenis: "Sarpras", proyek: "NT2", vendor: "CV Karya Aspal", deskripsi: "Pengerasan & pengaspalan jalan lingkungan", sarpras: ["NT2-S1"], nominal: 360000000, vo: [], retensiPct: 5, jatuhTempoBln: 3, mulai: "12 Mar 2023",
    riwayat: [{ tgl: "12 Mar 2023", uraian: "DP 40% pekerjaan jalan", nominal: 144000000 }, { tgl: "28 Apr 2023", uraian: "Pelunasan pekerjaan jalan", nominal: 216000000 }] },
  { kode: "S2", jenis: "Sarpras", proyek: "NT2", vendor: "CV Hijau Lestari", deskripsi: "Penataan taman & ruang terbuka hijau", sarpras: ["NT2-S2"], nominal: 92000000, vo: [], retensiPct: 0, jatuhTempoBln: 0, mulai: "05 Apr 2023",
    riwayat: [{ tgl: "05 Apr 2023", uraian: "Pelunasan penataan taman", nominal: 92000000 }] },
  { kode: "S3", jenis: "Sarpras", proyek: "NT4", vendor: "PT Bina Marga Sejahtera", deskripsi: "Jalan lingkungan & saluran drainase", sarpras: ["NT4-S1", "NT4-S2"], nominal: 2260000000, retensiPct: 5, jatuhTempoBln: 3, mulai: "15 Feb 2025",
    vo: [{ no: "VO-01", tgl: "12 Mei 2025", uraian: "Tambah volume jalan 180 m² (pelebaran jalan masuk)", nominal: 84000000, status: "Disetujui" },
         { no: "VO-02", tgl: "02 Jul 2026", uraian: "Tambah saluran drainase 60 m sisi timur", nominal: 36000000, status: "Diajukan" }],
    riwayat: [{ tgl: "15 Feb 2025", uraian: "DP 30% jalan & drainase", nominal: 678000000 }, { tgl: "20 Apr 2025", uraian: "Termin 2", nominal: 452000000 }, { tgl: "18 Jun 2025", uraian: "Termin 3", nominal: 280000000 }] },
  { kode: "S4", jenis: "Sarpras", proyek: "NT4", vendor: "CV Cipta Bangun", deskripsi: "Gerbang utama & pos jaga", sarpras: ["NT4-S3"], nominal: 370000000, vo: [], retensiPct: 5, jatuhTempoBln: 3, mulai: "08 Mar 2025",
    riwayat: [{ tgl: "08 Mar 2025", uraian: "DP 40% gerbang & pos jaga", nominal: 148000000 }] },
  { kode: "S5", jenis: "Sarpras", proyek: "NT4", vendor: "CV Elektrindo Jaya", deskripsi: "Jaringan listrik 51 sambungan", sarpras: ["NT4-S5"], nominal: 595000000, vo: [], retensiPct: 5, jatuhTempoBln: 3, mulai: "02 Apr 2025",
    riwayat: [{ tgl: "02 Apr 2025", uraian: "DP 50% jaringan listrik", nominal: 297500000 }] },
  { kode: "S6", jenis: "Sarpras", proyek: "GN2", vendor: "CV Karya Aspal", deskripsi: "Jalan lingkungan & drainase", sarpras: ["GN2-S1", "GN2-S2"], nominal: 690000000, vo: [], retensiPct: 5, jatuhTempoBln: 3, mulai: "20 Okt 2024",
    riwayat: [{ tgl: "20 Okt 2024", uraian: "DP 40% jalan & drainase", nominal: 276000000 }, { tgl: "14 Jan 2025", uraian: "Termin 2", nominal: 207000000 }] },
];

export const TENDER = [
  { kode: "TD-2026-01", proyek: "NT4", pekerjaan: "Borongan finishing tipe Newton — 8 unit", tgl: "12 Jun 2026", hps: 640000000, status: "Evaluasi", pemenang: null as string | null,
    peserta: [{ vendor: "CV Cipta Bangun", nilai: 612000000, dok: "Lengkap" }, { vendor: "Pemborong Hj. Hasim", nilai: 598000000, dok: "Lengkap" }, { vendor: "CV Baja Jaya Mandiri", nilai: 655000000, dok: "Kurang dokumen" }] },
  { kode: "TD-2026-02", proyek: "GN2", pekerjaan: "Pagar keliling & gerbang samping", tgl: "02 Jul 2026", hps: 185000000, status: "Dibuka", pemenang: null,
    peserta: [{ vendor: "CV Cipta Bangun", nilai: 178000000, dok: "Lengkap" }, { vendor: "CV Tanah Makmur", nilai: 182500000, dok: "Lengkap" }] },
  { kode: "TD-2026-03", proyek: "NT4", pekerjaan: "Jaringan air bersih 51 sambungan", tgl: "20 Mei 2026", hps: 428000000, status: "Ditetapkan", pemenang: "CV Elektrindo Jaya",
    peserta: [{ vendor: "CV Elektrindo Jaya", nilai: 415000000, dok: "Lengkap" }, { vendor: "PT Bina Marga Sejahtera", nilai: 447000000, dok: "Lengkap" }] },
];

// ---------------------------------------------------------------------------
// EQUIPMENT
// ---------------------------------------------------------------------------

export const ASET = [
  { kode: "SCF-001", jumlah: 100, satuan: "set", nama: "Scaffolding Frame Set (100 set)", kategori: "Perancah", merk: "Multi Frame 1,7 m", milik: "Milik Sendiri", vendor: null as string | null, lokasi: "NT4", pj: "Agus Pratama", status: "Digunakan", satuanPakai: "hari", pakai: 128, servisAkhir: "12 Mar 2026", servisBerikut: "12 Sep 2026", nilai: 185000000 },
  { kode: "MLN-002", jumlah: 3, satuan: "unit", nama: "Concrete Mixer / Molen 350 L", kategori: "Alat Berat Ringan", merk: "Hercules HCM-350", milik: "Milik Sendiri", vendor: null, lokasi: "NT4", pj: "Agus Pratama", status: "Digunakan", satuanPakai: "jam", pakai: 1240, servisAkhir: "02 Jun 2026", servisBerikut: "02 Sep 2026", nilai: 24500000 },
  { kode: "STP-003", jumlah: 2, satuan: "unit", nama: "Stamper Kuda / Tamping Rammer", kategori: "Pemadatan", merk: "Mikasa MT-76", milik: "Milik Sendiri", vendor: null, lokasi: "GN2", pj: "Hendra Kurnia", status: "Digunakan", satuanPakai: "jam", pakai: 860, servisAkhir: "18 Apr 2026", servisBerikut: "18 Agu 2026", nilai: 32000000 },
  { kode: "STP-004", jumlah: 2, satuan: "unit", nama: "Stamper Kodok / Plate Compactor", kategori: "Pemadatan", merk: "Tiger TPC-80", milik: "Sewa", vendor: "CV Karya Aspal", lokasi: "NT4", pj: "Agus Pratama", status: "Digunakan", satuanPakai: "jam", pakai: 320, servisAkhir: null, servisBerikut: null, nilai: 450000 },
  { kode: "BOR-005", jumlah: 6, satuan: "unit", nama: "Mesin Bor Beton / Rotary Hammer", kategori: "Perkakas Listrik", merk: "Bosch GBH 2-26", milik: "Milik Sendiri", vendor: null, lokasi: "NT4", pj: "Agus Pratama", status: "Tersedia", satuanPakai: "jam", pakai: 410, servisAkhir: "20 Mei 2026", servisBerikut: "20 Nov 2026", nilai: 4200000 },
  { kode: "VBR-006", jumlah: 4, satuan: "unit", nama: "Vibrator Beton (Concrete Vibrator)", kategori: "Pengecoran", merk: "Dynamic ZN-50", milik: "Milik Sendiri", vendor: null, lokasi: "NT4", pj: "Agus Pratama", status: "Pemeliharaan", satuanPakai: "jam", pakai: 980, servisAkhir: "10 Jul 2026", servisBerikut: "10 Okt 2026", nilai: 8900000 },
  { kode: "GEN-007", jumlah: 2, satuan: "unit", nama: "Genset 5.000 Watt", kategori: "Daya & Listrik", merk: "Honda EP-6500", milik: "Milik Sendiri", vendor: null, lokasi: "GN2", pj: "Hendra Kurnia", status: "Digunakan", satuanPakai: "jam", pakai: 1520, servisAkhir: "28 Jun 2026", servisBerikut: "28 Agu 2026", nilai: 18500000 },
  { kode: "LAS-008", jumlah: 3, satuan: "unit", nama: "Mesin Las Listrik 900 Watt", kategori: "Perkakas Listrik", merk: "Rhino MMA-120", milik: "Milik Sendiri", vendor: null, lokasi: "NT4", pj: "Agus Pratama", status: "Digunakan", satuanPakai: "jam", pakai: 640, servisAkhir: "05 Mei 2026", servisBerikut: "05 Nov 2026", nilai: 3100000 },
  { kode: "BCT-009", jumlah: 2, satuan: "unit", nama: "Bar Cutter (Pemotong Besi)", kategori: "Pembesian", merk: "Toyo TBC-25", milik: "Milik Sendiri", vendor: null, lokasi: "NT4", pj: "Agus Pratama", status: "Digunakan", satuanPakai: "jam", pakai: 720, servisAkhir: "14 Apr 2026", servisBerikut: "14 Okt 2026", nilai: 21000000 },
  { kode: "BBD-010", jumlah: 2, satuan: "unit", nama: "Bar Bender (Pembengkok Besi)", kategori: "Pembesian", merk: "Toyo TBB-25", milik: "Milik Sendiri", vendor: null, lokasi: "NT4", pj: "Agus Pratama", status: "Tersedia", satuanPakai: "jam", pakai: 540, servisAkhir: "14 Apr 2026", servisBerikut: "14 Okt 2026", nilai: 19500000 },
  { kode: "SRV-011", jumlah: 1, satuan: "unit", nama: "Theodolite / Total Station", kategori: "Survey & Ukur", merk: "Topcon GTS-235", milik: "Sewa", vendor: "PT Bina Marga Sejahtera", lokasi: "NT4", pj: "Fajar Ramadhan", status: "Digunakan", satuanPakai: "hari", pakai: 22, servisAkhir: null, servisBerikut: null, nilai: 350000 },
  { kode: "SRV-012", jumlah: 2, satuan: "unit", nama: "Automatic Level / Waterpass", kategori: "Survey & Ukur", merk: "Nikon AX-2S", milik: "Milik Sendiri", vendor: null, lokasi: "GN2", pj: "Fajar Ramadhan", status: "Tersedia", satuanPakai: "hari", pakai: 64, servisAkhir: "08 Jan 2026", servisBerikut: "08 Jan 2027", nilai: 9800000 },
  { kode: "PMP-013", jumlah: 3, satuan: "unit", nama: 'Pompa Air / Water Pump 3"', kategori: "Daya & Listrik", merk: "Honda WB-30", milik: "Milik Sendiri", vendor: null, lokasi: "NT2", pj: "Rina Safitri", status: "Tersedia", satuanPakai: "jam", pakai: 380, servisAkhir: "02 Feb 2026", servisBerikut: "02 Agu 2026", nilai: 6700000 },
  { kode: "JCH-014", jumlah: 2, satuan: "unit", nama: "Jack Hammer / Bobok Beton", kategori: "Alat Berat Ringan", merk: "Makita HM-1317", milik: "Sewa", vendor: "CV Cipta Bangun", lokasi: "GN2", pj: "Hendra Kurnia", status: "Digunakan", satuanPakai: "jam", pakai: 96, servisAkhir: null, servisBerikut: null, nilai: 275000 },
  { kode: "TWL-015", jumlah: 4, satuan: "unit", nama: "Tower Lamp / Lampu Sorot Proyek", kategori: "Daya & Listrik", merk: "Airman 4x400W", milik: "Sewa", vendor: "CV Elektrindo Jaya", lokasi: "NT4", pj: "Agus Pratama", status: "Rusak", satuanPakai: "jam", pakai: 210, servisAkhir: "30 Jun 2026", servisBerikut: null, nilai: 400000 },
];

// ---------------------------------------------------------------------------
// BIAYA OPERASIONAL & LOG
// ---------------------------------------------------------------------------

export const POS_HPP: Record<string, string> = {
  "Unit (rumah dijual)": "E — Konstruksi",
  "Prasarana & Sarana": "D — Prasarana",
  "Perijinan & Ormas": "C — Perijinan",
  "Pengolahan Lahan": "B — Pengolahan Lahan",
};

/**
 * Transaksi tingkat proyek — dipindahkan dari array EXPENSES pada artifact.
 * `unit` diisi nomor unit bila biaya itu menempel pada satu unit tertentu.
 */
export const BIAYA_UMUM = [
  { tgl: "16 Jul 2026", proyek: "NT4", fase: "F2", unit: "5", peruntukan: "Unit (rumah dijual)", jenis: "Subkon", metode: "Transfer", uraian: "Termin 3 subkon rangka atap", total: 70000000, status: "Lunas", pic: "Budi Hartono", bukti: "ba-termin-3.pdf", kontrak: "CV Baja Jaya Mandiri" },
  { tgl: "14 Jul 2026", proyek: "GN2", fase: "F1", unit: "", peruntukan: "Unit (rumah dijual)", jenis: "Material", metode: "Petty Cash", uraian: "Besi 6mm & 10mm, semen unit 6-10", total: 62000000, status: "Lunas", pic: "Sari Kusuma", bukti: "nota-besi.jpg", kontrak: "" },
  { tgl: "12 Jul 2026", proyek: "NT4", fase: "F2", unit: "", peruntukan: "Prasarana & Sarana", jenis: "Material", metode: "Transfer", uraian: "Beton jalan lingkungan", total: 18400000, status: "Lunas", pic: "Budi Hartono", bukti: "inv-beton.pdf", kontrak: "" },
  { tgl: "11 Jul 2026", proyek: "GN2", fase: "F1", unit: "2", peruntukan: "Unit (rumah dijual)", jenis: "Material", metode: "Transfer", uraian: "Keramik lantai & sanitair", total: 9800000, status: "Belum", pic: "Sari Kusuma", bukti: "", kontrak: "" },
  { tgl: "10 Jul 2026", proyek: "GN2", fase: "F1", unit: "", peruntukan: "Unit (rumah dijual)", jenis: "Upah Harian", metode: "Petty Cash", uraian: "Upah tukang minggu ke-2 Juli, 24 orang", total: 24000000, status: "Lunas", pic: "Sari Kusuma", bukti: "absensi.jpg", kontrak: "" },
  { tgl: "08 Jul 2026", proyek: "NT4", fase: "F1", unit: "", peruntukan: "Prasarana & Sarana", jenis: "Upah Harian", metode: "Petty Cash", uraian: "Upah paving jalan cluster", total: 4500000, status: "Lunas", pic: "Budi Hartono", bukti: "", kontrak: "" },
  { tgl: "05 Jul 2026", proyek: "NT2", fase: "F1", unit: "", peruntukan: "Pengolahan Lahan", jenis: "Subkon", metode: "Transfer", uraian: "Cut & fill lahan", total: 12500000, status: "Lunas", pic: "Dewi Anggraini", bukti: "kontrak-cnf.pdf", kontrak: "CV Tanah Makmur" },
  { tgl: "02 Jul 2026", proyek: "GN2", fase: "F1", unit: "", peruntukan: "Unit (rumah dijual)", jenis: "Upah Borongan", metode: "Transfer", uraian: "Termin 2 borongan F1", total: 81000000, status: "Lunas", pic: "Sari Kusuma", bukti: "ba-borongan.pdf", kontrak: "Pemborong Hj. Hasim" },
  { tgl: "28 Jun 2026", proyek: "NT2", fase: "F2", unit: "", peruntukan: "Unit (rumah dijual)", jenis: "Material", metode: "Transfer", uraian: "Bata ringan & mortar", total: 15600000, status: "Lunas", pic: "Dewi Anggraini", bukti: "nota-bata.jpg", kontrak: "" },
  { tgl: "21 Jun 2026", proyek: "GN2", fase: "F1", unit: "", peruntukan: "Perijinan & Ormas", jenis: "Lain-lain proyek", metode: "Tunai langsung", uraian: "Biaya izin ormas & lingkungan", total: 6000000, status: "Lunas", pic: "Sari Kusuma", bukti: "kwitansi.jpg", kontrak: "" },
  { tgl: "15 Jun 2026", proyek: "NT4", fase: "F2", unit: "", peruntukan: "Unit (rumah dijual)", jenis: "Subkon", metode: "Transfer", uraian: "Termin 2 subkon rangka atap", total: 250000000, status: "Lunas", pic: "Budi Hartono", bukti: "ba-termin-2.pdf", kontrak: "CV Baja Jaya Mandiri" },
  { tgl: "10 Jun 2026", proyek: "NT4", fase: "F3", unit: "", peruntukan: "Unit (rumah dijual)", jenis: "Upah Borongan", metode: "Transfer", uraian: "Borongan struktur Tesla", total: 95000000, status: "Lunas", pic: "Budi Hartono", bukti: "ba-tesla.pdf", kontrak: "" },
];

/** Warna kategori pada diagram donat dan penanda jenis biaya. */
export const WARNA_JENIS: Record<string, string> = {
  "Upah Borongan": "#3b82c4",
  "Upah Harian": "#e0619a",
  Material: "#d9a441",
  Subkon: "#8b7fd6",
  "Lain-lain proyek": "#4bbf87",
};

export const WARNA_PERUNTUKAN: Record<string, string> = {
  "Unit (rumah dijual)": "#3b82c4",
  "Prasarana & Sarana": "#d9a441",
  "Perijinan & Ormas": "#e0619a",
  "Pengolahan Lahan": "#8b7fd6",
};

/** Porsi jenis biaya terhadap realisasi sebuah unit, beserta metode bayarnya. */
export const PORSI_BIAYA_UNIT: [string, number, string, string[]][] = [
  ["Upah Borongan", 0.38, "Transfer", ["Termin 1 borongan struktur", "Termin 2 borongan finishing"]],
  ["Material", 0.34, "Transfer", ["Semen, besi & bata ringan", "Keramik, cat & sanitair"]],
  ["Subkon", 0.16, "Transfer", ["Subkon rangka atap & plafon"]],
  ["Upah Harian", 0.09, "Petty Cash", ["Upah tukang harian"]],
  ["Lain-lain proyek", 0.03, "Tunai langsung", ["Konsumsi & operasional lapangan"]],
];

export const LOG_AWAL = [
  { waktu: "22 Jul 2026 16:40", peran: "Quantity Surveyor", oleh: "Budi Hartono", proyek: "NT4", objek: "Unit F2-3 · RAB", aksi: "Ubah baris BOQ", dari: "Pek. Lantai & Keramik — Rp 285.000/m²", ke: "Pek. Lantai & Keramik — Rp 298.000/m²" },
  { waktu: "22 Jul 2026 14:12", peran: "Arsitek", oleh: "Fajar Ramadhan", proyek: "NT4", objek: "Tipe Galileo · Gambar Kerja", aksi: "Unggah revisi", dari: "R2", ke: "R3" },
  { waktu: "21 Jul 2026 11:05", peran: "Project Manager", oleh: "Hendra Kurnia", proyek: "GN2", objek: "Unit F1-4", aksi: "Ubah status bangun", dari: "Progress", ke: "Selesai" },
  { waktu: "20 Jul 2026 09:30", peran: "Head Operation Office", oleh: "Rina Safitri", proyek: "NT2", objek: "Sarpras · Taman & RTH", aksi: "Ubah status bangun", dari: "Progress", ke: "Selesai" },
  { waktu: "18 Jul 2026 15:22", peran: "Business Development", oleh: "Andra Wijaya", proyek: "NT4", objek: "Biaya Perolehan Lahan", aksi: "Ubah nilai", dari: "Rp 5.590.000.000", ke: "Rp 5.755.000.000" },
];
