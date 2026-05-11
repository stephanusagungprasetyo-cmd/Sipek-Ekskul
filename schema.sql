-- 1. Create Extracurriculars table
CREATE TABLE extracurriculars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Profiles table (extending Supabase Auth)
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
  extracurricular_id UUID REFERENCES extracurriculars(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Create Scores table
CREATE TABLE scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  extracurricular_id UUID REFERENCES extracurriculars(id) ON DELETE CASCADE NOT NULL,
  attendance NUMERIC DEFAULT 0,
  practice NUMERIC DEFAULT 0,
  knowledge NUMERIC DEFAULT 0,
  final_score NUMERIC GENERATED ALWAYS AS ((attendance + practice + knowledge) / 3.0) STORED,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, extracurricular_id)
);

-- Enable RLS
ALTER TABLE extracurriculars ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Simple Policies (Allow authenticated users full access for this internal tool)
CREATE POLICY "Allow all for authenticated" ON extracurriculars FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON students FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON scores FOR ALL TO authenticated USING (true);

-- Insert initial data
INSERT INTO extracurriculars (name) VALUES 
('Badminton'), 
('Futsal'), 
('Basket'), 
('Pramuka');

-- Function to handle new user profile creation (optional but good practice)
-- Note: Since we are creating users manually for this simple app, we can just insert into profiles directly.
