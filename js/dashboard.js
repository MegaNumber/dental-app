// js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    
    // فالبک هوشمند برای همکارانی که از قبل لاگین مانده‌اند (به صورت پیش‌فرض ادمین اصلی قلمداد می‌شوند)
    if (localStorage.getItem('adminLoggedIn') === 'true' && !localStorage.getItem('userPhone')) {
        localStorage.setItem('userPhone', '09337593737');
        localStorage.setItem('userRole', 'admin');
    }
    
    let allPatients = [];

    // مدیریت تم تاریک/روشن فوق حرفه‌ای دشبورد (Dark Mode Toggle)
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    const body = document.body;

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark');
            document.documentElement.classList.add('dark');
            if (themeToggleIcon) {
                themeToggleIcon.className = 'fas fa-sun text-yellow-400';
            }
            localStorage.setItem('dashboardTheme', 'dark');
        } else {
            body.classList.remove('dark');
            document.documentElement.classList.remove('dark');
            if (themeToggleIcon) {
                themeToggleIcon.className = 'fas fa-moon';
            }
            localStorage.setItem('dashboardTheme', 'light');
        }
    }

    // لود تنظیمات تم ترجیحی کاربر از حافظه مرورگر
    const savedTheme = localStorage.getItem('dashboardTheme') || 'light';
    applyTheme(savedTheme);

    themeToggleBtn?.addEventListener('click', () => {
        const isDark = body.classList.contains('dark');
        applyTheme(isDark ? 'light' : 'dark');
    });

    // مبدل تاریخ شمسی مستقل دشبورد
    function toJalali(gy, gm, gd) {
        const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        const gy2 = gm > 2 ? gy + 1 : gy;
        let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
        let jy = -1595 + (33 * Math.floor(days / 12053));
        days %= 12053;
        jy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            jy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        let jm, jd;
        if (days < 186) {
            jm = 1 + Math.floor(days / 31);
            jd = 1 + (days % 31);
        } else {
            jm = 7 + Math.floor((days - 186) / 30);
            jd = 1 + ((days - 186) % 30);
        }
        return { jy, jm, jd };
    }

    const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
    function toPersianDigits(value) {
        return String(value || '').replace(/\d/g, d => PERSIAN_DIGITS[d] || d);
    }

    function toEnglishDigits(value) {
        const p = '۰۱۲۳۴۵۶۷۸۹';
        const a = '٠١٢٣٤٥٦٧٨٩';
        return String(value || '')
            .replace(/[۰-۹]/g, d => String(p.indexOf(d)))
            .replace(/[٠-٩]/g, d => String(a.indexOf(d)));
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[ch] || ch);
    }

    function parsePatientMeta(patient) {
        const patientMeta = (patient.results || []).find(item => item && item.type === 'patient_meta') || {};
        return {
            status: patientMeta.patientStatus || 'under_treatment',
            summary: patient.summary || patient.treatment_summary || patientMeta.treatmentSummary || patientMeta.summary || 'خلاصه درمانی برای این بیمار ثبت نگردیده است.'
        };
    }

    function renderPatientCards(patients) {
        const grid = document.getElementById('patientsCardsGrid');
        if (!grid) return;

        if (patients.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20 text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                    <i class="fas fa-folder-open text-3xl mb-3 text-slate-300"></i>
                    <p class="font-bold text-sm text-slate-600 dark:text-slate-400">هیچ پرونده‌ای یافت نشد</p>
                    <p class="text-[10px] text-slate-400 mt-1">با فیلتر یا متن دیگری جستجو نمایید</p>
                </div>`;
            return;
        }

        grid.innerHTML = patients.map(p => {
            const meta = parsePatientMeta(p);

            // استایل‌دهی پالت رنگی سبک شخصی ۲۰۲۶ (مینی‌مال لوکس با پشتیبانی کامل از تم تیره نئونی)
            let statusColor = '#3b82f6'; // تحت درمان (آبی)
            let badgeText = 'تحت درمان';
            let bgPillClass = 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 font-extrabold';
            let glowColor = 'rgba(59, 130, 246, 0.02)';
            let glowHoverColor = 'rgba(59, 130, 246, 0.05)';
            let shadowColor = 'rgba(59, 130, 246, 0.08)';

            if (meta.status === 'finished') {
                statusColor = '#10b981'; // اتمام درمان (سبز)
                badgeText = 'اتمام درمان';
                bgPillClass = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 font-extrabold';
                glowColor = 'rgba(16, 185, 129, 0.02)';
                glowHoverColor = 'rgba(16, 185, 129, 0.05)';
                shadowColor = 'rgba(16, 185, 129, 0.08)';
            } else if (meta.status === 'retreatment') {
                statusColor = '#8b5cf6'; // درمان مجدد (بنفش)
                badgeText = 'درمان مجدد';
                bgPillClass = 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/30 font-extrabold';
                glowColor = 'rgba(139, 92, 246, 0.02)';
                glowHoverColor = 'rgba(139, 92, 246, 0.05)';
                shadowColor = 'rgba(139, 92, 246, 0.08)';
            } else if (meta.status === 'suspended') {
                statusColor = '#f97316'; // توقف درمان (نارنجی)
                badgeText = 'توقف درمان';
                bgPillClass = 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/30 font-extrabold';
                glowColor = 'rgba(249, 115, 22, 0.02)';
                glowHoverColor = 'rgba(249, 115, 22, 0.05)';
                shadowColor = 'rgba(249, 115, 22, 0.08)';
            }

            let visitDate = 'ثبت نشده';
            if (p.updated_at || p.created_at) {
                try {
                    const d = new Date(p.updated_at || p.created_at);
                    const jalali = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                    visitDate = toPersianDigits(`${jalali.jy}/${String(jalali.jm).padStart(2, '0')}/${String(jalali.jd).padStart(2, '0')}`);
                } catch (e) {
                    console.error(e);
                }
            }

            const profileImgHtml = p.profile_url
                ? `<img src="${escapeHtml(p.profile_url)}" alt="avatar">`
                : `<i class="fas fa-user text-slate-300 dark:text-slate-600"></i>`;

            return `
                <div class="patient-card-premium" onclick="location.href='patient.html?fileNumber=${escapeHtml(p.file_number)}'" style="--status-color: ${statusColor}; --status-color-glow: ${glowColor}; --status-color-glow-hover: ${glowHoverColor}; --status-color-shadow: ${shadowColor};">
                    <!-- نوار عمودی رنگی در حاشیه کارت برای نمایش سبک شخصی وضعیت -->
                    <div class="status-accent-strip" style="background-color: ${statusColor};"></div>

                    <!-- بخش بالایی کارت با ساختار مرتب و تراز عالی -->
                    <div class="flex items-center gap-4 mb-4">
                        <div class="avatar-frame">
                            <div class="avatar-inner">
                                ${profileImgHtml}
                            </div>
                        </div>
                        <div class="flex flex-col min-width-0">
                            <span class="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[170px]" title="${escapeHtml(p.name)}">${escapeHtml(p.name || 'بیمار بدون نام')}</span>
                            <span class="text-[10px] text-slate-400 font-bold mt-0.5">پرونده: <strong class="text-slate-600 dark:text-slate-300 font-bold">${toPersianDigits(p.file_number)}</strong></span>
                        </div>
                    </div>

                    <!-- خلاصه درمان مینی‌مال با لاین هیت بسیار خوانای ۱.۷ فارسی -->
                    <div class="flex-1 mb-5">
                        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2" title="${escapeHtml(meta.summary)}" style="line-height: 1.7;">
                            ${escapeHtml(meta.summary)}
                        </p>
                    </div>

                    <!-- بخش پایینی کارت (بج تپنده مدرن سبک شخصی ۲۰۲۶) -->
                    <div class="flex items-center justify-between pt-3.5 border-t border-slate-100 dark:border-slate-800/80 gap-2">
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-black"><i class="fas fa-calendar-day mr-1"></i>آخرین ویزیت: ${visitDate}</span>
                        <span class="status-pill-premium ${bgPillClass}">
                            <span class="status-pulse-dot" style="background-color: ${statusColor};"></span>
                            <span class="text-[10.5px]">${badgeText}</span>
                        </span>
                    </div>
                </div>`;
        }).join('');
    }

    async function loadDashboardData() {
        if (!window.DB) {
            console.error('DB Object not found');
            return;
        }

        const patients = await window.DB.getAllPatients();
        allPatients = patients;

        let total = patients.length;
        let underTreatment = 0;
        let finished = 0;
        let other = 0;

        patients.forEach(p => {
            const meta = parsePatientMeta(p);
            if (meta.status === 'under_treatment') underTreatment++;
            else if (meta.status === 'finished') finished++;
            else other++;
        });

        const totalEl = document.getElementById('totalPatientsCount');
        const underEl = document.getElementById('underTreatmentCount');
        const finishedEl = document.getElementById('finishedTreatmentCount');
        const otherEl = document.getElementById('otherTreatmentCount');

        if (totalEl) totalEl.textContent = toPersianDigits(total);
        if (underEl) underEl.textContent = toPersianDigits(underTreatment);
        if (finishedEl) finishedEl.textContent = toPersianDigits(finished);
        if (otherEl) otherEl.textContent = toPersianDigits(other);

        // محاسبه و آپدیت داینامیک نمودار پیشرفت نیم‌دایره‌ای (نرخ موفقیت درمان)
        const successRate = total > 0 ? Math.round((finished / total) * 100) : 0;
        const gaugeArc = document.getElementById('gaugeProgressArc');
        const gaugeText = document.getElementById('gaugePercentageText');
        if (gaugeArc && gaugeText) {
            const dashLength = 125.6;
            const offset = dashLength - (dashLength * successRate / 100);
            gaugeArc.style.strokeDashoffset = offset;
            gaugeText.textContent = toPersianDigits(successRate) + '٪';
        }

        renderPatientCards(allPatients);
    }

    function filterAndRender() {
        const searchInput = document.getElementById('dashboardSearchInput');
        const statusFilter = document.getElementById('statusFilter');
        
        if (!searchInput || !statusFilter) return;

        const query = toEnglishDigits(searchInput.value.toLowerCase().trim());
        const selectedStatus = statusFilter.value;

        const filtered = allPatients.filter(p => {
            const meta = parsePatientMeta(p);
            
            const nameMatch = (p.name || '').toLowerCase().includes(query);
            const fileMatch = (p.file_number || '').toLowerCase().includes(query);
            const summaryMatch = (meta.summary || '').toLowerCase().includes(query);
            const textMatch = nameMatch || fileMatch || summaryMatch;

            const statusMatch = selectedStatus === 'all' || meta.status === selectedStatus;

            return textMatch && statusMatch;
        });

        renderPatientCards(filtered);
    }

    // === سیستم تعاملی مدیریت همکاران و کاربران کلینیک (ویژه مدیر ادمین اصلی) ===
    const userRole = localStorage.getItem('userRole') || 'staff';
    const currentUserPhone = localStorage.getItem('userPhone') || '';
    
    // انحصار دسترسی به پنل تعریف کاربران فقط و فقط برای ادمین اصلی (09337593737)
    // کاربران جدید تعریف شده توسط ادمین اصلی دیگر به این بخش دسترسی نخواهند داشت
    const adminUserManagementRow = document.getElementById('adminUserManagementRow');
    if (adminUserManagementRow) {
        if (currentUserPhone === '09337593737') {
            adminUserManagementRow.classList.remove('hidden');
        } else {
            adminUserManagementRow.classList.add('hidden');
        }
    }

    const userManagementModal = document.getElementById('userManagementModal');
    const userManagementModalCard = document.getElementById('userManagementModalCard');
    const closeUserModalBtn = document.getElementById('closeUserModalBtn');
    const newUserForm = document.getElementById('newUserForm');
    const usersTableBody = document.getElementById('usersTableBody');

    // تابع کمکی برای نمایش پیغام پاپ‌آپ کوتاه
    function showLocalToast(message) {
        if (window.showToast) {
            window.showToast(message);
        } else {
            alert(message);
        }
    }

    // لود مجدد و رندر لیست همکاران
    async function loadUsersList() {
        if (!usersTableBody || !window.DB) return;
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="3" class="p-8 text-center text-slate-400">
                    <i class="fas fa-spinner fa-spin mr-1"></i> در حال دریافت لیست پرسنل...
                </td>
            </tr>`;

        const users = await window.DB.getUsers();
        if (users.length === 0) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="p-8 text-center text-slate-400 font-bold">
                        <i class="fas fa-user-slash mb-2 text-lg"></i>
                        <p>هیچ همکاری در دیتابیس ثبت نشده است.</p>
                    </td>
                </tr>`;
            return;
        }

        usersTableBody.innerHTML = users.map(user => {
            const isMainAdmin = user.phone === '09337593737';
            const isSelf = user.phone === currentUserPhone;
            
            let roleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30">همکار (Staff)</span>';
            if (user.role === 'admin') {
                roleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30">مدیر (Admin)</span>';
            }

            // غیرفعال کردن دکمه حذف برای خود ادمین اصلی یا ادمینی که لاگین کرده است
            const deleteBtnHtml = (isMainAdmin || isSelf)
                ? `<button class="text-slate-300 dark:text-slate-700 cursor-not-allowed" title="غیرقابل حذف" disabled><i class="fas fa-trash-alt"></i></button>`
                : `<button class="text-red-500 hover:text-red-700 transition-colors delete-user-btn" data-id="${user.id}" data-phone="${user.phone}" title="حذف کاربر"><i class="fas fa-trash-alt"></i></button>`;

            return `
                <tr class="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                    <td class="p-3 font-extrabold text-slate-800 dark:text-slate-100">${user.phone}</td>
                    <td class="p-3">${roleBadge}</td>
                    <td class="p-3 text-center">${deleteBtnHtml}</td>
                </tr>`;
        }).join('');

        // اتصال رویدادهای کلیک به دکمه‌های حذف
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // محافظت امنیتی کلاینت-ساید
                if (currentUserPhone !== '09337593737') {
                    showLocalToast('شما دسترسی مجاز برای حذف کاربران را ندارید.');
                    return;
                }

                const userId = btn.getAttribute('data-id');
                const userPhone = btn.getAttribute('data-phone');
                if (confirm(`آیا از حذف همکار با شماره تماس ${userPhone} مطمئن هستید؟`)) {
                    const result = await window.DB.deleteUser(userId);
                    if (result.success) {
                        showLocalToast('همکار با موفقیت حذف گردید.');
                        loadUsersList();
                    } else {
                        showLocalToast(result.message);
                    }
                }
            });
        });
    }

    // باز کردن مودال مدیریت کاربران
    adminUserManagementRow?.addEventListener('click', () => {
        if (userManagementModal && userManagementModalCard) {
            // بستن منوی تنظیمات شیشه‌ای ابتدا
            if (settingsDropdown) {
                settingsDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                settingsDropdown.classList.remove('opacity-100', 'scale-100');
                
            }
            
            userManagementModal.classList.remove('opacity-0', 'pointer-events-none');
            userManagementModalCard.classList.remove('scale-95');
            userManagementModalCard.classList.add('scale-100');
            loadUsersList();
        }
    });

    // بستن مودال
    function closeUserModal() {
        if (userManagementModal && userManagementModalCard) {
            userManagementModal.classList.add('opacity-0', 'pointer-events-none');
            userManagementModalCard.classList.remove('scale-100');
            userManagementModalCard.classList.add('scale-95');
        }
    }

    closeUserModalBtn?.addEventListener('click', closeUserModal);
    
    // بستن مودال با کلیک روی بک‌گراند خاکستری
    userManagementModal?.addEventListener('click', (e) => {
        if (e.target === userManagementModal) {
            closeUserModal();
        }
    });

    // سابمیت فرم تعریف همکار جدید
    newUserForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // محافظت امنیتی کلاینت-ساید
        if (currentUserPhone !== '09337593737') {
            showLocalToast('شما دسترسی مجاز برای انجام این عملیات را ندارید.');
            return;
        }

        const phoneEl = document.getElementById('newUserPhone');
        const passEl = document.getElementById('newUserPass');
        const roleEl = document.getElementById('newUserRole');

        if (!phoneEl || !passEl || !roleEl || !window.DB) return;

        const phone = phoneEl.value.trim();
        const password = passEl.value;
        const role = roleEl.value;

        // بررسی فرمت شماره تلفن اجمالی
        if (!/^\d{11}$/.test(phone)) {
            showLocalToast('لطفا یک شماره تلفن معتبر ۱۱ رقمی وارد نمایید.');
            return;
        }

        const result = await window.DB.createUser(phone, password, role, currentUserPhone);
        if (result.success) {
            showLocalToast(`همکار جدید با دسترسی ${role === 'admin' ? 'مدیر' : 'همکار'} با موفقیت تعریف شد.`);
            phoneEl.value = '';
            passEl.value = '';
            roleEl.value = 'staff';
            loadUsersList();
        } else {
            showLocalToast(result.message);
        }
    });

    // مدیریت باز و بسته شدن منوی تنظیمات شیشه‌ای در بالا-چپ

    // مدیریت باز و بسته شدن منوی تنظیمات شیشه‌ای در بالا-چپ
    const settingsMenuBtn = document.getElementById('settingsMenuBtn');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const settingsContainer = document.getElementById('settingsContainer');
    const settingsCogIcon = document.getElementById('settingsCogIcon');

    if (settingsMenuBtn && settingsDropdown) {
        settingsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = settingsMenuBtn.getAttribute('aria-expanded') === 'true';
            settingsMenuBtn.setAttribute('aria-expanded', !isExpanded);
            if (!isExpanded) {
                settingsDropdown.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
                settingsDropdown.classList.add('opacity-100', 'scale-100');
                
            } else {
                settingsDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                settingsDropdown.classList.remove('opacity-100', 'scale-100');
                
            }
        });

        // بستن منو در صورت کلیک در خارج از کادر آن
        document.addEventListener('click', (e) => {
            if (settingsContainer && !settingsContainer.contains(e.target)) {
                settingsMenuBtn.setAttribute('aria-expanded', 'false');
                settingsDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                settingsDropdown.classList.remove('opacity-100', 'scale-100');
                
            }
        });
    }

    // اتصالات رویدادها و میانبرهای کیبورد حرفه‌ای
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            document.getElementById('dashboardSearchInput')?.focus();
        }
    });

    document.getElementById('dashboardSearchInput')?.addEventListener('input', filterAndRender);
    document.getElementById('statusFilter')?.addEventListener('change', filterAndRender);
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (window.Auth) {
            window.Auth.logout();
        } else {
            localStorage.removeItem('adminLoggedIn');
            window.location.href = 'index.html';
        }
    });

    // بارگذاری نهایی داده‌ها
    await loadDashboardData();
});