-- 1. Buat fungsi untuk menghitung average_score secara otomatis di database
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
  
  vals TEXT[];
  v TEXT;
BEGIN
  -- Hitung Nilai Absensi (att_1 s.d att_12)
  vals := ARRAY[NEW.att_1, NEW.att_2, NEW.att_3, NEW.att_4, NEW.att_5, NEW.att_6, 
                NEW.att_7, NEW.att_8, NEW.att_9, NEW.att_10, NEW.att_11, NEW.att_12];
  FOREACH v IN ARRAY vals LOOP
    IF v IS NOT NULL AND v <> '' THEN
      att_count := att_count + 1;
      IF v = 'O' OR v = 'I' OR v = 'S' THEN
        att_present := att_present + 1;
      END IF;
    END IF;
  END LOOP;
  IF att_count > 0 THEN
    att_score := (att_present::NUMERIC / att_count::NUMERIC) * 100;
  END IF;

  -- Hitung Nilai Praktik (prac_1 s.d prac_5)
  IF NEW.prac_1 IS NOT NULL THEN prac_sum := prac_sum + NEW.prac_1; prac_count := prac_count + 1; END IF;
  IF NEW.prac_2 IS NOT NULL THEN prac_sum := prac_sum + NEW.prac_2; prac_count := prac_count + 1; END IF;
  IF NEW.prac_3 IS NOT NULL THEN prac_sum := prac_sum + NEW.prac_3; prac_count := prac_count + 1; END IF;
  IF NEW.prac_4 IS NOT NULL THEN prac_sum := prac_sum + NEW.prac_4; prac_count := prac_count + 1; END IF;
  IF NEW.prac_5 IS NOT NULL THEN prac_sum := prac_sum + NEW.prac_5; prac_count := prac_count + 1; END IF;
  IF prac_count > 0 THEN
    prac_score := prac_sum / prac_count;
  END IF;

  -- Hitung Nilai Pengetahuan (know_1 s.d know_3)
  IF NEW.know_1 IS NOT NULL THEN know_sum := know_sum + NEW.know_1; know_count := know_count + 1; END IF;
  IF NEW.know_2 IS NOT NULL THEN know_sum := know_sum + NEW.know_2; know_count := know_count + 1; END IF;
  IF NEW.know_3 IS NOT NULL THEN know_sum := know_sum + NEW.know_3; know_count := know_count + 1; END IF;
  IF know_count > 0 THEN
    know_score := know_sum / know_count;
  END IF;

  -- Rerata dari ketiganya
  NEW.average_score := (att_score + prac_score + know_score) / 3;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Buat trigger pada tabel scores
DROP TRIGGER IF EXISTS trg_calculate_average_score ON scores;
CREATE TRIGGER trg_calculate_average_score
BEFORE INSERT OR UPDATE ON scores
FOR EACH ROW
EXECUTE FUNCTION calculate_average_score();

-- 3. Update data lama yang sudah ada di database untuk menghitung ulang nilai rata-ratanya
UPDATE scores SET updated_at = NOW();
