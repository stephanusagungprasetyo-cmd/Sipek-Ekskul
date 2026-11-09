-- ==============================================================================
-- SCRIPT LENGKAP: SEMESTER 1 & 2, KUNCI NILAI, LOGIKA PRESENSI, DAN REALTIME
-- ==============================================================================
-- Salin dan jalankan seluruh script ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ckciqfmuddkpzypiwpqi/sql

-- 1. Tambahkan kolom semester dan is_locked pada tabel scores
ALTER TABLE public.scores 
ADD COLUMN IF NOT EXISTS semester INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Pastikan semua data nilai lama berstatus Semester 1
UPDATE public.scores 
SET semester = 1 
WHERE semester IS NULL;

-- 2. Perbarui Unique Constraint pada tabel scores agar mendukung nilai per semester
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scores_student_id_extracurricular_id_key'
  ) THEN
    ALTER TABLE public.scores DROP CONSTRAINT scores_student_id_extracurricular_id_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scores_student_ekskul_semester_key'
  ) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_student_ekskul_semester_key UNIQUE (student_id, extracurricular_id, semester);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scores_semester ON public.scores(semester);

-- 3. Tambahkan kolom pilihan ekskul Semester 2 pada tabel students (Opsi B: Boleh Ganti Ekskul di Semester 2)
-- Jika NULL, maka siswa otomatis melanjutkan ekskul pilihan Semester 1
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS sem2_pilihan_1_id UUID REFERENCES extracurriculars(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sem2_pilihan_2_id UUID REFERENCES extracurriculars(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sem2_pilihan_3_id UUID REFERENCES extracurriculars(id) ON DELETE SET NULL;

-- 4. Tabel Pengaturan Sistem (Termasuk Kunci Nilai Semester 1)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on system_settings" ON public.system_settings;
CREATE POLICY "Allow all for authenticated on system_settings" 
ON public.system_settings FOR ALL TO authenticated USING (true);

INSERT INTO public.system_settings (key, value)
VALUES ('semester_lock', '{"semester_1_locked": false, "active_semester": 1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Perbarui Fungsi Perhitungan Nilai Rata-rata di PostgreSQL (HANYA 'O' HADIR)
CREATE OR REPLACE FUNCTION calculate_average_score()
RETURNS TRIGGER AS $$
DECLARE
  att_score NUMERIC := 0;
  prac_score NUMERIC := 0;
  know_score NUMERIC := 0;
  
  att_count INT := 0;
  att_present INT := 0;
  
  prac_count INT := 0;
  prac_sum NUMERIC := 0;
  
  know_count INT := 0;
  know_sum NUMERIC := 0;
  
  active_categories INT := 0;
  vals TEXT[];
  v TEXT;
BEGIN
  -- Hitung Nilai Absensi (att_1 s.d att_12)
  vals := ARRAY[NEW.att_1, NEW.att_2, NEW.att_3, NEW.att_4, NEW.att_5, NEW.att_6, 
                NEW.att_7, NEW.att_8, NEW.att_9, NEW.att_10, NEW.att_11, NEW.att_12];
  FOREACH v IN ARRAY vals LOOP
    IF v IS NOT NULL AND v <> '' THEN
      att_count := att_count + 1;
      -- HANYA 'O' (Hadir) yang dihitung hadir fisik (1 poin)
      IF UPPER(TRIM(v)) = 'O' THEN
        att_present := att_present + 1;
      END IF;
    END IF;
  END LOOP;

  IF att_count > 0 THEN
    att_score := (att_present::NUMERIC / att_count::NUMERIC) * 100;
    active_categories := active_categories + 1;
  END IF;

  -- Hitung Nilai Praktik (prac_1 s.d prac_5) dengan pembatasan 0-100
  IF NEW.prac_1 IS NOT NULL THEN prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_1)); prac_count := prac_count + 1; END IF;
  IF NEW.prac_2 IS NOT NULL THEN prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_2)); prac_count := prac_count + 1; END IF;
  IF NEW.prac_3 IS NOT NULL THEN prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_3)); prac_count := prac_count + 1; END IF;
  IF NEW.prac_4 IS NOT NULL THEN prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_4)); prac_count := prac_count + 1; END IF;
  IF NEW.prac_5 IS NOT NULL THEN prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_5)); prac_count := prac_count + 1; END IF;

  IF prac_count > 0 THEN
    prac_score := prac_sum / prac_count;
    active_categories := active_categories + 1;
  END IF;

  -- Hitung Nilai Pengetahuan (know_1 s.d know_3) dengan pembatasan 0-100
  IF NEW.know_1 IS NOT NULL THEN know_sum := know_sum + LEAST(100, GREATEST(0, NEW.know_1)); know_count := know_count + 1; END IF;
  IF NEW.know_2 IS NOT NULL THEN know_sum := know_sum + LEAST(100, GREATEST(0, NEW.know_2)); know_count := know_count + 1; END IF;
  IF NEW.know_3 IS NOT NULL THEN know_sum := know_sum + LEAST(100, GREATEST(0, NEW.know_3)); know_count := know_count + 1; END IF;

  IF know_count > 0 THEN
    know_score := know_sum / know_count;
    active_categories := active_categories + 1;
  END IF;

  -- Rerata dari kategori yang aktif saja
  IF active_categories > 0 THEN
    NEW.average_score := (att_score + prac_score + know_score) / active_categories;
  ELSE
    NEW.average_score := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Pasang Trigger Rerata
DROP TRIGGER IF EXISTS trg_calculate_average_score ON scores;
CREATE TRIGGER trg_calculate_average_score
BEFORE INSERT OR UPDATE ON scores
FOR EACH ROW
EXECUTE FUNCTION calculate_average_score();

-- 7. Hitung ulang seluruh average_score lama di tabel scores
UPDATE scores SET updated_at = NOW();

-- 8. Aktifkan Supabase Realtime untuk tabel students, scores, dan system_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE students;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'extracurriculars'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE extracurriculars;
  END IF;
END $$;
