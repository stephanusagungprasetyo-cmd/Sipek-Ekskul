-- SCRIPT UNTUK MENAMBAHKAN SEMESTER PADA TABEL SCORES
-- Salin dan jalankan script ini di SQL Editor Supabase Anda

-- 1. Tambahkan kolom semester ke tabel scores (Default 1 untuk Semester 1)
ALTER TABLE public.scores 
ADD COLUMN IF NOT EXISTS semester INT DEFAULT 1;

-- 2. Update data nilai yang sudah ada agar terdata sebagai Semester 1
UPDATE public.scores 
SET semester = 1 
WHERE semester IS NULL;

-- 3. Perbarui unique constraint agar mendukung nilai per semester (Opsional)
DO $$
BEGIN
  -- Cek dan hapus constraint lama jika ada
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scores_student_id_extracurricular_id_key'
  ) THEN
    ALTER TABLE public.scores DROP CONSTRAINT scores_student_id_extracurricular_id_key;
    ALTER TABLE public.scores ADD CONSTRAINT scores_student_ekskul_semester_key UNIQUE (student_id, extracurricular_id, semester);
  END IF;
END $$;

-- 4. Tambahkan index untuk optimasi filter semester
CREATE INDEX IF NOT EXISTS idx_scores_semester ON public.scores(semester);

DO $$
BEGIN
  RAISE NOTICE 'Kolom semester berhasil ditambahkan ke tabel scores';
END $$;

