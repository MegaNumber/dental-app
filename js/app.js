// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    
    function showToast(m) {
        const t = document.getElementById('toast');
        t.textContent = m;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2200);
    }
    window.showToast = showToast;

    function calcH(nw, nh, cw) {
        return Math.max(80, Math.min(cw * (nh / nw), 800));
    }

    function getImageFitMode() {
        return getComputedStyle(document.documentElement).getPropertyValue('--image-fit').trim() || '100% 100%';
    }

    function compressImage(file, options = {}) {
        return new Promise((resolve) => {
            const maxWidth = options.maxWidth || 1600;
            const maxHeight = options.maxHeight || 1600;
            const quality = options.quality || 0.82;
            const format = options.format || 'image/jpeg';

            if (!file || !file.type.startsWith('image/')) {
                resolve(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.naturalWidth;
                    let height = img.naturalHeight;

                    if (!width || !height) {
                        resolve(file);
                        return;
                    }

                    if (width > maxWidth || height > maxHeight) {
                        if (width > height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(file);
                        return;
                    }

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }
                        const ext = format === 'image/jpeg' ? '.jpg' : '.png';
                        const newName = file.name.replace(/\.[^/.]+$/, "") + ext;
                        const compressedFile = new File([blob], newName, {
                            type: format,
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }, format, quality);
                };
                img.onerror = () => resolve(file);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        });
    }

    const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
    const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

    function toEnglishDigits(value) {
        return String(value || '')
            .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
            .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));
    }

    function toPersianDigits(value) {
        return String(value || '').replace(/\d/g, d => PERSIAN_DIGITS[d] || d);
    }

    function normalizeFileNumber(value) {
        return toEnglishDigits(String(value || '').trim());
    }

    function getRequiredFileNumber() {
        const input = document.getElementById('fileNumber');
        const fileNumber = normalizeFileNumber(input.value);
        if (!fileNumber) {
            showToast('ابتدا شماره پرونده را وارد کنید');
            input.focus();
            return null;
        }
        if (input.value !== fileNumber) input.value = fileNumber;
        return fileNumber;
    }

    function ensureRemoveButton(rect) {
        if (!rect.querySelector('.remove-img-btn')) {
            const btn = document.createElement('button');
            btn.className = 'remove-img-btn';
            btn.type = 'button';
            btn.title = 'حذف';
            btn.innerHTML = '<i class="fas fa-times"></i>';
            rect.prepend(btn);
        }
    }

    function showImageSkeleton(target, label = 'در حال آماده‌سازی تصویر') {
        if (!target) return;
        target.setAttribute('aria-busy', 'true');
        let skeleton = target.querySelector(':scope > .media-skeleton');
        if (!skeleton) {
            skeleton = document.createElement('div');
            skeleton.className = 'media-skeleton';
            skeleton.setAttribute('aria-hidden', 'true');
            skeleton.innerHTML = `
                <span class="media-skeleton-preview"><i class="fas fa-image"></i></span>
                <span class="media-skeleton-copy"><span></span><span></span></span>
                <small class="media-skeleton-label"></small>`;
            target.appendChild(skeleton);
        }
        const labelElement = skeleton.querySelector('.media-skeleton-label');
        if (labelElement) labelElement.textContent = label;
    }

    function hideImageSkeleton(target, force = false) {
        if (!target || (!force && target.getAttribute('data-uploading') === 'true')) return;
        target.removeAttribute('aria-busy');
        target.querySelector(':scope > .media-skeleton')?.remove();
    }

    function applyUploadPreview(targetRect, url) {
        showImageSkeleton(targetRect, targetRect.getAttribute('data-uploading') === 'true' ? 'در حال پردازش و بارگذاری' : 'در حال نمایش تصویر');
        const cachedWidth = targetRect.getAttribute('data-width');
        const cachedHeight = targetRect.getAttribute('data-height');

        const applyStyles = (naturalWidth, naturalHeight) => {
            const cw = targetRect.offsetWidth || 300;
            const th = calcH(naturalWidth, naturalHeight, cw);
            targetRect.style.height = th + 'px';
            targetRect.style.minHeight = th + 'px';
            targetRect.style.backgroundImage = `url(${url})`;
            targetRect.style.backgroundSize = getImageFitMode();
            targetRect.style.backgroundRepeat = 'no-repeat';
            targetRect.style.backgroundPosition = 'center';
            targetRect.classList.add('has-image');
            ensureRemoveButton(targetRect);
            const icon = targetRect.querySelector(':scope > i');
            const span = targetRect.querySelector(':scope > span');
            if(icon) icon.style.display = 'none';
            if(span) span.style.display = 'none';
        };

        const hasCachedDimensions = cachedWidth && cachedHeight;
        if (hasCachedDimensions) {
            applyStyles(parseInt(cachedWidth, 10), parseInt(cachedHeight, 10));
        }

        const img = new Image();
        img.onload = () => {
            if (!hasCachedDimensions) {
                targetRect.setAttribute('data-width', img.naturalWidth);
                targetRect.setAttribute('data-height', img.naturalHeight);
                applyStyles(img.naturalWidth, img.naturalHeight);
            }
            hideImageSkeleton(targetRect);
        };
        img.onerror = () => hideImageSkeleton(targetRect, true);
        img.src = url;
    }

    function applyStoredUploadImage(targetRect, url) {
        showImageSkeleton(targetRect, 'در حال نمایش تصویر');
        targetRect.setAttribute('data-db-url', url);
        targetRect.setAttribute('data-image-url', url);
        targetRect.classList.add('has-image');
        targetRect.style.backgroundImage = `url(${url})`;
        targetRect.style.backgroundSize = getImageFitMode();
        targetRect.style.backgroundRepeat = 'no-repeat';
        targetRect.style.backgroundPosition = 'center';
        ensureRemoveButton(targetRect);
        requestAnimationFrame(() => applyUploadPreview(targetRect, url));
    }

    function applyCoverImage(url) {
        showImageSkeleton(coverZone, 'در حال نمایش تصویر کاور');
        coverZone.style.backgroundImage = `url(${url})`;
        coverZone.style.backgroundSize = 'cover';
        coverZone.style.backgroundPosition = 'center';
        coverZone.classList.add('has-cover');
        coverZone.setAttribute('data-db-url', url);
        coverZone.setAttribute('data-image-url', url);

        const cachedWidth = coverZone.getAttribute('data-width');
        const cachedHeight = coverZone.getAttribute('data-height');

        const applyHeight = (naturalWidth, naturalHeight) => {
            const cw = coverZone.offsetWidth || 300;
            const h = Math.max(140, Math.min(cw * (naturalHeight / naturalWidth), 500));
            coverZone.style.height = h + 'px';
        };

        const hasCachedDimensions = cachedWidth && cachedHeight;
        if (hasCachedDimensions) {
            applyHeight(parseInt(cachedWidth, 10), parseInt(cachedHeight, 10));
        }

        const img = new Image();
        img.onload = () => {
            if (!hasCachedDimensions) {
                coverZone.setAttribute('data-width', img.naturalWidth);
                coverZone.setAttribute('data-height', img.naturalHeight);
                applyHeight(img.naturalWidth, img.naturalHeight);
            }
            hideImageSkeleton(coverZone);
        };
        img.onerror = () => hideImageSkeleton(coverZone, true);
        img.src = url;
    }

    function resetCoverImage() {
        coverZone.removeAttribute('data-db-url');
        coverZone.removeAttribute('data-image-url');
        coverZone.removeAttribute('data-uploading');
        coverZone.removeAttribute('data-width');
        coverZone.removeAttribute('data-height');
        coverZone.style.height = '';
        coverZone.style.backgroundImage = '';
        coverZone.classList.remove('has-cover');
        hideImageSkeleton(coverZone, true);
    }

    function applyProfileImage(url) {
        showImageSkeleton(profileZone, 'در حال نمایش تصویر');
        const inner = profileZone.querySelector('.profile-pic-inner');
        profileZone.setAttribute('data-db-url', url);
        const img = new Image();
        img.onload = () => {
            inner.style.backgroundImage = `url(${url})`;
            inner.style.backgroundSize = 'cover';
            inner.innerHTML = '';
            profileZone.classList.add('has-image');
            hideImageSkeleton(profileZone);
        };
        img.onerror = () => hideImageSkeleton(profileZone, true);
        img.src = url;
    }

    function resetProfileImage() {
        const inner = profileZone.querySelector('.profile-pic-inner');
        profileZone.removeAttribute('data-db-url');
        profileZone.removeAttribute('data-uploading');
        profileZone.removeAttribute('data-width');
        profileZone.removeAttribute('data-height');
        profileZone.classList.remove('has-image');
        inner.style.backgroundImage = '';
        inner.style.backgroundSize = '';
        inner.innerHTML = '<i class="fas fa-user"></i><span>profile</span>';
        hideImageSkeleton(profileZone, true);
    }

    function resetEmptyUploadRect(rect) {
        rect.removeAttribute('data-db-url');
        rect.removeAttribute('data-image-url');
        rect.removeAttribute('data-width');
        rect.removeAttribute('data-height');
        rect.style.height = '';
        rect.style.minHeight = '';
        rect.style.backgroundImage = '';
        rect.classList.remove('has-image');
        rect.querySelector('.remove-img-btn')?.remove();
        hideImageSkeleton(rect, true);
        const icon = rect.querySelector(':scope > i');
        const span = rect.querySelector(':scope > span');
        if (icon) icon.style.display = 'block';
        if (span) span.style.display = 'block';
    }

    function refreshImageHeights() {
        document.querySelectorAll('.upload-rect[data-image-url]').forEach(rect => {
            applyUploadPreview(rect, rect.getAttribute('data-image-url'));
        });
        const coverUrl = coverZone.getAttribute('data-image-url');
        if (coverUrl) applyCoverImage(coverUrl);
    }

    function makeSectionKey(prefix = 'custom') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    const RESULT_DEFAULT_FIELDS = [
        { key: 'treatmentDuration', label: 'مدت درمان', placeholder: 'مثلاً ۱۲ ماه', fieldType: 'text' },
        { key: 'extractDate', label: 'تاریخ برداشت', placeholder: 'مثلاً ۱۴۰۵/۰۳/۱۵', fieldType: 'jalali-date' },
        { key: 'patientPresence', label: 'حضور به موقع بیمار', placeholder: 'وضعیت حضور بیمار', fieldType: 'text' },
        { key: 'patientCare', label: 'مراقبت بیمار', placeholder: 'نوع مراقبت', fieldType: 'text' },
        { key: 'hygiene', label: 'بهداشت در طول درمان', placeholder: 'وضعیت بهداشت', fieldType: 'text' },
        { key: 'postRequirements', label: 'الزامات بعد از درمان', placeholder: 'الزامات و توصیه‌ها', fieldType: 'text' }
    ];
    const PATIENT_DETAIL_ROW_DEFAULT = { label: 'فیلد جدید', placeholder: 'وارد کنید...' };
    const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    let activeResultDateField = null;

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

    function toGregorian(jy, jm, jd) {
        const sal_a = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let jy2 = jy + 1595;
        let days = -355668 + (365 * jy2) + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + jd;
        if (jm < 7) {
            days += (jm - 1) * 31;
        } else {
            days += (jm - 1) * 30 + 6;
        }
        let gy = 400 * Math.floor(days / 146097);
        days %= 146097;
        if (days > 36524) {
            gy += 100 * Math.floor(--days / 36524);
            days %= 36524;
            if (days >= 365) days++;
        }
        gy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            gy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        let gd = days + 1;
        let gm = 0;
        const salv = [0, 31, (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        for (let i = 1; i <= 12; i++) {
            if (gd <= salv[i]) {
                gm = i;
                break;
            }
            gd -= salv[i];
        }
        return { gy, gm, gd };
    }

    function isLeapJalaliYear(jy) {
        const g = toGregorian(jy, 12, 30);
        const j = toJalali(g.gy, g.gm, g.gd);
        return j.jy === jy && j.jm === 12 && j.jd === 30;
    }

    function getJalaliMonthLength(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        return isLeapJalaliYear(jy) ? 30 : 29;
    }

    function parseJalaliDate(value) {
        const normalized = toEnglishDigits(String(value || '').trim()).replace(/[.\-]/g, '/');
        const match = normalized.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
        if (!match) return null;
        const jy = Number(match[1]);
        const jm = Number(match[2]);
        const jd = Number(match[3]);
        try {
            if (jm < 1 || jm > 12 || jd < 1 || jd > getJalaliMonthLength(jy, jm)) return null;
        } catch {
            return null;
        }
        return { jy, jm, jd };
    }

    function formatJalaliDate({ jy, jm, jd }) {
        return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
    }

    function getTodayJalali() {
        const today = new Date();
        return toJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    }

    function getJalaliWeekdayIndex(jy, jm, jd = 1) {
        const { gy, gm, gd } = toGregorian(jy, jm, jd);
        return (new Date(gy, gm - 1, gd).getDay() + 1) % 7;
    }

    function placeEditableSelection(node) {
        requestAnimationFrame(() => {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(node);
            selection.removeAllRanges();
            selection.addRange(range);
        });
    }

    function getResultGrid() {
        return document.getElementById('resultGrid') || document.querySelector('.result-grid');
    }

    function getPatientDetailsContainer() {
        return document.getElementById('patientDetailsFields');
    }

    function getDefaultResultField(key) {
        return RESULT_DEFAULT_FIELDS.find(field => field.key === key) || null;
    }

    function resolveResultFieldType(field = {}) {
        if (field.fieldType) return field.fieldType;
        if (field.type && field.type !== 'patient_meta') return field.type;
        if (field.key === 'extractDate' || String(field.label || '').trim() === 'تاریخ برداشت') return 'jalali-date';
        return 'text';
    }

    function normalizeResultField(field = {}) {
        const fallback = getDefaultResultField(field.key);
        const label = String(field.label ?? fallback?.label ?? 'فیلد جدید').replace(/\s+/g, ' ').trim() || 'فیلد جدید';
        const fieldType = resolveResultFieldType({ ...fallback, ...field });
        const rawValue = String(field.value ?? '');
        const parsedDate = fieldType === 'jalali-date' ? parseJalaliDate(rawValue) : null;
        return {
            key: field.key || makeSectionKey('result_field'),
            label,
            value: parsedDate ? formatJalaliDate(parsedDate) : rawValue,
            placeholder: String(field.placeholder ?? fallback?.placeholder ?? 'وارد کنید...'),
            fieldType,
            isDeletable: Boolean(field.allowDelete)
        };
    }

    function buildResultFieldMarkup(field, showDelete = false) {
        const inputId = `result-${field.key}`;
        const labelMarkup = `
            <div class="result-field-label-row">
                <label class="result-field-label" for="${escapeHtml(inputId)}"><span class="result-label-text" contenteditable="false" spellcheck="false">${escapeHtml(field.label)}</span></label>
                ${showDelete ? '<button class="component-delete-btn result-field-remove-btn" type="button" title="حذف سطر" aria-label="حذف سطر"><i class="fas fa-times"></i></button>' : ''}
            </div>`;
        const inputAttrs = `class="result-field-input${field.fieldType === 'jalali-date' ? ' result-date-input' : ''}" id="${escapeHtml(inputId)}" placeholder="${escapeHtml(field.placeholder)}" value="${escapeHtml(field.value)}"`;

        if (field.fieldType === 'jalali-date') {
            return `
                <div class="field-group result-field-group" data-result-key="${escapeHtml(field.key)}" data-result-type="jalali-date" data-result-placeholder="${escapeHtml(field.placeholder)}">
                    ${labelMarkup}
                    <div class="jalali-picker-shell">
                        <div class="result-input-shell">
                            <input type="text" ${inputAttrs} readonly inputmode="none" autocomplete="off">
                            <button class="jalali-picker-trigger" type="button" aria-label="باز کردن تقویم" aria-expanded="false">
                                <i class="fas fa-calendar-alt"></i>
                            </button>
                        </div>
                        <div class="jalali-picker-panel" hidden></div>
                    </div>
                </div>`;
        }

        return `
            <div class="field-group result-field-group" data-result-key="${escapeHtml(field.key)}" data-result-type="text" data-result-placeholder="${escapeHtml(field.placeholder)}">
                ${labelMarkup}
                <input type="text" ${inputAttrs} autocomplete="off">
            </div>`;
    }

    function renderResultFields(fields = RESULT_DEFAULT_FIELDS) {
        const resultGrid = getResultGrid();
        if (!resultGrid) return;
        closeResultDatePicker();
        const list = (Array.isArray(fields) && fields.length ? fields : RESULT_DEFAULT_FIELDS).map(normalizeResultField);
        resultGrid.innerHTML = list.map(buildResultFieldMarkup).join('');
        bindResultGrid();
    }

    function collectResultFields() {
        return Array.from(getResultGrid()?.querySelectorAll('.result-field-group') || []).map(fieldGroup => {
            const input = fieldGroup.querySelector('.result-field-input');
            return {
                key: fieldGroup.dataset.resultKey || makeSectionKey('result_field'),
                label: fieldGroup.querySelector('.result-label-text')?.textContent.replace(/\s+/g, ' ').trim() || 'فیلد جدید',
                value: input?.value || '',
                placeholder: input?.getAttribute('placeholder') || fieldGroup.dataset.resultPlaceholder || 'وارد کنید...',
                fieldType: fieldGroup.dataset.resultType || 'text'
            };
        });
    }

    function closeResultDatePicker() {
        if (!activeResultDateField) return;
        activeResultDateField.querySelector('.jalali-picker-panel')?.setAttribute('hidden', '');
        activeResultDateField.querySelector('.jalali-picker-trigger')?.setAttribute('aria-expanded', 'false');
        activeResultDateField = null;
    }

    function setResultDateValue(fieldGroup, dateParts) {
        const input = fieldGroup?.querySelector('.result-date-input');
        if (!input) return;
        input.value = dateParts ? formatJalaliDate(dateParts) : '';
        closeResultDatePicker();
        Autosave.trigger(input);
    }

    function renderResultDatePicker(fieldGroup) {
        const panel = fieldGroup?.querySelector('.jalali-picker-panel');
        const input = fieldGroup?.querySelector('.result-date-input');
        if (!panel || !input) return;

        const selected = parseJalaliDate(input.value);
        const today = getTodayJalali();
        const viewYear = Number(fieldGroup.dataset.viewYear) || selected?.jy || today.jy;
        const viewMonth = Number(fieldGroup.dataset.viewMonth) || selected?.jm || today.jm;
        fieldGroup.dataset.viewYear = String(viewYear);
        fieldGroup.dataset.viewMonth = String(viewMonth);

        const firstWeekday = getJalaliWeekdayIndex(viewYear, viewMonth, 1);
        const daysInMonth = getJalaliMonthLength(viewYear, viewMonth);
        const years = Array.from({ length: 41 }, (_, index) => viewYear - 20 + index);
        const weekdayMarkup = JALALI_WEEKDAYS.map(day => `<div class="jalali-picker-weekday">${day}</div>`).join('');
        const emptyMarkup = Array.from({ length: firstWeekday }, () => '<div class="jalali-picker-empty" aria-hidden="true"></div>').join('');
        const dayMarkup = Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const isSelected = selected && selected.jy === viewYear && selected.jm === viewMonth && selected.jd === day;
            const isToday = today.jy === viewYear && today.jm === viewMonth && today.jd === day;
            const classes = ['jalali-picker-day'];
            if (isSelected) classes.push('is-selected');
            if (isToday) classes.push('is-today');
            return `<button class="${classes.join(' ')}" type="button" data-jalali-day="${day}">${toPersianDigits(day)}</button>`;
        }).join('');

        panel.innerHTML = `
            <div class="jalali-picker-toolbar">
                <button class="jalali-picker-nav" type="button" data-jalali-nav="next" aria-label="ماه بعد"><i class="fas fa-chevron-left"></i></button>
                <div class="jalali-picker-selects">
                    <select class="jalali-picker-select" data-jalali-month>
                        ${JALALI_MONTHS.map((month, index) => `<option value="${index + 1}"${index + 1 === viewMonth ? ' selected' : ''}>${month}</option>`).join('')}
                    </select>
                    <select class="jalali-picker-select" data-jalali-year>
                        ${years.map(year => `<option value="${year}"${year === viewYear ? ' selected' : ''}>${toPersianDigits(year)}</option>`).join('')}
                    </select>
                </div>
                <button class="jalali-picker-nav" type="button" data-jalali-nav="prev" aria-label="ماه قبل"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="jalali-picker-weekdays">${weekdayMarkup}</div>
            <div class="jalali-picker-days">${emptyMarkup}${dayMarkup}</div>
            <div class="jalali-picker-actions">
                <button class="jalali-picker-action clear" type="button" data-jalali-action="clear">پاک کردن</button>
                <button class="jalali-picker-action today" type="button" data-jalali-action="today">امروز</button>
            </div>`;
    }

    function openResultDatePicker(fieldGroup) {
        if (!fieldGroup) return;
        if (activeResultDateField && activeResultDateField !== fieldGroup) closeResultDatePicker();
        const panel = fieldGroup.querySelector('.jalali-picker-panel');
        if (!panel) return;
        renderResultDatePicker(fieldGroup);
        panel.removeAttribute('hidden');
        fieldGroup.querySelector('.jalali-picker-trigger')?.setAttribute('aria-expanded', 'true');
        activeResultDateField = fieldGroup;
    }

    function startResultLabelEdit(fieldGroup) {
        const labelEl = fieldGroup?.querySelector('.result-label-text');
        if (!labelEl || labelEl.classList.contains('is-editing')) return;
        closeResultDatePicker();
        const originalLabel = labelEl.textContent.replace(/\s+/g, ' ').trim() || 'فیلد جدید';
        labelEl.contentEditable = 'true';
        labelEl.classList.add('is-editing');
        labelEl.focus();
        placeEditableSelection(labelEl);

        const finish = (revert = false) => {
            labelEl.removeEventListener('blur', onBlur);
            labelEl.removeEventListener('keydown', onKeydown);
            labelEl.contentEditable = 'false';
            labelEl.classList.remove('is-editing');
            labelEl.textContent = revert
                ? originalLabel
                : (labelEl.textContent.replace(/\s+/g, ' ').trim() || originalLabel);
            Autosave.trigger();
        };

        const onBlur = () => finish(false);
        const onKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                labelEl.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finish(true);
                labelEl.blur();
            }
        };

        labelEl.addEventListener('blur', onBlur, { once: true });
        labelEl.addEventListener('keydown', onKeydown);
    }

    function addResultField() {
        const resultGrid = getResultGrid();
        if (!resultGrid) return null;
        const field = normalizeResultField({ label: 'فیلد جدید', placeholder: 'وارد کنید...', allowDelete: true });
        const template = document.createElement('template');
        template.innerHTML = buildResultFieldMarkup(field, true).trim();
        const fieldNode = template.content.firstElementChild;
        if (!fieldNode) return null;
        fieldNode.style.animation = 'fadeUp .3s ease both';
        resultGrid.appendChild(fieldNode);
        bindResultGrid();
        Autosave.trigger();
        showToast('سطر جدید اضافه شد');
        startResultLabelEdit(fieldNode);
        return fieldNode;
    }

    function normalizePatientDetailRow(row = {}) {
        return {
            key: row.key || makeSectionKey('patient_detail'),
            label: String(row.label ?? PATIENT_DETAIL_ROW_DEFAULT.label).replace(/\s+/g, ' ').trim() || PATIENT_DETAIL_ROW_DEFAULT.label,
            value: String(row.value ?? ''),
            placeholder: String(row.placeholder ?? PATIENT_DETAIL_ROW_DEFAULT.placeholder)
        };
    }

    function buildPatientDetailRowMarkup(row, showDelete = false) {
        const inputId = `patient-detail-${row.key}`;
        return `
            <div class="field-group patient-detail-field" data-patient-detail-key="${escapeHtml(row.key)}" data-patient-detail-placeholder="${escapeHtml(row.placeholder)}">
                <div class="patient-detail-label-row">
                    <label class="result-field-label" for="${escapeHtml(inputId)}"><span class="result-label-text patient-detail-label-text" contenteditable="false" spellcheck="false">${escapeHtml(row.label)}</span></label>
                    ${showDelete ? '<button class="component-delete-btn patient-detail-remove-btn" type="button" title="حذف سطر" aria-label="حذف سطر"><i class="fas fa-times"></i></button>' : ''}
                </div>
                <input class="patient-detail-input" type="text" id="${escapeHtml(inputId)}" placeholder="${escapeHtml(row.placeholder)}" value="${escapeHtml(row.value)}" autocomplete="off">
            </div>`;
    }

    function renderPatientDetailRows(rows = []) {
        const container = getPatientDetailsContainer();
        if (!container) return;
        container.querySelectorAll('.patient-detail-field').forEach(node => node.remove());
        rows.map(normalizePatientDetailRow).forEach(row => {
            const template = document.createElement('template');
            template.innerHTML = buildPatientDetailRowMarkup(row).trim();
            const node = template.content.firstElementChild;
            if (node) container.appendChild(node);
        });
        bindPatientDetails();
    }

    function collectPatientDetailRows() {
        return Array.from(getPatientDetailsContainer()?.querySelectorAll('.patient-detail-field') || []).map(fieldGroup => ({
            key: fieldGroup.dataset.patientDetailKey || makeSectionKey('patient_detail'),
            label: fieldGroup.querySelector('.patient-detail-label-text')?.textContent.replace(/\s+/g, ' ').trim() || PATIENT_DETAIL_ROW_DEFAULT.label,
            value: fieldGroup.querySelector('.patient-detail-input')?.value || '',
            placeholder: fieldGroup.querySelector('.patient-detail-input')?.getAttribute('placeholder') || fieldGroup.dataset.patientDetailPlaceholder || PATIENT_DETAIL_ROW_DEFAULT.placeholder
        }));
    }

    function startPatientDetailLabelEdit(fieldGroup) {
        const labelEl = fieldGroup?.querySelector('.patient-detail-label-text');
        if (!labelEl || labelEl.classList.contains('is-editing')) return;
        const originalLabel = labelEl.textContent.replace(/\s+/g, ' ').trim() || PATIENT_DETAIL_ROW_DEFAULT.label;
        labelEl.contentEditable = 'true';
        labelEl.classList.add('is-editing');
        labelEl.focus();
        placeEditableSelection(labelEl);

        const finish = (revert = false) => {
            labelEl.removeEventListener('blur', onBlur);
            labelEl.removeEventListener('keydown', onKeydown);
            labelEl.contentEditable = 'false';
            labelEl.classList.remove('is-editing');
            labelEl.textContent = revert
                ? originalLabel
                : (labelEl.textContent.replace(/\s+/g, ' ').trim() || originalLabel);
            Autosave.trigger();
        };

        const onBlur = () => finish(false);
        const onKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                labelEl.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finish(true);
                labelEl.blur();
            }
        };

        labelEl.addEventListener('blur', onBlur, { once: true });
        labelEl.addEventListener('keydown', onKeydown);
    }

    function addPatientDetailRow(row = {}) {
        const container = getPatientDetailsContainer();
        if (!container) return null;
        const nextRow = normalizePatientDetailRow(row);
        const template = document.createElement('template');
        template.innerHTML = buildPatientDetailRowMarkup(nextRow, true).trim();
        const node = template.content.firstElementChild;
        if (!node) return null;
        container.appendChild(node);
        bindPatientDetails();
        Autosave.trigger();
        showToast('سطر جدید اضافه شد');
        startPatientDetailLabelEdit(node);
        return node;
    }

    function bindPatientDetails() {
        const container = getPatientDetailsContainer();
        if (!container || container._patientDetailsBound) return;
        container._patientDetailsBound = true;

        container.addEventListener('input', (e) => {
            if (e.target.closest('.patient-detail-input')) {
                Autosave.trigger(e.target);
            }
        });

        container.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.patient-detail-remove-btn');
            if (removeButton && container.contains(removeButton)) {
                e.preventDefault();
                e.stopPropagation();
                removeButton.closest('.patient-detail-field')?.remove();
                Autosave.trigger();
                showToast('سطر حذف شد');
                return;
            }

            const labelText = e.target.closest('.patient-detail-label-text');
            if (!labelText || !container.contains(labelText)) return;
            e.preventDefault();
            e.stopPropagation();
            startPatientDetailLabelEdit(labelText.closest('.patient-detail-field'));
        });
    }

    function bindResultGrid() {
        const resultGrid = getResultGrid();
        if (!resultGrid || resultGrid._resultGridBound) return;
        resultGrid._resultGridBound = true;

        resultGrid.addEventListener('input', (e) => {
            if (e.target.closest('.result-field-input') && !e.target.closest('.result-date-input')) {
                Autosave.trigger(e.target);
            }
        });

        resultGrid.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.result-field-remove-btn');
            if (removeButton && resultGrid.contains(removeButton)) {
                e.preventDefault();
                e.stopPropagation();
                closeResultDatePicker();
                removeButton.closest('.result-field-group')?.remove();
                Autosave.trigger();
                showToast('سطر حذف شد');
                return;
            }

            const labelText = e.target.closest('.result-label-text');
            if (labelText && resultGrid.contains(labelText)) {
                e.preventDefault();
                e.stopPropagation();
                startResultLabelEdit(labelText.closest('.result-field-group'));
                return;
            }

            const dateInput = e.target.closest('.result-date-input');
            if (dateInput && resultGrid.contains(dateInput)) {
                e.preventDefault();
                e.stopPropagation();
                openResultDatePicker(dateInput.closest('.result-field-group'));
                return;
            }

            const pickerTrigger = e.target.closest('.jalali-picker-trigger');
            if (pickerTrigger && resultGrid.contains(pickerTrigger)) {
                e.preventDefault();
                e.stopPropagation();
                const fieldGroup = pickerTrigger.closest('.result-field-group');
                if (activeResultDateField === fieldGroup) closeResultDatePicker();
                else openResultDatePicker(fieldGroup);
                return;
            }

            const navButton = e.target.closest('[data-jalali-nav]');
            if (navButton && resultGrid.contains(navButton)) {
                e.preventDefault();
                e.stopPropagation();
                const fieldGroup = navButton.closest('.result-field-group');
                let year = Number(fieldGroup.dataset.viewYear);
                let month = Number(fieldGroup.dataset.viewMonth);
                month += navButton.dataset.jalaliNav === 'next' ? 1 : -1;
                if (month > 12) {
                    month = 1;
                    year += 1;
                } else if (month < 1) {
                    month = 12;
                    year -= 1;
                }
                fieldGroup.dataset.viewYear = String(year);
                fieldGroup.dataset.viewMonth = String(month);
                renderResultDatePicker(fieldGroup);
                return;
            }

            const dayButton = e.target.closest('[data-jalali-day]');
            if (dayButton && resultGrid.contains(dayButton)) {
                e.preventDefault();
                e.stopPropagation();
                const fieldGroup = dayButton.closest('.result-field-group');
                setResultDateValue(fieldGroup, {
                    jy: Number(fieldGroup.dataset.viewYear),
                    jm: Number(fieldGroup.dataset.viewMonth),
                    jd: Number(dayButton.dataset.jalaliDay)
                });
                return;
            }

            const actionButton = e.target.closest('[data-jalali-action]');
            if (actionButton && resultGrid.contains(actionButton)) {
                e.preventDefault();
                e.stopPropagation();
                const fieldGroup = actionButton.closest('.result-field-group');
                if (actionButton.dataset.jalaliAction === 'today') {
                    const today = getTodayJalali();
                    fieldGroup.dataset.viewYear = String(today.jy);
                    fieldGroup.dataset.viewMonth = String(today.jm);
                    setResultDateValue(fieldGroup, today);
                } else if (actionButton.dataset.jalaliAction === 'clear') {
                    setResultDateValue(fieldGroup, null);
                }
            }
        });

        resultGrid.addEventListener('change', (e) => {
            const monthSelect = e.target.closest('[data-jalali-month]');
            const yearSelect = e.target.closest('[data-jalali-year]');
            if (monthSelect || yearSelect) {
                const fieldGroup = e.target.closest('.result-field-group');
                fieldGroup.dataset.viewMonth = String(Number(fieldGroup.querySelector('[data-jalali-month]')?.value || 1));
                fieldGroup.dataset.viewYear = String(Number(fieldGroup.querySelector('[data-jalali-year]')?.value || getTodayJalali().jy));
                renderResultDatePicker(fieldGroup);
            }
        });
    }

    window.ResultFields = {
        render: renderResultFields,
        collect: collectResultFields,
        addRow: addResultField
    };
    window.PatientDetails = {
        render: renderPatientDetailRows,
        collect: collectPatientDetailRows,
        addRow: addPatientDetailRow
    };

    function getImageCardTitle(card) {
        return card?.querySelector('.image-upload-card-title')?.textContent.trim() || 'تصویر بارگذاری شده';
    }

    function setImageCardTitle(card, value, shouldSave = true) {
        const titleEl = card?.querySelector('.image-upload-card-title');
        if (!titleEl) return '';
        const nextTitle = String(value ?? '').replace(/\s+/g, ' ').trim() || 'تصویر بارگذاری شده';
        titleEl.textContent = nextTitle;
        card.dataset.imageTitle = nextTitle;
        if (shouldSave) Autosave.trigger();
        return nextTitle;
    }

    function getImageCardSection(card) {
        return card?.closest('.card[data-section-key]') || null;
    }

    function getImageSectionLabel(sectionCard) {
        if (!sectionCard) return 'بخش';
        const customTitle = sectionCard.querySelector('.custom-section-title')?.value.trim();
        if (customTitle) return customTitle;
        const clone = sectionCard.querySelector('.card-title')?.cloneNode(true);
        if (!clone) return 'بخش';
        clone.querySelectorAll('button,input').forEach(node => node.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim() || 'بخش';
    }

    function getImageSectionContainers() {
        return Array.from(document.querySelectorAll('.card[data-section-key]'))
            .map(sectionCard => ({
                sectionCard,
                sectionKey: sectionCard.dataset.sectionKey,
                label: getImageSectionLabel(sectionCard),
                container: sectionCard.querySelector('.images-section, .custom-images')
            }))
            .filter(item => item.container);
    }

    function getImageSectionNotesContainer(card) {
        return getImageCardSection(card)?.querySelector('.treatment-notes, .custom-notes') || null;
    }

    function getImageSectionImagesContainer(card) {
        return getImageCardSection(card)?.querySelector('.images-section, .custom-images') || null;
    }

    const sectionImageTitleDefaults = {
        'patient-info': 'تصویر جدید بیمار',
        'doctor-treatment': 'تصویر جدید توضیحات',
        'initial-images': 'تصویر اولیه جدید',
        'during-images': 'تصویر حین درمان جدید',
        'file-image': 'تصویر پرونده جدید',
        'extract-images': 'تصویر برداشت جدید'
    };

    const sectionNotePlaceholders = {
        'doctor-treatment': 'توضیحات دکتر یا نکات درمان را وارد کنید...',
        'during-images': 'توضیحات مربوط به حین درمان را وارد کنید...',
        'extract-images': 'توضیحات مربوط به برداشت را وارد کنید...'
    };

    function getSectionImagesContainer(sectionCard) {
        return sectionCard?.querySelector('.images-section, .custom-images') || null;
    }

    function getSectionNotesContainer(sectionCard) {
        return sectionCard?.querySelector('.treatment-notes, .custom-notes') || null;
    }

    function getSectionImageCards(sectionCard) {
        return Array.from(getSectionImagesContainer(sectionCard)?.querySelectorAll('.image-upload-card') || []);
    }

    function normalizeSectionTitle(sectionCard) {
        const title = sectionCard?.querySelector('.card-title');
        if (!title) return null;
        const customInput = title.querySelector('.custom-section-title');
        if (customInput) return customInput;

        let textEl = title.querySelector('.section-title-text');
        if (textEl) return textEl;

        const textNodes = [];
        let titleText = '';
        title.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                textNodes.push(node);
                titleText += ` ${node.textContent.trim()}`;
            }
        });
        textNodes.forEach(node => node.remove());

        textEl = document.createElement('span');
        textEl.className = 'section-title-text';
        textEl.setAttribute('contenteditable', 'false');
        textEl.textContent = titleText.trim() || 'بخش';

        const tools = title.querySelector('.section-tools, .drag-handle, .delete-section-btn');
        if (tools) title.insertBefore(textEl, tools);
        else title.appendChild(textEl);
        return textEl;
    }

    function getSectionTitleElement(sectionCard) {
        return normalizeSectionTitle(sectionCard);
    }

    function getSectionTitleValue(sectionCard) {
        const titleEl = getSectionTitleElement(sectionCard);
        if (!titleEl) return 'بخش';
        const raw = 'value' in titleEl ? titleEl.value : titleEl.textContent;
        return String(raw || '').replace(/\s+/g, ' ').trim() || 'بخش';
    }

    function setSectionTitleValue(sectionCard, value, shouldSave = true) {
        const titleEl = getSectionTitleElement(sectionCard);
        if (!titleEl) return 'بخش';
        const nextTitle = String(value ?? '').replace(/\s+/g, ' ').trim() || 'بخش';
        if ('value' in titleEl) titleEl.value = nextTitle;
        else titleEl.textContent = nextTitle;
        if (shouldSave) Autosave.trigger();
        return nextTitle;
    }

    function applySavedSectionTitles(sectionTitles = []) {
        sectionTitles.forEach(item => {
            if (!item?.key) return;
            const card = document.querySelector(`.card[data-section-key="${CSS.escape(item.key)}"]`);
            if (card) setSectionTitleValue(card, item.title || 'بخش', false);
        });
    }

    function startSectionTitleEdit(sectionCard) {
        const titleEl = getSectionTitleElement(sectionCard);
        if (!titleEl) return;
        closeSectionMenus(sectionCard);

        if ('value' in titleEl) {
            requestAnimationFrame(() => {
                titleEl.focus({ preventScroll: true });
                titleEl.select?.();
            });
            return;
        }

        const originalTitle = titleEl.textContent.trim() || 'بخش';
        titleEl.dataset.originalTitle = originalTitle;
        titleEl.contentEditable = 'true';
        titleEl.spellcheck = false;
        titleEl.classList.add('is-editing');

        requestAnimationFrame(() => {
            titleEl.focus({ preventScroll: true });
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            selection.removeAllRanges();
            selection.addRange(range);
        });

        const finish = (revert = false) => {
            if (titleEl.dataset.editingDone === 'true') return;
            titleEl.dataset.editingDone = 'true';
            titleEl.contentEditable = 'false';
            titleEl.classList.remove('is-editing');
            const nextTitle = revert
                ? originalTitle
                : (titleEl.textContent.replace(/\s+/g, ' ').trim() || originalTitle);
            titleEl.textContent = nextTitle;
            delete titleEl.dataset.originalTitle;
            delete titleEl.dataset.editingDone;
            Autosave.trigger();
        };

        const onBlur = () => finish(false);
        const onKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finish(true);
                titleEl.blur();
            }
        };

        titleEl.addEventListener('blur', onBlur, { once: true });
        titleEl.addEventListener('keydown', onKeydown, { once: true });
    }

    function addImageToSection(sectionCard) {
        const container = getSectionImagesContainer(sectionCard);
        if (!container?.id) return null;
        const title = sectionImageTitleDefaults[sectionCard.dataset.sectionKey] || `${getSectionTitleValue(sectionCard)} - تصویر`;
        return addImageCard(container.id, title);
    }

    function addDescriptionToSection(sectionCard) {
        const notesContainer = getSectionNotesContainer(sectionCard);
        if (!notesContainer) return null;
        const placeholder = sectionNotePlaceholders[sectionCard.dataset.sectionKey] || 'توضیحات این بخش را وارد کنید...';
        const note = addNoteBox(notesContainer, '', placeholder, true);
        note.querySelector('textarea')?.focus();
        Autosave.trigger();
        showToast('باکس توضیحات اضافه شد');
        return note;
    }

    function moveSectionCard(sectionCard, direction) {
        const container = document.querySelector('.container');
        if (!container || !sectionCard) return;
        const cards = Array.from(container.querySelectorAll(':scope > .card[data-section-key]'));
        const currentIndex = cards.indexOf(sectionCard);
        if (currentIndex < 0) return;

        if (direction === 'up') {
            if (currentIndex === 0) {
                showToast('این بخش در بالاترین موقعیت است');
                return;
            }
            container.insertBefore(sectionCard, cards[currentIndex - 1]);
        } else {
            if (currentIndex === cards.length - 1) {
                showToast('این بخش در پایین‌ترین موقعیت است');
                return;
            }
            const target = cards[currentIndex + 1];
            container.insertBefore(sectionCard, target.nextElementSibling || null);
        }

        Autosave.trigger();
        showToast('بخش جابه‌جا شد');
    }

    function updateLocalImagePreview(rect, previewUrl) {
        if (!rect || !previewUrl) return;
        rect.setAttribute('data-image-url', previewUrl);
        rect.classList.add('has-image');
        rect.style.backgroundImage = `url(${previewUrl})`;
        rect.style.backgroundSize = getImageFitMode();
        rect.style.backgroundRepeat = 'no-repeat';
        rect.style.backgroundPosition = 'center';
        ensureRemoveButton(rect);
        requestAnimationFrame(() => applyUploadPreview(rect, previewUrl));
    }

    function createImageCardMarkup(title, iconClass = 'fa-upload', showDelete = false) {
        return `
            <div class="image-upload-card-header">
                <i class="fas ${iconClass}"></i>
                <span class="image-upload-card-title" contenteditable="false">${escapeHtml(title)}</span>
                ${showDelete ? '<button class="component-delete-btn image-card-delete-btn" type="button" title="حذف کادر تصویر" aria-label="حذف کادر تصویر"><i class="fas fa-trash-alt"></i></button>' : ''}
            </div>
            <label class="upload-rect" tabindex="0" role="button" aria-label="${escapeHtml(title)}">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>آپلود تصویر</span>
                <input type="file" accept="image/*">
            </label>`;
    }

    async function removeImageCard(card) {
        if (!card?.isConnected) return false;
        const confirmed = await showModal('آیا این کادر تصویر حذف شود؟');
        if (!confirmed) return false;
        const rect = card.querySelector('.upload-rect');
        const dbUrl = rect?.getAttribute('data-db-url');
        if (dbUrl) {
            try {
                await DB.deleteImage(dbUrl);
            } catch (error) {
                console.error('Error deleting image asset:', error);
            }
        }
        card.remove();
        Autosave.triggerSoon();
        showToast('کادر تصویر حذف شد');
        return true;
    }

    function closeImageCardMenus(exceptCard = null) {
        document.querySelectorAll('.image-upload-card.menu-open,.image-upload-card.edit-tools-open,.image-upload-card.move-open').forEach(card => {
            if (card === exceptCard) return;
            card.classList.remove('menu-open', 'edit-tools-open', 'move-open');
        });
    }

    function startImageTitleEdit(card) {
        const titleEl = card?.querySelector('.image-upload-card-title');
        if (!titleEl) return;
        closeImageCardMenus(card);
        const originalTitle = titleEl.textContent.trim() || 'تصویر بارگذاری شده';
        titleEl.dataset.originalTitle = originalTitle;
        titleEl.contentEditable = 'true';
        titleEl.spellcheck = false;
        titleEl.classList.add('is-editing');
        requestAnimationFrame(() => {
            titleEl.focus({ preventScroll: true });
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            selection.removeAllRanges();
            selection.addRange(range);
        });

        const finish = (revert = false) => {
            titleEl.removeEventListener('blur', onBlur);
            titleEl.removeEventListener('keydown', onKeydown);
            titleEl.contentEditable = 'false';
            titleEl.classList.remove('is-editing');
            const nextTitle = revert
                ? originalTitle
                : (titleEl.textContent.replace(/\s+/g, ' ').trim() || originalTitle);
            titleEl.textContent = nextTitle;
            card.dataset.imageTitle = nextTitle;
            Autosave.trigger();
        };

        const onBlur = () => finish(false);
        const onKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(true);
            }
        };

        titleEl.addEventListener('blur', onBlur, { once: true });
        titleEl.addEventListener('keydown', onKeydown);
    }

    function loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), type, quality);
        });
    }

    async function uploadEditedImageToCard(card, canvas, suffix = 'edited') {
        const rect = card?.querySelector('.upload-rect');
        if (!rect || !window.DB) return false;
        const fileNumber = getRequiredFileNumber();
        if (!fileNumber) return false;
        const blob = await canvasToBlob(canvas);
        if (!blob) {
            showToast('ویرایش تصویر قابل ذخیره نبود');
            return false;
        }
        const oldUrl = rect.getAttribute('data-db-url');
        const oldPreviewUrl = rect.getAttribute('data-image-url') || oldUrl || '';
        const oldBackground = rect.style.backgroundImage;
        const localPreviewUrl = URL.createObjectURL(blob);
        rect.setAttribute('data-uploading', 'true');
        showImageSkeleton(rect, 'در حال پردازش و ذخیره ویرایش');
        updateLocalImagePreview(rect, localPreviewUrl);
        syncSectionImageEditor();
        const file = new File([blob], `${suffix}.jpg`, { type: blob.type || 'image/jpeg' });
        DB.uploadImage(file, DB.buildImagePath(fileNumber, 'image', file))
            .then((nextUrl) => {
                if (!nextUrl) throw new Error('upload_failed');
                rect.removeAttribute('data-uploading');
                applyStoredUploadImage(rect, nextUrl);
                const title = card.querySelector('.image-upload-card-title')?.textContent.trim();
                if (title) card.dataset.imageTitle = title;
                if (oldUrl && oldUrl !== nextUrl) void DB.deleteImage(oldUrl);
                Autosave.triggerSoon(rect);
                syncSectionImageEditor();
                showToast('ویرایش تصویر ذخیره شد');
            })
            .catch(() => {
                rect.removeAttribute('data-uploading');
                if (oldUrl) {
                    applyStoredUploadImage(rect, oldUrl);
                } else if (oldPreviewUrl) {
                    updateLocalImagePreview(rect, oldPreviewUrl);
                } else {
                    rect.style.backgroundImage = oldBackground;
                    resetEmptyUploadRect(rect);
                }
                syncSectionImageEditor();
                showToast('خطا در ذخیره ویرایش تصویر');
            })
            .finally(() => {
                URL.revokeObjectURL(localPreviewUrl);
            });
        return true;
    }

    async function applyImageTransform(card, mode) {
        const rect = card?.querySelector('.upload-rect');
        const src = rect?.getAttribute('data-db-url') || rect?.getAttribute('data-image-url') || rect?.style.backgroundImage?.replace(/url\(["']?|["']?\)/gi, '');
        if (!rect || !src) {
            showToast('ابتدا یک تصویر بارگذاری کنید');
            return;
        }
        try {
            const img = await loadImageFromUrl(src);
            const sourceCanvas = document.createElement('canvas');
            const sourceCtx = sourceCanvas.getContext('2d');
            if (!sourceCtx) {
                showToast('ویرایشگر تصویر در دسترس نیست');
                return;
            }

            let canvas = sourceCanvas;
            let ctx = sourceCtx;
            if (mode === 'rotate-left' || mode === 'rotate-right') {
                canvas.width = img.naturalHeight;
                canvas.height = img.naturalWidth;
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((mode === 'rotate-left' ? -90 : 90) * Math.PI / 180);
                ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
            } else if (mode === 'crop-square') {
                const size = Math.min(img.naturalWidth, img.naturalHeight);
                const sx = Math.max(0, Math.floor((img.naturalWidth - size) / 2));
                const sy = Math.max(0, Math.floor((img.naturalHeight - size) / 2));
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
            } else if (mode === 'smart-enhance') {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.filter = 'contrast(1.1) saturate(1.08) brightness(1.04)';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none';
                ctx.globalAlpha = 0.12;
                ctx.globalCompositeOperation = 'overlay';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
            } else {
                return;
            }

            await uploadEditedImageToCard(card, canvas, mode);
        } catch (error) {
            console.error('Error editing image:', error);
            showToast('خطا در پردازش تصویر');
        }
    }

    function populateMoveTargets(card) {
        const submenu = card?.querySelector('.image-card-move-submenu');
        if (!submenu) return;
        const currentSection = getImageCardSection(card);
        const targets = getImageSectionContainers().filter(item => item.sectionCard !== currentSection);
        submenu.innerHTML = targets.length
            ? targets.map(target => `
                <button class="image-card-menu-item" type="button" data-move-target="${escapeHtml(target.sectionKey)}">
                    <i class="fas fa-location-arrow"></i>
                    <span class="menu-label">${escapeHtml(target.label)}</span>
                </button>
            `).join('')
            : `<button class="image-card-menu-item" type="button" disabled><i class="fas fa-ban"></i><span class="menu-label">بخش دیگری یافت نشد</span></button>`;
    }

    function moveImageCard(card, targetSectionKey) {
        const target = getImageSectionContainers().find(item => item.sectionKey === targetSectionKey);
        if (!target) return;
        target.container.appendChild(card);
        closeImageCardMenus();
        Autosave.triggerSoon();
        showToast('تصویر منتقل شد');
    }

    let imageEditorModal = null;
    let imageEditorSelect = null;
    let imageEditorPreview = null;
    let imageEditorPreviewLabel = null;
    let imageEditorSubtitle = null;
    let activeImageEditorSection = null;

    function getImageCardPreviewUrl(card) {
        return card?.querySelector('.upload-rect')?.getAttribute('data-image-url') || '';
    }

    function getActiveImageEditorCard() {
        if (!activeImageEditorSection || !imageEditorSelect) return null;
        const cards = getSectionImageCards(activeImageEditorSection);
        if (!cards.length) return null;
        const index = Number(imageEditorSelect.value || 0);
        return cards[index] || cards[0] || null;
    }

    function syncSectionImageEditor() {
        if (!imageEditorSelect || !imageEditorPreview || !imageEditorPreviewLabel) return;

        const cards = getSectionImageCards(activeImageEditorSection);
        const previousValue = imageEditorSelect.value;
        imageEditorSelect.innerHTML = cards.length
            ? cards.map((card, index) => `<option value="${index}">${escapeHtml(getImageCardTitle(card) || `تصویر ${index + 1}`)}</option>`).join('')
            : '<option value="">بدون تصویر</option>';

        if (cards.length) {
            imageEditorSelect.value = previousValue && Number(previousValue) < cards.length ? previousValue : '0';
        }

        const activeCard = getActiveImageEditorCard();
        const previewUrl = getImageCardPreviewUrl(activeCard);
        imageEditorPreview.style.backgroundImage = previewUrl ? `url(${previewUrl})` : '';
        imageEditorPreview.classList.toggle('has-image', Boolean(previewUrl));
        imageEditorPreviewLabel.textContent = previewUrl
            ? getImageCardTitle(activeCard)
            : 'برای ویرایش، ابتدا یک تصویر در این بخش آپلود کنید';

        document.querySelectorAll('[data-editor-action]').forEach(button => {
            const isReplace = button.getAttribute('data-editor-action') === 'replace-image';
            button.disabled = !activeCard || (!previewUrl && !isReplace);
        });
    }

    function closeSectionImageEditor() {
        if (!imageEditorModal) return;
        imageEditorModal.classList.remove('show');
        activeImageEditorSection = null;
    }

    function openSectionImageEditor(sectionCard) {
        if (!imageEditorModal || !imageEditorSubtitle) return;
        activeImageEditorSection = sectionCard;
        imageEditorSubtitle.textContent = getSectionTitleValue(sectionCard);
        imageEditorModal.classList.add('show');
        syncSectionImageEditor();
    }

    function refreshSectionImageEditorAfterUpload(card) {
        const rect = card?.querySelector('.upload-rect');
        if (!rect) return;
        const initialUrl = rect.getAttribute('data-image-url') || '';
        let attempts = 0;
        const timer = setInterval(() => {
            attempts += 1;
            syncSectionImageEditor();
            const currentUrl = rect.getAttribute('data-image-url') || '';
            const isUploading = rect.getAttribute('data-uploading') === 'true';
            if ((!isUploading && currentUrl && currentUrl !== initialUrl) || (!isUploading && attempts > 4) || attempts > 20) {
                clearInterval(timer);
            }
        }, 400);
    }

    function ensureImageCardMenu(card) {
        if (!card || card._imageMenuBound) return card;
        card._imageMenuBound = true;
        const header = card.querySelector('.image-upload-card-header');
        const menuHost = document.createElement('div');
        menuHost.innerHTML = createImageCardMarkup(
            header?.textContent?.trim() || 'تصویر بارگذاری شده',
            header?.querySelector('i')?.className?.replace('fas ', '') || 'fa-image'
        );
        const built = menuHost.firstElementChild;
        const existingRect = card.querySelector('.upload-rect');
        const existingHeader = card.querySelector('.image-upload-card-header');
        if (!built || !existingRect || !existingHeader) return card;

        if (existingHeader.parentNode === card) existingHeader.remove();
        const rectClone = existingRect.cloneNode(true);
        existingRect.remove();

        const toolsNode = built.querySelector('.image-card-tools');
        const headerNode = built.matches('.image-upload-card-header')
            ? built
            : built.querySelector('.image-upload-card-header');
        if (toolsNode) card.prepend(toolsNode);
        if (headerNode) card.appendChild(headerNode);
        card.appendChild(rectClone);

        card.classList.add('menu-ready');
        bindImageCardMenu(card);
        return card;
    }

    function bindImageCardMenu(card) {
        if (!card || card._imageMenuEventsBound) return;
        card._imageMenuBound = true;
        card._imageMenuEventsBound = true;
        const menuButton = card.querySelector('.image-card-menu-btn');
        const menu = card.querySelector('.image-card-menu');
        const deleteButton = card.querySelector('.image-card-delete-btn');

        deleteButton?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await removeImageCard(card);
        });

        if (!menuButton || !menu) return;

        menuButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const shouldOpen = !card.classList.contains('menu-open');
            closeImageCardMenus(card);
            card.classList.toggle('menu-open', shouldOpen);
            if (!shouldOpen) card.classList.remove('edit-tools-open', 'move-open');
        });

        menu.addEventListener('click', async (e) => {
            const actionBtn = e.target.closest('[data-image-action]');
            const moveBtn = e.target.closest('[data-move-target]');
            if (!actionBtn && !moveBtn) return;
            e.preventDefault();
            e.stopPropagation();

            if (moveBtn) {
                moveImageCard(card, moveBtn.getAttribute('data-move-target'));
                return;
            }

            const action = actionBtn.getAttribute('data-image-action');
            const keepOpen = action === 'toggle-edit-image' || action === 'toggle-move';
            switch (action) {
                case 'edit-title':
                    closeImageCardMenus(card);
                    startImageTitleEdit(card);
                    break;
                case 'toggle-edit-image':
                    card.classList.toggle('edit-tools-open');
                    card.classList.remove('move-open');
                    break;
                case 'replace-image':
                    card.querySelector('.upload-rect input[type="file"]')?.click();
                    break;
                case 'rotate-left':
                case 'rotate-right':
                case 'crop-square':
                    await applyImageTransform(card, action);
                    break;
                case 'ai-edit':
                    showToast('ویرایش هوشمند AI هنوز به سرویس متصل نشده است');
                    break;
                case 'add-image': {
                    const section = getImageCardSection(card);
                    const container = getImageSectionImagesContainer(card);
                    if (!section || !container) break;
                    addImageCard(container.id, 'تصویر جدید');
                    break;
                }
                case 'add-description': {
                    const notesContainer = getImageSectionNotesContainer(card);
                    if (!notesContainer) break;
                    const note = addNoteBox(notesContainer, '', 'توضیحات این تصویر را وارد کنید...', true);
                    note.querySelector('textarea')?.focus();
                    Autosave.trigger();
                    break;
                }
                case 'toggle-move':
                    card.classList.toggle('move-open');
                    card.classList.remove('edit-tools-open');
                    if (card.classList.contains('move-open')) populateMoveTargets(card);
                    break;
                case 'remove': {
                    await removeImageCard(card);
                    break;
                }
                default:
                    break;
            }
            if (!keepOpen) closeImageCardMenus();
        });
    }

    function closeSectionMenus(exceptCard = null) {
        document.querySelectorAll('.section-tools.open').forEach(menuHost => {
            if (exceptCard && menuHost.closest('.card[data-section-key]') === exceptCard) return;
            menuHost.classList.remove('open');
            const card = menuHost.closest('.card');
            if (card) card.classList.remove('has-open-menu');
        });
    }

    async function removeSectionCard(sectionCard) {
        if (!sectionCard?.isConnected) return false;
        const confirmed = await showModal('آیا این کادر حذف شود؟');
        if (!confirmed) return false;
        const imageUrls = Array.from(sectionCard.querySelectorAll('.upload-rect[data-db-url]'))
            .map(rect => rect.getAttribute('data-db-url'))
            .filter(Boolean);
        await Promise.allSettled(imageUrls.map(url => DB.deleteImage(url)));
        sectionCard.remove();
        Autosave.trigger();
        showToast('کادر حذف شد');
        return true;
    }

    function createSectionMenuMarkup(sectionCard) {
        const isCustom = sectionCard?.dataset.customSection === 'true';
        const isResult = sectionCard?.dataset.sectionKey === 'result';
        const isPatientInfo = sectionCard?.dataset.sectionKey === 'patient-info';
        const hasNotesContainer = Boolean(getSectionNotesContainer(sectionCard));
        return `
            <div class="section-tools">
                <button class="section-tools-btn" type="button" aria-label="گزینه‌های بخش"><i class="fas fa-ellipsis-v"></i></button>
                <div class="section-tools-menu" aria-label="منوی بخش">
                    <button class="section-tool-item" type="button" data-section-action="edit-title"><i class="fas fa-pen"></i><span>ویرایش عنوان</span></button>
                    ${isPatientInfo ? '<button class="section-tool-item" type="button" data-section-action="add-patient-row"><i class="fas fa-plus"></i><span>اضافه کردن سطر</span></button>' : ''}
                    ${isResult ? '<button class="section-tool-item" type="button" data-section-action="add-result-row"><i class="fas fa-plus"></i><span>افزودن سطر جدید</span></button>' : ''}
                    <button class="section-tool-item" type="button" data-section-action="edit-image"><i class="fas fa-wand-magic-sparkles"></i><span>ویرایش تصویر</span></button>
                    <button class="section-tool-item" type="button" data-section-action="add-image"><i class="fas fa-plus"></i><span>افزودن تصویر جدید</span></button>
                    ${hasNotesContainer ? '<button class="section-tool-item" type="button" data-section-action="add-description"><i class="fas fa-align-left"></i><span>افزودن توضیحات</span></button>' : ''}
                    <button class="section-tool-item" type="button" data-section-action="move-up"><i class="fas fa-arrow-up"></i><span>انتقال به بالا</span></button>
                    <button class="section-tool-item" type="button" data-section-action="move-down"><i class="fas fa-arrow-down"></i><span>انتقال به پایین</span></button>
                    ${isCustom ? '<button class="section-tool-item danger" type="button" data-section-action="delete-section"><i class="fas fa-trash"></i><span>حذف کادر</span></button>' : ''}
                </div>
            </div>`;
    }

    function refreshSectionMenuState(sectionCard) {
        const hasImagesContainer = Boolean(getSectionImagesContainer(sectionCard));
        const hasNotesContainer = Boolean(getSectionNotesContainer(sectionCard));
        const menuHost = sectionCard?.querySelector('.section-tools');
        if (!menuHost) return;
        const container = document.querySelector('.container');
        const cards = Array.from(container?.querySelectorAll(':scope > .card[data-section-key]') || []);
        const index = cards.indexOf(sectionCard);

        menuHost.querySelector('[data-section-action="edit-image"]')?.toggleAttribute('disabled', !hasImagesContainer);
        menuHost.querySelector('[data-section-action="add-image"]')?.toggleAttribute('disabled', !hasImagesContainer);
        menuHost.querySelector('[data-section-action="add-description"]')?.toggleAttribute('disabled', !hasNotesContainer);
        menuHost.querySelector('[data-section-action="move-up"]')?.toggleAttribute('disabled', index <= 0);
        menuHost.querySelector('[data-section-action="move-down"]')?.toggleAttribute('disabled', index < 0 || index >= cards.length - 1);
    }

    function bindSectionMenu(sectionCard) {
        if (!sectionCard || sectionCard._sectionMenuBound) return;
        sectionCard._sectionMenuBound = true;

        const menuHost = sectionCard.querySelector('.section-tools');
        const menuButton = menuHost?.querySelector('.section-tools-btn');
        const menu = menuHost?.querySelector('.section-tools-menu');
        if (!menuHost || !menuButton || !menu) return;

        menuButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const shouldOpen = !menuHost.classList.contains('open');
            closeSectionMenus(sectionCard);
            refreshSectionMenuState(sectionCard);
            menuHost.classList.toggle('open', shouldOpen);
            
            const card = menuHost.closest('.card');
            if (card) {
                card.classList.toggle('has-open-menu', shouldOpen);
            }
        });

        menu.addEventListener('click', async (e) => {
            const actionBtn = e.target.closest('[data-section-action]');
            if (!actionBtn || actionBtn.disabled) return;
            e.preventDefault();
            e.stopPropagation();

            const action = actionBtn.getAttribute('data-section-action');
            switch (action) {
                case 'edit-title':
                    startSectionTitleEdit(sectionCard);
                    break;
                case 'add-result-row':
                    addResultField();
                    break;
                case 'add-patient-row':
                    addPatientDetailRow();
                    break;
                case 'edit-image':
                    openSectionImageEditor(sectionCard);
                    break;
                case 'add-image':
                    addImageToSection(sectionCard);
                    break;
                case 'add-description':
                    addDescriptionToSection(sectionCard);
                    break;
                case 'move-up':
                    moveSectionCard(sectionCard, 'up');
                    break;
                case 'move-down':
                    moveSectionCard(sectionCard, 'down');
                    break;
                case 'delete-section': {
                    await removeSectionCard(sectionCard);
                    break;
                }
                default:
                    break;
            }

            menuHost.classList.remove('open');
            const card = menuHost.closest('.card');
            if (card) card.classList.remove('has-open-menu');
        });
    }

    function upgradeImageCards(root = document) {
        root.querySelectorAll('.image-upload-card').forEach(card => {
            if (card._imageMenuBound) return;
            const header = card.querySelector('.image-upload-card-header');
            const rect = card.querySelector('.upload-rect');
            if (!header || !rect) return;
            const title = header.querySelector('.image-upload-card-title')?.textContent.trim() || header.textContent.trim() || 'تصویر بارگذاری شده';
            const iconClass = header.querySelector('i')?.className?.replace(/\s*$/, '') || 'fas fa-image';
            const tools = document.createElement('div');
            tools.innerHTML = createImageCardMarkup(title, iconClass.includes('fa-') ? iconClass.split(/\s+/).find(cls => cls.startsWith('fa-')) || 'fa-image' : 'fa-image');
            const built = tools.firstElementChild;
            if (!built) return;
            const toolsNode = built.querySelector('.image-card-tools');
            const headerNode = built.matches('.image-upload-card-header')
                ? built
                : built.querySelector('.image-upload-card-header');
            if (toolsNode) card.prepend(toolsNode);
            if (headerNode) {
                headerNode.querySelector('.image-upload-card-title')?.setAttribute('contenteditable', 'false');
                card.replaceChild(headerNode, header);
            }
            card._imageMenuBound = true;
            card.classList.add('menu-ready');
            bindImageCardMenu(card);
        });
    }

    document.addEventListener('click', (e) => {
        if (activeResultDateField && !e.target.closest('.result-field-group[data-result-type="jalali-date"]')) {
            closeResultDatePicker();
        }
        if (!e.target.closest('.image-upload-card')) {
            closeImageCardMenus();
        }
        if (!e.target.closest('.section-tools')) {
            closeSectionMenus();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeResultDatePicker();
            closeImageCardMenus();
            closeSectionMenus();
            closeSectionImageEditor();
        }
    });

    function addNoteBox(container, value = '', placeholder = 'توضیحات را وارد کنید...', showDelete = false) {
        const note = document.createElement('div');
        note.className = 'treatment-note-box';
        note.style.animation = 'fadeUp .3s ease both';
        note.innerHTML = `${showDelete ? '<button class="component-delete-btn remove-note-btn" type="button" title="حذف توضیحات" aria-label="حذف توضیحات"><i class="fas fa-times"></i></button>' : ''}<textarea class="treatment-note-text" placeholder="${placeholder}"></textarea>`;
        note.querySelector('textarea').value = value || '';
        container.appendChild(note);
        return note;
    }

    function bindNoteContainer(container) {
        if (!container || container._noteBound) return;
        container._noteBound = true;
        container.addEventListener('input', () => Autosave.trigger());
        container.addEventListener('click', (e) => {
            if (e.target.closest('.remove-note-btn')) {
                e.target.closest('.treatment-note-box').remove();
                Autosave.trigger();
                showToast('توضیحات حذف شد');
            }
        });
    }

    // --- منطق آپلود عکس‌ها (اصلاح شده با نشانه‌گذاری وضعیت) ---
    async function handleImageUpload(fileInput, targetRect) {
        const file = fileInput.files[0];
        if (!file) return;
        const fileNumber = getRequiredFileNumber();
        if (!fileNumber) {
            fileInput.value = '';
            return;
        }

        const oldUrl = targetRect.getAttribute('data-db-url');
        const oldBackground = targetRect.style.backgroundImage;
        const oldHeight = targetRect.style.height;
        const oldMinHeight = targetRect.style.minHeight;

        // ۱. پیش‌نمایش فوری
        const reader = new FileReader();
        reader.onload = (e) => applyUploadPreview(targetRect, e.target.result);
        reader.readAsDataURL(file);

        // ۲. نشانه‌گذاری به عنوان "در حال آپلود" تا Autosave آن را نگیرد
        targetRect.setAttribute('data-uploading', 'true');
        showImageSkeleton(targetRect, 'در حال پردازش و بارگذاری');

        // ۳. فشرده‌سازی تصویر در پس‌زمینه
        let uploadFile = file;
        try {
            uploadFile = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        } catch (compressError) {
            console.error("خطا در فشرده‌سازی:", compressError);
        }

        const filePath = DB.buildImagePath(fileNumber, 'image', uploadFile);

        try {
            // ۴. آپلود به سرور
            const dbUrl = await DB.uploadImage(uploadFile, filePath);
            
            if (dbUrl) {
                // ۵. برداشتن نشانه "در حال آپلود" و گذاشتن لینک واقعی
                targetRect.removeAttribute('data-uploading');
                applyStoredUploadImage(targetRect, dbUrl);
                if (oldUrl && oldUrl !== dbUrl) DB.deleteImage(oldUrl);
                
                // ۶. VERY IMPORTANT: اجبار به ذخیره مجدد چون حالا لینک آماده است
                Autosave.triggerSoon(targetRect); 
            } else {
                targetRect.removeAttribute('data-uploading');
                if (oldUrl) targetRect.setAttribute('data-db-url', oldUrl);
                if (oldUrl) {
                    targetRect.style.backgroundImage = oldBackground;
                    targetRect.style.height = oldHeight;
                    targetRect.style.minHeight = oldMinHeight;
                } else {
                    resetEmptyUploadRect(targetRect);
                }
                hideImageSkeleton(targetRect, true);
                showToast('خطا در آپلود عکس به سرور');
            }
        } catch (error) {
            targetRect.removeAttribute('data-uploading');
            if (oldUrl) targetRect.setAttribute('data-db-url', oldUrl);
            if (oldUrl) {
                targetRect.style.backgroundImage = oldBackground;
                targetRect.style.height = oldHeight;
                targetRect.style.minHeight = oldMinHeight;
            } else {
                resetEmptyUploadRect(targetRect);
            }
            hideImageSkeleton(targetRect, true);
            showToast('خطا در ارتباط با سرور');
        }
        
        fileInput.value = '';
    }

    function bindAllRectUploads() {
        document.querySelectorAll('.upload-rect').forEach(rect => {
            const inp = rect.querySelector('input[type="file"]');
            if (inp && !inp._bound) {
                inp._bound = true;
                inp.addEventListener('change', () => handleImageUpload(inp, rect));
            }
            if (inp && rect.tagName !== 'LABEL' && !rect._clickBound) {
                rect._clickBound = true;
                rect.addEventListener('click', (e) => {
                    if (e.target.closest('.remove-img-btn')) return;
                    rect.querySelector('input[type="file"]')?.click();
                });
                rect.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        rect.querySelector('input[type="file"]')?.click();
                    }
                });
            }
        });
        upgradeImageCards();
    }

    // --- مدیریت کاور ---
    const coverZone = document.getElementById('coverZone');
    const coverInput = document.getElementById('coverInput');
    
    coverZone.addEventListener('click', (e) => {
        if (e.target.closest('.cover-remove-btn')) return;
        coverInput.click();
    });
    
    coverInput.addEventListener('change', async () => {
        const file = coverInput.files[0];
        if (!file) return;
        const fileNumber = getRequiredFileNumber();
        if (!fileNumber) {
            coverInput.value = '';
            return;
        }
        const oldUrl = coverZone.getAttribute('data-db-url');
        const oldBackground = coverZone.style.backgroundImage;
        const oldHeight = coverZone.style.height;
        
        coverZone.setAttribute('data-uploading', 'true');
        showImageSkeleton(coverZone, 'در حال پردازش و بارگذاری کاور');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const h = Math.max(140, Math.min(coverZone.offsetWidth * (img.naturalHeight / img.naturalWidth), 500));
                coverZone.style.height = h + 'px';
                coverZone.style.backgroundImage = `url(${e.target.result})`;
                coverZone.style.backgroundSize = 'cover';
                coverZone.style.backgroundPosition = 'center';
                coverZone.classList.add('has-cover');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // فشرده‌سازی تصویر در پس‌زمینه
        let uploadFile = file;
        try {
            uploadFile = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        } catch (err) {
            console.error(err);
        }

        DB.uploadImage(uploadFile, DB.buildImagePath(fileNumber, 'cover', uploadFile)).then(url => {
            if (url) {
                coverZone.removeAttribute('data-uploading');
                applyCoverImage(url);
                if (oldUrl && oldUrl !== url) DB.deleteImage(oldUrl);
                Autosave.triggerSoon(coverZone);
            } else {
                coverZone.removeAttribute('data-uploading');
                if (oldUrl) coverZone.setAttribute('data-db-url', oldUrl);
                coverZone.style.backgroundImage = oldBackground;
                coverZone.style.height = oldHeight;
                if (!oldUrl) coverZone.classList.remove('has-cover');
                hideImageSkeleton(coverZone, true);
                showToast('خطا در آپلود عکس کاور');
            }
        }).catch(() => {
            coverZone.removeAttribute('data-uploading');
            if (oldUrl) coverZone.setAttribute('data-db-url', oldUrl);
            coverZone.style.backgroundImage = oldBackground;
            coverZone.style.height = oldHeight;
            if (!oldUrl) coverZone.classList.remove('has-cover');
            hideImageSkeleton(coverZone, true);
            showToast('خطا در ارتباط با سرور');
        });
        coverInput.value = '';
    });

    document.getElementById('coverRemoveBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const oldUrl = coverZone.getAttribute('data-db-url');
        if(oldUrl) DB.deleteImage(oldUrl);
        coverZone.removeAttribute('data-db-url');
        coverZone.removeAttribute('data-image-url');
        coverZone.removeAttribute('data-uploading');
        coverZone.removeAttribute('data-width');
        coverZone.removeAttribute('data-height');
        coverZone.style.height = '';
        coverZone.style.backgroundImage = '';
        coverZone.classList.remove('has-cover');
        Autosave.trigger();
        showToast('تصویر کاور حذف شد');
    });

    // --- مدیریت پروفایل ---
    const profileZone = document.getElementById('profilePicZone');
    const profileInput = document.getElementById('profilePicInput');
    
    profileZone.addEventListener('click', () => profileInput.click());
    profileInput.addEventListener('change', async () => {
        const file = profileInput.files[0]; if (!file) return;
        const fileNumber = getRequiredFileNumber();
        if (!fileNumber) {
            profileInput.value = '';
            return;
        }
        const oldUrl = profileZone.getAttribute('data-db-url');
        const inner = profileZone.querySelector('.profile-pic-inner');
        const oldBackground = inner.style.backgroundImage;
        const oldBackgroundSize = inner.style.backgroundSize;
        const oldHtml = inner.innerHTML;
        
        profileZone.setAttribute('data-uploading', 'true');
        showImageSkeleton(profileZone, 'در حال پردازش تصویر');

        const reader = new FileReader();
        reader.onload = (e) => {
            inner.style.backgroundImage = `url(${e.target.result})`;
            inner.style.backgroundSize = 'cover';
            inner.innerHTML = '';
            profileZone.classList.add('has-image');
        };
        reader.readAsDataURL(file);

        // فشرده‌سازی تصویر در پس‌زمینه
        let uploadFile = file;
        try {
            uploadFile = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
        } catch (err) {
            console.error(err);
        }

        DB.uploadImage(uploadFile, DB.buildImagePath(fileNumber, 'profile', uploadFile)).then(url => {
            if (url) {
                profileZone.removeAttribute('data-uploading');
                applyProfileImage(url);
                if (oldUrl && oldUrl !== url) DB.deleteImage(oldUrl);
                Autosave.triggerSoon(profileZone);
            } else {
                profileZone.removeAttribute('data-uploading');
                if (oldUrl) profileZone.setAttribute('data-db-url', oldUrl);
                inner.style.backgroundImage = oldBackground;
                inner.style.backgroundSize = oldBackgroundSize;
                inner.innerHTML = oldHtml;
                if (!oldUrl) profileZone.classList.remove('has-image');
                hideImageSkeleton(profileZone, true);
                showToast('خطا در آپلود عکس پروفایل');
            }
        }).catch(() => {
            profileZone.removeAttribute('data-uploading');
            if (oldUrl) profileZone.setAttribute('data-db-url', oldUrl);
            inner.style.backgroundImage = oldBackground;
            inner.style.backgroundSize = oldBackgroundSize;
            inner.innerHTML = oldHtml;
            if (!oldUrl) profileZone.classList.remove('has-image');
            hideImageSkeleton(profileZone, true);
            showToast('خطا در ارتباط با سرور');
        });
        profileInput.value = '';
    });

    // --- رویدادهای تایپ متنی ---
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const patientNameInput = document.getElementById('patientName');

    function composePatientName(firstName = firstNameInput?.value, lastName = lastNameInput?.value) {
        return [firstName, lastName]
            .map(part => String(part || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' ');
    }

    function splitPatientName(fullName = '') {
        const parts = String(fullName || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        return {
            firstName: parts.shift() || '',
            lastName: parts.join(' ')
        };
    }

    function syncPatientName() {
        const fullName = composePatientName();
        if (patientNameInput) patientNameInput.value = fullName;
        document.getElementById('nameDisplay').textContent = fullName || 'نام و نام خانوادگی بیمار';
        return fullName;
    }

    [firstNameInput, lastNameInput].forEach(input => {
        input?.addEventListener('input', () => {
            syncPatientName();
            Autosave.trigger(patientNameInput);
        });
    });

    document.getElementById('fileNumber')?.addEventListener('input', (event) => {
        const normalized = normalizeFileNumber(event.currentTarget.value);
        if (normalized !== event.currentTarget.value) event.currentTarget.value = normalized;
        document.getElementById('fileDisplay').textContent = normalized || '---';
        Autosave.trigger(event.currentTarget);
    });

    const treatmentSummaryCard = document.getElementById('treatmentSummaryCard');
    const treatmentSummaryDisplay = document.getElementById('treatmentSummaryDisplay');
    const treatmentSummaryInput = document.getElementById('treatmentSummary');
    let treatmentSummarySaveTimer = null;
    let treatmentSummaryBlurTimer = null;

    function syncTreatmentSummaryDisplay(value = treatmentSummaryInput?.value || '') {
        if (!treatmentSummaryCard || !treatmentSummaryDisplay) return;
        const text = String(value ?? '').trim();
        treatmentSummaryDisplay.textContent = text;
        treatmentSummaryCard.classList.toggle('has-summary', !!text);
    }

    function resizeTreatmentSummaryInput() {
        if (!treatmentSummaryInput || !treatmentSummaryCard?.classList.contains('is-expanded')) return;
        treatmentSummaryInput.style.height = 'auto';
        treatmentSummaryInput.style.height = `${Math.max(treatmentSummaryInput.scrollHeight, 72)}px`;
    }

    function setTreatmentSummaryExpanded(expanded) {
        if (!treatmentSummaryCard || !treatmentSummaryInput) return;
        treatmentSummaryCard.classList.toggle('is-expanded', !!expanded);
        treatmentSummaryCard.classList.toggle('is-collapsed', !expanded);
        treatmentSummaryCard.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        treatmentSummaryInput.tabIndex = expanded ? 0 : -1;
        treatmentSummaryInput.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        if (expanded) {
            requestAnimationFrame(resizeTreatmentSummaryInput);
        } else {
            treatmentSummaryInput.style.height = '0px';
        }
    }

    function scheduleTreatmentSummarySave(immediate = false) {
        if (!treatmentSummaryInput || !window.Autosave) return;
        clearTimeout(treatmentSummarySaveTimer);
        const commit = () => Autosave.trigger(treatmentSummaryInput);
        if (immediate) {
            commit();
            return;
        }
        treatmentSummarySaveTimer = setTimeout(commit, 450);
    }

    function openTreatmentSummary() {
        setTreatmentSummaryExpanded(true);
        requestAnimationFrame(() => treatmentSummaryInput?.focus({ preventScroll: true }));
    }

    if (treatmentSummaryCard && treatmentSummaryInput && !treatmentSummaryInput._autosaveBound) {
        treatmentSummaryInput._autosaveBound = true;
        syncTreatmentSummaryDisplay();
        setTreatmentSummaryExpanded(false);

        treatmentSummaryCard.addEventListener('click', (e) => {
            if (e.target.closest('input')) return;
            openTreatmentSummary();
        });

        treatmentSummaryInput.addEventListener('focus', () => {
            clearTimeout(treatmentSummaryBlurTimer);
            setTreatmentSummaryExpanded(true);
            resizeTreatmentSummaryInput();
        });

        treatmentSummaryInput.addEventListener('input', () => {
            syncTreatmentSummaryDisplay(treatmentSummaryInput.value);
            setTreatmentSummaryExpanded(true);
            resizeTreatmentSummaryInput();
            scheduleTreatmentSummarySave();
        });

        treatmentSummaryInput.addEventListener('change', () => {
            scheduleTreatmentSummarySave(true);
        });

        treatmentSummaryInput.addEventListener('blur', () => {
            clearTimeout(treatmentSummaryBlurTimer);
            treatmentSummaryBlurTimer = setTimeout(() => {
                scheduleTreatmentSummarySave(true);
                setTreatmentSummaryExpanded(false);
            }, 0);
        });

        document.addEventListener('pointerdown', (e) => {
            if (!treatmentSummaryCard.contains(e.target) && document.activeElement === treatmentSummaryInput) {
                treatmentSummaryInput.blur();
            }
        });

        window.addEventListener('resize', resizeTreatmentSummaryInput, { passive: true });
    }

    const treatmentNotes = document.getElementById('treatmentNotes');
    const duringNotes = document.getElementById('duringNotes');
    const extractNotes = document.getElementById('extractNotes');

    function addTreatmentNote(value = '') {
        return addNoteBox(treatmentNotes, value, 'توضیحات دکتر یا نکات درمان را وارد کنید...');
    }

    function addDuringNote(value = '') {
        return addNoteBox(duringNotes, value, 'توضیحات مربوط به حین درمان را وارد کنید...');
    }

    function addExtractNote(value = '') {
        return addNoteBox(extractNotes, value, 'توضیحات مربوط به برداشت را وارد کنید...');
    }

    bindNoteContainer(treatmentNotes);
    bindNoteContainer(duringNotes);
    bindNoteContainer(extractNotes);

    // --- اضافه کردن فیلدهای تصویر ---
    function addImageCard(containerId, headerText) {
        const c = document.getElementById(containerId);
        const d = document.createElement('div');
        d.className = 'image-upload-card';
        d.style.animation = 'fadeUp .3s ease both';
        d.innerHTML = createImageCardMarkup(headerText, 'fa-upload', true);
        bindImageCardMenu(d);
        c.appendChild(d);
        bindAllRectUploads();
        showToast('فیلد تصویر جدید اضافه شد');
        return d;
    }

    function createCustomSection(sectionData = {}) {
        const showDelete = !sectionData.key;
        const key = sectionData.key || makeSectionKey('custom');
        const title = sectionData.title || 'کادر جدید';
        const card = document.createElement('section');
        card.className = 'card custom-card rounded-ui border shadow-card transition-colors';
        card.dataset.sectionKey = key;
        card.dataset.printSection = key;
        card.dataset.customSection = 'true';
        card.innerHTML = `
            ${showDelete ? '<button class="component-delete-btn delete-section-btn" type="button" title="حذف کادر" aria-label="حذف کادر"><i class="fas fa-trash-alt"></i></button>' : ''}
            <div class="card-title"><i class="fas fa-layer-group"></i><input class="inline-section-title custom-section-title" type="text" value="${escapeHtml(title)}" aria-label="عنوان کادر"></div>
            <div class="images-section custom-images" id="${key}Images"></div>
            <div class="treatment-notes custom-notes" id="${key}Notes"></div>`;

        const resultCard = document.querySelector('[data-section-key="result"]');
        document.querySelector('.container').insertBefore(card, resultCard || null);

        const notes = card.querySelector('.custom-notes');
        const titleInput = card.querySelector('.custom-section-title');

        titleInput.addEventListener('input', () => Autosave.trigger());
        card.querySelector('.delete-section-btn')?.addEventListener('click', () => removeSectionCard(card));
        bindNoteContainer(notes);
        bindAllRectUploads();
        enhanceDraggableSections();

        (sectionData.notes || []).forEach(note => addNoteBox(notes, note, 'توضیحات این کادر را وارد کنید...'));
        return card;
    }

    function enhanceDraggableSections() {
        document.querySelectorAll('.container > .card[data-section-key]').forEach(card => {
            normalizeSectionTitle(card);
            card.querySelector('.drag-handle')?.remove();
            if (!card.querySelector('.section-tools')) {
                const title = card.querySelector('.card-title');
                if (title) title.insertAdjacentHTML('beforeend', createSectionMenuMarkup(card));
            }
            refreshSectionMenuState(card);
            bindSectionMenu(card);
        });
    }

    renderResultFields(RESULT_DEFAULT_FIELDS);
    bindPatientDetails();

    // --- حذف عکس ---
    document.addEventListener('click', (e) => {
        if (e.target.closest('.remove-img-btn')) {
            e.preventDefault(); e.stopPropagation();
            const rect = e.target.closest('.upload-rect');
            const dbUrl = rect.getAttribute('data-db-url');
            if (dbUrl) DB.deleteImage(dbUrl);
            rect.removeAttribute('data-db-url');
            rect.removeAttribute('data-image-url');
            rect.removeAttribute('data-uploading');
            rect.style.height = ''; rect.style.minHeight = ''; rect.style.backgroundImage = '';
            rect.classList.remove('has-image');
            rect.innerHTML = `<i class="fas fa-cloud-upload-alt" style="display:block"></i><span style="display:block">آپلود تصویر</span><input type="file" accept="image/*">`;
            bindAllRectUploads();
            Autosave.triggerSoon(rect);
            showToast('تصویر حذف شد');
        }
    });

    // --- منوی کشویی ---
    const dropdownWrapper = document.querySelector('.nav-dropdown-wrapper');
    const settingsPanels = [
        document.getElementById('settingsPanel'),
        document.getElementById('imageSettingsPanel'),
        document.getElementById('themeSettingsPanel')
    ].filter(Boolean);

    function closeSettingsPanels(exceptPanel = null) {
        settingsPanels.forEach(panel => {
            if (panel !== exceptPanel) panel.classList.remove('open');
        });
    }

    function toggleSettingsPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const shouldOpen = !panel.classList.contains('open');
        closeSettingsPanels(panel);
        panel.classList.toggle('open', shouldOpen);
    }

    const dropdownToggle = document.getElementById('dropdownToggle');
    const syncDropdownState = () => {
        dropdownToggle?.setAttribute('aria-expanded', String(dropdownWrapper.classList.contains('open')));
    };
    const closeDropdown = () => {
        dropdownWrapper.classList.remove('open');
        syncDropdownState();
    };
    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownWrapper.classList.toggle('open');
        syncDropdownState();
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown-wrapper')) {
            closeDropdown();
        }
    });

    document.getElementById('searchBtn').addEventListener('click', () => { closeDropdown(); handleFileNumberChange(true); });
    document.getElementById('saveNowBtn').addEventListener('click', async () => { closeDropdown(); await Autosave.forceSave(); showToast('داده‌ها ذخیره شدند'); });
    document.getElementById('addCustomSectionBtn').addEventListener('click', () => {
        closeDropdown();
        const card = createCustomSection();
        card.querySelector('.custom-section-title')?.focus();
        Autosave.trigger();
        showToast('کادر جدید اضافه شد');
    });
    document.getElementById('printBtn').addEventListener('click', () => { closeDropdown(); closeSettingsPanels(); if (window.PrintManager) PrintManager.initiatePrint(); });
    document.getElementById('printSettingsToggle').addEventListener('click', () => { closeDropdown(); toggleSettingsPanel('settingsPanel'); });
    document.getElementById('imageSettingsToggle').addEventListener('click', () => { closeDropdown(); toggleSettingsPanel('imageSettingsPanel'); });
    document.getElementById('themeSettingsToggle').addEventListener('click', () => { closeDropdown(); toggleSettingsPanel('themeSettingsPanel'); });
    document.getElementById('settingsCloseBtn').addEventListener('click', () => document.getElementById('settingsPanel').classList.remove('open'));
    document.getElementById('imageSettingsCloseBtn').addEventListener('click', () => document.getElementById('imageSettingsPanel').classList.remove('open'));
    document.getElementById('themeSettingsCloseBtn').addEventListener('click', () => document.getElementById('themeSettingsPanel').classList.remove('open'));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.settings-panel') && !e.target.closest('.nav-dropdown-wrapper')) closeSettingsPanels();
    });

    const printSettingIds = [
        'printStylePreset',
        'printOrientation',
        'printPaperSize',
        'printImages',
        'printCover',
        'printMargin',
        'printPageMargin',
        'printSummary',
        'printImageLayout',
        'printImageSize',
        'printImageFit',
        'printImageWidth',
        'printImageBorderStyle',
        'printImageBorderWidth',
        'printImageBorderColor',
        'printTitleFrameStyle',
        'printTitleBorderStyle',
        'printTitleBorderWidth',
        'printTitleRadius',
        'printTitleBorderColor',
        'printTitleBgColor',
        'printTitleTextColor',
        'printTitleIconColor',
        'printTitleShadow',
        'printHeaderMode',
        'printFooter',
        'printPageNumbers',
        'printFontSize',
        'printContentScale',
        'printSectionBreak',
        'printCompactMode',
        'printAutoPrint'
    ];

    function collectFormSettings(ids) {
        return ids.reduce((settings, id) => {
            const el = document.getElementById(id);
            if (!el) return settings;
            settings[id] = el.type === 'checkbox' ? el.checked : el.value;
            return settings;
        }, {});
    }

    function applyFormSettings(settings) {
        Object.entries(settings || {}).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = Boolean(value);
            else el.value = value;
        });
    }

    function savePrintSettings() {
        localStorage.setItem('dentalPrintSettings', JSON.stringify(collectFormSettings(printSettingIds)));
    }

    function syncPrintRangeValue(inputId, outputId, suffix = '') {
        const input = document.getElementById(inputId);
        const output = document.getElementById(outputId);
        if (!input || !output) return;
        output.textContent = `${input.value}${suffix}`;
    }

    function syncAllPrintRangeLabels() {
        syncPrintRangeValue('printImageWidth', 'printImageWidthValue', '%');
        syncPrintRangeValue('printPageMargin', 'printPageMarginValue', 'mm');
        syncPrintRangeValue('printContentScale', 'printContentScaleValue', '%');
    }

    function loadPrintSettings() {
        const saved = localStorage.getItem('dentalPrintSettings');
        if (!saved) return;
        try {
            applyFormSettings(JSON.parse(saved));
        } catch (error) {
            localStorage.removeItem('dentalPrintSettings');
        }
    }

    loadPrintSettings();
    syncAllPrintRangeLabels();

    // Preset های سبک چاپ ارتودنسی
    let isApplyingPrintPreset = false;
    function applyPrintStylePreset(preset) {
        const get = id => document.getElementById(id);
        const setVal = (id, value) => { const el = get(id); if (el) el.value = value; };
        const setChecked = (id, value) => { const el = get(id); if (el && el.type === 'checkbox') el.checked = !!value; };
        if (preset === 'userDefault') {
            savePrintSettings();
            showToast('تنظیمات دلخواه شما ذخیره شد');
            return;
        }

        isApplyingPrintPreset = true;
        if (preset === 'beforeAfterPortfolio') {
            setVal('printOrientation', 'landscape');
            setVal('printMargin', 'narrow');
            setVal('printPageMargin', '8');
            setChecked('printSummary', true);
            setVal('printImageLayout', 'grid3');
            setVal('printImageSize', 'large');
            setVal('printImageFit', 'contain');
            setVal('printImageWidth', '95');
            setVal('printImageBorderStyle', 'solid');
            setVal('printImageBorderWidth', '1px');
            setVal('printTitleFrameStyle', 'accent');
            setVal('printTitleBorderStyle', 'solid');
            setVal('printTitleBorderWidth', '1px');
            setVal('printTitleRadius', '10px');
            setVal('printHeaderMode', 'full');
            setChecked('printFooter', true);
            setChecked('printPageNumbers', true);
            setVal('printContentScale', '100');
            setVal('printSectionBreak', 'each');
            setChecked('printImages', true);
            setChecked('printCover', true);
            setChecked('printCompactMode', false);
            setChecked('printAutoPrint', true);
        } else if (preset === 'clinicLetterhead') {
            setVal('printOrientation', 'portrait');
            setVal('printMargin', 'normal');
            setVal('printPageMargin', '12');
            setChecked('printSummary', true);
            setVal('printImageLayout', 'grid2');
            setVal('printImageSize', 'medium');
            setVal('printImageFit', 'contain');
            setVal('printImageWidth', '90');
            setVal('printImageBorderStyle', 'solid');
            setVal('printImageBorderWidth', '1px');
            setVal('printTitleFrameStyle', 'outline');
            setVal('printTitleBorderStyle', 'solid');
            setVal('printTitleBorderWidth', '1px');
            setVal('printTitleRadius', '10px');
            setVal('printHeaderMode', 'full');
            setChecked('printFooter', true);
            setChecked('printPageNumbers', true);
            setVal('printContentScale', '100');
            setVal('printSectionBreak', 'avoid');
            setChecked('printImages', true);
            setChecked('printCover', true);
            setChecked('printCompactMode', false);
            setChecked('printAutoPrint', true);
        } else if (preset === 'minimalSummary') {
            setVal('printOrientation', 'portrait');
            setVal('printMargin', 'normal');
            setVal('printPageMargin', '10');
            setChecked('printSummary', false);
            setVal('printImageLayout', 'grid1');
            setVal('printImageSize', 'small');
            setVal('printImageFit', 'contain');
            setVal('printImageWidth', '82');
            setVal('printImageBorderStyle', 'none');
            setVal('printTitleFrameStyle', 'minimal');
            setVal('printTitleBorderStyle', 'none');
            setVal('printTitleRadius', '0px');
            setVal('printHeaderMode', 'compact');
            setChecked('printFooter', true);
            setChecked('printPageNumbers', false);
            setVal('printContentScale', '95');
            setVal('printSectionBreak', 'auto');
            setChecked('printImages', true);
            setChecked('printCover', false);
            setChecked('printCompactMode', true);
            setChecked('printAutoPrint', true);
        } else { // orthoClinical پیش‌فرض
            setVal('printOrientation', 'portrait');
            setVal('printMargin', 'normal');
            setVal('printPageMargin', '12');
            setChecked('printSummary', true);
            setVal('printImageLayout', 'grid2');
            setVal('printImageSize', 'medium');
            setVal('printImageFit', 'contain');
            setVal('printImageWidth', '100');
            setVal('printImageBorderStyle', 'solid');
            setVal('printImageBorderWidth', '1px');
            setVal('printTitleFrameStyle', 'filled');
            setVal('printTitleBorderStyle', 'solid');
            setVal('printTitleBorderWidth', '1px');
            setVal('printTitleRadius', '6px');
            setVal('printHeaderMode', 'full');
            setChecked('printFooter', true);
            setChecked('printPageNumbers', true);
            setVal('printContentScale', '100');
            setVal('printSectionBreak', 'avoid');
            setChecked('printImages', true);
            setChecked('printCover', true);
            setChecked('printCompactMode', false);
            setChecked('printAutoPrint', true);
        }
        isApplyingPrintPreset = false;
        syncAllPrintRangeLabels();
        savePrintSettings();
        showToast('سبک چاپ اعمال شد');
    }
    printSettingIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', savePrintSettings);
        el.addEventListener('change', savePrintSettings);
    });
    [
        ['printImageWidth', 'printImageWidthValue', '%'],
        ['printPageMargin', 'printPageMarginValue', 'mm'],
        ['printContentScale', 'printContentScaleValue', '%']
    ].forEach(([inputId, outputId, suffix]) => {
        const input = document.getElementById(inputId);
        if (!input || input._rangeValueBound) return;
        input._rangeValueBound = true;
        const sync = () => syncPrintRangeValue(inputId, outputId, suffix);
        input.addEventListener('input', sync);
        input.addEventListener('change', sync);
    });
    const stylePresetEl = document.getElementById('printStylePreset');
    if (stylePresetEl && !stylePresetEl._bound) {
        stylePresetEl._bound = true;
        stylePresetEl.addEventListener('change', () => applyPrintStylePreset(stylePresetEl.value));
    }
    const customPrintSettingIds = printSettingIds.filter(id => id !== 'printStylePreset');
    customPrintSettingIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el._customPresetBound) return;
        el._customPresetBound = true;
        const setAsCustom = () => {
            if (isApplyingPrintPreset) return;
            const presetEl = document.getElementById('printStylePreset');
            if (presetEl && presetEl.value !== 'userDefault') {
                presetEl.value = 'userDefault';
            }
            savePrintSettings();
        };
        el.addEventListener('input', setAsCustom);
        el.addEventListener('change', setAsCustom);
    });

    const imageSettingIds = ['imageFitMode', 'imageBorderStyle', 'imageBorderWidth', 'imageRadius', 'imageBorderColor', 'contentWidth'];

    function loadImageFrameSettings() {
        const saved = localStorage.getItem('dentalImageFrameSettings');
        if (!saved) return;
        try {
            applyFormSettings(JSON.parse(saved));
        } catch (error) {
            localStorage.removeItem('dentalImageFrameSettings');
        }
    }

    function applyImageFrameSettings(silent = false) {
        const root = document.documentElement;
        root.style.setProperty('--image-fit', document.getElementById('imageFitMode').value);
        root.style.setProperty('--image-frame-style', document.getElementById('imageBorderStyle').value);
        root.style.setProperty('--image-frame-width', document.getElementById('imageBorderWidth').value);
        root.style.setProperty('--image-frame-radius', document.getElementById('imageRadius').value);
        root.style.setProperty('--image-frame-color', document.getElementById('imageBorderColor').value);
        root.style.setProperty('--content-width', document.getElementById('contentWidth').value);
        localStorage.setItem('dentalImageFrameSettings', JSON.stringify(collectFormSettings(imageSettingIds)));
        refreshImageHeights();
        if (!silent) showToast('تنظیمات کادر تصاویر اعمال شد');
    }

    const themePresets = {
        clinicalBlue: {
            accent: '#5b5bd6',
            soft: '#7c78ee',
            bg: '#f5f7fb',
            card: '#ffffff',
            text: '#162033',
            border: '#e1e5ec',
            surface: 'clean'
        },
        emeraldCare: {
            accent: '#059669',
            soft: '#10b981',
            bg: '#eefdf7',
            card: '#ffffff',
            text: '#10251d',
            border: '#bbf7d0',
            surface: 'soft'
        },
        graphite: {
            accent: '#475569',
            soft: '#64748b',
            bg: '#eef2f7',
            card: '#ffffff',
            text: '#0f172a',
            border: '#cbd5e1',
            surface: 'contrast'
        },
        roseQuartz: {
            accent: '#e11d48',
            soft: '#fb7185',
            bg: '#fff1f2',
            card: '#ffffff',
            text: '#2b1018',
            border: '#fecdd3',
            surface: 'soft'
        },
        amberFocus: {
            accent: '#d97706',
            soft: '#f59e0b',
            bg: '#fffbeb',
            card: '#ffffff',
            text: '#2b2112',
            border: '#fde68a',
            surface: 'soft'
        },
        tealBreeze: {
            accent: '#0f766e',
            soft: '#14b8a6',
            bg: '#f0fdfa',
            card: '#ffffff',
            text: '#115e59',
            border: '#ccfbf1',
            surface: 'soft'
        },
        royalAmethyst: {
            accent: '#7e22ce',
            soft: '#a855f7',
            bg: '#faf5ff',
            card: '#ffffff',
            text: '#581c87',
            border: '#f3e8ff',
            surface: 'soft'
        },
        cosmeticGold: {
            accent: '#b45309',
            soft: '#d97706',
            bg: '#fffbeb',
            card: '#ffffff',
            text: '#78350f',
            border: '#fef3c7',
            surface: 'clean'
        },
        darkObsidian: {
            accent: '#6366f1',     /* Gorgeous premium Indigo */
            soft: '#818cf8',       /* Soft Indigo accent */
            bg: '#050811',         /* Ultimate cosmic dark background */
            card: '#0d1426',       /* Translucent obsidian card */
            text: '#f8fafc',       /* Silver metallic white */
            border: '#1e293b',     /* Slate 800 borders */
            surface: 'dark'
        }
    };

    function hexToRgb(hex) {
        const normalized = String(hex || '').replace('#', '');
        const full = normalized.length === 3 ? normalized.split('').map(ch => ch + ch).join('') : normalized;
        const value = parseInt(full, 16);
        if (Number.isNaN(value)) return { r: 37, g: 99, b: 235 };
        return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
    }

    function mixHex(hex, amount = 0.88) {
        const { r, g, b } = hexToRgb(hex);
        const mix = channel => {
            const target = amount >= 0 ? 255 : 0;
            return Math.max(0, Math.min(255, Math.round(channel + (target - channel) * Math.abs(amount))));
        };
        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
    }

    function getThemeFormValues() {
        return {
            preset: document.getElementById('themePreset').value,
            accent: document.getElementById('accentColor').value,
            soft: document.getElementById('accentSoftColor').value,
            bg: document.getElementById('bgColor').value,
            card: document.getElementById('cardColor').value,
            text: document.getElementById('textColor').value,
            border: document.getElementById('borderColor').value,
            surface: document.getElementById('surfaceTheme').value,
            radius: document.getElementById('uiRadius').value,
            shadow: document.getElementById('shadowLevel').value,
            fontScale: document.getElementById('fontScale')?.value || 'normal',
            cardBorder: document.getElementById('cardBorderWidth')?.value || 'medium'
        };
    }

    function setThemeFormValues(values) {
        document.getElementById('themePreset').value = values.preset || 'clinicalBlue';
        document.getElementById('accentColor').value = values.accent || '#5b5bd6';
        document.getElementById('accentSoftColor').value = values.soft || '#7c78ee';
        document.getElementById('bgColor').value = values.bg || '#f5f7fb';
        document.getElementById('cardColor').value = values.card || '#ffffff';
        document.getElementById('textColor').value = values.text || '#162033';
        document.getElementById('borderColor').value = values.border || '#e1e5ec';
        document.getElementById('surfaceTheme').value = values.surface || 'clean';
        document.getElementById('uiRadius').value = values.radius || '12px';
        document.getElementById('shadowLevel').value = values.shadow || 'soft';
        if (document.getElementById('fontScale')) {
            document.getElementById('fontScale').value = values.fontScale || 'normal';
        }
        if (document.getElementById('cardBorderWidth')) {
            document.getElementById('cardBorderWidth').value = values.cardBorder || 'medium';
        }
    }

    function applyThemeSettings(silent = false) {
        const root = document.documentElement;
        const values = getThemeFormValues();
        const accent = values.accent;
        const accentSoft = values.soft;
        const accentRgb = hexToRgb(accent);
        const dark = values.surface === 'dark';
        const shadowMap = {
            flat: { md: 'none', lg: 'none' },
            soft: { md: `0 4px 16px rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},.08)`, lg: `0 12px 30px rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},.12)` },
            deep: { md: `0 10px 28px rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},.16)`, lg: `0 18px 46px rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},.20)` }
        };
        const shadows = shadowMap[values.shadow] || shadowMap.soft;

        root.style.setProperty('--accent', accent);
        root.style.setProperty('--accent-soft', accentSoft);
        root.style.setProperty('--accent-light', mixHex(accent, dark ? 0.72 : 0.86));
        root.style.setProperty('--accent-dark', dark ? accentSoft : mixHex(accent, -0.2));
        root.style.setProperty('--bg', values.bg);
        root.style.setProperty('--card', values.card);
        root.style.setProperty('--text-primary', values.text);
        root.style.setProperty('--text-secondary', dark ? '#cbd5e1' : '#4b5563');
        root.style.setProperty('--text-tertiary', dark ? '#94a3b8' : '#9ca3af');
        root.style.setProperty('--border', values.border);
        root.style.setProperty('--field-bg', dark ? '#111827' : values.surface === 'soft' ? '#ffffff' : '#fafafa');
        root.style.setProperty('--muted-bg', dark ? '#0f172a' : values.surface === 'contrast' ? '#eef2f7' : '#f9fafb');
        root.style.setProperty('--button-text', '#ffffff');
        root.style.setProperty('--radius', values.radius);
        root.style.setProperty('--radius-sm', values.radius === '6px' ? '6px' : values.radius === '18px' ? '12px' : '8px');
        root.style.setProperty('--shadow-md', shadows.md);
        root.style.setProperty('--shadow-lg', shadows.lg);

        // تنظیم پویای ضریب اندازه فونت
        const fontScaleMap = {
            small: '0.9',
            normal: '1.0',
            large: '1.1',
            xlarge: '1.2'
        };
        root.style.setProperty('--font-scale', fontScaleMap[values.fontScale] || '1.0');

        // تنظیم پویای ضخامت کادرهای کارت‌ها
        const cardBorderMap = {
            none: '0px',
            thin: '1px',
            medium: '1.5px',
            thick: '3px'
        };
        root.style.setProperty('--card-border-width', cardBorderMap[values.cardBorder] || '1.5px');

        localStorage.setItem('dentalThemeSettings', JSON.stringify(values));
        if (!silent) showToast('تنظیمات رنگ و تم اعمال شد');
    }

    imageSettingIds.forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => applyImageFrameSettings());
        document.getElementById(id)?.addEventListener('change', () => applyImageFrameSettings());
    });
    ['accentColor', 'accentSoftColor', 'bgColor', 'cardColor', 'textColor', 'borderColor', 'surfaceTheme', 'uiRadius', 'shadowLevel', 'fontScale', 'cardBorderWidth'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => applyThemeSettings());
        document.getElementById(id)?.addEventListener('change', () => applyThemeSettings());
    });
    document.getElementById('themePreset')?.addEventListener('change', () => {
        const preset = document.getElementById('themePreset').value;
        if (preset !== 'custom' && themePresets[preset]) {
            setThemeFormValues({ preset, ...themePresets[preset], radius: document.getElementById('uiRadius').value, shadow: document.getElementById('shadowLevel').value, fontScale: document.getElementById('fontScale')?.value || 'normal', cardBorder: document.getElementById('cardBorderWidth')?.value || 'medium' });
        }
        applyThemeSettings();
    });
    document.getElementById('resetThemeBtn')?.addEventListener('click', () => {
        setThemeFormValues({ preset: 'clinicalBlue', ...themePresets.clinicalBlue, radius: '12px', shadow: 'soft', fontScale: 'normal', cardBorder: 'medium' });
        applyThemeSettings();
        showToast('تم به حالت پیش‌فرض برگشت');
    });
    const savedTheme = localStorage.getItem('dentalThemeSettings');
    if (savedTheme) {
        try {
            setThemeFormValues(JSON.parse(savedTheme));
        } catch (error) {
            setThemeFormValues({ preset: 'clinicalBlue', ...themePresets.clinicalBlue, radius: '12px', shadow: 'soft', fontScale: 'normal', cardBorder: 'medium' });
        }
    } else {
        setThemeFormValues({ preset: 'clinicalBlue', ...themePresets.clinicalBlue, radius: '12px', shadow: 'soft', fontScale: 'normal', cardBorder: 'medium' });
    }
    loadImageFrameSettings();
    applyImageFrameSettings(true);
    applyThemeSettings(true);

    // --- مودال ---
    const modalOverlay = document.getElementById('customModal');
    imageEditorModal = document.getElementById('sectionImageEditorModal');
    imageEditorSelect = document.getElementById('sectionImageEditorSelect');
    imageEditorPreview = document.getElementById('sectionImageEditorPreview');
    imageEditorPreviewLabel = document.getElementById('sectionImageEditorPreviewLabel');
    imageEditorSubtitle = document.getElementById('sectionImageEditorSubtitle');
    let modalResolve = null;
    function showModal(message) { document.getElementById('modalMessage').textContent = message; modalOverlay.classList.add('show'); return new Promise((resolve) => { modalResolve = resolve; }); }
    document.getElementById('modalConfirm').addEventListener('click', () => { modalOverlay.classList.remove('show'); if (modalResolve) modalResolve(true); });
    document.getElementById('modalCancel').addEventListener('click', () => { modalOverlay.classList.remove('show'); if (modalResolve) modalResolve(false); });
    imageEditorSelect?.addEventListener('change', syncSectionImageEditor);
    document.getElementById('sectionImageEditorCloseBtn')?.addEventListener('click', closeSectionImageEditor);
    imageEditorModal?.addEventListener('click', (e) => {
        if (e.target === imageEditorModal) closeSectionImageEditor();
    });
    document.querySelectorAll('[data-editor-action]').forEach(button => {
        button.addEventListener('click', async () => {
            const activeCard = getActiveImageEditorCard();
            if (!activeCard) return;

            const action = button.getAttribute('data-editor-action');
            if (action === 'replace-image') {
                const input = activeCard.querySelector('.upload-rect input[type="file"]');
                if (!input) return;
                input.addEventListener('change', () => refreshSectionImageEditorAfterUpload(activeCard), { once: true });
                input.click();
                return;
            }

            await applyImageTransform(activeCard, action);
            syncSectionImageEditor();
        });
    });

    // --- جستجو و بارگذاری ---
    const fileNumberInput = document.getElementById('fileNumber');
    const fileSearchButton = document.getElementById('fileSearchButton');
    const fileSearchFeedback = document.getElementById('fileSearchFeedback');
    const standardImageSectionIds = ['patientImages', 'doctorImages', 'initialImages', 'duringImages', 'fileImages', 'extractImages'];
    const standardSectionCards = Array.from(document.querySelectorAll('.container > .card[data-section-key]:not([data-custom-section="true"])'));
    const pristinePatientState = {
        imageMarkup: Object.fromEntries(standardImageSectionIds.map(id => [id, document.getElementById(id)?.innerHTML || ''])),
        sectionOrder: standardSectionCards.map(card => card.dataset.sectionKey),
        sectionTitles: standardSectionCards.map(card => ({
            key: card.dataset.sectionKey,
            title: getSectionTitleValue(card)
        }))
    };
    let isSearching = false;
    fileNumberInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFileNumberChange(); } });
    fileSearchButton?.addEventListener('click', () => handleFileNumberChange(true));

    function setFileSearchState(searching, message = '') {
        if (fileSearchButton) {
            fileSearchButton.disabled = searching;
            fileSearchButton.setAttribute('aria-busy', String(searching));
            const label = fileSearchButton.querySelector('.file-search-button-label');
            if (label) label.textContent = searching ? 'در حال جستجو' : 'جستجو';
        }
        fileNumberInput.setAttribute('aria-busy', String(searching));
        if (message && fileSearchFeedback) fileSearchFeedback.textContent = message;
    }

    function resetPatientForm({ identity = null } = {}) {
        const nextIdentity = identity || { firstName: '', lastName: '', fileNumber: '' };
        Autosave.resetForNewPatient();
        clearTimeout(treatmentSummarySaveTimer);
        clearTimeout(treatmentSummaryBlurTimer);
        closeResultDatePicker();
        closeSectionImageEditor();
        closeImageCardMenus();
        closeSectionMenus();

        firstNameInput.value = nextIdentity.firstName || '';
        lastNameInput.value = nextIdentity.lastName || '';
        fileNumberInput.value = normalizeFileNumber(nextIdentity.fileNumber || '');
        syncPatientName();
        document.getElementById('fileDisplay').textContent = fileNumberInput.value || '---';

        coverInput.value = '';
        profileInput.value = '';
        resetCoverImage();
        resetProfileImage();

        const select = document.getElementById('patientStatus');
        if (select) {
            select.value = 'under_treatment';
            updateStatusSelectorUI(select);
        }

        if (treatmentSummaryInput) {
            treatmentSummaryInput.value = '';
            syncTreatmentSummaryDisplay('');
            setTreatmentSummaryExpanded(false);
        }

        renderPatientDetailRows([]);
        document.querySelectorAll('.custom-card[data-custom-section="true"]').forEach(card => card.remove());
        treatmentNotes.innerHTML = '';
        duringNotes.innerHTML = '';
        extractNotes.innerHTML = '';
        renderResultFields(RESULT_DEFAULT_FIELDS);

        standardImageSectionIds.forEach(id => {
            const container = document.getElementById(id);
            if (container) container.innerHTML = pristinePatientState.imageMarkup[id];
        });

        const pageContainer = document.querySelector('.container');
        pristinePatientState.sectionOrder.forEach(key => {
            const card = pageContainer?.querySelector(`.card[data-section-key="${CSS.escape(key)}"]`);
            if (card) pageContainer.appendChild(card);
        });
        applySavedSectionTitles(pristinePatientState.sectionTitles);
        enhanceDraggableSections();
        bindAllRectUploads();

        setFileSearchState(false, 'شماره پرونده را وارد کرده و جستجو را بزنید.');
        Autosave.primeImageSectionState(null);
        Autosave.updateStatus('آماده', '#9ca3af');
    }

    async function handleFileNumberChange(showEmptyWarning = false) {
        if (isSearching) return;
        const fileNumber = normalizeFileNumber(fileNumberInput.value);
        if (!fileNumber) {
            setFileSearchState(false, 'برای جستجو، شماره پرونده را وارد کنید.');
            if (showEmptyWarning) {
                showToast('ابتدا شماره پرونده را وارد کنید');
                fileNumberInput.focus();
            }
            return;
        }
        if (fileNumberInput.value !== fileNumber) fileNumberInput.value = fileNumber;
        isSearching = true;
        setFileSearchState(true, `در حال جستجوی پرونده ${toPersianDigits(fileNumber)}...`);
        Autosave.updateStatus('در حال جستجو...', '#3b82f6');
        try {
            const patient = await DB.getPatient(fileNumber);
            if (patient) {
                Autosave.updateStatus('پرونده پیدا شد...', '#22c55e');
                renderPatientData(patient);
                Autosave.currentPatientId = patient.id;
                Autosave.updateStatus('پرونده بارگذاری شد ✓', '#22c55e');
                setFileSearchState(true, `پرونده ${toPersianDigits(fileNumber)} با موفقیت بارگذاری شد.`);
                showToast('پرونده بارگذاری شد');
            } else {
                Autosave.updateStatus('پرونده یافت نشد', '#ef4444');
                setFileSearchState(true, `پرونده‌ای با شماره ${toPersianDigits(fileNumber)} یافت نشد.`);
                const userWantsToCreate = await showModal(`شماره پرونده "${fileNumber}" موجود نمی‌باشد. ایجاد شود؟`);
                if (userWantsToCreate) {
                    const identity = {
                        firstName: firstNameInput.value,
                        lastName: lastNameInput.value,
                        fileNumber
                    };
                    resetPatientForm({ identity });
                    const savedPatient = await Autosave.forceSave({ allowCreate: true });
                    if (savedPatient?.id) {
                        setFileSearchState(true, `پرونده جدید با شماره ${toPersianDigits(fileNumber)} ایجاد شد.`);
                        showToast('پرونده جدید ایجاد شد');
                    } else {
                        setFileSearchState(true, 'ایجاد پرونده با خطا مواجه شد. دوباره تلاش کنید.');
                        showToast('خطا در ایجاد پرونده جدید');
                    }
                } else {
                    fileNumberInput.value = '';
                    document.getElementById('fileDisplay').textContent = '---';
                    Autosave.updateStatus('آماده', '#9ca3af');
                    setFileSearchState(true, 'شماره پرونده را وارد کرده و جستجو را بزنید.');
                }
            }
        } catch (error) {
            console.error('خطا در جستجوی پرونده:', error);
            Autosave.updateStatus('خطا در جستجو', '#ef4444');
            setFileSearchState(true, 'جستجوی پرونده با خطا مواجه شد. دوباره تلاش کنید.');
            showToast('خطا در جستجوی پرونده');
        } finally {
            isSearching = false;
            setFileSearchState(false);
        }
    }

    function renderPatientData(patient) {
        const nameParts = splitPatientName(patient.name || '');
        resetPatientForm({
            identity: {
                ...nameParts,
                fileNumber: patient.file_number || fileNumberInput.value
            }
        });
        if (patient.cover_url) applyCoverImage(patient.cover_url);
        else resetCoverImage();
        if (patient.profile_url) applyProfileImage(patient.profile_url);
        else resetProfileImage();

        const patientMeta = (patient.results || []).find(item => item && item.type === 'patient_meta') || {};
        const patientStatus = patientMeta.patientStatus || 'under_treatment';
        const select = document.getElementById('patientStatus');
        if (select) {
            select.value = patientStatus;
            updateStatusSelectorUI(select);
        }

        const summaryInput = document.getElementById('treatmentSummary');
        if (summaryInput) {
            summaryInput.value = patient.summary || patient.treatment_summary || patientMeta.treatmentSummary || patientMeta.summary || '';
            syncTreatmentSummaryDisplay(summaryInput.value);
            setTreatmentSummaryExpanded(false);
        }
        renderPatientDetailRows(patientMeta.patientDetailRows || []);
        document.querySelectorAll('.custom-card[data-custom-section="true"]').forEach(card => card.remove());
        (patientMeta.customSections || []).forEach(section => createCustomSection(section));
        applySavedSectionTitles(patientMeta.sectionTitles || []);

        treatmentNotes.innerHTML = ''; 
        if (patient.treatments && patient.treatments.length > 0) {
            patient.treatments.forEach((t) => {
                const value = t.note || [t.plan, t.action, t.date].filter(Boolean).join(' - ');
                addTreatmentNote(value);
            });
        }
        duringNotes.innerHTML = '';
        (patientMeta.duringNotes || []).forEach(note => addDuringNote(note));
        extractNotes.innerHTML = '';
        (patientMeta.extractNotes || []).forEach(note => addExtractNote(note));

        const visibleResults = (patient.results || []).filter(r => !r.type);
        renderResultFields(visibleResults);

        const sectionMap = { 'patient_info': 'patientImages', 'doctor_notes': 'doctorImages', 'initial': 'initialImages', 'during': 'duringImages', 'file_image': 'fileImages', 'extract': 'extractImages' };
        document.querySelectorAll('.custom-card[data-custom-section="true"]').forEach(card => {
            sectionMap[card.dataset.sectionKey] = `${card.dataset.sectionKey}Images`;
        });
        const imageSectionsWithData = new Set((patient.images || []).map(image => image.section));
        Object.entries(sectionMap).forEach(([section, id]) => {
            const container = document.getElementById(id);
            if (container && imageSectionsWithData.has(section)) container.innerHTML = '';
        });
        const imageTitleMap = new Map((patientMeta.imageTitles || []).filter(item => item && item.url).map(item => [item.url, item.title || '']));

        if (patient.images && patient.images.length > 0) {
            patient.images.forEach(img => {
                const containerId = sectionMap[img.section]; if (!containerId) return;
                const container = document.getElementById(containerId);
                const d = document.createElement('div');
                d.className = 'image-upload-card';
                d.style.animation = 'fadeUp .3s ease both';
                d.innerHTML = createImageCardMarkup(imageTitleMap.get(img.image_url) || 'تصویر بارگذاری شده', 'fa-image');
                container.appendChild(d);
                applyStoredUploadImage(d.querySelector('.upload-rect'), img.image_url);
                setImageCardTitle(d, imageTitleMap.get(img.image_url) || 'تصویر بارگذاری شده', false);
                bindImageCardMenu(d);
            });
        }
        if (Array.isArray(patientMeta.sectionOrder)) {
            const container = document.querySelector('.container');
            patientMeta.sectionOrder.forEach(key => {
                const card = container.querySelector(`.card[data-section-key="${CSS.escape(key)}"]`);
                if (card) container.appendChild(card);
            });
        }
        enhanceDraggableSections();
        bindAllRectUploads();
        Autosave.primeImageSectionState(patient.id);
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(refreshImageHeights, 150);
    });

    function updateStatusSelectorUI(select) {
        if (!select) return;
        const option = select.options[select.selectedIndex];
        if (!option) return;
        const color = option.getAttribute('data-color') || '#2563eb';
        const bg = option.getAttribute('data-bg') || '#eff6ff';
        const text = option.textContent || '';
        const dot = document.getElementById('statusIndicatorDot');
        if (dot) dot.style.color = color;
        const wrapper = select.closest('.status-select-wrapper');
        if (wrapper) wrapper.style.borderColor = color;
        const badge = document.getElementById('statusBadgeDisplay');
        if (badge) {
            badge.textContent = text;
            badge.style.color = color;
            badge.style.background = bg;
            badge.style.boxShadow = `0 2px 8px ${color}10`;
            let icon = 'fa-stethoscope';
            if (select.value === 'under_treatment') icon = 'fa-clock';
            if (select.value === 'finished') icon = 'fa-check-circle';
            if (select.value === 'retreatment') icon = 'fa-redo';
            if (select.value === 'suspended') icon = 'fa-pause-circle';
            badge.innerHTML = `<i class="fas ${icon}"></i>${text}`;
        }
    }

    const statusSelect = document.getElementById('patientStatus');
    if (statusSelect) {
        statusSelect.addEventListener('change', () => {
            updateStatusSelectorUI(statusSelect);
            Autosave.trigger();
        });
        updateStatusSelectorUI(statusSelect);
    }

    enhanceDraggableSections();
    bindAllRectUploads();

    // بررسی پارامترهای آدرس (Query Parameters) برای تعامل با دشبورد خارجی
    const urlParams = new URLSearchParams(window.location.search);
    const actionParam = urlParams.get('action');
    const fileNumberParam = urlParams.get('fileNumber');

    if (actionParam === 'new') {
        resetPatientForm();
        setTimeout(() => {
            firstNameInput.focus();
            showToast('آماده برای تشکیل پرونده جدید');
        }, 300);
    } else if (fileNumberParam) {
        // بارگذاری خودکار بیمار دشبورد
        document.getElementById('fileNumber').value = fileNumberParam;
        handleFileNumberChange(true);
    }

    // حذف کامل پرونده بیمار با تایید مدیر ادمین کلینیک دکتر تهمتن
    document.getElementById('deletePatientBtn')?.addEventListener('click', async () => {
        const patientId = Autosave.currentPatientId;
        const fileNumberInput = document.getElementById('fileNumber');
        const fileNumber = fileNumberInput ? fileNumberInput.value.trim() : '';

        if (!patientId) {
            showToast('هیچ پرونده‌ای برای حذف بارگذاری نشده است');
            return;
        }

        const isConfirmed = confirm(`آیا از حذف کامل و برگشت‌ناپذیر پرونده شماره ${toPersianDigits(fileNumber)} به همراه تمامی تصاویر و مدارک آن اطمینان دارید؟`);
        if (!isConfirmed) return;

        try {
            Autosave.updateStatus('در حال حذف پرونده...', '#ef4444');
            const result = await DB.deletePatient(patientId);
            if (result.success) {
                showToast('پرونده بیمار با موفقیت حذف گردید');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showToast(result.message);
                Autosave.updateStatus('خطا در حذف', '#ef4444');
            }
        } catch (err) {
            console.error(err);
            showToast('خطا در ارتباط با سرور دیتابیس');
            Autosave.updateStatus('خطا', '#ef4444');
        }
    });

    // خروج از حساب در صفحه پرونده
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('adminLoggedIn');
        window.location.href = 'index.html';
    });
});
