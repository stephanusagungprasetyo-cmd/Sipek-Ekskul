-- ==============================================================================
-- SCRIPT PEMBARUAN LOGIKA PRESENSI & AKTIVASI SUPABASE REALTIME
-- ==============================================================================
-- Salin dan jalankan seluruh script ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ckciqfmuddkpzypiwpqi/sql

-- 1. Perbarui Fungsi Perhitungan Nilai Rata-rata Otomatis di PostgreSQL
-- Aturan baru: HANYA nilai 'O' (Hadir) yang dihitung sebagai kehadiran fisik (1 poin).
-- Nilai 'I' (Izin), 'S' (Sakit), dan 'A' (Alpa) dihitung 0 poin kehadiran fisik.
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
  IF NEW.prac_1 IS NOT NULL THEN 
    prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_1)); 
    prac_count := prac_count + 1; 
  END IF;
  IF NEW.prac_2 IS NOT NULL THEN 
    prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_2)); 
    prac_count := prac_count + 1; 
  END IF;
  IF NEW.prac_3 IS NOT NULL THEN 
    prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_3)); 
    prac_count := prac_count + 1; 
  END IF;
  IF NEW.prac_4 IS NOT NULL THEN 
    prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_4)); 
    prac_count := prac_count + 1; 
  END IF;
  IF NEW.prac_5 IS NOT NULL THEN 
    prac_sum := prac_sum + LEAST(100, GREATEST(0, NEW.prac_5)); 
    prac_count := prac_count + 1; 
  END IF;

  IF prac_count > 0 THEN
    prac_score := prac_sum / prac_count;
    active_categories := active_categories + 1;
  END IF;

  -- Hitung Nilai Pengetahuan (know_1 s.d know_3) dengan pembatasan 0-100
  IF NEW.know_1 IS NOT NULL THEN 
    know_sum := know_sum + LEAST(100, GREATEST(0, NEW.know_1)); 
    know_count := know_count + 1; 
  END IF;
  IF NEW.know_2 IS NOT NULL THEN 
    know_sum := know_sum + LEAST(100, GREATEST(0, NEW.know_2)); 
    know_count := know_count + 1; 
  END IF;
  IF NEW.know_3 IS NOT NULL THEN 
    know_sum := know_sum + LEAST(100, GREATEST(0, NEW.know_3)); 
    know_count := know_count + 1; 
  END IF;

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

-- 2. Pastikan trigger terpasang pada tabel scores
DROP TRIGGER IF EXISTS trg_calculate_average_score ON scores;
CREATE TRIGGER trg_calculate_average_score
BEFORE INSERT OR UPDATE ON scores
FOR EACH ROW
EXECUTE FUNCTION calculate_average_score();

-- 3. Hitung ulang seluruh average_score lama di tabel scores dengan aturan baru
UPDATE scores SET updated_at = NOW();

-- 4. Aktifkan Supabase Realtime untuk tabel students dan scores
-- Supaya perubahan data langsung otomatis terkirim via WebSockets ke aplikasi
DO $$
BEGIN
  -- Tambahkan tabel students ke publication supabase_realtime jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE students;
  END IF;

  -- Tambahkan tabel scores ke publication supabase_realtime jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scores;
  END IF;
END $$;

-- 5. Bersihkan data nilai yatim (orphaned scores) yang ekskulnya sudah tidak lagi dipilih siswa
DELETE FROM scores s
WHERE NOT EXISTS (
  SELECT 1 FROM students st
  WHERE st.id = s.student_id
  AND (
    st.wajib_id = s.extracurricular_id OR
    st.pilihan_1_id = s.extracurricular_id OR
    st.pilihan_2_id = s.extracurricular_id OR
    st.pilihan_3_id = s.extracurricular_id
  )
);

