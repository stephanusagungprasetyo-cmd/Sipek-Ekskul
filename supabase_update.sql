-- 1. Hapus akun bawaan lama (kecuali akun admin utama)
DELETE FROM auth.users 
WHERE email IN (
  'koordinator@sipek.local', 
  'pelatih@sipek.local', 
  'pendamping@sipek.local'
);

-- 2. Buat fungsi mendaftarkan user baru di sisi database (Bypass Rate Limit & Email Verification)
-- Menyertakan instance_id, timestamps, metadata, dan string kosong untuk token agar kompatibel dengan GoTrue driver Go
CREATE OR REPLACE FUNCTION create_user(
  new_username TEXT,
  new_password TEXT,
  new_role TEXT
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
  new_email TEXT;
BEGIN
  new_email := new_username || '@sipek.com';
  
  -- Insert ke auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    new_email,
    crypt(new_password, gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    NOW(),
    NOW(),
    false,
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- Insert ke public.profiles (tanpa binding ekskul)
  INSERT INTO public.profiles (
    id,
    username,
    role,
    extracurricular_id
  ) VALUES (
    new_user_id,
    new_username,
    new_role,
    NULL
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fungsi pembantu untuk menghapus user
CREATE OR REPLACE FUNCTION delete_user_by_id(user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fungsi pembantu untuk mengganti/reset password user
CREATE OR REPLACE FUNCTION update_user_password(user_id UUID, new_password TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf', 10)),
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
