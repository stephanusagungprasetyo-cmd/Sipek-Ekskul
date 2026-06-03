-- SCRIPT UNTUK RE-CREATE USER ADMIN DI SQL EDITOR SUPABASE
-- Salin dan jalankan seluruh script ini di SQL Editor Supabase Anda.

-- 1. Hapus entri user admin lama jika ada di auth.users (akan otomatis menghapus di profiles lewat cascade/manual jika perlu)
DELETE FROM auth.users WHERE email = 'admin@sipek.local';
DELETE FROM public.profiles WHERE username = 'admin';

-- 2. Deklarasikan variabel dan masukkan user baru ke auth.users serta public.profiles
DO $$
DECLARE
  new_admin_id UUID := gen_random_uuid();
BEGIN
  -- A. Insert ke tabel auth.users
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
    new_admin_id,
    'authenticated',
    'authenticated',
    'admin@sipek.local',
    crypt('adminP4Eks', gen_salt('bf', 10)),
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
  );

  -- B. Insert ke tabel public.profiles dengan role 'master_data'
  INSERT INTO public.profiles (
    id,
    username,
    role,
    extracurricular_id
  ) VALUES (
    new_admin_id,
    'admin',
    'master_data',
    NULL
  );

  RAISE NOTICE 'User admin berhasil dibuat dengan UUID: %', new_admin_id;
END $$;
