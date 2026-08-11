-- =====================================================
-- إنشاء جدول طلبات تعديل/حذف الكشافين
-- =====================================================

CREATE TABLE IF NOT EXISTS public.scout_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scout_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('edit', 'delete')),
    scout_data JSONB,
    school_stage TEXT,
    requested_by TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_scout_requests_status ON public.scout_requests(status);
CREATE INDEX IF NOT EXISTS idx_scout_requests_requested_by ON public.scout_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_scout_requests_scout_id ON public.scout_requests(scout_id);

-- إضافة تعليقات على الأعمدة
COMMENT ON TABLE public.scout_requests IS 'جدول طلبات تعديل وحذف الكشافين من قادة الفرق';
COMMENT ON COLUMN public.scout_requests.scout_id IS 'الكود الكشفي للكشاف';
COMMENT ON COLUMN public.scout_requests.type IS 'نوع الطلب: edit للتعديل، delete للحذف';
COMMENT ON COLUMN public.scout_requests.scout_data IS 'بيانات الكشاف المطلوب تعديلها (JSON)';
COMMENT ON COLUMN public.scout_requests.school_stage IS 'المرحلة الدراسية';
COMMENT ON COLUMN public.scout_requests.requested_by IS 'اسم المستخدم اللي طلب التعديل/الحذف';
COMMENT ON COLUMN public.scout_requests.status IS 'حالة الطلب: pending, approved, rejected';
