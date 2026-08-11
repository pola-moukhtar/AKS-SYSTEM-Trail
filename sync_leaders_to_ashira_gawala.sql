-- SQL Script: مزامنة القادة كمخدومين في عشيرة الجوالة
-- هذا السكربت ينشئ سجلات للقادة في جدول scouts بحيث يكونوا مخدومين في فرقة "عشيرة الجوالة"

-- 1. إنشاء trigger function للمزامنة التلقائية
CREATE OR REPLACE FUNCTION sync_leader_to_ashira_gawala()
RETURNS TRIGGER AS $$
BEGIN
    -- عند إضافة قائد جديد بفرقة "عشيرة الجوالة"، ينشئ له سجل في جدول scouts
    IF NEW.troop = 'عشيرة الجوالة' OR NEW.sector = 'عشيرة جوالة' THEN
        -- التحقق من عدم وجود سجل سابق للقائد في عشيرة الجوالة
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
                leader_sync_id,  -- ربط بجدول القادة
                comments
            ) VALUES (
                'L' || LPAD(NEW.id::text, 5, '0'),  -- كود يبدأ بـ L للقادة
                NEW.full_name,
                NEW.phone,
                NEW.email,
                NEW.birth_date,
                CASE WHEN NEW.gender = 'ذكر' THEN 'ولد' ELSE 'بنت' END,
                'عشيرة جوالة',
                NULL, -- السنة الدراسية اختيارية
                'عام',
                'مقبول', -- القادة مقبولين تلقائياً
                NEW.id, -- ربط بجدول القادة
                'تم إنشاء هذا السجل تلقائياً كمخدوم في عشيرة الجوالة'
            );
        END IF;
    END IF;

    -- عند تعديل بيانات القائد، تحديث سجل الكشاف المرتبط
    IF OLD.troop = 'عشيرة الجوالة' OR OLD.sector = 'عشيرة جوالة' OR 
       NEW.troop = 'عشيرة الجوالة' OR NEW.sector = 'عشيرة جوالة' THEN
        
        UPDATE scouts SET
            full_name = NEW.full_name,
            personal_phone = NEW.phone,
            personal_email = NEW.email,
            birth_date = NEW.birth_date,
            gender = CASE WHEN NEW.gender = 'ذكر' THEN 'ولد' ELSE 'بنت' END
        WHERE leader_sync_id = NEW.id AND school_stage = 'عشيرة جوالة';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. إنشاء trigger للمزامنة عند إضافة/تعديل القادة
DROP TRIGGER IF EXISTS trigger_sync_leader_to_ashira ON leaders;
CREATE TRIGGER trigger_sync_leader_to_ashira
    AFTER INSERT OR UPDATE ON leaders
    FOR EACH ROW
    EXECUTE FUNCTION sync_leader_to_ashira_gawala();

-- 3. إضافة عمود leader_sync_id لجدول scouts إذا لم يكن موجوداً
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scouts' AND column_name = 'leader_sync_id'
    ) THEN
        ALTER TABLE scouts ADD COLUMN leader_sync_id INTEGER REFERENCES leaders(id);
        CREATE INDEX idx_scouts_leader_sync_id ON scouts(leader_sync_id);
    END IF;
END $$;

-- 4. مزامنة القادة الموجودين حالياً (إن وجدوا)
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
)
SELECT 
    'L' || LPAD(l.id::text, 5, '0'),
    l.full_name,
    l.phone,
    l.email,
    l.birth_date,
    CASE WHEN l.gender = 'ذكر' THEN 'ولد' ELSE 'بنت' END,
    'عشيرة جوالة',
    NULL,
    'عام',
    'مقبول',
    l.id,
    'تم إنشاء هذا السجل تلقائياً كمخدوم في عشيرة الجوالة - مزامنة أولية'
FROM leaders l
WHERE (l.troop = 'عشيرة الجوالة' OR l.sector = 'عشيرة جوالة')
AND NOT EXISTS (
    SELECT 1 FROM scouts s 
    WHERE s.leader_sync_id = l.id 
    AND s.school_stage = 'عشيرة جوالة'
);

-- 5. trigger للحذف (عند حذف قائد أو تغيير فرقته)
CREATE OR REPLACE FUNCTION cleanup_ashira_gawala_scout()
RETURNS TRIGGER AS $$
BEGIN
    -- عند حذف قائد أو تغيير فرقته بعيداً عن عشيرة الجوالة
    IF OLD.troop = 'عشيرة الجوالة' OR OLD.sector = 'عشيرة جوالة' THEN
        -- إذا تم تغيير الفرقة وليس حذف القائد
        IF TG_OP = 'UPDATE' AND (NEW.troop != 'عشيرة الجوالة' AND NEW.sector != 'عشيرة جوالة') THEN
            DELETE FROM scouts WHERE leader_sync_id = OLD.id AND school_stage = 'عشيرة جوالة';
        -- إذا تم حذف القائد نهائياً
        ELSIF TG_OP = 'DELETE' THEN
            DELETE FROM scouts WHERE leader_sync_id = OLD.id AND school_stage = 'عشيرة جوالة';
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger للحذف والتحديث
DROP TRIGGER IF EXISTS trigger_cleanup_ashira_gawala ON leaders;
CREATE TRIGGER trigger_cleanup_ashira_gawala
    AFTER UPDATE OR DELETE ON leaders
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_ashira_gawala_scout();

-- 6. دالة يدوية لإعادة مزامنة جميع القادة (للطوارئ)
CREATE OR REPLACE FUNCTION manual_sync_all_ashira_gawala()
RETURNS TEXT AS $$
DECLARE
    synced_count INTEGER := 0;
BEGIN
    -- حذف السجلات القديمة للقادة الذين لم يعودوا في عشيرة الجوالة
    DELETE FROM scouts 
    WHERE leader_sync_id IS NOT NULL 
    AND school_stage = 'عشيرة جوالة'
    AND leader_sync_id NOT IN (
        SELECT id FROM leaders 
        WHERE troop = 'عشيرة الجوالة' OR sector = 'عشيرة جوالة'
    );

    -- إضافة القادة الجدد
    INSERT INTO scouts (
        scout_id, full_name, personal_phone, personal_email, birth_date, gender,
        school_stage, school_year, certificate, status, leader_sync_id, comments
    )
    SELECT 
        'L' || LPAD(l.id::text, 5, '0'), l.full_name, l.phone, l.email, l.birth_date,
        CASE WHEN l.gender = 'ذكر' THEN 'ولد' ELSE 'بنت' END,
        'عشيرة جوالة', NULL, 'عام', 'مقبول', l.id,
        'مزامنة يدوية - ' || NOW()::text
    FROM leaders l
    WHERE (l.troop = 'عشيرة الجوالة' OR l.sector = 'عشيرة جوالة')
    AND NOT EXISTS (
        SELECT 1 FROM scouts s WHERE s.leader_sync_id = l.id AND s.school_stage = 'عشيرة جوالة'
    );
    
    GET DIAGNOSTICS synced_count = ROW_COUNT;
    RETURN 'تمت مزامنة ' || synced_count || ' قائد/قادة إلى عشيرة الجوالة';
END;
$$ LANGUAGE plpgsql;

-- رسالة إتمام
SELECT 'تم إعداد نظام مزامنة القادة إلى عشيرة الجوالة بنجاح!' as result;