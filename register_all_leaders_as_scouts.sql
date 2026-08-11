-- SQL Script: تسجيل جميع القادة الموجودين كمخدومين في عشيرة الجوالة
-- هذا السكربت ينشئ سجلات لكل القادة في جدول scouts بحيث يكونوا مخدومين في فرقة "عشيرة الجوالة"

-- 0. أولاً تحديث constraint ليسمح بـ "عشيرة جوالة"
DO $$ 
BEGIN 
    -- حذف الـ constraint القديم إن وجد
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'scouts' AND constraint_name = 'scouts_school_stage_check'
    ) THEN
        ALTER TABLE scouts DROP CONSTRAINT scouts_school_stage_check;
    END IF;
    
    -- إضافة constraint جديد يتضمن "عشيرة جوالة"
    ALTER TABLE scouts ADD CONSTRAINT scouts_school_stage_check 
    CHECK (school_stage IN ('براعم', 'ابتدائي', 'اعدادي', 'ثانوي', 'مرشح جوالة', 'عشيرة جوالة'));
    
    RAISE NOTICE '✅ تم تحديث قيود school_stage لتشمل عشيرة جوالة';
END $$;

-- 1. أولاً إضافة عمود leader_sync_id إذا لم يكن موجوداً
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scouts' AND column_name = 'leader_sync_id'
    ) THEN
        ALTER TABLE scouts ADD COLUMN leader_sync_id UUID REFERENCES leaders(id);
        CREATE INDEX idx_scouts_leader_sync_id ON scouts(leader_sync_id);
    END IF;
END $$;

-- 1.1 تحديث FK ليتعامل مع الحذف المتتالي دون تكرار القيد
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'scouts_leader_sync_id_fkey'
          AND table_name = 'scouts'
    ) THEN
        ALTER TABLE scouts DROP CONSTRAINT scouts_leader_sync_id_fkey;
    END IF;

    ALTER TABLE scouts
        ADD CONSTRAINT scouts_leader_sync_id_fkey
        FOREIGN KEY (leader_sync_id) REFERENCES leaders(id) ON DELETE CASCADE;
END $$;

-- 2. حذف أي سجلات قديمة للقادة في عشيرة الجوالة (تنظيف)
DELETE FROM scouts 
WHERE leader_sync_id IS NOT NULL 
AND school_stage = 'عشيرة جوالة';

-- 3. إنشاء سجلات جديدة لكل القادة الموجودين
INSERT INTO scouts (
    scout_id,
    full_name,
    personal_phone,
    personal_email,
    birth_date,
    gender,
    school_stage,
    school_year,
    certificate,
    status,
    leader_sync_id,
    comments,
    created_at
)
SELECT 
    'L' || SUBSTRING(l.id::text FROM 1 FOR 8) as scout_id,
    l.full_name,
    NULL as personal_phone, -- set to NULL to avoid phone constraint
    NULL as personal_email,
    NULL as birth_date,
    NULL as gender,
    'عشيرة جوالة' as school_stage,
    NULL as school_year, -- السنة الدراسية اختيارية للقادة
    'عام' as certificate,
    'مقبول' as status, -- كل القادة مقبولين تلقائياً
    l.id as leader_sync_id,
    CONCAT(
        'تم إنشاء هذا السجل تلقائياً للقائد في عشيرة الجوالة - ',
        CASE l.role 
            WHEN 'Master' THEN 'ماستر'
            WHEN 'General' THEN 'قائد عام'
            WHEN 'SectorLeader' THEN CONCAT('قائد قطاع ', COALESCE(l.sector, ''))
            WHEN 'TroopLeader' THEN CONCAT('قائد فرقة ', COALESCE(l.troop, ''))
            WHEN 'Viewer' THEN 'عشيرة'
            ELSE l.role
        END,
        ' - تاريخ التسجيل: ', NOW()::date
    ) as comments,
    NOW() as created_at
FROM leaders l
WHERE l.status = 'نشط' -- فقط القادة النشطين
AND NOT EXISTS (
    -- التأكد من عدم وجود سجل مسبق
    SELECT 1 FROM scouts s 
    WHERE s.leader_sync_id = l.id 
    AND s.school_stage = 'عشيرة جوالة'
);

-- 4. إنشاء triggers للمزامنة التلقائية المستقبلية
CREATE OR REPLACE FUNCTION sync_leader_to_ashira_gawala()
RETURNS TRIGGER AS $$
BEGIN
    -- عند إضافة قائد جديد، ينشئ له سجل في جدول scouts
    IF TG_OP = 'INSERT' AND NEW.status = 'نشط' THEN
        -- التحقق من عدم وجود سجل سابق
        IF NOT EXISTS (
            SELECT 1 FROM scouts 
            WHERE leader_sync_id = NEW.id 
            AND school_stage = 'عشيرة جوالة'
        ) THEN
            -- إنشاء كود كشفي جديد للقائد
            INSERT INTO scouts (
                scout_id,
                full_name,
                personal_phone,
                personal_email,
                birth_date,
                gender,
                school_stage,
                school_year,
                certificate,
                status,
                leader_sync_id,
                comments
            ) VALUES (
                'L' || SUBSTRING(NEW.id::text FROM 1 FOR 8),
                NEW.full_name,
                NULL, -- avoid phone constraint
                NULL,
                NULL,
                NULL,
                'عشيرة جوالة',
                NULL,
                'عام',
                'مقبول',
                NEW.id,
                CONCAT('تم إنشاء هذا السجل تلقائياً كمخدوم في عشيرة الجوالة - ', NOW()::date)
            );
        END IF;
    END IF;

    -- عند تعديل بيانات القائد، تحديث سجل الكشاف المرتبط
    IF TG_OP = 'UPDATE' THEN
        UPDATE scouts SET
            full_name = NEW.full_name,
            personal_phone = NULL, -- avoid phone constraint
            personal_email = NULL,
            birth_date = NULL,
            gender = NULL,
            -- إذا تم إلغاء تنشيط القائد، إلغاء تنشيط الكشاف أيضاً
            status = CASE WHEN NEW.status = 'نشط' THEN 'مقبول' ELSE 'معلق' END
        WHERE leader_sync_id = NEW.id AND school_stage = 'عشيرة جوالة';
        
        -- إذا تم تنشيط قائد كان معطل، إنشاء سجل جديد له
        IF NEW.status = 'نشط' AND OLD.status != 'نشط' THEN
            IF NOT EXISTS (
                SELECT 1 FROM scouts 
                WHERE leader_sync_id = NEW.id 
                AND school_stage = 'عشيرة جوالة'
            ) THEN
                INSERT INTO scouts (
                    scout_id, full_name, personal_phone, personal_email, birth_date, gender,
                    school_stage, school_year, certificate, status, leader_sync_id, comments
                ) VALUES (
                    'L' || SUBSTRING(NEW.id::text FROM 1 FOR 8), NEW.full_name, NULL, NULL, NULL,
                    NULL,
                    'عشيرة جوالة', NULL, 'عام', 'مقبول', NEW.id,
                    CONCAT('تم إعادة تنشيط القائد في عشيرة الجوالة - ', NOW()::date)
                );
            END IF;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 5. إنشاء trigger للمزامنة عند إضافة/تعديل القادة
DROP TRIGGER IF EXISTS trigger_sync_leader_to_ashira ON leaders;
CREATE TRIGGER trigger_sync_leader_to_ashira
    AFTER INSERT OR UPDATE ON leaders
    FOR EACH ROW
    EXECUTE FUNCTION sync_leader_to_ashira_gawala();

-- 6. trigger للحذف
CREATE OR REPLACE FUNCTION cleanup_ashira_gawala_scout()
RETURNS TRIGGER AS $$
BEGIN
    -- عند حذف قائد، حذف سجله كمخدوم
    IF TG_OP = 'DELETE' THEN
        DELETE FROM scouts 
        WHERE leader_sync_id = OLD.id 
        AND school_stage = 'عشيرة جوالة';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger للحذف
DROP TRIGGER IF EXISTS trigger_cleanup_ashira_gawala ON leaders;
CREATE TRIGGER trigger_cleanup_ashira_gawala
    AFTER DELETE ON leaders
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_ashira_gawala_scout();

-- 7. عرض النتائج
DO $$
DECLARE
    total_leaders INTEGER;
    synced_scouts INTEGER;
BEGIN
    -- حساب عدد القادة الكلي
    SELECT COUNT(*) INTO total_leaders FROM leaders WHERE status = 'نشط';
    
    -- حساب عدد الكشافين المتزامنين
    SELECT COUNT(*) INTO synced_scouts 
    FROM scouts 
    WHERE leader_sync_id IS NOT NULL 
    AND school_stage = 'عشيرة جوالة';
    
    RAISE NOTICE '✅ تم إنجاز المزامنة بنجاح!';
    RAISE NOTICE '👥 عدد القادة النشطين: %', total_leaders;
    RAISE NOTICE '🏕️ عدد القادة المسجلين في عشيرة الجوالة: %', synced_scouts;
    RAISE NOTICE '🔄 تم تفعيل المزامنة التلقائية للقادة الجدد';
END $$;

-- 8. دالة يدوية لإعادة المزامنة (للطوارئ)
CREATE OR REPLACE FUNCTION manual_sync_all_leaders_to_ashira()
RETURNS TEXT AS $$
DECLARE
    synced_count INTEGER := 0;
BEGIN
    -- حذف السجلات القديمة للقادة المحذوفين أو المعطلين
    DELETE FROM scouts 
    WHERE leader_sync_id IS NOT NULL 
    AND school_stage = 'عشيرة جوالة'
    AND (
        leader_sync_id NOT IN (SELECT id FROM leaders WHERE status = 'نشط')
    );

    -- إضافة القادة الجدد
    INSERT INTO scouts (
        scout_id, full_name, personal_phone, personal_email, birth_date, gender,
        school_stage, school_year, certificate, status, leader_sync_id, comments
    )
    SELECT 
        'L' || SUBSTRING(l.id::text FROM 1 FOR 8), l.full_name, NULL, NULL, NULL,
        NULL,
        'عشيرة جوالة', NULL, 'عام', 'مقبول', l.id,
        CONCAT('مزامنة يدوية شاملة - ', NOW()::date)
    FROM leaders l
    WHERE l.status = 'نشط'
    AND NOT EXISTS (
        SELECT 1 FROM scouts s WHERE s.leader_sync_id = l.id AND s.school_stage = 'عشيرة جوالة'
    );
    
    GET DIAGNOSTICS synced_count = ROW_COUNT;
    RETURN 'تمت مزامنة ' || synced_count || ' قائد/قادة جدد إلى عشيرة الجوالة';
END;
$$ LANGUAGE plpgsql;

-- رسالة إتمام نهائية
SELECT '🎉 نظام عشيرة الجوالة جاهز! جميع القادة متاحين الآن كمخدومين للحضور والطلائع' as result;