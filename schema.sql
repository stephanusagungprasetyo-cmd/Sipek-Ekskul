-- 1. Create Extracurriculars table
CREATE TABLE extracurriculars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('master_data', 'koordinator', 'pelatih', 'pendamping')) NOT NULL,
  extracurricular_id UUID REFERENCES extracurriculars(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create Students table
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('L', 'P')) NOT NULL,
  class_name TEXT NOT NULL,
  wajib_id UUID REFERENCES extracurriculars(id) ON DELETE SET NULL,
  pilihan_1_id UUID REFERENCES extracurriculars(id) ON DELETE SET NULL,
  pilihan_2_id UUID REFERENCES extracurriculars(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Create Scores table
CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  extracurricular_id UUID REFERENCES extracurriculars(id) ON DELETE CASCADE NOT NULL,
  
  -- Attendance (12 sessions: O, I, A, S)
  att_1 TEXT, att_2 TEXT, att_3 TEXT, att_4 TEXT, att_5 TEXT, att_6 TEXT,
  att_7 TEXT, att_8 TEXT, att_9 TEXT, att_10 TEXT, att_11 TEXT, att_12 TEXT,
  
  -- Practice (5 times)
  prac_1 NUMERIC, prac_2 NUMERIC, prac_3 NUMERIC, prac_4 NUMERIC, prac_5 NUMERIC,
  
  -- Knowledge (3 times)
  know_1 NUMERIC, know_2 NUMERIC, know_3 NUMERIC,
  
  average_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, extracurricular_id)
);

-- Enable RLS
ALTER TABLE extracurriculars ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Simple Policies
CREATE POLICY "Allow all for authenticated" ON extracurriculars FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON students FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON scores FOR ALL TO authenticated USING (true);

-- Insert initial data (23 Ekskul)
INSERT INTO extracurriculars (name) VALUES 
('Badminton'), ('Band'), ('Basket'), ('Catur'), ('Cooking Class'), 
('Desain Animasi'), ('Dewan Galang'), ('English Club'), ('Esport'), 
('Floorball'), ('Futsal'), ('Math Club'), ('Modern Dance'), 
('Multimedia'), ('Paduan Suara'), ('Paskibra'), ('PMR'), 
('Pramuka'), ('Programming'), ('Renang'), ('Science Club'), 
('Theater'), ('Tenis Meja');
