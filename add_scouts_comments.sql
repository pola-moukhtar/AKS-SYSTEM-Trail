-- =====================================================
-- إضافة حقل الملاحظات/الكومنتات لجدول الكشافين
-- =====================================================

ALTER TABLE public.scouts 
ADD COLUMN IF NOT EXISTS comments TEXT;

COMMENT ON COLUMN public.scouts.comments IS 'ملاحظات القادة عن الكشاف';
