# Bugfix Requirements Document

## Introduction

هذا المستند يوثق إصلاح خلل في نظام Ava Kirolos Scout System يتعلق بعدم ظهور مهام الافتقاد (follow-up tasks) للقادة المعينين لهم. عندما يقوم قائد قطاع (SectorLeader) بإنشاء مهمة افتقاد ويعينها لقائد فرقة (TroopLeader)، لا تظهر هذه المهمة في قائمة المهام الخاصة بقائد الفرقة المعين.

التأثير: قادة الفرق لا يستطيعون رؤية المهام المعينة لهم، مما يعطل سير عمل الافتقاد ويمنع القادة من متابعة الكشافين المسؤولين عنهم.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN قائد قطاع ينشئ مهمة افتقاد ويعينها لقائد فرقة معين عن طريق اختياره من القائمة المنسدلة THEN المهمة لا تظهر في قائمة المهام الخاصة بقائد الفرقة المعين

1.2 WHEN قائد فرقة يفتح صفحة الافتقاد (follow_up.html) THEN يرى رسالة "مفيش مهام افتقاد حالياً تخصك" رغم وجود مهام معينة له في قاعدة البيانات

1.3 WHEN يتم تخزين اسم القائد المعين في حقل `notes` بصيغة `[اسم القائد] ملاحظات` THEN عملية الفلترة تفشل في مطابقة اسم القائد بشكل صحيح بسبب مشاكل في المسافات أو الصيغة

### Expected Behavior (Correct)

2.1 WHEN قائد قطاع ينشئ مهمة افتقاد ويعينها لقائد فرقة معين THEN يجب تخزين معرف القائد المعين (assigned_to) واسمه (assigned_to_name) في حقول مخصصة في جدول follow_up_tasks

2.2 WHEN قائد فرقة يفتح صفحة الافتقاد THEN يجب أن يرى جميع المهام التي تم تعيينها له عن طريق مطابقة معرفه (user.id) مع حقل assigned_to في قاعدة البيانات

2.3 WHEN يتم استعلام المهام لقائد فرقة THEN يجب استخدام حقل assigned_to المخصص بدلاً من البحث النصي في حقل notes

2.4 WHEN قائد قطاع أو قائد عام أو ماستر يفتح صفحة الافتقاد THEN يجب أن يرى جميع المهام في قطاعه أو في كل المجموعة حسب صلاحياته

### Unchanged Behavior (Regression Prevention)

3.1 WHEN قائد قطاع ينشئ مهمة افتقاد جديدة THEN يجب أن تستمر عملية إنشاء المهمة بنفس الطريقة مع إضافة حقول التعيين الجديدة

3.2 WHEN يتم عرض تفاصيل مهمة افتقاد (الكشافين، نسبة الإنجاز، الملاحظات) THEN يجب أن تستمر في العمل بنفس الطريقة الحالية

3.3 WHEN قائد يقوم بتحديث حالة الافتقاد (contacted checkbox) أو إضافة ملاحظات THEN يجب أن تستمر هذه العمليات في العمل بشكل صحيح

3.4 WHEN قائد قطاع أو قائد عام أو ماستر يحذف مهمة افتقاد THEN يجب أن تستمر عملية الحذف في العمل وحذف جميع السجلات المرتبطة

3.5 WHEN يتم تحميل قائمة القادة المتاحين في القطاع عند إنشاء مهمة جديدة THEN يجب أن تستمر في عرض قادة الفرق المناسبين حسب القطاع

3.6 WHEN يتم اختيار قائد فرقة من القائمة المنسدلة THEN يجب أن يستمر تحميل قائمة الكشافين المرتبطين بفرقته بشكل صحيح

## Bug Condition and Property Specification

### Bug Condition Function

```pascal
FUNCTION isBugCondition(task, currentUser)
  INPUT: task of type FollowUpTask
  INPUT: currentUser of type Leader
  OUTPUT: boolean
  
  // Returns true when the bug condition is met:
  // - User is a TroopLeader
  // - Task is assigned to this TroopLeader
  // - Task assignment is stored in notes field (old method)
  
  IF currentUser.role ≠ 'TroopLeader' THEN
    RETURN false
  END IF
  
  IF task.notes IS NULL OR task.notes = '' THEN
    RETURN false
  END IF
  
  // Old buggy method: checking if leader name is in notes
  cleanNotes ← TRIM(task.notes)
  currentLeaderName ← TRIM(currentUser.full_name)
  
  hasAssignmentInNotes ← (cleanNotes CONTAINS '[' AND cleanNotes CONTAINS currentLeaderName)
  
  RETURN hasAssignmentInNotes
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - Task Visibility for Assigned TroopLeader
FOR ALL task WHERE isBugCondition(task, currentUser) DO
  visibleTasks ← loadTasksWithNewMethod(currentUser)
  
  ASSERT task IN visibleTasks
  ASSERT task.assigned_to = currentUser.id
  ASSERT task.assigned_to_name = currentUser.full_name
END FOR
```

**التفسير**: بعد الإصلاح، جميع المهام المعينة لقائد فرقة يجب أن تظهر له باستخدام حقل `assigned_to` المخصص بدلاً من البحث النصي في `notes`.

### Property: Preservation Checking

```pascal
// Property: Preservation Checking - Other Roles and Functionality
FOR ALL task, user WHERE NOT isBugCondition(task, user) DO
  // For SectorLeader, General, Master
  IF user.role IN ['SectorLeader', 'General', 'Master'] THEN
    visibleTasksOld ← loadTasksOldMethod(user)
    visibleTasksNew ← loadTasksNewMethod(user)
    
    ASSERT visibleTasksOld = visibleTasksNew
  END IF
  
  // Task creation, update, delete operations
  ASSERT createTask_Old(data) = createTask_New(data)
  ASSERT updateTaskRecord_Old(id, data) = updateTaskRecord_New(id, data)
  ASSERT deleteTask_Old(id) = deleteTask_New(id)
END FOR
```

**التفسير**: السلوك الحالي لجميع الأدوار الأخرى (SectorLeader, General, Master) وجميع العمليات الأخرى (إنشاء، تحديث، حذف) يجب أن يبقى كما هو بدون تغيير.

## Counterexample

**مثال محدد يوضح الخلل:**

1. قائد قطاع "أحمد محمد" (SectorLeader, sector: "ابتدائي") يقوم بإنشاء مهمة افتقاد
2. يختار قائد فرقة "محمد علي" (TroopLeader, troop: "أشبال وزهرات", id: "leader-123")
3. يتم حفظ المهمة في قاعدة البيانات:
   - `task_date`: "2024-01-15"
   - `sector`: "ابتدائي"
   - `created_by`: "أحمد محمد"
   - `notes`: "[محمد علي] افتقاد أسبوعي"
   - `assigned_to`: NULL (الحقل غير موجود حالياً)
   - `assigned_to_name`: NULL (الحقل غير موجود حالياً)

4. قائد الفرقة "محمد علي" يفتح صفحة follow_up.html
5. الكود الحالي يحاول الفلترة:
   ```javascript
   allTasks = rawTasks.filter(task => {
       if (!task.notes) return false;
       const cleanNotes = task.notes.trim();
       return cleanNotes.includes(`[`) && cleanNotes.includes(currentLeaderName);
   });
   ```
6. المشكلة: إذا كان هناك اختلاف بسيط في المسافات أو الصيغة، الفلترة تفشل
7. النتيجة: قائد الفرقة لا يرى المهمة المعينة له

**السلوك المتوقع بعد الإصلاح:**
- يتم إضافة حقول `assigned_to` و `assigned_to_name` إلى جدول `follow_up_tasks`
- عند إنشاء المهمة، يتم حفظ: `assigned_to: "leader-123"`, `assigned_to_name: "محمد علي"`
- عند تحميل المهام، يتم الاستعلام: `WHERE assigned_to = currentUser.id`
- قائد الفرقة يرى المهمة بشكل موثوق
