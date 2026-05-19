-- SQL Migration: Menambahkan kolom pilihan_3_id ke tabel students
ALTER TABLE public.students 
ADD COLUMN pilihan_3_id UUID REFERENCES public.extracurriculars(id) ON DELETE SET NULL;
