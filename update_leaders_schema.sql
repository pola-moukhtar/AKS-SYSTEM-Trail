-- =====================================================
-- تحديث جدول القادة بإضافة حقول جديدة
-- =====================================================

-- إضافة حقول الحالة الوظيفية/الدراسية
ALTER TABLE public.leaders 
ADD COLUMN IF NOT EXISTS employment_status TEXT CHECK (employment_status IN ('شغال', 'بيدرس', 'لا يعمل')),
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS workplace TEXT,
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS university TEXT,
ADD COLUMN IF NOT EXISTS faculty TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT,
ADD COLUMN IF NOT EXISTS scouting_experience TEXT;

-- إضافة تعليق على الحقول الجديدة
COMMENT ON COLUMN public.leaders.employment_status IS 'الحالة الوظيفية: شغال، بيدرس، لا يعمل';
COMMENT ON COLUMN public.leaders.job_title IS 'المسمى الوظيفي (للعاملين)';
COMMENT ON COLUMN public.leaders.workplace IS 'مكان العمل (للعاملين)';
COMMENT ON COLUMN public.leaders.education_level IS 'المرحلة الدراسية (للطلاب)';
COMMENT ON COLUMN public.leaders.university IS 'الجامعة (للطلاب)';
COMMENT ON COLUMN public.leaders.faculty IS 'الكلية (للطلاب)';
COMMENT ON COLUMN public.leaders.academic_year IS 'السنة الدراسية (للطلاب)';
COMMENT ON COLUMN public.leaders.scouting_experience IS 'الخبرة الكشفية السابقة';

-- ضمان عدم تكرار أسماء المستخدمين في جدول القادة
CREATE UNIQUE INDEX IF NOT EXISTS leaders_username_unique_idx
ON public.leaders (username);

-- إذا كان هناك اسم مستخدم تكرر حالياً، لازم يتم تنظيفه فوراً قبل تطبيق الفهرس
-- (النسخة النهائية تحتاج إعادة تسمية أو حذف السجلات المكررة يدويًا في قاعدة البيانات).