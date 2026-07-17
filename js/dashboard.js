document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('adminLoggedIn') === 'true' && !localStorage.getItem('userPhone')) {
        localStorage.setItem('userPhone', '09337593737');
        localStorage.setItem('userRole', 'admin');
    }

    const state = {
        patients: [],
        status: 'all',
        query: '',
        range: 7,
        view: localStorage.getItem('dashboardView') || 'grid',
        loaded: false,
        renderFrame: 0,
        health: {
            networkOnline: navigator.onLine,
            connectionStatus: window.SupabaseConnection?.status || 'initializing',
            databaseStatus: 'checking',
            syncStatus: 'checking',
            latency: null,
            lastChecked: null,
            lastSuccess: localStorage.getItem('databaseLastSuccessAt')
                ? new Date(localStorage.getItem('databaseLastSuccessAt'))
                : null,
            source: 'بارگذاری داشبورد',
            error: null,
            errorStage: '',
            busy: false,
            detailsExpanded: localStorage.getItem('databaseStatusExpanded') === 'true'
        }
    };

    const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
    const STATUS_CONFIG = {
        under_treatment: { label: 'تحت درمان', color: '#716ee8', background: 'var(--primary-soft)' },
        finished: { label: 'تکمیل‌شده', color: '#16a879', background: 'var(--green-soft)' },
        retreatment: { label: 'درمان مجدد', color: '#b36ade', background: '#f7edfc' },
        suspended: { label: 'توقف درمان', color: '#e59734', background: 'var(--amber-soft)' }
    };
    const SYSTEM_HEALTH_CONFIG = {
        healthy: {
            badge: 'سالم',
            sidebar: 'سامانه پایدار است',
            message: 'اتصال پایگاه داده برقرار و اطلاعات کلینیک با موفقیت همگام شده است.',
            icon: 'fas fa-circle-check'
        },
        checking: {
            badge: 'در حال بررسی',
            sidebar: 'در حال بررسی سامانه',
            message: 'اتصال سرویس، دسترسی داده‌ها و آخرین همگام‌سازی در حال ارزیابی است.',
            icon: 'fas fa-rotate'
        },
        degraded: {
            badge: 'نیازمند توجه',
            sidebar: 'سامانه نیازمند بررسی است',
            message: 'ارتباط اصلی برقرار است، اما بخشی از دریافت یا همگام‌سازی اطلاعات کامل نشده است.',
            icon: 'fas fa-triangle-exclamation'
        },
        offline: {
            badge: 'بدون شبکه',
            sidebar: 'اتصال شبکه قطع است',
            message: 'مرورگر به شبکه دسترسی ندارد. اطلاعات قبلی تا زمان اتصال مجدد حفظ می‌شود.',
            icon: 'fas fa-wifi'
        },
        error: {
            badge: 'اختلال اتصال',
            sidebar: 'پایگاه داده در دسترس نیست',
            message: 'ارتباط با سرویس یا دسترسی به داده‌ها ناموفق است. جزئیات خطا را بررسی کنید.',
            icon: 'fas fa-database'
        }
    };

    const elements = {
        body: document.body,
        themeIcon: document.getElementById('themeToggleIcon'),
        themeModeText: document.getElementById('themeModeText'),
        sidebarThemeLabel: document.getElementById('sidebarThemeLabel'),
        settingsMenuBtn: document.getElementById('settingsMenuBtn'),
        settingsDropdown: document.getElementById('settingsDropdown'),
        searchInput: document.getElementById('dashboardSearchInput'),
        statusFilter: document.getElementById('statusFilter'),
        cardsGrid: document.getElementById('patientsCardsGrid'),
        resultsLabel: document.getElementById('patientResultsLabel'),
        trendSvg: document.getElementById('trendChartSvg'),
        donutSvg: document.getElementById('statusDonutSvg'),
        chartTooltip: document.getElementById('chartTooltip'),
        userModal: document.getElementById('userManagementModal'),
        usersTableBody: document.getElementById('usersTableBody'),
        databaseStatusCenter: document.getElementById('databaseStatusCenter'),
        databaseStatusShortcut: document.getElementById('databaseStatusShortcut'),
        databaseStatusIcon: document.getElementById('databaseStatusIcon'),
        databaseHealthBadge: document.getElementById('databaseHealthBadge'),
        databaseStatusMessage: document.getElementById('databaseStatusMessage'),
        databaseDetailsToggle: document.getElementById('databaseDetailsToggle'),
        databaseStatusDetails: document.getElementById('databaseStatusDetails'),
        databaseRetryButton: document.getElementById('databaseRetryButton'),
        databaseAlert: document.getElementById('databaseAlert'),
        databaseAlertIcon: document.getElementById('databaseAlertIcon'),
        databaseAlertTitle: document.getElementById('databaseAlertTitle'),
        databaseAlertMessage: document.getElementById('databaseAlertMessage'),
        databaseErrorDetail: document.getElementById('databaseErrorDetail'),
        networkHealthItem: document.getElementById('networkHealthItem'),
        serviceHealthItem: document.getElementById('serviceHealthItem'),
        databaseHealthItem: document.getElementById('databaseHealthItem'),
        latencyHealthItem: document.getElementById('latencyHealthItem')
    };

    function toPersianDigits(value) {
        return String(value ?? '').replace(/\d/g, digit => PERSIAN_DIGITS[digit]);
    }

    function toEnglishDigits(value) {
        const persian = '۰۱۲۳۴۵۶۷۸۹';
        const arabic = '٠١٢٣٤٥٦٧٨٩';
        return String(value ?? '')
            .replace(/[۰-۹]/g, digit => String(persian.indexOf(digit)))
            .replace(/[٠-٩]/g, digit => String(arabic.indexOf(digit)));
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function parsePatientMeta(patient) {
        const patientMeta = (patient.results || []).find(item => item && item.type === 'patient_meta') || {};
        return {
            status: patientMeta.patientStatus || 'under_treatment',
            summary: patient.summary || patient.treatment_summary || patientMeta.treatmentSummary || patientMeta.summary || 'خلاصه درمانی برای این پرونده ثبت نشده است.'
        };
    }

    function getStatusConfig(status) {
        return STATUS_CONFIG[status] || { label: 'نیازمند پیگیری', color: '#e59734', background: 'var(--amber-soft)' };
    }

    function formatDate(dateValue, options = {}) {
        if (!dateValue) return 'ثبت نشده';
        try {
            return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
                year: options.short ? undefined : 'numeric',
                month: options.short ? 'short' : '2-digit',
                day: '2-digit'
            }).format(new Date(dateValue));
        } catch (_) {
            return 'ثبت نشده';
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function formatClock(dateValue, withSeconds = false) {
        if (!dateValue) return 'هنوز انجام نشده';
        try {
            return new Intl.DateTimeFormat('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
                ...(withSeconds ? { second: '2-digit' } : {})
            }).format(dateValue);
        } catch (_) {
            return 'ثبت نشده';
        }
    }

    function formatStatusDate(dateValue) {
        if (!dateValue) return 'ثبت نشده';
        try {
            return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(dateValue);
        } catch (_) {
            return formatClock(dateValue);
        }
    }

    function formatErrorDetail(error) {
        if (!error) return '';
        const message = String(error.message || error);
        const context = [
            error.code ? `کد: ${error.code}` : '',
            error.status ? `وضعیت: ${error.status}` : '',
            error.details ? `جزئیات: ${error.details}` : '',
            error.hint ? `راهنما: ${error.hint}` : ''
        ].filter(Boolean);
        return [message, ...context].join('\n');
    }

    function setHealthIndicator(item, status, valueId, value, metaId, meta) {
        if (!item) return;
        item.dataset.status = status;
        setText(valueId, value);
        setText(metaId, meta);
    }

    function setDatabaseDetailsExpanded(expanded, { persist = true } = {}) {
        const nextValue = Boolean(expanded);
        state.health.detailsExpanded = nextValue;
        elements.databaseStatusCenter?.classList.toggle('is-expanded', nextValue);
        elements.databaseDetailsToggle?.setAttribute('aria-expanded', String(nextValue));
        elements.databaseStatusDetails?.setAttribute('aria-hidden', String(!nextValue));
        const label = elements.databaseDetailsToggle?.querySelector('span');
        if (label) label.textContent = nextValue ? 'بستن جزئیات' : 'جزئیات';
        if (persist) localStorage.setItem('databaseStatusExpanded', String(nextValue));
    }

    function getOverallHealthState() {
        const health = state.health;
        if (!health.networkOnline) return 'offline';
        if (health.busy) return 'checking';
        if (health.connectionStatus === 'unavailable' || health.databaseStatus === 'error') return 'error';
        if (['initializing', 'checking'].includes(health.connectionStatus)
            || health.databaseStatus === 'checking' || health.syncStatus === 'checking') {
            return 'checking';
        }
        if (health.syncStatus === 'error' || health.syncStatus === 'stale') return 'degraded';
        return 'healthy';
    }

    function getRecoveryHint(overallState) {
        if (overallState === 'healthy') return 'نیازی به اقدام نیست؛ پایش خودکار فعال است.';
        if (overallState === 'checking') return 'این بررسی خودکار است و ممکن است چند ثانیه زمان ببرد.';
        if (overallState === 'offline') return 'اتصال اینترنت دستگاه را بررسی کنید؛ پس از بازگشت شبکه، بررسی خودکار انجام می‌شود.';
        if (overallState === 'degraded') return 'برای دریافت تازه‌ترین اطلاعات، بررسی مجدد را اجرا کنید.';
        return 'اتصال شبکه، دسترسی پروژه Supabase و مجوز جدول patients را بررسی کنید.';
    }

    function renderDatabaseHealth() {
        const health = state.health;
        const overallState = getOverallHealthState();
        const config = SYSTEM_HEALTH_CONFIG[overallState];
        const connectionStatus = health.connectionStatus;
        const serviceStatus = !health.networkOnline
            ? 'offline'
            : connectionStatus === 'connected'
                ? 'healthy'
                : connectionStatus === 'unavailable'
                    ? 'error'
                    : 'checking';
        const databaseStatus = !health.networkOnline || health.databaseStatus === 'error'
            ? (!health.networkOnline ? 'offline' : 'error')
            : health.databaseStatus === 'healthy'
                ? 'healthy'
                : 'checking';
        const latencyStatus = health.latency == null
            ? (overallState === 'error' || overallState === 'offline' ? 'error' : 'checking')
            : health.latency >= 3000
                ? 'error'
                : health.latency >= 1000
                    ? 'warning'
                    : 'healthy';

        elements.databaseStatusCenter?.setAttribute('data-state', overallState);
        elements.databaseStatusCenter?.setAttribute('aria-busy', String(health.busy));
        elements.databaseStatusShortcut?.setAttribute('data-state', overallState);
        if (elements.databaseStatusIcon) elements.databaseStatusIcon.className = config.icon;
        setText('sidebarSystemStatus', config.sidebar);
        setText('databaseHealthBadge', config.badge);
        setText('databaseStatusMessage', config.message);
        setText('databaseLastChecked', formatClock(health.lastChecked, true));

        const networkValue = health.networkOnline ? 'متصل' : 'قطع';
        setHealthIndicator(
            elements.networkHealthItem,
            health.networkOnline ? 'healthy' : 'offline',
            'networkHealthValue',
            networkValue,
            'networkHealthMeta',
            health.networkOnline ? 'دسترسی مرورگر به اینترنت' : 'دستگاه آفلاین است'
        );
        setHealthIndicator(
            elements.serviceHealthItem,
            serviceStatus,
            'serviceHealthValue',
            serviceStatus === 'healthy' ? 'متصل' : serviceStatus === 'error' ? 'در دسترس نیست' : serviceStatus === 'offline' ? 'بدون شبکه' : 'در حال اتصال',
            'serviceHealthMeta',
            serviceStatus === 'healthy' ? 'پاسخ سرویس دریافت شد' : 'بررسی اتصال سرویس'
        );
        setHealthIndicator(
            elements.databaseHealthItem,
            databaseStatus,
            'databaseAccessValue',
            databaseStatus === 'healthy' ? 'عملیاتی' : databaseStatus === 'error' ? 'ناموفق' : databaseStatus === 'offline' ? 'بدون شبکه' : 'در حال ارزیابی',
            'databaseAccessMeta',
            databaseStatus === 'healthy' ? 'دسترسی به جدول پرونده‌ها برقرار است' : 'بررسی جدول patients'
        );
        setHealthIndicator(
            elements.latencyHealthItem,
            latencyStatus,
            'databaseLatencyValue',
            health.latency == null ? (latencyStatus === 'error' ? 'ثبت نشد' : 'اندازه‌گیری...') : `${toPersianDigits(Math.round(health.latency))} میلی‌ثانیه`,
            'databaseLatencyMeta',
            health.latency == null ? 'تا پاسخ پایگاه داده' : latencyStatus === 'healthy' ? 'پاسخ سریع' : latencyStatus === 'warning' ? 'پاسخ کندتر از معمول' : 'زمان پاسخ بالا'
        );

        const alertConfig = {
            healthy: {
                severity: 'success',
                icon: 'fas fa-circle-check',
                title: 'هیچ هشدار فعالی وجود ندارد',
                message: 'اتصال و همگام‌سازی اطلاعات کلینیک بدون خطا انجام شده است.'
            },
            checking: {
                severity: 'info',
                icon: 'fas fa-circle-info',
                title: 'بررسی سلامت سامانه در حال انجام است',
                message: 'نتیجه اتصال و دریافت داده‌ها تا چند لحظه دیگر نمایش داده می‌شود.'
            },
            degraded: {
                severity: 'warning',
                icon: 'fas fa-triangle-exclamation',
                title: 'داده‌های نمایش‌داده‌شده ممکن است قدیمی باشند',
                message: 'اتصال برقرار است، اما دریافت تازه‌ترین پرونده‌ها کامل نشده است.'
            },
            offline: {
                severity: 'error',
                icon: 'fas fa-wifi',
                title: 'اتصال شبکه دستگاه قطع است',
                message: 'آخرین داده‌های دریافت‌شده حفظ شده‌اند و پس از اتصال مجدد، بررسی خودکار انجام می‌شود.'
            },
            error: {
                severity: 'error',
                icon: 'fas fa-database',
                title: health.errorStage === 'sync' ? 'همگام‌سازی پرونده‌ها ناموفق بود' : 'اتصال پایگاه داده ناموفق است',
                message: health.errorStage === 'sync'
                    ? 'آخرین داده‌های موفق حفظ شده‌اند. برای دریافت اطلاعات جدید، بررسی مجدد را اجرا کنید.'
                    : 'سرویس یا مجوز دسترسی داده‌ها پاسخ معتبر برنگرداند. جزئیات فنی در ادامه ثبت شده است.'
            }
        }[overallState];

        elements.databaseAlert?.setAttribute('data-severity', alertConfig.severity);
        if (elements.databaseAlertIcon) elements.databaseAlertIcon.className = alertConfig.icon;
        setText('databaseAlertTitle', alertConfig.title);
        setText('databaseAlertMessage', alertConfig.message);
        if (elements.databaseErrorDetail) {
            const detail = formatErrorDetail(health.error);
            elements.databaseErrorDetail.textContent = detail;
            elements.databaseErrorDetail.classList.toggle('hidden', !detail || overallState === 'healthy' || overallState === 'checking' || overallState === 'offline');
        }

        setText('databaseLastSuccess', formatStatusDate(health.lastSuccess));
        setText('databaseCheckSource', health.source);
        setText(
            'databaseDataFreshness',
            health.syncStatus === 'healthy'
                ? 'به‌روز و همگام'
                : state.loaded
                    ? `آخرین نسخه موفق: ${formatClock(health.lastSuccess)}`
                    : 'داده‌ای دریافت نشده'
        );
        setText('databaseRecoveryHint', getRecoveryHint(overallState));
        setText(
            'lastSyncLabel',
            overallState === 'healthy'
                ? `همگام‌سازی موفق: ${formatClock(health.lastSuccess)}`
                : overallState === 'offline'
                    ? 'در انتظار اتصال شبکه'
                    : health.syncStatus === 'stale' || health.syncStatus === 'error'
                        ? 'نمایش آخرین داده دریافت‌شده'
                        : 'در حال همگام‌سازی'
        );

        elements.databaseRetryButton?.classList.toggle('is-loading', health.busy);
        elements.databaseRetryButton?.toggleAttribute('disabled', health.busy);
        if (overallState !== 'healthy' && overallState !== 'checking') {
            setDatabaseDetailsExpanded(true, { persist: false });
        } else {
            setDatabaseDetailsExpanded(health.detailsExpanded, { persist: false });
        }
    }

    function getCounts() {
        return state.patients.reduce((counts, patient) => {
            const status = parsePatientMeta(patient).status;
            counts.total += 1;
            if (status === 'under_treatment') counts.under += 1;
            else if (status === 'finished') counts.finished += 1;
            else counts.other += 1;
            return counts;
        }, { total: 0, under: 0, finished: 0, other: 0 });
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        elements.body.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
        localStorage.setItem('dashboardTheme', theme);
        if (elements.themeIcon) elements.themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        document.querySelectorAll('#desktopThemeBtn i').forEach(icon => {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        });
        if (elements.themeModeText) elements.themeModeText.textContent = isDark ? 'تیره' : 'روشن';
        if (elements.sidebarThemeLabel) elements.sidebarThemeLabel.textContent = isDark ? 'تیره' : 'روشن';
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) themeColor.content = isDark ? '#0d1019' : '#f5f7fb';
        if (state.patients.length) renderCharts();
    }

    function toggleTheme() {
        applyTheme(elements.body.classList.contains('dark') ? 'light' : 'dark');
    }

    function updateTodayLabel() {
        const formatted = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            weekday: 'long', day: 'numeric', month: 'long'
        }).format(new Date());
        setText('todayLabel', formatted);
    }

    function filteredPatients() {
        const normalizedQuery = toEnglishDigits(state.query.toLowerCase().trim());
        return state.patients.filter(patient => {
            const meta = parsePatientMeta(patient);
            const searchable = toEnglishDigits(`${patient.name || ''} ${patient.file_number || ''} ${patient.mobile || patient.phone || ''} ${meta.summary}`.toLowerCase());
            const statusMatch = state.status === 'all'
                || meta.status === state.status
                || (state.status === 'other' && !['under_treatment', 'finished'].includes(meta.status));
            return searchable.includes(normalizedQuery) && statusMatch;
        });
    }

    function renderPatients() {
        if (!elements.cardsGrid) return;
        const patients = filteredPatients();
        elements.cardsGrid.classList.toggle('is-list', state.view === 'list');
        setText('patientResultsLabel', `${toPersianDigits(patients.length)} پرونده از ${toPersianDigits(state.patients.length)} پرونده`);

        if (!patients.length) {
            elements.cardsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <strong>پرونده‌ای با این مشخصات پیدا نشد</strong>
                    <span>عبارت جستجو یا فیلتر وضعیت را تغییر دهید.</span>
                </div>`;
            return;
        }

        elements.cardsGrid.innerHTML = patients.map(patient => {
            const meta = parsePatientMeta(patient);
            const status = getStatusConfig(meta.status);
            const profile = patient.profile_url
                ? `<img src="${escapeHtml(patient.profile_url)}" alt="تصویر ${escapeHtml(patient.name || 'بیمار')}" loading="lazy">`
                : '<i class="fas fa-user"></i>';
            const fileNumber = escapeHtml(patient.file_number || '---');
            return `
                <article class="patient-card" tabindex="0" role="link" data-file-number="${fileNumber}"
                    style="--status-color:${status.color};--status-bg:${status.background}">
                    <div class="patient-card-header">
                        <span class="patient-avatar">${profile}</span>
                        <span class="patient-identity">
                            <strong>${escapeHtml(patient.name || 'بیمار بدون نام')}</strong>
                            <span>شماره پرونده: ${toPersianDigits(patient.file_number || '---')}</span>
                        </span>
                        <span class="patient-arrow"><i class="fas fa-arrow-left"></i></span>
                    </div>
                    <p class="patient-summary">${escapeHtml(meta.summary)}</p>
                    <div class="patient-card-footer">
                        <span class="patient-date"><i class="far fa-calendar"></i> آخرین ویرایش: ${formatDate(patient.updated_at || patient.created_at)}</span>
                        <span class="status-badge">${status.label}</span>
                    </div>
                </article>`;
        }).join('');

        elements.cardsGrid.querySelectorAll('.patient-card').forEach(card => {
            const openPatient = () => {
                window.location.href = `patient.html?fileNumber=${encodeURIComponent(card.dataset.fileNumber)}`;
            };
            card.addEventListener('click', openPatient);
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPatient();
                }
            });
        });
    }

    function schedulePatientRender() {
        if (state.renderFrame) return;
        state.renderFrame = window.requestAnimationFrame(() => {
            state.renderFrame = 0;
            renderPatients();
        });
    }

    function setStatusFilter(status) {
        state.status = status;
        if (elements.statusFilter) elements.statusFilter.value = status;
        document.querySelectorAll('#statusFilterChips button').forEach(button => {
            const isSelected = button.dataset.status === status;
            button.classList.toggle('is-selected', isSelected);
            button.setAttribute('aria-pressed', String(isSelected));
        });
        document.querySelectorAll('#statusLegend button').forEach(button => {
            const isSelected = button.dataset.status === status;
            button.classList.toggle('is-selected', isSelected);
            button.setAttribute('aria-pressed', String(isSelected));
        });
        renderPatients();
        document.getElementById('patientsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function activitySeries(days) {
        const now = new Date();
        const bucketCount = days === 7 ? 7 : days === 30 ? 10 : 12;
        const bucketSize = days / bucketCount;
        const buckets = Array.from({ length: bucketCount }, (_, index) => {
            const endDaysAgo = days - ((index + 1) * bucketSize);
            const date = new Date(now);
            date.setDate(now.getDate() - Math.max(0, Math.round(endDaysAgo)));
            return { value: 0, label: formatDate(date, { short: true }) };
        });

        state.patients.forEach(patient => {
            const value = patient.updated_at || patient.created_at;
            if (!value) return;
            const age = (now - new Date(value)) / 86400000;
            if (age < 0 || age > days) return;
            const bucketIndex = Math.min(bucketCount - 1, Math.max(0, bucketCount - 1 - Math.floor(age / bucketSize)));
            buckets[bucketIndex].value += 1;
        });
        return buckets;
    }

    function smoothPath(points) {
        if (points.length < 2) return '';
        return points.reduce((path, point, index) => {
            if (index === 0) return `M ${point.x} ${point.y}`;
            const previous = points[index - 1];
            const middleX = (previous.x + point.x) / 2;
            return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
        }, '');
    }

    function renderTrendChart() {
        if (!elements.trendSvg) return;
        const series = activitySeries(state.range);
        const width = 760;
        const height = 260;
        const padding = { top: 18, right: 28, bottom: 35, left: 26 };
        const plotWidth = width - padding.right - padding.left;
        const plotHeight = height - padding.top - padding.bottom;
        const maxValue = Math.max(4, ...series.map(item => item.value));
        const points = series.map((item, index) => ({
            ...item,
            x: padding.right + (index * plotWidth / Math.max(1, series.length - 1)),
            y: padding.top + plotHeight - (item.value / maxValue * plotHeight)
        }));
        const path = smoothPath(points);
        const areaPath = `${path} L ${points.at(-1).x} ${padding.top + plotHeight} L ${points[0].x} ${padding.top + plotHeight} Z`;
        const gridLines = Array.from({ length: 5 }, (_, index) => {
            const y = padding.top + index * plotHeight / 4;
            const value = Math.round(maxValue - index * maxValue / 4);
            return `<line class="chart-grid-line" x1="${padding.right}" y1="${y}" x2="${width - padding.left}" y2="${y}"></line>
                <text class="chart-axis-label" x="${width - 4}" y="${y + 3}" text-anchor="end">${toPersianDigits(value)}</text>`;
        }).join('');
        const labelStep = series.length > 10 ? 2 : 1;
        const labels = points.map((point, index) => index % labelStep === 0
            ? `<text class="chart-axis-label" x="${point.x}" y="${height - 8}" text-anchor="middle">${escapeHtml(point.label)}</text>`
            : '').join('');
        const pointElements = points.map((point, index) => `
            <circle class="chart-point" tabindex="0" role="button" aria-label="${escapeHtml(point.label)}، ${toPersianDigits(point.value)} فعالیت"
                data-index="${index}" cx="${point.x}" cy="${point.y}" r="5"></circle>`).join('');

        elements.trendSvg.innerHTML = `
            <defs>
                <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--primary)" stop-opacity=".28"></stop>
                    <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"></stop>
                </linearGradient>
            </defs>
            ${gridLines}
            <path class="chart-area" d="${areaPath}"></path>
            <path class="chart-line" d="${path}" pathLength="900" style="stroke-dasharray:900;animation:chartReveal .9s var(--ease) both"></path>
            ${labels}${pointElements}`;

        const activityTotal = series.reduce((sum, item) => sum + item.value, 0);
        setText('rangeActivityCount', toPersianDigits(activityTotal));
        setText('rangeInsight', activityTotal ? `بیشترین فعالیت: ${toPersianDigits(Math.max(...series.map(item => item.value)))} پرونده` : 'در این بازه فعالیتی ثبت نشده است');

        elements.trendSvg.querySelectorAll('.chart-point').forEach(point => {
            const showTooltip = () => {
                const item = points[Number(point.dataset.index)];
                elements.chartTooltip.innerHTML = `<strong>${toPersianDigits(item.value)} فعالیت</strong><span>${escapeHtml(item.label)}</span>`;
                elements.chartTooltip.style.left = `${item.x / width * 100}%`;
                elements.chartTooltip.style.top = `${item.y / height * 100}%`;
                elements.chartTooltip.classList.add('is-visible');
            };
            const hideTooltip = () => elements.chartTooltip.classList.remove('is-visible');
            point.addEventListener('mouseenter', showTooltip);
            point.addEventListener('focus', showTooltip);
            point.addEventListener('click', showTooltip);
            point.addEventListener('mouseleave', hideTooltip);
            point.addEventListener('blur', hideTooltip);
        });
    }

    function renderDonutChart() {
        if (!elements.donutSvg) return;
        const counts = getCounts();
        const values = [
            { status: 'under_treatment', value: counts.under, color: 'var(--primary)' },
            { status: 'finished', value: counts.finished, color: 'var(--green)' },
            { status: 'other', value: counts.other, color: 'var(--amber)' }
        ];
        const radius = 82;
        const circumference = 2 * Math.PI * radius;
        let offset = 0;
        const gap = counts.total > 1 ? 4 : 0;
        const segments = values.map(item => {
            const length = counts.total ? (item.value / counts.total) * circumference : 0;
            const segment = `<circle class="donut-segment" tabindex="0" role="button" data-status="${item.status}"
                aria-label="${getStatusConfig(item.status).label || 'سایر'}: ${toPersianDigits(item.value)} پرونده"
                cx="110" cy="110" r="${radius}" stroke="${item.color}"
                stroke-dasharray="${Math.max(0, length - gap)} ${circumference}"
                stroke-dashoffset="${-offset}"></circle>`;
            offset += length;
            return segment;
        }).join('');
        elements.donutSvg.innerHTML = `<circle class="donut-track" cx="110" cy="110" r="${radius}"></circle>${segments}`;
        elements.donutSvg.querySelectorAll('.donut-segment').forEach(segment => {
            segment.addEventListener('click', () => setStatusFilter(segment.dataset.status));
            segment.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') setStatusFilter(segment.dataset.status);
            });
        });
        const rate = counts.total ? Math.round(counts.finished / counts.total * 100) : 0;
        setText('gaugePercentageText', `${toPersianDigits(rate)}٪`);
        setText('legendUnderCount', toPersianDigits(counts.under));
        setText('legendFinishedCount', toPersianDigits(counts.finished));
        setText('legendOtherCount', toPersianDigits(counts.other));
    }

    function renderCharts() {
        renderTrendChart();
        renderDonutChart();
    }

    function updateMetrics() {
        const counts = getCounts();
        setText('totalPatientsCount', toPersianDigits(counts.total));
        setText('underTreatmentCount', toPersianDigits(counts.under));
        setText('finishedTreatmentCount', toPersianDigits(counts.finished));
        setText('otherTreatmentCount', toPersianDigits(counts.other));
        setText('sidebarPatientCount', toPersianDigits(counts.total));
    }

    function renderPatientLoadError(error) {
        if (!elements.cardsGrid) return;
        if (state.loaded) {
            setText('patientResultsLabel', 'نمایش آخرین داده دریافت‌شده؛ همگام‌سازی جدید ناموفق بود');
            return;
        }
        elements.cardsGrid.innerHTML = `
            <div class="error-state">
                <i class="fas fa-database"></i>
                <strong>دریافت پرونده‌ها با مشکل مواجه شد</strong>
                <span>وضعیت اتصال را بررسی کنید و دوباره تلاش کنید.</span>
                <button class="secondary-button patient-retry-button" type="button">
                    <i class="fas fa-rotate"></i> تلاش دوباره
                </button>
            </div>`;
        elements.cardsGrid.querySelector('.patient-retry-button')?.addEventListener('click', () => {
            loadDashboardData({ source: 'تلاش دوباره از بخش پرونده‌ها', forceConnectionCheck: true });
        });
        if (error) console.warn('[Dashboard] Patient data unavailable.', error);
    }

    let dashboardLoadPromise = null;

    async function loadDashboardData({ source = 'بارگذاری داشبورد', forceConnectionCheck = false } = {}) {
        if (dashboardLoadPromise) return dashboardLoadPromise;

        dashboardLoadPromise = (async () => {
            const health = state.health;
            health.busy = true;
            health.source = source;
            health.lastChecked = new Date();
            health.error = null;
            health.errorStage = '';
            health.databaseStatus = 'checking';
            health.syncStatus = state.loaded ? 'stale' : 'checking';
            if (navigator.onLine) health.networkOnline = true;
            renderDatabaseHealth();

            let operationStage = 'connection';
            try {
                if (!window.DB) {
                    throw new Error('کلاینت پایگاه داده در مرورگر آماده نیست.');
                }

                if (forceConnectionCheck && navigator.onLine && window.SupabaseConnection?.check) {
                    window.SupabaseConnection.ready = window.SupabaseConnection.check({ attempts: 2 });
                    const connected = await window.SupabaseConnection.ready;
                    if (!connected) throw window.SupabaseConnection.lastError || new Error('ارتباط با سرویس پایگاه داده برقرار نشد.');
                }

                operationStage = 'database';
                const healthStartedAt = performance.now();
                const databaseHealth = await window.DB.healthCheck();
                health.latency = Math.max(0, performance.now() - healthStartedAt);
                health.lastChecked = new Date();
                if (!databaseHealth.ok) throw databaseHealth.error || new Error('بررسی دسترسی پایگاه داده ناموفق بود.');

                health.connectionStatus = window.SupabaseConnection?.status || 'connected';
                health.databaseStatus = 'healthy';
                operationStage = 'sync';
                const patients = await window.DB.getAllPatients();
                if (window.DB.lastError) throw window.DB.lastError;

                state.patients = patients;
                state.patients.sort((first, second) => new Date(second.updated_at || second.created_at || 0) - new Date(first.updated_at || first.created_at || 0));
                state.loaded = true;
                health.syncStatus = 'healthy';
                health.lastSuccess = new Date();
                localStorage.setItem('databaseLastSuccessAt', health.lastSuccess.toISOString());
                health.error = null;
                health.errorStage = '';
                updateMetrics();
                renderCharts();
                renderPatients();
                return true;
            } catch (error) {
                console.error(error);
                health.lastChecked = new Date();
                health.error = error instanceof Error ? error : new Error(String(error || 'خطای نامشخص'));
                health.errorStage = operationStage;
                health.networkOnline = navigator.onLine;

                if (!health.networkOnline) {
                    health.connectionStatus = 'unavailable';
                    health.databaseStatus = operationStage === 'database' ? 'error' : health.databaseStatus;
                    health.syncStatus = state.loaded ? 'stale' : 'error';
                } else if (operationStage === 'sync') {
                    health.syncStatus = 'error';
                    if (health.databaseStatus === 'checking') health.databaseStatus = 'healthy';
                } else {
                    health.databaseStatus = 'error';
                    health.syncStatus = state.loaded ? 'stale' : 'error';
                }
                renderPatientLoadError(error);
                return false;
            } finally {
                health.busy = false;
                renderDatabaseHealth();
                dashboardLoadPromise = null;
            }
        })();

        return dashboardLoadPromise;
    }

    async function retryDatabaseHealth() {
        if (state.health.busy) return;
        state.health.networkOnline = navigator.onLine;
        state.health.source = 'بررسی دستی مدیر';
        state.health.lastChecked = new Date();
        state.health.error = null;
        state.health.errorStage = '';

        if (!navigator.onLine) {
            state.health.connectionStatus = 'unavailable';
            state.health.syncStatus = state.loaded ? 'stale' : 'error';
            renderDatabaseHealth();
            return;
        }

        state.health.connectionStatus = 'checking';
        state.health.databaseStatus = 'checking';
        state.health.syncStatus = state.loaded ? 'stale' : 'checking';
        renderDatabaseHealth();
        await loadDashboardData({ source: 'بررسی دستی مدیر', forceConnectionCheck: true });
    }

    function handleSupabaseConnection(event) {
        const nextStatus = event.detail?.status || 'unavailable';
        state.health.connectionStatus = nextStatus;
        state.health.networkOnline = navigator.onLine;

        if (nextStatus === 'unavailable') {
            state.health.errorStage = 'connection';
            state.health.error = window.SupabaseConnection?.lastError
                || (event.detail?.message ? new Error(event.detail.message) : state.health.error);
            state.health.syncStatus = state.loaded ? 'stale' : 'error';
        } else if (nextStatus === 'connected' && state.health.errorStage === 'connection') {
            state.health.error = null;
            state.health.errorStage = '';
        }
        renderDatabaseHealth();
    }

    function handleBrowserOffline() {
        state.health.networkOnline = false;
        state.health.connectionStatus = 'unavailable';
        state.health.source = 'پایش خودکار شبکه مرورگر';
        state.health.lastChecked = new Date();
        state.health.errorStage = 'network';
        state.health.syncStatus = state.loaded ? 'stale' : 'error';
        renderDatabaseHealth();
    }

    function handleBrowserOnline() {
        state.health.networkOnline = true;
        state.health.connectionStatus = 'checking';
        state.health.databaseStatus = 'checking';
        state.health.syncStatus = state.loaded ? 'stale' : 'checking';
        state.health.source = 'بازیابی خودکار پس از اتصال شبکه';
        state.health.error = null;
        state.health.errorStage = '';
        renderDatabaseHealth();

        window.setTimeout(async () => {
            if (dashboardLoadPromise) await dashboardLoadPromise;
            if (navigator.onLine) {
                await loadDashboardData({ source: 'بازیابی خودکار پس از اتصال شبکه' });
            }
        }, 350);
    }

    function initializeDatabaseHealth() {
        const connection = window.SupabaseConnection;
        state.health.networkOnline = navigator.onLine;
        state.health.connectionStatus = connection?.status || (window.supabase ? 'initializing' : 'unavailable');
        if (connection?.lastError) {
            state.health.error = connection.lastError;
            state.health.errorStage = 'connection';
        }
        setDatabaseDetailsExpanded(state.health.detailsExpanded, { persist: false });
        renderDatabaseHealth();
    }

    function openSidebar() {
        elements.body.classList.add('sidebar-open');
        document.getElementById('mobileMenuBtn')?.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
        elements.body.classList.remove('sidebar-open');
        document.getElementById('mobileMenuBtn')?.setAttribute('aria-expanded', 'false');
    }

    function focusSearch() {
        closeSidebar();
        document.getElementById('patientsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => elements.searchInput?.focus(), 350);
    }

    function setView(view) {
        state.view = view;
        localStorage.setItem('dashboardView', view);
        const gridButton = document.getElementById('gridViewBtn');
        const listButton = document.getElementById('listViewBtn');
        gridButton?.classList.toggle('is-selected', view === 'grid');
        listButton?.classList.toggle('is-selected', view === 'list');
        gridButton?.setAttribute('aria-pressed', String(view === 'grid'));
        listButton?.setAttribute('aria-pressed', String(view === 'list'));
        elements.cardsGrid?.classList.toggle('is-list', view === 'list');
        if (state.loaded) renderPatients();
    }

    const currentUserPhone = localStorage.getItem('userPhone') || '';
    const adminManagementButton = document.getElementById('adminUserManagementRow');
    if (currentUserPhone === '09337593737') adminManagementButton?.classList.remove('hidden');

    function showToast(message) {
        if (window.showToast) window.showToast(message);
        else window.alert(message);
    }

    async function loadUsersList() {
        if (!elements.usersTableBody || !window.DB) return;
        elements.usersTableBody.innerHTML = '<tr><td colspan="3">در حال دریافت اطلاعات...</td></tr>';
        const users = await window.DB.getUsers();
        if (!users.length) {
            elements.usersTableBody.innerHTML = '<tr><td colspan="3">همکاری در سامانه ثبت نشده است.</td></tr>';
            return;
        }
        elements.usersTableBody.innerHTML = users.map(user => {
            const protectedUser = user.phone === '09337593737' || user.phone === currentUserPhone;
            return `<tr>
                <td>${escapeHtml(user.phone)}</td>
                <td><span class="user-role-pill">${user.role === 'admin' ? 'مدیر' : 'همکار'}</span></td>
                <td><button class="delete-user-btn" type="button" data-id="${escapeHtml(user.id)}" data-phone="${escapeHtml(user.phone)}" ${protectedUser ? 'disabled' : ''} aria-label="حذف کاربر"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('');
        elements.usersTableBody.querySelectorAll('.delete-user-btn:not(:disabled)').forEach(button => {
            button.addEventListener('click', async () => {
                if (!window.confirm(`همکار با شماره ${button.dataset.phone} حذف شود؟`)) return;
                const result = await window.DB.deleteUser(button.dataset.id);
                showToast(result.success ? 'همکار با موفقیت حذف شد.' : result.message);
                if (result.success) loadUsersList();
            });
        });
    }

    let modalReturnFocus = null;

    function openUserModal() {
        modalReturnFocus = document.activeElement;
        elements.userModal?.classList.add('is-open');
        elements.userModal?.setAttribute('aria-hidden', 'false');
        elements.body.classList.add('modal-open');
        elements.settingsDropdown?.classList.remove('is-open');
        loadUsersList();
        window.setTimeout(() => document.getElementById('newUserPhone')?.focus(), 200);
    }

    function closeUserModal() {
        elements.userModal?.classList.remove('is-open');
        elements.userModal?.setAttribute('aria-hidden', 'true');
        elements.body.classList.remove('modal-open');
        if (modalReturnFocus instanceof HTMLElement) modalReturnFocus.focus({ preventScroll: true });
        modalReturnFocus = null;
    }

    document.getElementById('newUserForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        if (currentUserPhone !== '09337593737') return showToast('دسترسی انجام این عملیات را ندارید.');
        const phoneInput = document.getElementById('newUserPhone');
        const passwordInput = document.getElementById('newUserPass');
        const roleInput = document.getElementById('newUserRole');
        const phone = toEnglishDigits(phoneInput.value.trim());
        if (!/^\d{11}$/.test(phone)) return showToast('شماره تماس باید ۱۱ رقم باشد.');
        if (passwordInput.value.length < 8) return showToast('رمز عبور باید حداقل ۸ کاراکتر باشد.');
        const result = await window.DB.createUser(phone, passwordInput.value, roleInput.value, currentUserPhone);
        showToast(result.success ? 'همکار جدید با موفقیت اضافه شد.' : result.message);
        if (result.success) {
            event.target.reset();
            loadUsersList();
        }
    });

    const savedTheme = localStorage.getItem('dashboardTheme');
    const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(savedTheme || preferredTheme);
    updateTodayLabel();
    setView(state.view);
    initializeDatabaseHealth();

    window.addEventListener('supabase:connection', handleSupabaseConnection);
    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);

    ['themeToggleBtn', 'sidebarThemeBtn', 'desktopThemeBtn', 'mobileThemeBtn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', toggleTheme);
    });
    ['topSearchBtn', 'sidebarSearchBtn', 'mobileSearchBtn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', focusSearch);
    });
    document.getElementById('mobileMenuBtn')?.addEventListener('click', openSidebar);
    document.getElementById('sidebarCloseBtn')?.addEventListener('click', closeSidebar);
    document.getElementById('mobileOverlay')?.addEventListener('click', closeSidebar);
    document.querySelectorAll('.sidebar a').forEach(link => link.addEventListener('click', closeSidebar));
    document.getElementById('gridViewBtn')?.addEventListener('click', () => setView('grid'));
    document.getElementById('listViewBtn')?.addEventListener('click', () => setView('list'));
    document.getElementById('resetStatusFilter')?.addEventListener('click', () => setStatusFilter('all'));
    elements.databaseDetailsToggle?.addEventListener('click', () => {
        setDatabaseDetailsExpanded(!state.health.detailsExpanded);
    });
    elements.databaseRetryButton?.addEventListener('click', retryDatabaseHealth);
    elements.databaseStatusShortcut?.addEventListener('click', () => {
        closeSidebar();
        setDatabaseDetailsExpanded(true);
        elements.databaseStatusCenter?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    adminManagementButton?.addEventListener('click', openUserModal);
    document.getElementById('closeUserModalBtn')?.addEventListener('click', closeUserModal);
    elements.userModal?.addEventListener('click', event => {
        if (event.target === elements.userModal) closeUserModal();
    });

    elements.settingsMenuBtn?.addEventListener('click', event => {
        event.stopPropagation();
        const isOpen = elements.settingsDropdown.classList.toggle('is-open');
        elements.settingsMenuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', event => {
        if (!elements.settingsDropdown?.contains(event.target) && !elements.settingsMenuBtn?.contains(event.target)) {
            elements.settingsDropdown?.classList.remove('is-open');
            elements.settingsMenuBtn?.setAttribute('aria-expanded', 'false');
        }
    });

    elements.searchInput?.addEventListener('input', event => {
        state.query = event.target.value;
        schedulePatientRender();
    });
    elements.statusFilter?.addEventListener('change', event => setStatusFilter(event.target.value));
    document.querySelectorAll('#statusFilterChips button, #statusLegend button').forEach(button => {
        button.addEventListener('click', () => setStatusFilter(button.dataset.status));
    });
    document.querySelectorAll('#trendRangeControl button').forEach(button => {
        button.addEventListener('click', () => {
            state.range = Number(button.dataset.range);
            document.querySelectorAll('#trendRangeControl button').forEach(item => {
                const isSelected = item === button;
                item.classList.toggle('is-selected', isSelected);
                item.setAttribute('aria-pressed', String(isSelected));
            });
            renderTrendChart();
        });
    });
    document.addEventListener('keydown', event => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            focusSearch();
        }
        if (event.key === 'Escape') {
            closeSidebar();
            closeUserModal();
            elements.settingsDropdown?.classList.remove('is-open');
            elements.settingsMenuBtn?.setAttribute('aria-expanded', 'false');
        }
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (window.Auth) window.Auth.logout();
        else {
            localStorage.removeItem('adminLoggedIn');
            window.location.href = 'index.html';
        }
    });

    await loadDashboardData({ source: 'بارگذاری اولیه داشبورد' });
});
