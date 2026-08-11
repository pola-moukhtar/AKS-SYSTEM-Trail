// ==================== حماية الصفحة ====================
const sessionData = localStorage.getItem('scout_leader_session');
if (!sessionData) { window.location.href = 'index.html'; }
const currentUser = JSON.parse(sessionData);

// Debug: نطبع بيانات الـ session
console.log('👤 Current User Session:', currentUser);

document.addEventListener('DOMContentLoaded', () => {
    applyRoleRestrictions();
    fetchScouts();
    
    // ربط زرار الحفظ/إرسال طلب التعديل
    const submitBtn = document.getElementById('formSubmitBtn');
    console.log('🔘 Submit Button:', submitBtn);
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            console.log('🖱️ Button clicked! currentEditingScoutId:', currentEditingScoutId);
            if (!currentEditingScoutId) {
                console.warn('⚠️ No scout ID set!');
                return;
            }
            submitEditScout(currentEditingScoutId);
        });
        console.log('✅ Event listener attached');
    } else {
        console.error('❌ Submit button not found!');
    }
});

const SUPABASE_URL = 'https://xbdprjxvtwfieiqncbez.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZHByanh2dHdmaWVpcW5jYmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjI2NDgsImV4cCI6MjA5NTI5ODY0OH0.ptteVMU6OYawOqiQinKg2FQ_fpP-_VdG3BJY6alkgXM';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allScouts = [];
let attendanceData = [];
let currentFilterStage = 'الكل';
let currentFilterGender = 'الكل';
let scoutChartInstance = null;

// ==================== الصور والمراحل المدمجة ====================
function getDirectDriveLink(url) {
    if (!url || url.trim() === '') return 'https://via.placeholder.com/150?text=No+Image';
    const match = url.match(/(?:id=|d\/)([\w-]{25,33})/);
    if (match && match[1]) {
        const driveLink = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
        return `https://wsrv.nl/?url=${encodeURIComponent(driveLink)}&output=webp`;
    }
    return 'https://via.placeholder.com/150?text=No+Image';
}

// تم دمج المراحل بناءً على طلبك
function getScoutStage(schoolStage, gender) {
    if (!schoolStage) return 'مش محدد';
    const stage = schoolStage.trim();
    if (stage === 'براعم') return 'براعم';
    else if (stage === 'ابتدائي') return 'أشبال وزهرات';
    else if (stage === 'اعدادي') return 'مبتدئ ومرشدات';
    else if (stage === 'ثانوي') return 'متقدم ورائدات';
    else if (stage === 'مرشح جوالة') return 'مرشح جوالة';
    else if (stage === 'عشيرة جوالة') return 'عشيرة الجوالة';
    else return 'مش محدد';
}

// دالة تطبيع أسماء المراحل من المنفصلة إلى الموحدة
function normalizeScoutGroup(troop) {
    if (!troop) return '';
    const normalizations = {
        'أشبال': 'أشبال وزهرات',
        'زهرات': 'أشبال وزهرات',
        'كشاف مبتدئ': 'مبتدئ ومرشدات',
        'مرشدات': 'مبتدئ ومرشدات',
        'كشاف متقدم': 'متقدم ورائدات',
        'رائدات': 'متقدم ورائدات'
    };
    return normalizations[troop.trim()] || troop;
}

// تحويل اسم الفرقة/القطاع (قديم أو موحد) → school_stage في الداتابيز
function getDbSchoolStage(troopOrSector) {
    if (!troopOrSector) {
        console.warn('⚠️ getDbSchoolStage: input is null/undefined');
        return null;
    }
    const raw = String(troopOrSector).trim();
    const unified = normalizeScoutGroup(raw) || raw;
    const map = {
        'براعم': 'براعم',
        'أشبال وزهرات': 'ابتدائي', 'أشبال': 'ابتدائي', 'زهرات': 'ابتدائي',
        'مبتدئ ومرشدات': 'اعدادي', 'كشاف مبتدئ': 'اعدادي', 'مرشدات': 'اعدادي',
        'متقدم ورائدات': 'ثانوي', 'كشاف متقدم': 'ثانوي', 'رائدات': 'ثانوي',
        'مرشح جوالة': 'مرشح جوالة',
        'عشيرة الجوالة': 'عشيرة جوالة', // مع الـ 
        'عشيرة جوالة': 'عشيرة جوالة',  // بدون الـ
        'ابتدائي': 'ابتدائي', 'اعدادي': 'اعدادي', 'ثانوي': 'ثانوي'
    };
    const result = map[unified] || map[raw] || null;
    
    // Debug
    if (!result) {
        console.warn('⚠️ getDbSchoolStage: no mapping found', { input: troopOrSector, raw, unified });
    }
    
    return result;
}

// تحويل أي اسم → الاسم الموحد للواجهة (أشبال وزهرات، إلخ)
function getUnifiedGroupName(troopOrSector) {
    const dbStage = getDbSchoolStage(troopOrSector);
    if (dbStage === 'براعم') return 'براعم';
    if (dbStage === 'ابتدائي') return 'أشبال وزهرات';
    if (dbStage === 'اعدادي') return 'مبتدئ ومرشدات';
    if (dbStage === 'ثانوي') return 'متقدم ورائدات';
    if (dbStage === 'مرشح جوالة') return 'مرشح جوالة';
    if (dbStage === 'عشيرة جوالة') return 'عشيرة الجوالة';
    return normalizeScoutGroup(troopOrSector) || troopOrSector;
}

function getAllowedTroopNames(troopOrSector) {
    const unified = getUnifiedGroupName(troopOrSector);
    const map = {
        'براعم': ['براعم'],
        'أشبال وزهرات': ['أشبال وزهرات', 'أشبال', 'زهرات'],
        'مبتدئ ومرشدات': ['مبتدئ ومرشدات', 'كشاف مبتدئ', 'مرشدات'],
        'متقدم ورائدات': ['متقدم ورائدات', 'كشاف متقدم', 'رائدات'],
        'مرشح جوالة': ['مرشح جوالة'],
        'عشيرة الجوالة': ['عشيرة الجوالة']
    };
    return map[unified] || (troopOrSector ? [troopOrSector] : []);
}

function applyRoleRestrictions() {
    if (currentUser.role === 'Viewer') {
        const addBtn = document.getElementById('addScoutBtn'); 
        if (addBtn) addBtn.style.display = 'none';
    }
    
    // منع قادة عشيرة الجوالة من إضافة كشافين عاديين (القادة يتزامنوا تلقائياً)
    if (currentUser.role === 'SectorLeader' && 
        (currentUser.sector === 'عشيرة الجوالة' || currentUser.sector === 'عشيرة جوالة')) {
        const addBtn = document.getElementById('addScoutBtn');
        if (addBtn) {
            addBtn.style.display = 'none';
            console.log('🏕️ عشيرة الجوالة: منع إضافة كشافين عاديين - القادة يتزامنوا تلقائياً');
        }
    }
    
    if (currentUser.role === 'TroopLeader' || currentUser.role === 'SectorLeader') {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const allowedTabs = ['الكل'];
        const source = currentUser.role === 'TroopLeader' ? currentUser.troop : currentUser.sector;
        const unifiedTab = getUnifiedGroupName(source);
        if (unifiedTab) allowedTabs.push(unifiedTab);

        tabBtns.forEach(btn => { 
            const stage = btn.getAttribute('data-stage');
            if (!allowedTabs.includes(stage)) btn.style.display = 'none'; 
        });
    }
}

async function fetchScouts() {
    // منع عشيرة من رؤية البيانات
    if (currentUser.role === 'Viewer') {
        console.warn('⚠️ عشيرة ليس لديه صلاحية لرؤية البيانات');
        return [];
    }
    
    let query = supabaseClient.from('scouts').select('*').order('scout_id', { ascending: true });
    
    if (currentUser.role !== 'Master' && currentUser.role !== 'General') {
        query = query.eq('status', 'مقبول');
    }

    if (currentUser.role === 'TroopLeader' || currentUser.role === 'SectorLeader') {
        const source = currentUser.troop || currentUser.sector;
        const dbStage = getDbSchoolStage(source);
        
        // Debug: نطبع القيم عشان نشوف المشكلة فين
        console.log('🔍 Debug Info:', {
            role: currentUser.role,
            source: source,
            dbStage: dbStage,
            troop: currentUser.troop,
            sector: currentUser.sector
        });
        
        if (dbStage) {
            query = query.eq('school_stage', dbStage);
            console.log('🎯 Applied school_stage filter:', dbStage);
            
            // خاص: قائد عشيرة الجوالة يشوف القادة المتزامنين فقط
            if (dbStage === 'عشيرة جوالة') {
                query = query.not('leader_sync_id', 'is', null);
                console.log('🏕️ عشيرة الجوالة: فلترة القادة المتزامنين فقط');
                console.log('🔍 Final query will show only scouts with leader_sync_id NOT NULL');
            }
        } else {
            console.warn('⚠️ dbStage is null! Check getDbSchoolStage function');
            console.log('🔍 Mapping debug - source:', source, 'raw:', String(source || '').trim());
        }
    }

    const { data, error } = await query;
    
    if (error) {
        console.error('❌ Fetch Error:', error);
        return alert('فشل التحميل: ' + error.message);
    }
    
    console.log('✅ Fetched Scouts:', data?.length || 0, 'scouts');
    
    allScouts = data.map(scout => { scout.scout_group = getScoutStage(scout.school_stage, scout.gender); return scout; });
    
    // جيب أسماء الطلايع
    await fetchPatrolNames();
    
    updateScoutCounts();
    renderTable(); 
}

let patrolsMap = {};

async function fetchPatrolNames() {
    const { data: patrols } = await supabaseClient.from('patrols').select('id, name');
    patrolsMap = {};
    if (patrols) {
        patrols.forEach(p => { patrolsMap[p.id] = p.name; });
    }
}

function renderTable() {
    const tbody = document.getElementById('scoutsTableBody');
    if(!tbody) return;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    tbody.innerHTML = '';
    const filteredScouts = allScouts.filter(scout => {
    const matchesTab = currentFilterStage === 'الكل' || scout.scout_group === currentFilterStage;
    const matchesGender = currentFilterGender === 'الكل' || scout.gender === currentFilterGender;
    return matchesTab && matchesGender && `${scout.full_name} ${scout.scout_id} ${scout.personal_phone}`.toLowerCase().includes(searchTerm);
});
    if (filteredScouts.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-gray-400">مفيش نتايج...</td></tr>`; return; }
    filteredScouts.forEach(scout => {
        const imgSrc = getDirectDriveLink(scout.photo_url);
        const patrolName = scout.patrol_id ? (patrolsMap[scout.patrol_id] || '—') : '—';
        const comments = scout.comments || '—';
        const tr = document.createElement('tr');
        let actionsHtml = `<button onclick="viewProfile('${scout.scout_id}')" class="text-blue-600 hover:text-blue-900 text-lg"><i class="fa-solid fa-address-card"></i></button>`;
        if (canManageScoutsDirect || isTroopLeaderScout) {
            actionsHtml += `<button onclick="openEditModal('${scout.scout_id}')" class="text-green-600 hover:text-green-900 text-lg ml-3 mr-3"><i class="fa-solid fa-user-pen"></i></button>`;
            actionsHtml += `<button onclick="deleteScout('${scout.scout_id}')" class="text-red-500 hover:text-red-800 text-lg"><i class="fa-solid fa-user-minus"></i></button>`;
        }
        tr.innerHTML = `
            <td class="p-4"><img src="${imgSrc}" class="w-11 h-11 rounded-full object-cover cursor-pointer border border-gray-600" onclick="openImagePreview('${imgSrc}')"></td>
            <td class="p-4 font-bold text-[var(--gold)]">${scout.scout_id}</td>
            <td class="p-4 font-medium text-white">${scout.full_name}</td>
            <td class="p-4"><span class="bg-[var(--dark3)] text-[var(--gold)] px-2.5 py-1 rounded-md text-xs font-bold border border-[var(--border)]">${scout.scout_group || '-'}</span></td>
            <td class="p-4 text-gray-400 text-sm">${patrolName}</td>
            <td class="p-4 text-gray-400 font-mono" dir="ltr">${scout.personal_phone || '-'}</td>
            <td class="p-4 text-gray-300 text-sm max-w-xs truncate">${comments}</td>
            <td class="p-4 text-center">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateScoutCounts() {
    // حساب العدد الكلي
    const totalCount = allScouts.length;
    const boysTotal = allScouts.filter(s => s.gender === 'ولد').length;
    const girlsTotal = allScouts.filter(s => s.gender === 'بنت').length;
    
    document.getElementById('count-الكل').innerHTML = `${totalCount} <span style="font-size: 0.65rem; opacity: 0.8;">(👦${boysTotal} 👧${girlsTotal})</span>`;
    
    // حساب عدد كل مرحلة
    const stages = ['براعم', 'أشبال وزهرات', 'مبتدئ ومرشدات', 'متقدم ورائدات', 'مرشح جوالة', 'عشيرة الجوالة'];
    stages.forEach(stage => {
        const stageScouts = allScouts.filter(scout => scout.scout_group === stage);
        const count = stageScouts.length;
        const boys = stageScouts.filter(s => s.gender === 'ولد').length;
        const girls = stageScouts.filter(s => s.gender === 'بنت').length;
        
        const badge = document.getElementById(`count-${stage}`);
        if (badge) {
            badge.innerHTML = `${count} <span style="font-size: 0.65rem; opacity: 0.8;">(👦${boys} 👧${girls})</span>`;
        }
    });
}

function filterData(stage, btnElement) {
    currentFilterStage = stage;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    renderTable();
    if(typeof calculateRankings === 'function') calculateRankings();
}

if(document.getElementById('searchInput')) document.getElementById('searchInput').addEventListener('input', () => { renderTable(); if(typeof calculateRankings === 'function') calculateRankings(); });
if(document.getElementById('genderFilter')) document.getElementById('genderFilter').addEventListener('change', (e) => { currentFilterGender = e.target.value; renderTable(); if(typeof calculateRankings === 'function') calculateRankings(); });

// ==================== الفحص الذكي في التعديل (Validation) ====================
function validateScoutData(data) {
    let isValid = true;
    function setError(inputId, message) {
        isValid = false;
        const inputEl = document.getElementById(inputId);
        if (inputEl) {
            inputEl.classList.add('border-red-500', 'bg-[rgba(139,26,26,0.1)]');
            let errorSpan = document.getElementById(inputId + '_error');
            if (!errorSpan) {
                errorSpan = document.createElement('span');
                errorSpan.id = inputId + '_error';
                errorSpan.className = 'text-red-500 text-xs mt-1 block font-bold';
                inputEl.parentNode.insertBefore(errorSpan, inputEl.nextSibling);
            }
            errorSpan.textContent = message;
            errorSpan.style.display = 'block';
        }
    }
    document.querySelectorAll('.form-input').forEach(el => {
        el.classList.remove('border-red-500', 'bg-[rgba(139,26,26,0.1)]');
        const errSpan = document.getElementById(el.id + '_error');
        if (errSpan) errSpan.style.display = 'none';
    });

    const nameRegex = /^[\u0600-\u06FF\s]+$/;
    if (!data.full_name) setError('formFullName', 'الاسم الرباعي مطلوب.');
    else if (!nameRegex.test(data.full_name)) setError('formFullName', 'الاسم لازم يتكتب بالعربي بس.');
    else if (data.full_name.trim().split(/\s+/).length < 3) setError('formFullName', 'الاسم لازم يكون ثلاثي أو رباعي.');

    const phoneRegex = /^01[0125]\d{8}$/;
    if (!data.personal_phone) setError('formPersonalPhone', 'رقم موبايل الكشاف مطلوب.');
    else if (!phoneRegex.test(data.personal_phone)) setError('formPersonalPhone', 'الرقم مش صحيح، لازم 11 رقم بيبدأ بـ 01.');
    if (data.father_phone && !phoneRegex.test(data.father_phone)) setError('formFatherPhone', 'رقم تليفون الأب مش صحيح.');
    if (data.mother_phone && !phoneRegex.test(data.mother_phone)) setError('formMotherPhone', 'رقم تليفون الأم مش صحيح.');

    if (data.personal_phone && data.father_phone && data.mother_phone) {
        if (data.personal_phone === data.father_phone && data.personal_phone === data.mother_phone) {
            setError('formPersonalPhone', 'الرقم متكرر 3 مرات! سيب خانة فاضية لو مفيش.');
            setError('formFatherPhone', 'الرقم متكرر 3 مرات!');
            setError('formMotherPhone', 'الرقم متكرر 3 مرات!');
        }
    }

    if (data.address && !/\d/.test(data.address)) setError('formAddress', 'العنوان لازم يكون فيه رقم العمارة أو الشقة.');

    if (data.birth_date) {
        const age = new Date().getFullYear() - new Date(data.birth_date).getFullYear();
        if (age < 4 || age > 25) setError('formBirthDate', `السن غير منطقي (${age} سنة).`);
    }

    if (data.siblings_count != null && data.sibling_order != null && data.sibling_order > data.siblings_count) {
        setError('formSiblingOrder', 'الترتيب مينفعش يكون أكبر من العدد الكلي!');
    }

    return isValid;
}

// دالة التعديل
async function submitEditScout(id) {
    console.log('📝 submitEditScout called with ID:', id);
    console.log('👤 isTroopLeaderScout:', isTroopLeaderScout);
    
    const data = getFormData();
    console.log('📋 Form data:', data);

    if (isTroopLeaderScout) {
        data.school_stage = getDbSchoolStage(currentUser.troop) || data.school_stage;
    }

    if (!validateScoutData(data)) {
        console.warn('⚠️ Validation failed');
        return;
    }

    const btn = document.getElementById('formSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        // حفظ الكومنتات مباشرة لكل القادة
        const commentsOnly = { comments: data.comments };
        const { error: commentsError } = await supabaseClient.from('scouts').update(commentsOnly).eq('scout_id', id);
        if (commentsError) {
            console.error('❌ Comments save error:', commentsError);
        } else {
            console.log('✅ Comments saved directly');
        }
        
        if (isTroopLeaderScout) {
            console.log('📤 Sending request as TroopLeader...');
            const scout = allScouts.find(s => s.scout_id === id);
            
            // إزالة الكومنتات من البيانات المرسلة للموافقة
            const dataWithoutComments = { ...data };
            delete dataWithoutComments.comments;
            
            const requestData = {
                scout_id: id,
                type: 'edit',
                scout_data: dataWithoutComments,
                school_stage: scout?.school_stage || data.school_stage,
                requested_by: currentUser.username,
                status: 'pending'
            };
            console.log('📦 Request data:', requestData);
            
            const { error } = await supabaseClient.from('scout_requests').insert([requestData]);
            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }
            console.log('✅ Request sent successfully');
            alert('تم حفظ الملاحظات وإرسال طلب التعديل لقائد القطاع / الماستر للموافقة.');
        } else {
            console.log('💾 Saving directly...');
            const { error } = await supabaseClient.from('scouts').update(data).eq('scout_id', id);
            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }
            console.log('✅ Saved successfully');
            alert('البيانات اتعدلت بنجاح.');
        }
        closeModal('formModal');
        fetchScouts();
    } catch (err) {
        console.error('💥 Error:', err);
        alert('مشكلة: ' + (err.message || err));
    }

    btn.disabled = false;
    btn.innerHTML = isTroopLeaderScout
        ? '<i class="fa-solid fa-paper-plane"></i> إرسال طلب تعديل'
        : '<i class="fa-solid fa-floppy-disk"></i> حفظ';
}

// ==================== البروفايل الكامل بالتقييمات والجراف ====================
async function viewProfile(id) {
    const scout = allScouts.find(s => s.scout_id === id);
    if (!scout) return;

    document.getElementById('modalImage').src = getDirectDriveLink(scout.photo_url);
    document.getElementById('modalName').textContent = scout.full_name;
    document.getElementById('modalID').textContent = `الكود: ${scout.scout_id}`;
    document.getElementById('modalStageBadge').textContent = scout.scout_group;

    const fieldLabels = { 'personal_phone': 'موبايل الكشاف', 'father_phone': 'تليفون الأب', 'mother_phone': 'تليفون الأم', 'address': 'العنوان بالكامل', 'school_stage': 'المرحلة الدراسية', 'school_year': 'السنة الدراسية', 'confession_father': 'أب الاعتراف', 'has_diseases': 'أمراض؟', 'diseases_details': 'تفاصيل الصحة', 'comments': 'ملاحظات القادة' };
    let detailsHTML = '';
    Object.keys(fieldLabels).forEach(key => {
        let value = scout[key] || '-';
        let cardClass = (key === 'has_diseases' && value === 'نعم') ? 'bg-[rgba(139,26,26,0.2)] border-red-900' : 'bg-[var(--dark2)] border-[var(--border)]';
        let colSpan = (key === 'comments' || key === 'address') ? 'sm:col-span-2 md:col-span-3' : '';
        detailsHTML += `<div class="p-3 border rounded-lg ${cardClass} flex flex-col gap-1 ${colSpan}"><span class="text-xs font-bold text-[var(--gold)]">${fieldLabels[key]}</span><span class="text-sm text-gray-200 break-words" ${key.includes('phone') ? 'dir="ltr"' : ''}>${value}</span></div>`;
    });
    document.getElementById('modalDetails').innerHTML = detailsHTML;

    document.getElementById('modalAttendanceDetails').innerHTML = '<tr><td colspan="7" class="text-center py-6 text-gray-400">جاري تحميل التقييمات... <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';
    document.getElementById('profileModal').classList.remove('hidden');

    const { data: attData, error } = await supabaseClient.from('attendance').select('*').eq('scout_id', id).order('date', { ascending: true });
    
    const tbody = document.getElementById('modalAttendanceDetails');
    tbody.innerHTML = '';

    if (error || !attData || attData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-gray-500">مفيش أي غياب أو درجات اتسجلت للكشاف ده.</td></tr>';
        if(scoutChartInstance) scoutChartInstance.destroy();
        return;
    }

    let labels = [];
    let totalScores = [];

    attData.forEach(rec => {
        const total = (rec.attendance_score || 0) + (rec.commitment_score || 0) + (rec.uniform_score || 0) + (rec.activity_score || 0);
        labels.push(rec.date);
        totalScores.push(total);

        let statusColor = rec.status === 'حاضر' ? 'text-green-400' : (rec.status === 'إذن' ? 'text-yellow-400' : 'text-red-400');
        
        tbody.innerHTML += `
            <tr class="border-b border-[rgba(201,168,76,0.1)] hover:bg-[rgba(201,168,76,0.05)]">
                <td class="p-3 font-mono text-xs">${rec.date}</td>
                <td class="p-3 font-bold ${statusColor}">${rec.status}</td>
                <td class="p-3 text-center">${rec.attendance_score}</td>
                <td class="p-3 text-center">${rec.commitment_score}</td>
                <td class="p-3 text-center">${rec.uniform_score}</td>
                <td class="p-3 text-center">${rec.activity_score}</td>
                <td class="p-3 text-center font-bold text-[var(--gold)]">${total} <span class="text-gray-500 text-xs">/ 14</span></td>
            </tr>
        `;
    });

    const ctx = document.getElementById('scoutPerformanceChart').getContext('2d');
    if(scoutChartInstance) scoutChartInstance.destroy();

    scoutChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'إجمالي الدرجات من 14',
                data: totalScores,
                borderColor: '#c9a84c',
                backgroundColor: 'rgba(201,168,76,0.2)',
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#c9a84c',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 14, ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#888' }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function openImagePreview(src) { document.getElementById('fullSizeImage').src = src; document.getElementById('imageModal').classList.remove('hidden'); }
function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

// ==================== دالة تصدير PDF المعدلة والمضمونة ====================
async function exportProfileToPDF() {
    const printArea = document.getElementById("printProfileArea");
    if (!printArea) return alert('البروفايل مش مفتوح!');
    
    // زرار التحميل بيقلب Loading
    const pdfBtn = document.querySelector('.btn-danger');
    let originalText = '';
    if (pdfBtn) {
        originalText = pdfBtn.innerHTML;
        pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التجهيز...';
        pdfBtn.disabled = true;
    }

    try {
        // ننتظر تحميل الخطوط العربية قبل الالتقاط
        await document.fonts.ready;

        // بنخلي الجراف والألوان تظهر بجودة عالية
        const canvas = await html2canvas(printArea, { 
            scale: 2, 
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#1a1a1a', // لون خلفية المودال
            onclone: (clonedDoc) => {
                // نضمن إن الخط العربي متطبق على النسخة المنسوخة
                clonedDoc.body.style.fontFamily = "'Cairo', 'Segoe UI', sans-serif";
            }
        });
        
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const { jsPDF } = window.jspdf;
        
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        
        const scoutName = document.getElementById("modalName").textContent || "Profile";
        pdf.save(`Scout_${scoutName}.pdf`);
        
    } catch (err) {
        console.error("PDF Export Error:", err);
        alert("فشل التصدير! اتأكد إنك فاتح من متصفح كروم أو سفاري.");
    } finally {
        if (pdfBtn) {
            pdfBtn.innerHTML = originalText;
            pdfBtn.disabled = false;
        }
    }
}

// ==================== الحسابات والترتيب العام للوحة التحكم ====================
async function calculateRankings() {
    const rankBody = document.getElementById('rankTableBody');
    if (!rankBody || document.getElementById('rankView').classList.contains('hidden')) return;

    rankBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-[var(--gold)]"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري حساب الدرجات...</td></tr>`;

    if (attendanceData.length === 0) {
        const { data, error } = await supabaseClient.from('attendance').select('*');
        if (error) { rankBody.innerHTML = `<tr><td colspan="5" class="p-4 text-red-500">خطأ في جلب الدرجات</td></tr>`; return; }
        attendanceData = data || [];
    }

    const filteredScouts = allScouts.filter(scout => currentFilterStage === 'الكل' || scout.scout_group === currentFilterStage);
    
    let rankings = filteredScouts.map(scout => {
        const scoutRecords = attendanceData.filter(r => r.scout_id === scout.scout_id);
        const totalSessions = scoutRecords.length;
        let totalPoints = 0, presentCount = 0;

        scoutRecords.forEach(rec => {
            totalPoints += (rec.attendance_score || 0) + (rec.commitment_score || 0) + (rec.uniform_score || 0) + (rec.activity_score || 0);
            if (rec.status === 'حاضر') presentCount++;
        });

        return { id: scout.scout_id, name: scout.full_name, group: scout.scout_group, points: totalPoints, percentage: totalSessions === 0 ? 0 : Math.round((presentCount / totalSessions) * 100) };
    });

    rankings.sort((a, b) => b.points - a.points);
    rankBody.innerHTML = '';
    if (rankings.length === 0) { rankBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500">مفيش بيانات لعرض الترتيب.</td></tr>`; return; }

    rankings.forEach((r, index) => {
        let rankMedal = `<span class="text-gray-400 font-bold">${index + 1}</span>`;
        if (index === 0) rankMedal = `<i class="fa-solid fa-medal text-yellow-400 text-xl"></i>`;
        else if (index === 1) rankMedal = `<i class="fa-solid fa-medal text-gray-300 text-lg"></i>`;
        else if (index === 2) rankMedal = `<i class="fa-solid fa-medal text-orange-400 text-lg"></i>`;

        let percColor = r.percentage >= 80 ? 'text-green-400' : (r.percentage >= 50 ? 'text-yellow-400' : 'text-red-400');
        rankBody.innerHTML += `<tr class="${index < 3 ? 'bg-[rgba(201,168,76,0.05)]' : ''}"><td class="p-4 text-center">${rankMedal}</td><td class="p-4 font-bold text-white">${r.name}</td><td class="p-4 text-gray-400">${r.group || '-'}</td><td class="p-4 text-center font-mono font-bold ${percColor}">${r.percentage}%</td><td class="p-4 text-center font-bold text-[var(--gold)] text-lg">${r.points}</td></tr>`;
    });
}

let currentEditingScoutId = null;
const canManageScoutsDirect = ['SectorLeader', 'Master', 'General'].includes(currentUser.role);
const isTroopLeaderScout = currentUser.role === 'TroopLeader';

function readInputValue(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const raw = (el.value || '').trim();
    return raw || null;
}

function readInputNumber(id) {
    const raw = readInputValue(id);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function getFormData() {
    return {
        full_name: readInputValue('formFullName'),
        birth_date: readInputValue('formBirthDate'),
        gender: readInputValue('formGender'),
        personal_phone: readInputValue('formPersonalPhone'),
        father_phone: readInputValue('formFatherPhone'),
        mother_phone: readInputValue('formMotherPhone'),
        address: readInputValue('formAddress'),
        school_stage: readInputValue('formSchoolStage'),
        school_year: readInputValue('formSchoolYear'),
        certificate: readInputValue('formCertificate'),
        personal_email: readInputValue('formPersonalEmail'),
        facebook_account: readInputValue('formFacebook'),
        instagram_account: readInputValue('formInstagram'),
        scout_uniform: readInputValue('formUniform'),
        confession_father: readInputValue('formConfessionFather'),
        confession_church: readInputValue('formConfessionChurch'),
        father_job: readInputValue('formFatherJob'),
        mother_job: readInputValue('formMotherJob'),
        siblings_count: readInputNumber('formSiblingsCount'),
        sibling_order: readInputNumber('formSiblingOrder'),
        has_diseases: readInputValue('formHasDiseases') || 'لا',
        diseases_details: readInputValue('formDiseasesDetails'),
        hobbies: readInputValue('formHobbies'),
        photo_url: readInputValue('formPhotoUrl'),
        comments: readInputValue('formComments')
    };
}

function openEditModal(id) {
    const scout = allScouts.find(s => s.scout_id === id);
    if (!scout) return;

    currentEditingScoutId = id;
    const title = document.getElementById('formModalTitle');
    if (title) title.textContent = `تعديل بيانات: ${scout.full_name}`;

    const submitBtn = document.getElementById('formSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = isTroopLeaderScout
            ? '<i class="fa-solid fa-paper-plane"></i> إرسال طلب تعديل'
            : '<i class="fa-solid fa-floppy-disk"></i> حفظ';
    }

    setInputValue('formScoutId', scout.scout_id);
    const idDisplay = document.getElementById('formScoutIdDisplay');
    if (idDisplay) idDisplay.textContent = scout.scout_id;

    setInputValue('formFullName', scout.full_name);
    setInputValue('formBirthDate', scout.birth_date);
    setInputValue('formGender', scout.gender);
    setInputValue('formSchoolStage', scout.school_stage);
    setInputValue('formSchoolYear', scout.school_year);
    setInputValue('formCertificate', scout.certificate);
    
    setInputValue('formPersonalPhone', scout.personal_phone);
    setInputValue('formFatherPhone', scout.father_phone);
    setInputValue('formMotherPhone', scout.mother_phone);
    setInputValue('formPersonalEmail', scout.personal_email);
    setInputValue('formFacebook', scout.facebook_account);
    setInputValue('formInstagram', scout.instagram_account);
    setInputValue('formAddress', scout.address);
    setInputValue('formFatherJob', scout.father_job);
    setInputValue('formMotherJob', scout.mother_job);
    setInputValue('formSiblingsCount', scout.siblings_count);
    setInputValue('formSiblingOrder', scout.sibling_order);
    setInputValue('formConfessionFather', scout.confession_father);
    setInputValue('formConfessionChurch', scout.confession_church);
    setInputValue('formUniform', scout.scout_uniform);
    setInputValue('formHobbies', scout.hobbies);
    setInputValue('formHasDiseases', scout.has_diseases || 'لا');
    setInputValue('formDiseasesDetails', scout.diseases_details);
    setInputValue('formPhotoUrl', scout.photo_url);
    setInputValue('formComments', scout.comments);

    document.getElementById('formModal')?.classList.remove('hidden');
}

async function deleteScout(id) {
    if (!canManageScoutsDirect && !isTroopLeaderScout) return;

    const scout = allScouts.find(s => s.scout_id === id);
    const msg = isTroopLeaderScout
        ? 'هيتبعت طلب حذف للموافقة من قائد القطاع / الماستر. متأكد؟'
        : 'متأكد إنك عايز حذف الكشاف نهائيًا؟';
    if (!confirm(msg)) return;

    try {
        if (isTroopLeaderScout) {
            const { error } = await supabaseClient.from('scout_requests').insert([{
                scout_id: id,
                type: 'delete',
                scout_data: { full_name: scout?.full_name || id },
                school_stage: scout?.school_stage || null,
                requested_by: currentUser.username,
                status: 'pending'
            }]);
            if (error) throw error;
            alert('تم إرسال طلب الحذف للموافقة.');
        } else {
            const { error } = await supabaseClient.from('scouts').delete().eq('scout_id', id);
            if (error) throw error;
            alert('تم حذف الكشاف بنجاح.');
        }
        fetchScouts();
    } catch (err) {
        alert('فشل الحذف: ' + (err.message || err));
    }
}

// دوال تحديث السنة الدراسية والشهادة في المودال
function updateSchoolYearAndCertificateInModal() {
    // الدالة دي مش محتاجة في dashboard.html لأن الحقول input مش select
    // بس نخليها فاضية عشان ميحصلش error
    return;
}

function handleCertificateChangeInModal() {
    const certSelect = document.getElementById('formCertificate');
    const certOtherContainer = document.getElementById('certificateOtherContainerModal');
    
    if (certOtherContainer) {
        if (certSelect.value === 'other') {
            certOtherContainer.style.display = 'block';
        } else {
            certOtherContainer.style.display = 'none';
            const otherInput = document.getElementById('formCertificateOther');
            if (otherInput) otherInput.value = '';
        }
    }
}
