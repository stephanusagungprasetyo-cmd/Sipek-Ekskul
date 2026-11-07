-- SCRIPT UNTUK MENAMBAHKAN TAHUN AJARAN PADA TABEL STUDENTS
-- Jalankan script ini di SQL Editor Supabase Anda (1 kali saja)

-- 1. Tambahkan kolom academic_year ke tabel students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2025/2026';

-- 2. Update data siswa yang sudah ada sebelumnya agar terdata sebagai Tahun Ajaran 2025/2026
UPDATE public.students 
SET academic_year = '2025/2026' 
WHERE academic_year IS NULL;

-- 3. Tambahkan index untuk optimasi performa query & pagination per tahun ajaran
CREATE INDEX IF NOT EXISTS idx_students_academic_year ON public.students(academic_year);

-- 4. Notifikasi
DO $$
BEGIN
  RAISE NOTICE 'Kolom academic_year berhasil ditambahkan dan data lama diset ke Tahun Ajaran 2025/2026';
END $$;
