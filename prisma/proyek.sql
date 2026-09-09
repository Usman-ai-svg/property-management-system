-- =============================================================================
-- DIHASILKAN OTOMATIS oleh scripts/skema-sql.mjs — JANGAN DISUNTING TANGAN.
--
-- DDL schema `proyek` untuk ERP Nanoland (Supabase/PostgreSQL 16).
-- Sumbernya prisma/schema.prisma; jalankan `npm run skema:sql` sesudah skema
-- berubah.
--
--   60 tabel · 523 kolom
--   51 kolom uang numeric(18,2)
--   27 CHECK enum, seluruhnya dari src/lib/domain/enums.ts
--   96 foreign key dalam schema · 4 dialihkan ke auth.users
--   3 trigger diubahPada
--
-- Tidak ikut: User, Role, UserRole, UserProjectAccess — identitas dari Supabase Auth.
-- =============================================================================

create schema if not exists proyek;

-- ---------------------------------------------------------------------------
-- TABEL
-- ---------------------------------------------------------------------------

create table proyek.role_section_permissions (
  "id" text primary key,
  "roleNama" text not null,
  "section" text not null,
  "bolehUbah" boolean not null default false,
  unique ("roleNama", "section")
);

create table proyek.documents (
  "id" text primary key,
  "kategori" text not null,
  "judul" text not null,
  "dibuatPada" timestamptz not null default now()
);

create table proyek.document_versions (
  "id" text primary key,
  "documentId" text not null,
  "revisi" text not null,
  "namaFile" text not null,
  "ukuranByte" integer not null,
  "objectKey" text,
  "diunggahPada" timestamptz not null default now(),
  "diunggahOlehId" text,
  unique ("documentId", "revisi"),
  foreign key ("documentId") references proyek.documents("id") on delete cascade,
  foreign key ("diunggahOlehId") references auth.users(id) on delete set null
);

create table proyek.projects (
  "id" text primary key,
  "kode" text not null,
  "nama" text not null,
  "status" text not null,
  "alamat" text not null,
  "kelurahan" text not null,
  "kecamatan" text not null,
  "kota" text not null,
  "provinsi" text not null,
  "pinLat" double precision,
  "pinLng" double precision,
  "luasKavlingEfektif" double precision not null,
  "luasSarana" double precision not null default 0,
  "luasPrasarana" double precision not null default 0,
  "luasRth" double precision not null default 0,
  "hargaPerM2" numeric(18,2) not null default 0,
  "biayaPembelian" numeric(18,2) not null default 0,
  "biayaNotaris" numeric(18,2) not null default 0,
  "biayaBalikNama" numeric(18,2) not null default 0,
  "biayaLegalLain" numeric(18,2) not null default 0,
  "analisaDocId" text,
  "dibuatPada" timestamptz not null default now(),
  "diubahPada" timestamptz not null,
  constraint projects_status_sah check ("status" in ('Perencanaan', 'Proses Legal & Perizinan', 'Pembangunan', 'Selesai')),
  unique ("kode"),
  unique ("analisaDocId"),
  foreign key ("analisaDocId") references proyek.documents("id") on delete set null
);

create table proyek.legalities (
  "id" text primary key,
  "projectId" text not null,
  "nib" text not null,
  "jenisHak" text not null default 'Hak Milik (HM)',
  "nomorHak" text not null default '',
  "sertifikat" text not null,
  "luas" double precision not null,
  "dokumenId" text,
  constraint legalities_jenishak_sah check ("jenisHak" in ('Hak Milik (HM)', 'Hak Guna Usaha (HGU)', 'Hak Guna Bangunan (HGB)', 'Hak Pakai', 'Hak Pengelolaan (HPL)', 'Hak Tanggungan')),
  unique ("dokumenId"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade,
  foreign key ("dokumenId") references proyek.documents("id") on delete set null
);

create table proyek.phases (
  "id" text primary key,
  "projectId" text not null,
  "kode" text not null,
  "nama" text,
  "urutan" integer not null default 0,
  unique ("projectId", "kode"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade
);

create table proyek.unit_types (
  "id" text primary key,
  "projectId" text not null,
  "kode" text not null,
  "nama" text not null,
  "luasBangunan" double precision not null,
  "luasTanah" double precision not null,
  "rapUpahVolume" numeric(18,2) not null default 1,
  "rapUpahHarga" numeric(18,2) not null default 0,
  "docModel3dId" text,
  "docGambarKerjaPdfId" text,
  "docGambarKerjaDwgId" text,
  "docRenderId" text,
  "docSpekId" text,
  unique ("docModel3dId"),
  unique ("docGambarKerjaPdfId"),
  unique ("docGambarKerjaDwgId"),
  unique ("docRenderId"),
  unique ("docSpekId"),
  unique ("projectId", "kode"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade,
  foreign key ("docModel3dId") references proyek.documents("id") on delete set null,
  foreign key ("docGambarKerjaPdfId") references proyek.documents("id") on delete set null,
  foreign key ("docGambarKerjaDwgId") references proyek.documents("id") on delete set null,
  foreign key ("docRenderId") references proyek.documents("id") on delete set null,
  foreign key ("docSpekId") references proyek.documents("id") on delete set null
);

create table proyek.unit_type_boq_items (
  "id" text primary key,
  "unitTypeId" text not null,
  "grup" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "spesifikasi" text,
  "urutan" integer not null default 0,
  foreign key ("unitTypeId") references proyek.unit_types("id") on delete cascade
);

create table proyek.unit_type_rap_items (
  "id" text primary key,
  "unitTypeId" text not null,
  "grup" text not null,
  "kategori" text not null default 'Material',
  "nama" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "keterangan" text,
  "urutan" integer not null default 0,
  foreign key ("unitTypeId") references proyek.unit_types("id") on delete cascade
);

create table proyek.units (
  "id" text primary key,
  "kode" text not null,
  "projectId" text not null,
  "phaseId" text not null,
  "unitTypeId" text not null,
  "nomor" integer not null,
  "luasTanah" double precision not null,
  "statusPembangunan" text not null default 'Belum Terbangun',
  "statusJual" text not null default 'Tersedia',
  "tanggalSerahTerima" timestamptz,
  "progress" integer not null default 0,
  "hargaJual" numeric(18,2) not null default 0,
  "rapUpahVolume" numeric(18,2) not null default 1,
  "rapUpahHarga" numeric(18,2) not null default 0,
  "dibuatPada" timestamptz not null default now(),
  "diubahPada" timestamptz not null,
  constraint units_statuspembangunan_sah check ("statusPembangunan" in ('Belum Terbangun', 'Progress', 'Terbangun', 'Masa Garansi', 'Selesai')),
  constraint units_statusjual_sah check ("statusJual" in ('Tersedia', 'Booking', 'Akad', 'Serah Terima')),
  unique ("kode"),
  unique ("projectId", "nomor"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade,
  foreign key ("phaseId") references proyek.phases("id") on delete cascade,
  foreign key ("unitTypeId") references proyek.unit_types("id") on delete restrict
);

create table proyek.unit_boq_items (
  "id" text primary key,
  "unitId" text not null,
  "grup" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "spesifikasi" text,
  "urutan" integer not null default 0,
  "progress" integer not null default 0,
  "progressLalu" integer not null default 0,
  "progressLaluPada" timestamptz,
  foreign key ("unitId") references proyek.units("id") on delete cascade
);

create table proyek.unit_rap_items (
  "id" text primary key,
  "unitId" text not null,
  "grup" text not null,
  "kategori" text not null default 'Material',
  "nama" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "keterangan" text,
  "urutan" integer not null default 0,
  foreign key ("unitId") references proyek.units("id") on delete cascade
);

create table proyek.custom_works (
  "id" text primary key,
  "unitId" text not null,
  "judul" text not null,
  "rapUpahVolume" numeric(18,2) not null default 1,
  "rapUpahHarga" numeric(18,2) not null default 0,
  "docDesainId" text,
  "docModel3dId" text,
  "docGambarKerjaPdfId" text,
  "docGambarKerjaDwgId" text,
  "docRabId" text,
  foreign key ("unitId") references proyek.units("id") on delete cascade,
  foreign key ("docDesainId") references proyek.documents("id") on delete set null,
  foreign key ("docModel3dId") references proyek.documents("id") on delete set null,
  foreign key ("docGambarKerjaPdfId") references proyek.documents("id") on delete set null,
  foreign key ("docGambarKerjaDwgId") references proyek.documents("id") on delete set null,
  foreign key ("docRabId") references proyek.documents("id") on delete set null
);

create table proyek.custom_work_boq_items (
  "id" text primary key,
  "customWorkId" text not null,
  "grup" text not null default 'Tambahan',
  "uraian" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "spesifikasi" text,
  "urutan" integer not null default 0,
  foreign key ("customWorkId") references proyek.custom_works("id") on delete cascade
);

create table proyek.custom_work_rap_items (
  "id" text primary key,
  "customWorkId" text not null,
  "grup" text not null,
  "kategori" text not null default 'Material',
  "nama" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "keterangan" text,
  "urutan" integer not null default 0,
  foreign key ("customWorkId") references proyek.custom_works("id") on delete cascade
);

create table proyek.progress_records (
  "id" text primary key,
  "unitId" text,
  "infrastructureId" text,
  "tanggal" timestamptz not null,
  "progress" integer not null,
  "catatan" text,
  "dicatatOleh" text,
  "dicatatOlehId" text,
  foreign key ("unitId") references proyek.units("id") on delete cascade,
  foreign key ("infrastructureId") references proyek.infrastructures("id") on delete cascade
);

create table proyek.infrastructures (
  "id" text primary key,
  "kode" text not null,
  "projectId" text not null,
  "nama" text not null,
  "jenis" text not null,
  "volume" text not null,
  "status" text not null default 'Belum Terbangun',
  "progress" integer not null default 0,
  "rab" numeric(18,2) not null,
  "rapUpahVolume" numeric(18,2) not null default 1,
  "rapUpahHarga" numeric(18,2) not null default 0,
  "docModel3dId" text,
  "docGambarKerjaPdfId" text,
  "docGambarKerjaDwgId" text,
  constraint infrastructures_jenis_sah check ("jenis" in ('Sarana', 'Prasarana')),
  constraint infrastructures_status_sah check ("status" in ('Belum Terbangun', 'Progress', 'Selesai')),
  unique ("kode"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade,
  foreign key ("docModel3dId") references proyek.documents("id") on delete set null,
  foreign key ("docGambarKerjaPdfId") references proyek.documents("id") on delete set null,
  foreign key ("docGambarKerjaDwgId") references proyek.documents("id") on delete set null
);

create table proyek.infrastructure_rap_items (
  "id" text primary key,
  "infrastructureId" text not null,
  "grup" text not null,
  "kategori" text not null default 'Material',
  "nama" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "keterangan" text,
  "urutan" integer not null default 0,
  foreign key ("infrastructureId") references proyek.infrastructures("id") on delete cascade
);

create table proyek.infrastructure_boq_items (
  "id" text primary key,
  "infrastructureId" text not null,
  "grup" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "spesifikasi" text,
  "urutan" integer not null default 0,
  "progress" integer not null default 0,
  "progressLalu" integer not null default 0,
  "progressLaluPada" timestamptz,
  foreign key ("infrastructureId") references proyek.infrastructures("id") on delete cascade
);

create table proyek.vendors (
  "id" text primary key,
  "nama" text not null,
  "bidang" text not null,
  "kontak" text not null,
  "alamat" text not null,
  "sejak" integer not null,
  "status" text not null default 'Aktif',
  constraint vendors_status_sah check ("status" in ('Aktif', 'Nonaktif')),
  unique ("nama")
);

create table proyek.contracts (
  "id" text primary key,
  "kode" text not null,
  "projectId" text not null,
  "vendorId" text not null,
  "jenis" text not null,
  "jenisBiaya" text not null default 'Upah Borongan',
  "deskripsi" text not null,
  "nominal" numeric(18,2) not null,
  "retensiPct" double precision not null default 0,
  "jatuhTempoBln" integer not null default 0,
  "mulai" timestamptz not null,
  "tanggalSelesai" timestamptz,
  "docSpkId" text,
  constraint contracts_jenis_sah check ("jenis" in ('Unit', 'Sarpras')),
  constraint contracts_jenisbiaya_sah check ("jenisBiaya" in ('Kontraktor', 'Upah Borongan', 'Subkon')),
  unique ("kode"),
  unique ("docSpkId"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade,
  foreign key ("vendorId") references proyek.vendors("id") on delete restrict,
  foreign key ("docSpkId") references proyek.documents("id") on delete set null
);

create table proyek.contract_boq_items (
  "id" text primary key,
  "contractId" text not null,
  "grup" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "urutan" integer not null default 0,
  foreign key ("contractId") references proyek.contracts("id") on delete cascade
);

create table proyek.contract_boq_unit (
  "id" text primary key,
  "contractId" text not null,
  "boqItemId" text not null,
  "unitId" text,
  "infrastructureId" text,
  "grup" text,
  "uraian" text,
  "satuan" text,
  "volume" double precision,
  "hargaSatuan" numeric(18,2),
  "progress" integer not null default 0,
  "progressLalu" integer not null default 0,
  "progressLaluPada" timestamptz,
  unique ("boqItemId", "unitId"),
  unique ("boqItemId", "infrastructureId"),
  foreign key ("contractId") references proyek.contracts("id") on delete cascade,
  foreign key ("boqItemId") references proyek.contract_boq_items("id") on delete cascade,
  foreign key ("unitId") references proyek.units("id") on delete cascade,
  foreign key ("infrastructureId") references proyek.infrastructures("id") on delete cascade
);

create table proyek.contract_units (
  "contractId" text not null,
  "unitId" text not null,
  "nilaiOverride" numeric(18,2),
  foreign key ("contractId") references proyek.contracts("id") on delete cascade,
  foreign key ("unitId") references proyek.units("id") on delete cascade
);

create table proyek.contract_infrastructures (
  "contractId" text not null,
  "infrastructureId" text not null,
  "nilaiOverride" numeric(18,2),
  foreign key ("contractId") references proyek.contracts("id") on delete cascade,
  foreign key ("infrastructureId") references proyek.infrastructures("id") on delete cascade
);

create table proyek.variation_orders (
  "id" text primary key,
  "contractId" text not null,
  "nomor" text not null,
  "tanggal" timestamptz not null,
  "uraian" text not null,
  "nominal" numeric(18,2) not null,
  "status" text not null default 'Diajukan',
  constraint variation_orders_status_sah check ("status" in ('Diajukan', 'Disetujui', 'Ditolak')),
  foreign key ("contractId") references proyek.contracts("id") on delete cascade
);

create table proyek.contract_vo_items (
  "id" text primary key,
  "voId" text not null,
  "unitId" text,
  "infrastructureId" text,
  "grup" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "progress" integer not null default 0,
  "progressLalu" integer not null default 0,
  "progressLaluPada" timestamptz,
  "urutan" integer not null default 0,
  foreign key ("voId") references proyek.variation_orders("id") on delete cascade,
  foreign key ("unitId") references proyek.units("id") on delete cascade,
  foreign key ("infrastructureId") references proyek.infrastructures("id") on delete cascade
);

create table proyek.expenses (
  "id" text primary key,
  "projectId" text not null,
  "tanggal" timestamptz not null,
  "peruntukan" text not null,
  "jenis" text not null,
  "metode" text not null,
  "uraian" text not null,
  "total" numeric(18,2) not null,
  "status" text not null default 'Belum',
  "pic" text,
  "picId" text,
  "posHpp" text,
  "bukti" text,
  "buktiKey" text,
  "kreditur" text,
  "tenggat" timestamptz,
  "contractId" text,
  "pembelianId" text,
  "pettyCashReportId" text,
  constraint expenses_peruntukan_sah check ("peruntukan" in ('Unit (rumah dijual)', 'Prasarana & Sarana', 'Perijinan & Ormas', 'Pengolahan Lahan')),
  constraint expenses_jenis_sah check ("jenis" in ('Kontraktor', 'Upah Borongan', 'Upah Harian', 'Material', 'Subkon', 'Lain-lain proyek')),
  constraint expenses_metode_sah check ("metode" in ('Transfer', 'Petty Cash', 'Tunai langsung', 'Hutang')),
  constraint expenses_status_sah check ("status" in ('Lunas', 'DP', 'Belum')),
  foreign key ("projectId") references proyek.projects("id") on delete cascade,
  foreign key ("contractId") references proyek.contracts("id") on delete set null,
  foreign key ("pembelianId") references proyek.pembelian("id") on delete set null,
  foreign key ("pettyCashReportId") references proyek.petty_cash_reports("id") on delete set null
);

create table proyek.hutang_cicilan (
  "id" text primary key,
  "expenseId" text not null,
  "tanggal" timestamptz not null,
  "nominal" numeric(18,2) not null,
  "metode" text not null,
  "bukti" text,
  "buktiKey" text,
  "pic" text,
  "picId" text,
  "dibuatPada" timestamptz not null default now(),
  constraint hutang_cicilan_metode_sah check ("metode" in ('Transfer', 'Petty Cash', 'Tunai langsung')),
  foreign key ("expenseId") references proyek.expenses("id") on delete cascade
);

create table proyek.expense_allocations (
  "id" text primary key,
  "expenseId" text not null,
  "unitId" text,
  "infrastructureId" text,
  "nominal" numeric(18,2) not null,
  foreign key ("expenseId") references proyek.expenses("id") on delete cascade,
  foreign key ("unitId") references proyek.units("id") on delete set null,
  foreign key ("infrastructureId") references proyek.infrastructures("id") on delete set null
);

create table proyek.petty_cash_funds (
  "id" text primary key,
  "projectId" text not null,
  "pemegangId" text not null,
  "plafon" numeric(18,2) not null default 0,
  "aktif" boolean not null default true,
  "dibuatPada" timestamptz not null default now(),
  unique ("projectId", "pemegangId"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade,
  foreign key ("pemegangId") references auth.users(id) on delete set null
);

create table proyek.petty_cash_topups (
  "id" text primary key,
  "fundId" text not null,
  "tanggal" timestamptz not null default now(),
  "nominal" numeric(18,2) not null,
  "jenis" text not null,
  "reportId" text,
  "olehId" text not null,
  "bukti" text,
  "buktiKey" text,
  constraint petty_cash_topups_jenis_sah check ("jenis" in ('Awal', 'Reimburse')),
  unique ("reportId"),
  foreign key ("fundId") references proyek.petty_cash_funds("id") on delete cascade,
  foreign key ("olehId") references auth.users(id) on delete set null,
  foreign key ("reportId") references proyek.petty_cash_reports("id") on delete set null
);

create table proyek.petty_cash_reports (
  "id" text primary key,
  "fundId" text not null,
  "periode" text not null,
  "status" text not null default 'Draft',
  "diajukanPada" timestamptz,
  "diverifikasiQsPada" timestamptz,
  "disetujuiOpsPada" timestamptz,
  "direimbursePada" timestamptz,
  "catatan" text,
  "bukti" text,
  "buktiKey" text,
  "dibuatPada" timestamptz not null default now(),
  constraint petty_cash_reports_status_sah check ("status" in ('Draft', 'Diajukan', 'DiverifikasiQS', 'Disetujui', 'Direimburse')),
  foreign key ("fundId") references proyek.petty_cash_funds("id") on delete cascade
);

create table proyek.operational_costs (
  "id" text primary key,
  "projectId" text not null,
  "tanggal" timestamptz not null,
  "kategori" text not null,
  "uraian" text not null,
  "nominal" numeric(18,2) not null,
  "status" text not null default 'Lunas',
  "pic" text,
  "picId" text,
  "bukti" text,
  constraint operational_costs_status_sah check ("status" in ('Lunas', 'DP', 'Belum')),
  foreign key ("projectId") references proyek.projects("id") on delete cascade
);

create table proyek.sales_payments (
  "id" text primary key,
  "unitId" text not null,
  "tanggal" timestamptz not null,
  "uraian" text not null,
  "nominal" numeric(18,2) not null,
  foreign key ("unitId") references proyek.units("id") on delete cascade
);

create table proyek.business_plans (
  "id" text primary key,
  "projectId" text not null,
  unique ("projectId"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade
);

create table proyek.bp_hpp_items (
  "id" text primary key,
  "businessPlanId" text not null,
  "nama" text not null,
  "urutan" integer not null default 0,
  foreign key ("businessPlanId") references proyek.business_plans("id") on delete cascade
);

create table proyek.bp_hpp_rows (
  "id" text primary key,
  "hppItemId" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "harga" numeric(18,2) not null,
  "urutan" integer not null default 0,
  foreign key ("hppItemId") references proyek.bp_hpp_items("id") on delete cascade
);

create table proyek.bp_omzet_units (
  "id" text primary key,
  "businessPlanId" text not null,
  "unitId" text not null,
  "hargaDasar" numeric(18,2) not null,
  unique ("unitId"),
  foreign key ("businessPlanId") references proyek.business_plans("id") on delete cascade,
  foreign key ("unitId") references proyek.units("id") on delete cascade
);

create table proyek.bp_operasional_items (
  "id" text primary key,
  "businessPlanId" text not null,
  "nama" text not null,
  "urutan" integer not null default 0,
  foreign key ("businessPlanId") references proyek.business_plans("id") on delete cascade
);

create table proyek.bp_operasional_rows (
  "id" text primary key,
  "operasionalItemId" text not null,
  "nama" text not null,
  "satuan" text not null,
  "volume" double precision not null,
  "harga" numeric(18,2) not null,
  "urutan" integer not null default 0,
  foreign key ("operasionalItemId") references proyek.bp_operasional_items("id") on delete cascade
);

create table proyek.bp_cashflow_items (
  "id" text primary key,
  "businessPlanId" text not null,
  "periode" text not null,
  "masuk" numeric(18,2) not null,
  "keluar" numeric(18,2) not null,
  "urutan" integer not null default 0,
  foreign key ("businessPlanId") references proyek.business_plans("id") on delete cascade
);

create table proyek.market_comparables (
  "id" text primary key,
  "projectId" text not null,
  "nama" text not null,
  "jarak" double precision not null,
  foreign key ("projectId") references proyek.projects("id") on delete cascade
);

create table proyek.market_comparable_types (
  "id" text primary key,
  "marketComparableId" text not null,
  "tipe" text not null,
  "jumlah" integer not null,
  "luasUnit" double precision not null,
  "luasLahan" double precision not null,
  "harga" numeric(18,2) not null,
  foreign key ("marketComparableId") references proyek.market_comparables("id") on delete cascade
);

create table proyek.equipments (
  "id" text primary key,
  "kode" text not null,
  "jenis" text not null default 'Peralatan',
  "nama" text not null,
  "kategori" text not null,
  "merk" text,
  "jumlah" integer not null default 1,
  "jumlahRusak" integer not null default 0,
  "satuan" text not null default 'unit',
  "kepemilikan" text not null default 'Milik Sendiri',
  "vendorId" text,
  "servisTerakhir" timestamptz,
  "servisBerikut" timestamptz,
  "nilai" numeric(18,2) not null default 0,
  constraint equipments_jenis_sah check ("jenis" in ('Peralatan', 'Aset')),
  constraint equipments_kepemilikan_sah check ("kepemilikan" in ('Milik Sendiri', 'Sewa')),
  unique ("kode"),
  foreign key ("vendorId") references proyek.vendors("id") on delete set null
);

create table proyek.equipment_services (
  "id" text primary key,
  "equipmentId" text not null,
  "tanggal" timestamptz not null default now(),
  "servisBerikut" timestamptz,
  "biaya" numeric(18,2) not null default 0,
  "catatan" text,
  "dicatatOleh" text not null,
  "dicatatOlehId" text,
  foreign key ("equipmentId") references proyek.equipments("id") on delete cascade
);

create table proyek.equipment_usages (
  "id" text primary key,
  "equipmentId" text not null,
  "projectId" text not null,
  "jumlah" integer not null,
  "tanggalMulai" timestamptz not null default now(),
  "tanggalSelesai" timestamptz,
  "tarif" numeric(18,2) not null default 0,
  "penanggungJawab" text,
  "catatan" text,
  "status" text not null default 'Aktif',
  "dicatatOleh" text not null,
  "dicatatOlehId" text,
  "dibuatPada" timestamptz not null default now(),
  constraint equipment_usages_status_sah check ("status" in ('Aktif', 'Selesai')),
  foreign key ("equipmentId") references proyek.equipments("id") on delete cascade,
  foreign key ("projectId") references proyek.projects("id") on delete restrict
);

create table proyek.equipment_adjustments (
  "id" text primary key,
  "equipmentId" text not null,
  "tanggal" timestamptz not null default now(),
  "jenis" text not null,
  "banyak" integer not null,
  "jumlahSebelum" integer not null,
  "jumlahSesudah" integer not null,
  "rusakSebelum" integer not null,
  "rusakSesudah" integer not null,
  "keterangan" text not null,
  "penanggungJawab" text,
  "dicatatOleh" text not null,
  "dicatatOlehId" text,
  constraint equipment_adjustments_jenis_sah check ("jenis" in ('Hilang', 'Rusak', 'Perbaikan Selesai', 'Koreksi Stok')),
  foreign key ("equipmentId") references proyek.equipments("id") on delete cascade
);

create table proyek.pemasok (
  "id" text primary key,
  "nama" text not null,
  "kategori" text not null,
  "kontakNama" text not null default '',
  "kontakTelepon" text not null default '',
  "alamat" text not null default '',
  "kecamatan" text not null default '',
  "provinsi" text not null default '',
  "status" text not null default 'Aktif',
  constraint pemasok_kategori_sah check ("kategori" in ('Material', 'Tenaga Kerja', 'Alat')),
  constraint pemasok_status_sah check ("status" in ('Aktif', 'Nonaktif'))
);

create table proyek.harga_dasar (
  "id" text primary key,
  "kode" text not null,
  "kategori" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "hargaAcuan" numeric(18,2) not null default 0,
  constraint harga_dasar_kategori_sah check ("kategori" in ('UPAH', 'BAHAN', 'ALAT')),
  unique ("kode")
);

create table proyek.penawaran_pemasok (
  "id" text primary key,
  "hargaDasarId" text not null,
  "pemasokId" text not null,
  "harga" numeric(18,2) not null,
  "tanggal" timestamptz not null default now(),
  "keterangan" text,
  foreign key ("hargaDasarId") references proyek.harga_dasar("id") on delete cascade,
  foreign key ("pemasokId") references proyek.pemasok("id") on delete cascade
);

create table proyek.analisa_harga (
  "id" text primary key,
  "kode" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "kelompok" text not null,
  "overheadPct" double precision not null default 13,
  unique ("kode")
);

create table proyek.komponen_analisa (
  "id" text primary key,
  "analisaId" text not null,
  "hargaDasarId" text not null,
  "koefisien" double precision not null,
  "urutan" integer not null default 0,
  foreign key ("analisaId") references proyek.analisa_harga("id") on delete cascade,
  foreign key ("hargaDasarId") references proyek.harga_dasar("id") on delete restrict
);

create table proyek.rab_estimasi (
  "id" text primary key,
  "projectId" text not null,
  "nomor" text not null,
  "nama" text not null,
  "tanggal" timestamptz not null default now(),
  "status" text not null default 'Draft',
  "diajukanPada" timestamptz,
  "diajukanOleh" text,
  "diajukanOlehId" text,
  "diputusPada" timestamptz,
  "diputusOleh" text,
  "diputusOlehId" text,
  "catatanTolak" text,
  "dibuatPada" timestamptz not null default now(),
  "diubahPada" timestamptz not null,
  constraint rab_estimasi_status_sah check ("status" in ('Draft', 'Diajukan', 'Ditolak', 'Final')),
  unique ("projectId", "nomor"),
  foreign key ("projectId") references proyek.projects("id") on delete cascade
);

create table proyek.rab_estimasi_items (
  "id" text primary key,
  "rabEstimasiId" text not null,
  "analisaId" text,
  "grup" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "spesifikasi" text,
  "volume" double precision not null,
  "hargaSatuan" numeric(18,2) not null,
  "pemenangVendorId" text,
  "urutan" integer not null default 0,
  foreign key ("rabEstimasiId") references proyek.rab_estimasi("id") on delete cascade,
  foreign key ("analisaId") references proyek.analisa_harga("id") on delete set null,
  foreign key ("pemenangVendorId") references proyek.vendors("id") on delete set null
);

create table proyek.rab_pembanding (
  "id" text primary key,
  "rabEstimasiId" text not null,
  "vendorId" text not null,
  unique ("rabEstimasiId", "vendorId"),
  foreign key ("rabEstimasiId") references proyek.rab_estimasi("id") on delete cascade,
  foreign key ("vendorId") references proyek.vendors("id") on delete restrict
);

create table proyek.rab_penawaran (
  "id" text primary key,
  "rabEstimasiItemId" text not null,
  "vendorId" text not null,
  "hargaSatuan" numeric(18,2) not null,
  unique ("rabEstimasiItemId", "vendorId"),
  foreign key ("rabEstimasiItemId") references proyek.rab_estimasi_items("id") on delete cascade,
  foreign key ("vendorId") references proyek.vendors("id") on delete restrict
);

create table proyek.pembelian (
  "id" text primary key,
  "pemasokId" text not null,
  "projectId" text not null,
  "nomor" text not null,
  "status" text not null default 'Draft',
  "tanggal" timestamptz not null default now(),
  "keterangan" text,
  "tanggalTerima" timestamptz,
  "penerima" text,
  "dibuatPada" timestamptz not null default now(),
  constraint pembelian_status_sah check ("status" in ('Draft', 'Diterima')),
  foreign key ("pemasokId") references proyek.pemasok("id") on delete cascade,
  foreign key ("projectId") references proyek.projects("id") on delete cascade
);

create table proyek.pembelian_items (
  "id" text primary key,
  "pembelianId" text not null,
  "uraian" text not null,
  "satuan" text not null,
  "qty" double precision not null,
  "harga" numeric(18,2) not null,
  "hargaDasarId" text,
  "urutan" integer not null default 0,
  foreign key ("pembelianId") references proyek.pembelian("id") on delete cascade,
  foreign key ("hargaDasarId") references proyek.harga_dasar("id") on delete set null
);

create table proyek.audit_logs (
  "id" text primary key,
  "waktu" timestamptz not null default now(),
  "userId" text,
  "peran" text not null,
  "projectId" text,
  "objek" text not null,
  "aksi" text not null,
  "nilaiDari" text,
  "nilaiKe" text,
  foreign key ("userId") references auth.users(id) on delete set null,
  foreign key ("projectId") references proyek.projects("id") on delete set null
);

-- ---------------------------------------------------------------------------
-- INDEKS
-- ---------------------------------------------------------------------------

create index role_section_permissions_rolenama_idx on proyek.role_section_permissions ("roleNama");
create index unit_type_boq_items_unittypeid_idx on proyek.unit_type_boq_items ("unitTypeId");
create index unit_type_rap_items_unittypeid_idx on proyek.unit_type_rap_items ("unitTypeId");
create index units_projectid_phaseid_idx on proyek.units ("projectId", "phaseId");
create index unit_boq_items_unitid_idx on proyek.unit_boq_items ("unitId");
create index unit_rap_items_unitid_idx on proyek.unit_rap_items ("unitId");
create index custom_work_boq_items_customworkid_idx on proyek.custom_work_boq_items ("customWorkId");
create index custom_work_rap_items_customworkid_idx on proyek.custom_work_rap_items ("customWorkId");
create index progress_records_unitid_tanggal_idx on proyek.progress_records ("unitId", "tanggal");
create index progress_records_infrastructureid_tanggal_idx on proyek.progress_records ("infrastructureId", "tanggal");
create index infrastructure_rap_items_infrastructureid_idx on proyek.infrastructure_rap_items ("infrastructureId");
create index infrastructure_boq_items_infrastructureid_idx on proyek.infrastructure_boq_items ("infrastructureId");
create index contracts_projectid_idx on proyek.contracts ("projectId");
create index contract_boq_items_contractid_idx on proyek.contract_boq_items ("contractId");
create index contract_boq_unit_contractid_idx on proyek.contract_boq_unit ("contractId");
create index contract_boq_unit_unitid_idx on proyek.contract_boq_unit ("unitId");
create index contract_boq_unit_infrastructureid_idx on proyek.contract_boq_unit ("infrastructureId");
create index variation_orders_contractid_idx on proyek.variation_orders ("contractId");
create index contract_vo_items_void_idx on proyek.contract_vo_items ("voId");
create index contract_vo_items_unitid_idx on proyek.contract_vo_items ("unitId");
create index contract_vo_items_infrastructureid_idx on proyek.contract_vo_items ("infrastructureId");
create index expenses_projectid_tanggal_idx on proyek.expenses ("projectId", "tanggal");
create index expenses_pettycashreportid_idx on proyek.expenses ("pettyCashReportId");
create index hutang_cicilan_expenseid_idx on proyek.hutang_cicilan ("expenseId");
create index expense_allocations_expenseid_idx on proyek.expense_allocations ("expenseId");
create index expense_allocations_unitid_idx on proyek.expense_allocations ("unitId");
create index expense_allocations_infrastructureid_idx on proyek.expense_allocations ("infrastructureId");
create index petty_cash_funds_projectid_idx on proyek.petty_cash_funds ("projectId");
create index petty_cash_topups_fundid_idx on proyek.petty_cash_topups ("fundId");
create index petty_cash_reports_fundid_idx on proyek.petty_cash_reports ("fundId");
create index operational_costs_projectid_tanggal_idx on proyek.operational_costs ("projectId", "tanggal");
create index sales_payments_unitid_idx on proyek.sales_payments ("unitId");
create index bp_hpp_rows_hppitemid_idx on proyek.bp_hpp_rows ("hppItemId");
create index bp_omzet_units_businessplanid_idx on proyek.bp_omzet_units ("businessPlanId");
create index bp_operasional_rows_operasionalitemid_idx on proyek.bp_operasional_rows ("operasionalItemId");
create index equipment_services_equipmentid_tanggal_idx on proyek.equipment_services ("equipmentId", "tanggal");
create index equipment_usages_equipmentid_status_idx on proyek.equipment_usages ("equipmentId", "status");
create index equipment_usages_projectid_status_idx on proyek.equipment_usages ("projectId", "status");
create index equipment_adjustments_equipmentid_tanggal_idx on proyek.equipment_adjustments ("equipmentId", "tanggal");
create index penawaran_pemasok_hargadasarid_idx on proyek.penawaran_pemasok ("hargaDasarId");
create index penawaran_pemasok_pemasokid_idx on proyek.penawaran_pemasok ("pemasokId");
create index komponen_analisa_analisaid_idx on proyek.komponen_analisa ("analisaId");
create index komponen_analisa_hargadasarid_idx on proyek.komponen_analisa ("hargaDasarId");
create index rab_estimasi_projectid_idx on proyek.rab_estimasi ("projectId");
create index rab_estimasi_items_rabestimasiid_idx on proyek.rab_estimasi_items ("rabEstimasiId");
create index rab_pembanding_rabestimasiid_idx on proyek.rab_pembanding ("rabEstimasiId");
create index rab_penawaran_rabestimasiitemid_idx on proyek.rab_penawaran ("rabEstimasiItemId");
create index pembelian_pemasokid_idx on proyek.pembelian ("pemasokId");
create index pembelian_projectid_idx on proyek.pembelian ("projectId");
create index pembelian_items_pembelianid_idx on proyek.pembelian_items ("pembelianId");
create index pembelian_items_hargadasarid_idx on proyek.pembelian_items ("hargaDasarId");
create index audit_logs_waktu_idx on proyek.audit_logs ("waktu");
create index audit_logs_projectid_waktu_idx on proyek.audit_logs ("projectId", "waktu");

-- ---------------------------------------------------------------------------
-- TRIGGER
-- ---------------------------------------------------------------------------

-- @updatedAt jadi trigger, bukan diisi aplikasi. Di Next.js Prisma yang
-- mengisinya; di ERP penulisnya banyak (RPC, impor, perbaikan manual), dan
-- satu jalur yang lupa mengisi akan membuat kolomnya berbohong.
create or replace function proyek.set_diubah_pada() returns trigger as $$
begin
  new."diubahPada" = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_diubah_pada before update on proyek.projects
  for each row execute function proyek.set_diubah_pada();
create trigger units_diubah_pada before update on proyek.units
  for each row execute function proyek.set_diubah_pada();
create trigger rab_estimasi_diubah_pada before update on proyek.rab_estimasi
  for each row execute function proyek.set_diubah_pada();

-- ---------------------------------------------------------------------------
-- RLS & GRANT
-- ---------------------------------------------------------------------------

-- ROW LEVEL SECURITY
--
-- Pola yang sama dengan seluruh ERP: baca lewat PostgREST dengan RLS aktif,
-- TULIS selalu lewat RPC SECURITY DEFINER. Karena itu tiap tabel di bawah
-- punya satu policy SELECT dan TIDAK punya policy tulis sama sekali — itu
-- disengaja, bukan kelupaan.
--
-- Peran publik-tanpa-login tidak pernah disebut di berkas ini — namanya pun
-- sengaja tidak ditulis, supaya `grep` atas nama itu benar-benar kosong.
-- Bukan dicabut belakangan: memang tidak pernah diberi. Di ERP pernah ada
-- temuan audit berupa lima view keuangan ber-SECURITY DEFINER yang terbuka
-- untuk peran publik — artinya siapa pun pemegang kunci publik bisa membaca
-- buku besar tanpa login. Satu-satunya yang diberi hak di sini:
-- `authenticated`, dan hanya SELECT.

grant usage on schema proyek to authenticated;

alter table proyek.role_section_permissions enable row level security;
create policy role_section_permissions_baca on proyek.role_section_permissions for select to authenticated using (true);
grant select on proyek.role_section_permissions to authenticated;

alter table proyek.documents enable row level security;
create policy documents_baca on proyek.documents for select to authenticated using (true);
grant select on proyek.documents to authenticated;

alter table proyek.document_versions enable row level security;
create policy document_versions_baca on proyek.document_versions for select to authenticated using (true);
grant select on proyek.document_versions to authenticated;

alter table proyek.projects enable row level security;
create policy projects_baca on proyek.projects for select to authenticated using (true);
grant select on proyek.projects to authenticated;

alter table proyek.legalities enable row level security;
create policy legalities_baca on proyek.legalities for select to authenticated using (true);
grant select on proyek.legalities to authenticated;

alter table proyek.phases enable row level security;
create policy phases_baca on proyek.phases for select to authenticated using (true);
grant select on proyek.phases to authenticated;

alter table proyek.unit_types enable row level security;
create policy unit_types_baca on proyek.unit_types for select to authenticated using (true);
grant select on proyek.unit_types to authenticated;

alter table proyek.unit_type_boq_items enable row level security;
create policy unit_type_boq_items_baca on proyek.unit_type_boq_items for select to authenticated using (true);
grant select on proyek.unit_type_boq_items to authenticated;

alter table proyek.unit_type_rap_items enable row level security;
create policy unit_type_rap_items_baca on proyek.unit_type_rap_items for select to authenticated using (true);
grant select on proyek.unit_type_rap_items to authenticated;

alter table proyek.units enable row level security;
create policy units_baca on proyek.units for select to authenticated using (true);
grant select on proyek.units to authenticated;

alter table proyek.unit_boq_items enable row level security;
create policy unit_boq_items_baca on proyek.unit_boq_items for select to authenticated using (true);
grant select on proyek.unit_boq_items to authenticated;

alter table proyek.unit_rap_items enable row level security;
create policy unit_rap_items_baca on proyek.unit_rap_items for select to authenticated using (true);
grant select on proyek.unit_rap_items to authenticated;

alter table proyek.custom_works enable row level security;
create policy custom_works_baca on proyek.custom_works for select to authenticated using (true);
grant select on proyek.custom_works to authenticated;

alter table proyek.custom_work_boq_items enable row level security;
create policy custom_work_boq_items_baca on proyek.custom_work_boq_items for select to authenticated using (true);
grant select on proyek.custom_work_boq_items to authenticated;

alter table proyek.custom_work_rap_items enable row level security;
create policy custom_work_rap_items_baca on proyek.custom_work_rap_items for select to authenticated using (true);
grant select on proyek.custom_work_rap_items to authenticated;

alter table proyek.progress_records enable row level security;
create policy progress_records_baca on proyek.progress_records for select to authenticated using (true);
grant select on proyek.progress_records to authenticated;

alter table proyek.infrastructures enable row level security;
create policy infrastructures_baca on proyek.infrastructures for select to authenticated using (true);
grant select on proyek.infrastructures to authenticated;

alter table proyek.infrastructure_rap_items enable row level security;
create policy infrastructure_rap_items_baca on proyek.infrastructure_rap_items for select to authenticated using (true);
grant select on proyek.infrastructure_rap_items to authenticated;

alter table proyek.infrastructure_boq_items enable row level security;
create policy infrastructure_boq_items_baca on proyek.infrastructure_boq_items for select to authenticated using (true);
grant select on proyek.infrastructure_boq_items to authenticated;

alter table proyek.vendors enable row level security;
create policy vendors_baca on proyek.vendors for select to authenticated using (true);
grant select on proyek.vendors to authenticated;

alter table proyek.contracts enable row level security;
create policy contracts_baca on proyek.contracts for select to authenticated using (true);
grant select on proyek.contracts to authenticated;

alter table proyek.contract_boq_items enable row level security;
create policy contract_boq_items_baca on proyek.contract_boq_items for select to authenticated using (true);
grant select on proyek.contract_boq_items to authenticated;

alter table proyek.contract_boq_unit enable row level security;
create policy contract_boq_unit_baca on proyek.contract_boq_unit for select to authenticated using (true);
grant select on proyek.contract_boq_unit to authenticated;

alter table proyek.contract_units enable row level security;
create policy contract_units_baca on proyek.contract_units for select to authenticated using (true);
grant select on proyek.contract_units to authenticated;

alter table proyek.contract_infrastructures enable row level security;
create policy contract_infrastructures_baca on proyek.contract_infrastructures for select to authenticated using (true);
grant select on proyek.contract_infrastructures to authenticated;

alter table proyek.variation_orders enable row level security;
create policy variation_orders_baca on proyek.variation_orders for select to authenticated using (true);
grant select on proyek.variation_orders to authenticated;

alter table proyek.contract_vo_items enable row level security;
create policy contract_vo_items_baca on proyek.contract_vo_items for select to authenticated using (true);
grant select on proyek.contract_vo_items to authenticated;

alter table proyek.expenses enable row level security;
create policy expenses_baca on proyek.expenses for select to authenticated using (true);
grant select on proyek.expenses to authenticated;

alter table proyek.hutang_cicilan enable row level security;
create policy hutang_cicilan_baca on proyek.hutang_cicilan for select to authenticated using (true);
grant select on proyek.hutang_cicilan to authenticated;

alter table proyek.expense_allocations enable row level security;
create policy expense_allocations_baca on proyek.expense_allocations for select to authenticated using (true);
grant select on proyek.expense_allocations to authenticated;

alter table proyek.petty_cash_funds enable row level security;
create policy petty_cash_funds_baca on proyek.petty_cash_funds for select to authenticated using (true);
grant select on proyek.petty_cash_funds to authenticated;

alter table proyek.petty_cash_topups enable row level security;
create policy petty_cash_topups_baca on proyek.petty_cash_topups for select to authenticated using (true);
grant select on proyek.petty_cash_topups to authenticated;

alter table proyek.petty_cash_reports enable row level security;
create policy petty_cash_reports_baca on proyek.petty_cash_reports for select to authenticated using (true);
grant select on proyek.petty_cash_reports to authenticated;

alter table proyek.operational_costs enable row level security;
create policy operational_costs_baca on proyek.operational_costs for select to authenticated using (true);
grant select on proyek.operational_costs to authenticated;

alter table proyek.sales_payments enable row level security;
create policy sales_payments_baca on proyek.sales_payments for select to authenticated using (true);
grant select on proyek.sales_payments to authenticated;

alter table proyek.business_plans enable row level security;
create policy business_plans_baca on proyek.business_plans for select to authenticated using (true);
grant select on proyek.business_plans to authenticated;

alter table proyek.bp_hpp_items enable row level security;
create policy bp_hpp_items_baca on proyek.bp_hpp_items for select to authenticated using (true);
grant select on proyek.bp_hpp_items to authenticated;

alter table proyek.bp_hpp_rows enable row level security;
create policy bp_hpp_rows_baca on proyek.bp_hpp_rows for select to authenticated using (true);
grant select on proyek.bp_hpp_rows to authenticated;

alter table proyek.bp_omzet_units enable row level security;
create policy bp_omzet_units_baca on proyek.bp_omzet_units for select to authenticated using (true);
grant select on proyek.bp_omzet_units to authenticated;

alter table proyek.bp_operasional_items enable row level security;
create policy bp_operasional_items_baca on proyek.bp_operasional_items for select to authenticated using (true);
grant select on proyek.bp_operasional_items to authenticated;

alter table proyek.bp_operasional_rows enable row level security;
create policy bp_operasional_rows_baca on proyek.bp_operasional_rows for select to authenticated using (true);
grant select on proyek.bp_operasional_rows to authenticated;

alter table proyek.bp_cashflow_items enable row level security;
create policy bp_cashflow_items_baca on proyek.bp_cashflow_items for select to authenticated using (true);
grant select on proyek.bp_cashflow_items to authenticated;

alter table proyek.market_comparables enable row level security;
create policy market_comparables_baca on proyek.market_comparables for select to authenticated using (true);
grant select on proyek.market_comparables to authenticated;

alter table proyek.market_comparable_types enable row level security;
create policy market_comparable_types_baca on proyek.market_comparable_types for select to authenticated using (true);
grant select on proyek.market_comparable_types to authenticated;

alter table proyek.equipments enable row level security;
create policy equipments_baca on proyek.equipments for select to authenticated using (true);
grant select on proyek.equipments to authenticated;

alter table proyek.equipment_services enable row level security;
create policy equipment_services_baca on proyek.equipment_services for select to authenticated using (true);
grant select on proyek.equipment_services to authenticated;

alter table proyek.equipment_usages enable row level security;
create policy equipment_usages_baca on proyek.equipment_usages for select to authenticated using (true);
grant select on proyek.equipment_usages to authenticated;

alter table proyek.equipment_adjustments enable row level security;
create policy equipment_adjustments_baca on proyek.equipment_adjustments for select to authenticated using (true);
grant select on proyek.equipment_adjustments to authenticated;

alter table proyek.pemasok enable row level security;
create policy pemasok_baca on proyek.pemasok for select to authenticated using (true);
grant select on proyek.pemasok to authenticated;

alter table proyek.harga_dasar enable row level security;
create policy harga_dasar_baca on proyek.harga_dasar for select to authenticated using (true);
grant select on proyek.harga_dasar to authenticated;

alter table proyek.penawaran_pemasok enable row level security;
create policy penawaran_pemasok_baca on proyek.penawaran_pemasok for select to authenticated using (true);
grant select on proyek.penawaran_pemasok to authenticated;

alter table proyek.analisa_harga enable row level security;
create policy analisa_harga_baca on proyek.analisa_harga for select to authenticated using (true);
grant select on proyek.analisa_harga to authenticated;

alter table proyek.komponen_analisa enable row level security;
create policy komponen_analisa_baca on proyek.komponen_analisa for select to authenticated using (true);
grant select on proyek.komponen_analisa to authenticated;

alter table proyek.rab_estimasi enable row level security;
create policy rab_estimasi_baca on proyek.rab_estimasi for select to authenticated using (true);
grant select on proyek.rab_estimasi to authenticated;

alter table proyek.rab_estimasi_items enable row level security;
create policy rab_estimasi_items_baca on proyek.rab_estimasi_items for select to authenticated using (true);
grant select on proyek.rab_estimasi_items to authenticated;

alter table proyek.rab_pembanding enable row level security;
create policy rab_pembanding_baca on proyek.rab_pembanding for select to authenticated using (true);
grant select on proyek.rab_pembanding to authenticated;

alter table proyek.rab_penawaran enable row level security;
create policy rab_penawaran_baca on proyek.rab_penawaran for select to authenticated using (true);
grant select on proyek.rab_penawaran to authenticated;

alter table proyek.pembelian enable row level security;
create policy pembelian_baca on proyek.pembelian for select to authenticated using (true);
grant select on proyek.pembelian to authenticated;

alter table proyek.pembelian_items enable row level security;
create policy pembelian_items_baca on proyek.pembelian_items for select to authenticated using (true);
grant select on proyek.pembelian_items to authenticated;

alter table proyek.audit_logs enable row level security;
create policy audit_logs_baca on proyek.audit_logs for select to authenticated using (true);
grant select on proyek.audit_logs to authenticated;
