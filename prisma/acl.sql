-- Matriks hak akses modul PROYEK — dihasilkan oleh scripts/acl-sql.mjs.
-- JANGAN disunting tangan: sumbernya prisma/acuan/hak-akses.json.
--
-- Dijalankan SESUDAH prisma/proyek.sql. Aman dijalankan ulang: tiap baris
-- punya id tetap yang diturunkan dari (jabatan, sub-bagian), dan diakhiri
-- "on conflict do nothing" — menjalankan dua kali tidak menggandakan apa pun
-- dan TIDAK menimpa penyuntingan yang sudah dilakukan lewat halaman Admin.
--
-- Matriks hak akses modul Proyek, satu baris per (jabatan, sub-bagian).
-- Dikunci ke KUNCI jabatan, bukan ke teks jabatan HRIS: selama kolom jabatan di HRIS belum terbukti punya daftar tertutup, teksnya harus dianggap bebas, dan satu salah ketik akan mencabut akses seseorang tanpa pesan apa pun. Pemetaan teks HRIS -> kunci ada di src/lib/domain/jabatan.ts.
-- Baris hanya ada bila boleh melihat. bolehUbah menentukan boleh mengubah; sub-bagian yang tidak punya baris berarti tertutup sama sekali, bukan sekadar hanya-lihat.
-- bolehUbah pada pettyCash berarti BOLEH IKUT DALAM ALUR, bukan boleh semua tahap. Tahap mana untuk jabatan mana ditegakkan tabel transisi di src/lib/calc/petty-cash.ts.
-- Hak sebuah jabatan adalah GABUNGAN hak peran-peran repo yang dulu menempel padanya (lihat peranAsal). Tiga jabatan menampung lebih dari satu peran: director, head of operation, quantity surveyor asst.
-- Satu orang boleh memegang lebih dari satu jabatan; izinnya gabungan dengan tingkat tertinggi yang menang.
-- Jabatan bercakupan luar tidak boleh punya satu pun bolehUbah. Ada tes yang gagal bila itu terjadi.
-- setujuiRab: Ubah berarti boleh menyetujui atau menolak. quantity_surveyor_asst TIDAK termasuk — ia yang menyusun dan mengajukan, dan tidak menyetujui buatannya sendiri.
-- pettyCash: Lihat: petty cash menyentuh lapangan sampai keuangan. Pemegang dana (logistic staff / manager proyek), verifikator (quantity surveyor asst), dan penyetuju (head of operation) ikut melihat, di samping garis keuangan yang memberi dan mereimburse dana. Ubah: berarti boleh ikut dalam alur (catat/ajukan/verifikasi/setujui/reimburse), BUKAN boleh semua tahap. Tahap mana untuk jabatan mana ditegakkan tabel transisi di src/lib/calc/petty-cash.ts.
-- progress: Ubah — quantity_surveyor_asst ikut boleh mengubah karena memantau progres vendor memang tugasnya, sekalipun angkanya diperoleh dari orang lapangan.
-- penyesuaianAset: Penyesuaian stok dipisahkan dari hak ubah aset karena pelakunya berbeda: yang mendata kehilangan dan kerusakan adalah orang lapangan, sedangkan yang menambah atau menghapus master aset adalah bagian pengadaan.
--
-- Ringkasan per jabatan:
--   director                 lihat 12  ubah 12
--   komisaris                lihat  9  ubah  0
--   head_of_operation        lihat 12  ubah 12
--   manager_proyek           lihat 11  ubah  7
--   logistic_staff           lihat  8  ubah  3
--   quantity_surveyor_asst   lihat 11  ubah  5
--   junior_arsitek_staff     lihat  7  ubah  1
--   consultant_finance       lihat  9  ubah  1
--   finance_tax              lihat  9  ubah  2
--   staff_administration     lihat  9  ubah  2
--   hrd_staff                lihat  6  ubah  0
--   sales_marketing          lihat  6  ubah  0
--   customer_service         lihat  6  ubah  0
--   manager_marketing        lihat  6  ubah  0
--   agent_coordinator        lihat  6  ubah  0
--   copy_writer              lihat  6  ubah  0
--   design_graphic_staff     lihat  6  ubah  0
--   graphic_designer         lihat  6  ubah  0

begin;

insert into proyek.role_section_permissions ("id", "jabatan", "section", "bolehLihat", "bolehUbah") values
  ('rsp-director-deskripsi', 'director', 'deskripsi', true, true),
  ('rsp-director-daftarunit', 'director', 'daftarUnit', true, true),
  ('rsp-director-daftarsarpras', 'director', 'daftarSarpras', true, true),
  ('rsp-director-dokumenteknis', 'director', 'dokumenTeknis', true, true),
  ('rsp-director-hargarabrap', 'director', 'hargaRabRap', true, true),
  ('rsp-director-setujuirab', 'director', 'setujuiRab', true, true),
  ('rsp-director-businessplan', 'director', 'businessPlan', true, true),
  ('rsp-director-keuangan', 'director', 'keuangan', true, true),
  ('rsp-director-pettycash', 'director', 'pettyCash', true, true),
  ('rsp-director-progress', 'director', 'progress', true, true),
  ('rsp-director-aset', 'director', 'aset', true, true),
  ('rsp-director-penyesuaianaset', 'director', 'penyesuaianAset', true, true),
  ('rsp-komisaris-deskripsi', 'komisaris', 'deskripsi', true, false),
  ('rsp-komisaris-daftarunit', 'komisaris', 'daftarUnit', true, false),
  ('rsp-komisaris-daftarsarpras', 'komisaris', 'daftarSarpras', true, false),
  ('rsp-komisaris-dokumenteknis', 'komisaris', 'dokumenTeknis', true, false),
  ('rsp-komisaris-hargarabrap', 'komisaris', 'hargaRabRap', true, false),
  ('rsp-komisaris-setujuirab', 'komisaris', 'setujuiRab', true, false),
  ('rsp-komisaris-businessplan', 'komisaris', 'businessPlan', true, false),
  ('rsp-komisaris-aset', 'komisaris', 'aset', true, false),
  ('rsp-komisaris-penyesuaianaset', 'komisaris', 'penyesuaianAset', true, false),
  ('rsp-head-of-operation-deskripsi', 'head_of_operation', 'deskripsi', true, true),
  ('rsp-head-of-operation-daftarunit', 'head_of_operation', 'daftarUnit', true, true),
  ('rsp-head-of-operation-daftarsarpras', 'head_of_operation', 'daftarSarpras', true, true),
  ('rsp-head-of-operation-dokumenteknis', 'head_of_operation', 'dokumenTeknis', true, true),
  ('rsp-head-of-operation-hargarabrap', 'head_of_operation', 'hargaRabRap', true, true),
  ('rsp-head-of-operation-setujuirab', 'head_of_operation', 'setujuiRab', true, true),
  ('rsp-head-of-operation-businessplan', 'head_of_operation', 'businessPlan', true, true),
  ('rsp-head-of-operation-keuangan', 'head_of_operation', 'keuangan', true, true),
  ('rsp-head-of-operation-pettycash', 'head_of_operation', 'pettyCash', true, true),
  ('rsp-head-of-operation-progress', 'head_of_operation', 'progress', true, true),
  ('rsp-head-of-operation-aset', 'head_of_operation', 'aset', true, true),
  ('rsp-head-of-operation-penyesuaianaset', 'head_of_operation', 'penyesuaianAset', true, true),
  ('rsp-manager-proyek-deskripsi', 'manager_proyek', 'deskripsi', true, false),
  ('rsp-manager-proyek-daftarunit', 'manager_proyek', 'daftarUnit', true, true),
  ('rsp-manager-proyek-daftarsarpras', 'manager_proyek', 'daftarSarpras', true, true),
  ('rsp-manager-proyek-dokumenteknis', 'manager_proyek', 'dokumenTeknis', true, true),
  ('rsp-manager-proyek-hargarabrap', 'manager_proyek', 'hargaRabRap', true, false),
  ('rsp-manager-proyek-setujuirab', 'manager_proyek', 'setujuiRab', true, true),
  ('rsp-manager-proyek-keuangan', 'manager_proyek', 'keuangan', true, false),
  ('rsp-manager-proyek-pettycash', 'manager_proyek', 'pettyCash', true, false),
  ('rsp-manager-proyek-progress', 'manager_proyek', 'progress', true, true),
  ('rsp-manager-proyek-aset', 'manager_proyek', 'aset', true, true),
  ('rsp-manager-proyek-penyesuaianaset', 'manager_proyek', 'penyesuaianAset', true, true),
  ('rsp-logistic-staff-deskripsi', 'logistic_staff', 'deskripsi', true, false),
  ('rsp-logistic-staff-daftarunit', 'logistic_staff', 'daftarUnit', true, false),
  ('rsp-logistic-staff-daftarsarpras', 'logistic_staff', 'daftarSarpras', true, false),
  ('rsp-logistic-staff-dokumenteknis', 'logistic_staff', 'dokumenTeknis', true, false),
  ('rsp-logistic-staff-pettycash', 'logistic_staff', 'pettyCash', true, true),
  ('rsp-logistic-staff-progress', 'logistic_staff', 'progress', true, true),
  ('rsp-logistic-staff-aset', 'logistic_staff', 'aset', true, false),
  ('rsp-logistic-staff-penyesuaianaset', 'logistic_staff', 'penyesuaianAset', true, true),
  ('rsp-quantity-surveyor-asst-deskripsi', 'quantity_surveyor_asst', 'deskripsi', true, false),
  ('rsp-quantity-surveyor-asst-daftarunit', 'quantity_surveyor_asst', 'daftarUnit', true, false),
  ('rsp-quantity-surveyor-asst-daftarsarpras', 'quantity_surveyor_asst', 'daftarSarpras', true, false),
  ('rsp-quantity-surveyor-asst-dokumenteknis', 'quantity_surveyor_asst', 'dokumenTeknis', true, false),
  ('rsp-quantity-surveyor-asst-hargarabrap', 'quantity_surveyor_asst', 'hargaRabRap', true, true),
  ('rsp-quantity-surveyor-asst-setujuirab', 'quantity_surveyor_asst', 'setujuiRab', true, false),
  ('rsp-quantity-surveyor-asst-keuangan', 'quantity_surveyor_asst', 'keuangan', true, false),
  ('rsp-quantity-surveyor-asst-pettycash', 'quantity_surveyor_asst', 'pettyCash', true, true),
  ('rsp-quantity-surveyor-asst-progress', 'quantity_surveyor_asst', 'progress', true, true),
  ('rsp-quantity-surveyor-asst-aset', 'quantity_surveyor_asst', 'aset', true, true),
  ('rsp-quantity-surveyor-asst-penyesuaianaset', 'quantity_surveyor_asst', 'penyesuaianAset', true, true),
  ('rsp-junior-arsitek-staff-deskripsi', 'junior_arsitek_staff', 'deskripsi', true, false),
  ('rsp-junior-arsitek-staff-daftarunit', 'junior_arsitek_staff', 'daftarUnit', true, false),
  ('rsp-junior-arsitek-staff-daftarsarpras', 'junior_arsitek_staff', 'daftarSarpras', true, false),
  ('rsp-junior-arsitek-staff-dokumenteknis', 'junior_arsitek_staff', 'dokumenTeknis', true, true),
  ('rsp-junior-arsitek-staff-progress', 'junior_arsitek_staff', 'progress', true, false),
  ('rsp-junior-arsitek-staff-aset', 'junior_arsitek_staff', 'aset', true, false),
  ('rsp-junior-arsitek-staff-penyesuaianaset', 'junior_arsitek_staff', 'penyesuaianAset', true, false),
  ('rsp-consultant-finance-deskripsi', 'consultant_finance', 'deskripsi', true, false),
  ('rsp-consultant-finance-daftarunit', 'consultant_finance', 'daftarUnit', true, false),
  ('rsp-consultant-finance-daftarsarpras', 'consultant_finance', 'daftarSarpras', true, false),
  ('rsp-consultant-finance-dokumenteknis', 'consultant_finance', 'dokumenTeknis', true, false),
  ('rsp-consultant-finance-hargarabrap', 'consultant_finance', 'hargaRabRap', true, false),
  ('rsp-consultant-finance-keuangan', 'consultant_finance', 'keuangan', true, false),
  ('rsp-consultant-finance-pettycash', 'consultant_finance', 'pettyCash', true, true),
  ('rsp-consultant-finance-aset', 'consultant_finance', 'aset', true, false),
  ('rsp-consultant-finance-penyesuaianaset', 'consultant_finance', 'penyesuaianAset', true, false),
  ('rsp-finance-tax-deskripsi', 'finance_tax', 'deskripsi', true, false),
  ('rsp-finance-tax-daftarunit', 'finance_tax', 'daftarUnit', true, false),
  ('rsp-finance-tax-daftarsarpras', 'finance_tax', 'daftarSarpras', true, false),
  ('rsp-finance-tax-dokumenteknis', 'finance_tax', 'dokumenTeknis', true, false),
  ('rsp-finance-tax-hargarabrap', 'finance_tax', 'hargaRabRap', true, false),
  ('rsp-finance-tax-keuangan', 'finance_tax', 'keuangan', true, true),
  ('rsp-finance-tax-pettycash', 'finance_tax', 'pettyCash', true, true),
  ('rsp-finance-tax-aset', 'finance_tax', 'aset', true, false),
  ('rsp-finance-tax-penyesuaianaset', 'finance_tax', 'penyesuaianAset', true, false),
  ('rsp-staff-administration-deskripsi', 'staff_administration', 'deskripsi', true, false),
  ('rsp-staff-administration-daftarunit', 'staff_administration', 'daftarUnit', true, false),
  ('rsp-staff-administration-daftarsarpras', 'staff_administration', 'daftarSarpras', true, false),
  ('rsp-staff-administration-dokumenteknis', 'staff_administration', 'dokumenTeknis', true, false),
  ('rsp-staff-administration-hargarabrap', 'staff_administration', 'hargaRabRap', true, false),
  ('rsp-staff-administration-keuangan', 'staff_administration', 'keuangan', true, true),
  ('rsp-staff-administration-pettycash', 'staff_administration', 'pettyCash', true, true),
  ('rsp-staff-administration-aset', 'staff_administration', 'aset', true, false),
  ('rsp-staff-administration-penyesuaianaset', 'staff_administration', 'penyesuaianAset', true, false),
  ('rsp-hrd-staff-deskripsi', 'hrd_staff', 'deskripsi', true, false),
  ('rsp-hrd-staff-daftarunit', 'hrd_staff', 'daftarUnit', true, false),
  ('rsp-hrd-staff-daftarsarpras', 'hrd_staff', 'daftarSarpras', true, false),
  ('rsp-hrd-staff-dokumenteknis', 'hrd_staff', 'dokumenTeknis', true, false),
  ('rsp-hrd-staff-aset', 'hrd_staff', 'aset', true, false),
  ('rsp-hrd-staff-penyesuaianaset', 'hrd_staff', 'penyesuaianAset', true, false),
  ('rsp-sales-marketing-deskripsi', 'sales_marketing', 'deskripsi', true, false),
  ('rsp-sales-marketing-daftarunit', 'sales_marketing', 'daftarUnit', true, false),
  ('rsp-sales-marketing-daftarsarpras', 'sales_marketing', 'daftarSarpras', true, false),
  ('rsp-sales-marketing-dokumenteknis', 'sales_marketing', 'dokumenTeknis', true, false),
  ('rsp-sales-marketing-aset', 'sales_marketing', 'aset', true, false),
  ('rsp-sales-marketing-penyesuaianaset', 'sales_marketing', 'penyesuaianAset', true, false),
  ('rsp-customer-service-deskripsi', 'customer_service', 'deskripsi', true, false),
  ('rsp-customer-service-daftarunit', 'customer_service', 'daftarUnit', true, false),
  ('rsp-customer-service-daftarsarpras', 'customer_service', 'daftarSarpras', true, false),
  ('rsp-customer-service-dokumenteknis', 'customer_service', 'dokumenTeknis', true, false),
  ('rsp-customer-service-aset', 'customer_service', 'aset', true, false),
  ('rsp-customer-service-penyesuaianaset', 'customer_service', 'penyesuaianAset', true, false),
  ('rsp-manager-marketing-deskripsi', 'manager_marketing', 'deskripsi', true, false),
  ('rsp-manager-marketing-daftarunit', 'manager_marketing', 'daftarUnit', true, false),
  ('rsp-manager-marketing-daftarsarpras', 'manager_marketing', 'daftarSarpras', true, false),
  ('rsp-manager-marketing-dokumenteknis', 'manager_marketing', 'dokumenTeknis', true, false),
  ('rsp-manager-marketing-aset', 'manager_marketing', 'aset', true, false),
  ('rsp-manager-marketing-penyesuaianaset', 'manager_marketing', 'penyesuaianAset', true, false),
  ('rsp-agent-coordinator-deskripsi', 'agent_coordinator', 'deskripsi', true, false),
  ('rsp-agent-coordinator-daftarunit', 'agent_coordinator', 'daftarUnit', true, false),
  ('rsp-agent-coordinator-daftarsarpras', 'agent_coordinator', 'daftarSarpras', true, false),
  ('rsp-agent-coordinator-dokumenteknis', 'agent_coordinator', 'dokumenTeknis', true, false),
  ('rsp-agent-coordinator-aset', 'agent_coordinator', 'aset', true, false),
  ('rsp-agent-coordinator-penyesuaianaset', 'agent_coordinator', 'penyesuaianAset', true, false),
  ('rsp-copy-writer-deskripsi', 'copy_writer', 'deskripsi', true, false),
  ('rsp-copy-writer-daftarunit', 'copy_writer', 'daftarUnit', true, false),
  ('rsp-copy-writer-daftarsarpras', 'copy_writer', 'daftarSarpras', true, false),
  ('rsp-copy-writer-dokumenteknis', 'copy_writer', 'dokumenTeknis', true, false),
  ('rsp-copy-writer-aset', 'copy_writer', 'aset', true, false),
  ('rsp-copy-writer-penyesuaianaset', 'copy_writer', 'penyesuaianAset', true, false),
  ('rsp-design-graphic-staff-deskripsi', 'design_graphic_staff', 'deskripsi', true, false),
  ('rsp-design-graphic-staff-daftarunit', 'design_graphic_staff', 'daftarUnit', true, false),
  ('rsp-design-graphic-staff-daftarsarpras', 'design_graphic_staff', 'daftarSarpras', true, false),
  ('rsp-design-graphic-staff-dokumenteknis', 'design_graphic_staff', 'dokumenTeknis', true, false),
  ('rsp-design-graphic-staff-aset', 'design_graphic_staff', 'aset', true, false),
  ('rsp-design-graphic-staff-penyesuaianaset', 'design_graphic_staff', 'penyesuaianAset', true, false),
  ('rsp-graphic-designer-deskripsi', 'graphic_designer', 'deskripsi', true, false),
  ('rsp-graphic-designer-daftarunit', 'graphic_designer', 'daftarUnit', true, false),
  ('rsp-graphic-designer-daftarsarpras', 'graphic_designer', 'daftarSarpras', true, false),
  ('rsp-graphic-designer-dokumenteknis', 'graphic_designer', 'dokumenTeknis', true, false),
  ('rsp-graphic-designer-aset', 'graphic_designer', 'aset', true, false),
  ('rsp-graphic-designer-penyesuaianaset', 'graphic_designer', 'penyesuaianAset', true, false)
on conflict ("id") do nothing;

commit;
