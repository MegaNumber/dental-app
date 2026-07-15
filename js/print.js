// js/print.js

const PrintManager = {
    el(id) {
        return document.getElementById(id);
    },

    value(id, fallback = '') {
        return this.el(id)?.value || fallback;
    },

    checked(id, fallback = false) {
        return this.el(id)?.checked ?? fallback;
    },

    clampNumber(value, fallback, min, max) {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    },

    sanitizeColor(value, fallback) {
        const raw = String(value ?? '').trim();
        if (!raw) return fallback;
        if (/^#[0-9a-fA-F]{3}$/.test(raw) || /^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
        return fallback;
    },

    hexToRgb(hex) {
        const normalized = String(hex || '').replace('#', '');
        const full = normalized.length === 3 ? normalized.split('').map((ch) => ch + ch).join('') : normalized;
        const value = parseInt(full, 16);
        if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 };
        return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
    },

    rgbToHex({ r, g, b }) {
        return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`;
    },

    mixColor(hex, targetHex, amount = 0.5) {
        const a = this.hexToRgb(hex);
        const b = this.hexToRgb(targetHex);
        return this.rgbToHex({
            r: Math.round(a.r + (b.r - a.r) * amount),
            g: Math.round(a.g + (b.g - a.g) * amount),
            b: Math.round(a.b + (b.b - a.b) * amount)
        });
    },

    luminance(hex) {
        const { r, g, b } = this.hexToRgb(hex);
        const channels = [r, g, b].map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    },

    contrastRatio(a, b) {
        const l1 = this.luminance(a);
        const l2 = this.luminance(b);
        const high = Math.max(l1, l2);
        const low = Math.min(l1, l2);
        return (high + 0.05) / (low + 0.05);
    },

    ensureReadableColor(color, background, fallback = '#111827') {
        const candidate = this.sanitizeColor(color, fallback);
        if (this.contrastRatio(candidate, background) >= 4.5) return candidate;
        const darkened = this.mixColor(candidate, '#000000', 0.35);
        if (this.contrastRatio(darkened, background) >= 4.5) return darkened;
        const lightened = this.mixColor(candidate, '#ffffff', 0.35);
        if (this.contrastRatio(lightened, background) >= 4.5) return lightened;
        return this.contrastRatio('#111827', background) >= this.contrastRatio('#ffffff', background) ? '#111827' : '#ffffff';
    },

    settings() {
        const marginDefaults = { narrow: 8, normal: 12, wide: 18 };
        const marginPreset = this.value('printMargin', 'normal');
        return {
            stylePreset: this.value('printStylePreset', 'orthoClinical'),
            orientation: this.value('printOrientation', 'portrait'),
            paperSize: this.value('printPaperSize', 'A4'),
            marginPreset,
            pageMargin: this.clampNumber(this.value('printPageMargin', marginDefaults[marginPreset] || 12), 12, 6, 22),
            contentScale: this.clampNumber(this.value('printContentScale', '100'), 100, 85, 110) / 100,
            showImages: this.checked('printImages', true),
            showCover: this.checked('printCover', true),
            showSummary: this.checked('printSummary', true),
            showFooter: this.checked('printFooter', true),
            showPageNumbers: this.checked('printPageNumbers', true),
            autoPrint: this.checked('printAutoPrint', true),
            imageLayout: this.value('printImageLayout', 'grid2'),
            imageSize: this.value('printImageSize', 'medium'),
            imageFit: 'contain',
            imageWidth: this.clampNumber(this.value('printImageWidth', '100'), 100, 55, 100),
            imageBorderStyle: this.value('printImageBorderStyle', 'solid'),
            imageBorderWidth: this.value('printImageBorderWidth', '1px'),
            imageBorderColor: this.sanitizeColor(this.value('printImageBorderColor', '#e5e7eb'), '#e5e7eb'),
            titleFrameStyle: this.value('printTitleFrameStyle', 'filled'),
            titleBorderStyle: this.value('printTitleBorderStyle', 'solid'),
            titleBorderWidth: this.value('printTitleBorderWidth', '1px'),
            titleRadius: this.value('printTitleRadius', '6px'),
            titleBorderColor: this.sanitizeColor(this.value('printTitleBorderColor', '#e5e7eb'), '#e5e7eb'),
            titleBgColor: this.sanitizeColor(this.value('printTitleBgColor', '#f8fafc'), '#f8fafc'),
            titleTextColor: this.value('printTitleTextColor', '#111827'),
            titleIconColor: this.value('printTitleIconColor', '#2563eb'),
            titleShadow: this.value('printTitleShadow', 'none'),
            headerMode: this.value('printHeaderMode', 'full'),
            fontSize: this.clampNumber(this.value('printFontSize', '13'), 13, 11, 16),
            sectionBreak: this.value('printSectionBreak', 'avoid'),
            compact: this.checked('printCompactMode', false)
        };
    },

    initiatePrint() {
        const config = this.settings();
        const payload = this.collectPayload(config);
        const preview = window.open('', '_blank', 'width=980,height=760');
        if (!preview) {
            window.showToast('لطفاً پاپ‌آپ را در مرورگر مجاز کنید');
            return;
        }
        preview.document.write(this.buildDocument(payload, config));
        preview.document.close();
    },

    collectPayload(config) {
        const patient = {
            name: this.value('patientName', 'نام و نام خانوادگی بیمار').trim() || 'نام و نام خانوادگی بیمار',
            fileNumber: this.value('fileNumber', '---').trim() || '---',
            date: this.getJalaliStr(),
            coverUrl: this.el('coverZone')?.getAttribute('data-db-url') || '',
            profileUrl: this.el('profilePicZone')?.getAttribute('data-db-url') || '',
            resultCount: 0,
            sectionCount: 0,
            imageCount: 0
        };
        const sections = [];
        const cards = document.querySelectorAll('.container > .card[data-section-key]');

        for (const card of cards) {
            const rendered = this.renderCardSection(card, config, patient);
            if (!rendered) continue;
            sections.push(rendered.html);
            patient.resultCount += rendered.resultCount;
            patient.imageCount += rendered.imageCount;
        }

        patient.sectionCount = sections.length;
        return { patient, sectionsHtml: sections.join('') };
    },

    renderCardSection(card, config, patient) {
        const key = card.dataset.sectionKey || '';
        const blocks = [];
        let resultCount = 0;

        if (key === 'patient-info') {
            const values = [
                ['نام و نام خانوادگی', patient.name || '---'],
                ['شماره پرونده', patient.fileNumber || '---']
            ];
            const statusSelect = document.getElementById('patientStatus');
            if (statusSelect) {
                const statusText = statusSelect.options[statusSelect.selectedIndex]?.textContent || '---';
                values.push(['وضعیت بیمار', statusText]);
            }
            for (const field of card.querySelectorAll('.patient-detail-field')) {
                const value = field.querySelector('input')?.value.trim() || '';
                if (!value) continue;
                values.push([field.querySelector('label')?.textContent.trim() || 'فیلد', value]);
            }
            if (values.some(([, value]) => value && value !== '---')) {
                blocks.push(this.wrapContentBlock('اطلاعات بیمار', this.renderKeyValues(values), 'data-block'));
            }
        }

        if (key === 'result') {
            const values = [];
            for (const field of card.querySelectorAll('.result-grid .field-group')) {
                const value = field.querySelector('input')?.value.trim() || '';
                if (!value) continue;
                values.push([field.querySelector('label')?.textContent.trim() || 'فیلد', value]);
            }
            resultCount = values.length;
            if (values.length) {
                blocks.push(this.wrapContentBlock('نتایج ثبت‌شده', this.renderKeyValues(values), 'data-block'));
            }
        }

        const notes = this.collectNotes(card);
        const images = config.showImages ? this.collectImagesFromCard(card) : [];

        if (images.length) {
            blocks.push(this.wrapContentBlock('تصاویر بخش', this.renderImages(images, config), 'image-block'));
        }
        if (notes.length) {
            blocks.push(this.wrapContentBlock('توضیحات', this.renderNotes(notes), 'note-block'));
        }
        if (!blocks.length) return null;

        return {
            html: this.renderSection(this.getSectionTitle(card), this.getSectionIcon(card), blocks.join(''), config),
            resultCount,
            imageCount: images.length
        };
    },

    getSectionTitle(card) {
        const customTitle = card.querySelector('.custom-section-title')?.value.trim();
        if (customTitle) return customTitle;
        const clone = card.querySelector('.card-title')?.cloneNode(true);
        if (!clone) return 'بخش';
        clone.querySelectorAll('button,input').forEach((node) => node.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim() || 'بخش';
    },

    getSectionIcon(card) {
        const className = card.querySelector('.card-title > i')?.className || '';
        return className.match(/fa-([a-z0-9-]+)/)?.[1] || 'folder';
    },

    collectNotes(card) {
        const notes = [];
        for (const textarea of card.querySelectorAll('.treatment-note-text')) {
            const note = textarea.value.trim();
            if (note) notes.push(note);
        }
        return notes;
    },

    collectImagesFromCard(card) {
        const images = [];
        let index = 0;
        for (const rect of card.querySelectorAll('.upload-rect')) {
            const src = this.getImageSrc(rect);
            if (!src) {
                index += 1;
                continue;
            }
            images.push({
                src,
                title: this.cleanImageTitle(
                    rect.closest('.image-upload-card')?.querySelector('.image-upload-card-title')?.textContent.trim()
                    || rect.closest('.image-upload-card')?.querySelector('.image-upload-card-header')?.textContent.trim(),
                    index
                )
            });
            index += 1;
        }
        return images;
    },

    cleanImageTitle(title) {
        return String(title || '').replace(/تصویر بارگذاری شده/g, '').replace(/\s+/g, ' ').trim();
    },

    getImageSrc(rect) {
        const dbUrl = rect.getAttribute('data-db-url');
        if (dbUrl) return dbUrl;
        const bg = rect.style.backgroundImage || '';
        return bg ? bg.replace(/url\(["']?|["']?\)/gi, '') : '';
    },

    renderKeyValues(items) {
        return `<div class="kv-grid">${items.map(([label, value]) => `
            <div class="kv-item">
                <div class="kv-label">${this.escape(label)}</div>
                <div class="kv-value">${this.escape(value)}</div>
            </div>
        `).join('')}</div>`;
    },

    wrapContentBlock(label, html, className = '') {
        return `
            <div class="content-block ${className}">
                <div class="content-block-label">${this.escape(label)}</div>
                <div class="content-block-body">${html}</div>
            </div>
        `;
    },

    renderImages(images, config) {
        return `<div class="image-grid image-layout-${config.imageLayout}" style="--print-image-width:${config.imageWidth}%;">${images.map((image) => `
            <figure class="print-image">
                <div class="image-box">
                    <img src="${this.escapeAttr(image.src)}" alt="${this.escapeAttr(image.title)}">
                </div>
                ${image.title ? `<figcaption>${this.escape(image.title)}</figcaption>` : ''}
            </figure>
        `).join('')}</div>`;
    },

    renderNotes(notes) {
        return `<div class="notes-list">${notes.map((note, index) => `
            <div class="note-item">
                <div class="note-title">توضیحات ${index + 1}</div>
                <div class="note-text">${this.escape(note)}</div>
            </div>
        `).join('')}</div>`;
    },

    renderSection(title, icon, content, config) {
        const breakClass = config.sectionBreak === 'each' ? 'section-break' : config.sectionBreak === 'avoid' ? 'section-avoid' : '';
        return `
            <section class="print-section ${breakClass} template-${this.escapeAttr(config.stylePreset)}">
                <header class="section-header">
                    <span class="section-badge"><i class="fas fa-${this.escapeAttr(icon)}"></i></span>
                    <div class="section-heading-copy">
                        <h2>${this.escape(title)}</h2>
                        <span class="section-subtitle">${this.sectionSubtitle(config.stylePreset)}</span>
                    </div>
                </header>
                <div class="section-body">${content}</div>
            </section>
        `;
    },

    titleThemeVars(config) {
        const bg = config.titleFrameStyle === 'minimal' ? 'transparent' : config.titleBgColor;
        const contrastBg = bg === 'transparent' ? '#ffffff' : bg;
        const border = config.titleBorderStyle === 'none'
            ? 'transparent'
            : config.titleBorderColor;
        const text = this.ensureReadableColor(config.titleTextColor, contrastBg);
        const icon = this.ensureReadableColor(config.titleIconColor, contrastBg, '#2563eb');
        const badgeBg = config.titleFrameStyle === 'filled'
            ? 'rgba(255,255,255,.85)'
            : this.mixColor(border, '#ffffff', 0.85);
        return {
            '--print-title-bg': bg,
            '--print-title-border-color': border,
            '--print-title-border-style': config.titleBorderStyle,
            '--print-title-border-width': config.titleBorderWidth,
            '--print-title-radius': config.titleRadius,
            '--print-title-text': text,
            '--print-title-icon': icon,
            '--print-title-badge-bg': badgeBg,
            '--print-title-shadow': {
                none: 'none',
                soft: '0 2px 8px rgba(15,23,42,.08)',
                deep: '0 6px 16px rgba(15,23,42,.14)'
            }[config.titleShadow] || 'none'
        };
    },

    styleAttr(vars) {
        return Object.entries(vars).map(([key, value]) => `${key}:${value}`).join(';');
    },

    sectionSubtitle(stylePreset) {
        if (stylePreset === 'beforeAfterPortfolio') return 'نمایش تصویری و مستندات درمان';
        if (stylePreset === 'minimalSummary') return 'خلاصه ثبت شده';
        if (stylePreset === 'clinicLetterhead') return 'گزارش رسمی کلینیک';
        if (stylePreset === 'editorialLuxury') return 'گزارش پورتفولیو دندانپزشکی زیبایی لوکس';
        if (stylePreset === 'nordicMinimal') return 'خلاصه بالینی به سبک مینیمال نوردیک';
        if (stylePreset === 'techGrid') return 'داشبورد مهندسی و بالینی بیمار';
        return 'گزارش بالینی بیمار';
    },

    buildDocument(payload, config) {
        const { patient, sectionsHtml } = payload;
        const footerHtml = config.showFooter ? `
            <footer class="print-footer">
                <span>این سند به صورت خودکار از سیستم پرونده بیمار تولید شده است.</span>
                ${config.showPageNumbers ? '<span class="page-number">صفحه <span class="page-current"></span></span>' : ''}
            </footer>
        ` : '';

        return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${this.escape(patient.fileNumber !== '---' ? patient.fileNumber : 'پرونده بیمار')}</title>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>${this.buildCss(config)}</style>
</head>
<body class="template-${this.escapeAttr(config.stylePreset)}">
    <div class="print-toolbar" role="toolbar" aria-label="ابزار چاپ">
        <div class="toolbar-meta">
            <strong>${this.escape(this.templateTitle(config.stylePreset))}</strong>
            <span>پرونده: ${this.escape(patient.fileNumber)}</span>
        </div>
        <div class="toolbar-actions">
            <button id="printNowBtn" type="button" onclick="if(window.doPrint){window.doPrint();}else{window.print();}">چاپ</button>
            <button id="closePreviewBtn" type="button" onclick="window.close();">بستن</button>
        </div>
    </div>
    <div class="print-ready-indicator" id="printReadyIndicator">در حال آماده‌سازی پیش‌نمایش...</div>
    <div class="print-page" style="${this.escapeAttr(this.styleAttr(this.titleThemeVars(config)))}">
        ${this.renderHeader(patient, config)}
        ${this.renderSummaryStrip(patient, config)}
        <main class="print-document">${sectionsHtml}</main>
        ${footerHtml}
    </div>
    <script>${this.previewScript(config.autoPrint)}<\/script>
</body>
</html>`;
    },

    templateTitle(stylePreset) {
        if (stylePreset === 'beforeAfterPortfolio') return 'قالب چاپ قبل/بعد';
        if (stylePreset === 'minimalSummary') return 'قالب چاپ خلاصه';
        if (stylePreset === 'clinicLetterhead') return 'قالب رسمی کلینیک';
        if (stylePreset === 'editorialLuxury') return 'قالب پورتفولیو لوکس ژورنالی';
        if (stylePreset === 'nordicMinimal') return 'قالب مینیمال اسکاندیناوی';
        if (stylePreset === 'techGrid') return 'قالب داشبورد مدرن تکنولوژی';
        return 'قالب چاپ کلینیکی';
    },

    renderSummaryStrip(patient, config) {
        if (!config.showSummary || (config.headerMode === 'none' && config.stylePreset === 'minimalSummary')) return '';
        const items = [
            ['تاریخ چاپ', patient.date],
            ['تعداد بخش‌ها', String(patient.sectionCount || 0)],
            ['تصاویر ثبت‌شده', String(patient.imageCount || 0)],
            ['فیلدهای نتیجه', String(patient.resultCount || 0)]
        ];
        return `
            <section class="summary-strip template-${this.escapeAttr(config.stylePreset)}">
                ${items.map(([label, value]) => `
                    <div class="summary-chip">
                        <span class="summary-label">${this.escape(label)}</span>
                        <strong class="summary-value">${this.escape(value)}</strong>
                    </div>
                `).join('')}
            </section>
        `;
    },

    renderHeader(patient, config) {
        if (config.headerMode === 'none') return '';
        if (config.headerMode === 'compact') {
            return `
                <header class="doc-header compact-header">
                    <div>
                        <strong>${this.escape(patient.name)}</strong>
                        <span>پرونده: ${this.escape(patient.fileNumber)}</span>
                    </div>
                    <time>${this.escape(patient.date)}</time>
                </header>
            `;
        }

        const cover = config.showCover && patient.coverUrl
            ? `<img class="cover-img" src="${this.escapeAttr(patient.coverUrl)}" alt="cover">`
            : '<div class="cover-fallback"></div>';
        const profile = patient.profileUrl
            ? `<img src="${this.escapeAttr(patient.profileUrl)}" alt="profile">`
            : '<i class="fas fa-user"></i>';

        return `
            <header class="doc-header full-header">
                <div class="cover-wrap">${cover}</div>
                <div class="identity-row">
                    <div class="profile-img">${profile}</div>
                    <div class="identity-text">
                        <h1>${this.escape(patient.name)}</h1>
                        <div>شماره پرونده: <strong>${this.escape(patient.fileNumber)}</strong></div>
                    </div>
                    <time>${this.escape(patient.date)}</time>
                </div>
            </header>
        `;
    },

    previewScript(autoPrint) {
        return `(function(){
var ready=document.getElementById('printReadyIndicator');
var printing=false;
var shouldAutoPrint=${autoPrint ? 'true' : 'false'};
function setReady(message,isReady){
  if(ready){
    ready.textContent=message;
    ready.classList.toggle('ready',!!isReady);
  }
}
function doPrint(){
  if(printing)return;
  printing=true;
  setReady('در حال ارسال به چاپگر...',false);
  setTimeout(function(){
    try {
      window.print();
    } catch(e) {
      console.error(e);
    }
    setTimeout(function(){
      printing=false;
      setReady('پیش‌نمایش آماده است',true);
    }, 1500);
  },120);
}
window.doPrint = doPrint;
function finalize(message){
  setReady(message,true);
  if(shouldAutoPrint)setTimeout(doPrint,260);
}
function waitForImages(){
  var imgs=Array.prototype.slice.call(document.images||[]);
  if(!imgs.length)return finalize('پیش‌نمایش آماده است');
  var done=0,total=imgs.length,finished=false;
  function markDone(){
    done+=1;
    if(done>=total&&!finished){
      finished=true;
      finalize('پیش‌نمایش آماده است');
    }
  }
  imgs.forEach(function(img){
    if(img.complete)return markDone();
    img.addEventListener('load',markDone,{once:true});
    img.addEventListener('error',markDone,{once:true});
  });
  setTimeout(function(){
    if(finished)return;
    finished=true;
    finalize('پیش‌نمایش آماده است (برخی تصاویر ممکن است کامل نباشند)');
  },2800);
}
window.addEventListener('afterprint',function(){
  printing=false;
  setReady('پیش‌نمایش آماده است',true);
});
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){
    e.preventDefault();
    doPrint();
  }
  if(e.key==='Escape')window.close();
});
waitForImages();
})();`;
    },

    buildCss(config) {
        const scale = config.contentScale;
        const compact = config.compact;
        const scaled = (value) => `${Math.round(value * scale * 100) / 100}px`;
        const textSm = Math.max(config.fontSize - 2, 10);
        const textXs = Math.max(config.fontSize - 3, 9);
        const imageBase = { small: 120, medium: 180, large: 260 }[config.imageSize] || 180;
        const imageHeight = compact ? imageBase - 28 : imageBase;
        const pageWidth = config.orientation === 'landscape' ? 1280 : 980;
        return `
@page { size:${config.paperSize} ${config.orientation}; margin:${config.pageMargin}mm; }
* { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body {
    margin:0;
    font-family:"Vazirmatn",sans-serif;
    color:#0f172a;
    background:linear-gradient(180deg,#f8fbff 0%,#ffffff 40%);
    line-height:${compact ? 1.5 : 1.72};
    font-size:${scaled(config.fontSize)};
}
.print-toolbar{
    position:sticky;
    top:0;
    z-index:20;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:${scaled(12)};
    padding:${scaled(10)} ${scaled(14)};
    background:rgba(255,255,255,.92);
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
    border-bottom:1px solid #e5e7eb;
}
.toolbar-meta{
    display:flex;
    align-items:center;
    gap:${scaled(10)};
    color:#4b5563;
    font-size:${scaled(textSm)};
}
.toolbar-meta strong{ color:#0f172a; font-size:${scaled(config.fontSize)}; }
.toolbar-actions{ display:flex; align-items:center; gap:${scaled(8)}; }
.toolbar-actions button{
    border:1px solid #cbd5e1;
    background:#fff;
    color:#334155;
    border-radius:${scaled(8)};
    padding:${scaled(6)} ${scaled(12)};
    font:700 ${scaled(textSm)} "Vazirmatn",sans-serif;
    cursor:pointer;
}
.toolbar-actions #printNowBtn{ border-color:#2563eb; color:#fff; background:#2563eb; }
.toolbar-actions button:hover{ filter:brightness(.97); }
.print-ready-indicator{
    margin:${scaled(8)} ${scaled(12)} 0;
    padding:${scaled(7)} ${scaled(10)};
    border-radius:${scaled(8)};
    background:#eff6ff;
    color:#1d4ed8;
    border:1px solid #bfdbfe;
    font-size:${scaled(textSm)};
    font-weight:600;
}
.print-ready-indicator.ready{ background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
.print-page{
    padding:${scaled(10)} ${scaled(12)} ${scaled(12)};
    max-width:${scaled(pageWidth)};
    margin:0 auto;
}
.doc-header{ break-inside:avoid; page-break-inside:avoid; margin-bottom:${scaled(compact ? 8 : 12)}; }
.compact-header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    border:1px solid #dbe7fb;
    border-right:${scaled(4)} solid #2563eb;
    border-radius:${scaled(12)};
    background:linear-gradient(135deg,#f9fbff 0%,#eef4ff 100%);
    padding:${scaled(8)} ${scaled(10)};
    color:#334155;
}
.compact-header div{ display:flex; gap:${scaled(10)}; align-items:center; }
.compact-header span,.compact-header time{ color:#64748b; font-size:${scaled(textSm)}; }
.full-header{
    border:1px solid #dbe7fb;
    border-radius:${scaled(14)};
    overflow:hidden;
    background:#fff;
    box-shadow:0 8px 22px rgba(37,99,235,.08);
}
.cover-wrap{
    height:${scaled(compact ? 82 : 134)};
    overflow:hidden;
    background:#dbeafe;
    position:relative;
}
.cover-img{ width:100%; height:100%; object-fit:contain; display:block; background:#dbeafe; }
.cover-wrap::after{
    content:"Orthodontic Clinical Report";
    position:absolute;
    left:${scaled(14)};
    bottom:${scaled(10)};
    font-size:${scaled(10)};
    letter-spacing:.08em;
    color:rgba(255,255,255,.9);
    font-weight:700;
    text-transform:uppercase;
}
.cover-fallback{ width:100%; height:100%; background:linear-gradient(135deg,#1d4ed8,#2563eb,#60a5fa); }
.identity-row{
    display:flex;
    align-items:flex-end;
    gap:${scaled(14)};
    padding:0 ${scaled(14)} ${scaled(12)};
    margin-top:${scaled(-38)};
    position:relative;
}
.profile-img{
    width:${scaled(compact ? 64 : 78)};
    height:${scaled(compact ? 64 : 78)};
    border-radius:50%;
    border:${scaled(3)} solid #fff;
    background:#fff;
    overflow:hidden;
    box-shadow:0 6px 16px rgba(37,99,235,.18);
    display:flex;
    align-items:center;
    justify-content:center;
    color:#2563eb;
    flex-shrink:0;
}
.profile-img img{ width:100%; height:100%; object-fit:contain; display:block; background:#fff; }
.identity-text{ flex:1; }
.identity-text h1{
    margin:${scaled(6)} 0 ${scaled(8)};
    font-size:${scaled(compact ? 16 : 22)};
    color:#1e3a8a;
    font-weight:800;
    position:relative;
    display:inline-block;
    padding-bottom:${scaled(5)};
}
.identity-text h1::after{
    content:"";
    position:absolute;
    bottom:0;
    right:0;
    width:${scaled(45)};
    height:${scaled(3)};
    background:linear-gradient(90deg,#2563eb,rgba(37,99,235,0.15));
    border-radius:${scaled(2)};
}
.identity-text div{ color:#64748b; font-size:${scaled(Math.max(config.fontSize - 1, 11))}; }
.identity-text strong{ color:#2563eb; }
.identity-row time{ color:#6b7280; font-size:${scaled(textSm)}; padding-bottom:${scaled(3)}; }
.summary-strip{
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:${scaled(8)};
    margin:0 0 ${scaled(compact ? 10 : 14)};
}
.summary-chip{
    border:1px solid #dbe7fb;
    border-radius:${scaled(12)};
    padding:${scaled(compact ? 7 : 10)} ${scaled(compact ? 9 : 12)};
    background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);
    display:flex;
    flex-direction:column;
    gap:${scaled(3)};
    min-height:${scaled(56)};
}
.summary-label{ color:#64748b; font-size:${scaled(textXs)}; font-weight:700; }
.summary-value{ color:#0f172a; font-size:${scaled(config.fontSize)}; font-weight:800; }
.print-section{
    border:1px solid #dbe7fb;
    border-radius:${scaled(12)};
    overflow:hidden;
    margin-bottom:${scaled(compact ? 9 : 13)};
    background:linear-gradient(180deg,#ffffff 0%,#fcfdff 100%);
    box-shadow:0 4px 14px rgba(15,23,42,.05);
}
.section-avoid{ break-inside:avoid; page-break-inside:avoid; }
.section-break{ break-before:page; page-break-before:always; }
.print-section:first-child.section-break{ break-before:auto; page-break-before:auto; }
.section-header{
    display:flex;
    align-items:center;
    gap:${scaled(8)};
    background:var(--print-title-bg);
    border:${config.titleFrameStyle === 'minimal' ? '0' : 'var(--print-title-border-width) var(--print-title-border-style) var(--print-title-border-color)'};
    border-right:${config.titleFrameStyle === 'accent' ? `5px solid var(--print-title-border-color)` : '0'};
    padding:${scaled(compact ? 7 : 9)} ${scaled(compact ? 10 : 12)};
    margin:${config.titleFrameStyle === 'minimal' ? '0' : `${scaled(compact ? 6 : 8)} ${scaled(compact ? 6 : 8)} 0`};
    border-radius:${config.titleFrameStyle === 'minimal' ? '0' : 'var(--print-title-radius)'};
    box-shadow:var(--print-title-shadow);
}
.section-badge{
    width:${scaled(26)};
    height:${scaled(26)};
    border-radius:${scaled(8)};
    display:flex;
    align-items:center;
    justify-content:center;
    background:var(--print-title-badge-bg);
    color:var(--print-title-icon);
    font-size:${scaled(12)};
    border:1px solid rgba(148,163,184,.3);
    flex-shrink:0;
}
.section-heading-copy{ display:flex; flex-direction:column; gap:${scaled(2)}; min-width:0; flex:1; }
.section-header h2{ margin:0; font-size:${scaled(config.fontSize + 1)}; font-weight:800; color:var(--print-title-text); }
.section-subtitle{ color:#64748b; font-size:${scaled(textXs)}; font-weight:700; }
.section-body{ padding:${scaled(compact ? 9 : 12)}; display:grid; gap:${scaled(compact ? 9 : 12)}; }
.content-block{
    border:1px solid #e6edf8;
    border-radius:${scaled(10)};
    background:linear-gradient(180deg,#ffffff 0%,#f9fbff 100%);
    padding:${scaled(compact ? 8 : 10)};
}
.content-block-label{
    margin-bottom:${scaled(compact ? 6 : 8)};
    padding-bottom:${scaled(5)};
    border-bottom:1px dashed #d7e3f4;
    color:#334155;
    font-size:${scaled(textSm)};
    font-weight:800;
}
.content-block-body{ min-width:0; }
.kv-grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:${scaled(compact ? 7 : 10)}; }
.kv-item{
    border:1px solid #eaf0fb;
    border-radius:${scaled(9)};
    padding:${scaled(7)} ${scaled(9)};
    background:#fbfdff;
}
.kv-label{ color:#64748b; font-size:${scaled(textSm)}; font-weight:700; margin-bottom:${scaled(2)}; }
.kv-value{ color:#0f172a; font-size:${scaled(config.fontSize)}; font-weight:600; }
.image-grid{ display:grid; gap:${scaled(compact ? 7 : 10)}; }
.image-layout-grid1{ grid-template-columns:1fr; }
.image-layout-grid2{ grid-template-columns:repeat(2,minmax(0,1fr)); }
.image-layout-grid3,.image-layout-compact{ grid-template-columns:repeat(3,minmax(0,1fr)); }
.print-image{
    margin:0;
    width:min(100%,var(--print-image-width,100%));
    justify-self:center;
    border:${config.imageBorderStyle === 'none' ? '0' : `${config.imageBorderWidth} ${config.imageBorderStyle} ${config.imageBorderColor}`};
    border-radius:${scaled(10)};
    background:#fff;
    break-inside:avoid;
    page-break-inside:avoid;
    box-shadow:0 4px 12px rgba(15,23,42,.06);
    overflow:hidden;
}
.image-box{
    width:100%;
    height:${scaled(imageHeight)};
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    background:linear-gradient(180deg,#f8fbff 0%,#f1f6ff 100%);
}
.image-box img{
    width:100%;
    height:100%;
    max-width:100%;
    max-height:100%;
    object-fit:contain;
    display:block;
    margin:0;
    background:#fff;
}
figcaption{
    padding:${scaled(6)} ${scaled(8)};
    background:#f7faff;
    border-top:${config.imageBorderStyle === 'none' ? '0' : `${config.imageBorderWidth} ${config.imageBorderStyle} ${config.imageBorderColor}`};
    color:#475569;
    font-size:${scaled(textXs)};
    font-weight:700;
}
.notes-list{ display:grid; gap:${scaled(compact ? 6 : 8)}; }
.note-item{
    border:1px solid #dbe7fb;
    border-radius:${scaled(10)};
    background:linear-gradient(180deg,#f9fbff 0%,#f4f8ff 100%);
    padding:${scaled(compact ? 7 : 9)} ${scaled(compact ? 9 : 11)};
    break-inside:avoid;
    page-break-inside:avoid;
}
.note-title{
    color:#1d4ed8;
    font-size:${scaled(textSm)};
    font-weight:800;
    margin-bottom:${scaled(4)};
    display:flex;
    align-items:center;
    gap:${scaled(6)};
}
.note-title::before{
    content:"";
    width:${scaled(6)};
    height:${scaled(6)};
    border-radius:50%;
    background:#2563eb;
    display:inline-block;
}
.note-text{ white-space:pre-wrap; color:#1e293b; font-size:${scaled(config.fontSize)}; }
.print-footer{
    margin-top:${scaled(12)};
    padding-top:${scaled(9)};
    border-top:1px solid #dbe7fb;
    color:#64748b;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:${scaled(10)};
    font-size:${scaled(10.5)};
    font-weight:600;
}
.page-current::after{ content:counter(page); }
.template-beforeAfterPortfolio .section-header{ background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%); }
.template-beforeAfterPortfolio .print-image{ border-radius:${scaled(12)}; box-shadow:0 8px 18px rgba(15,23,42,.08); }
.summary-strip.template-beforeAfterPortfolio .summary-chip{ background:linear-gradient(135deg,#f8fbff 0%,#eef4ff 100%); }
.template-minimalSummary.print-section{ border-color:#e5e7eb; box-shadow:none; background:#fff; }
.template-minimalSummary .section-header{ margin:0; padding:${scaled(compact ? 6 : 8)} 0 ${scaled(compact ? 8 : 10)}; }
.template-minimalSummary .section-badge{
    width:${scaled(22)};
    height:${scaled(22)};
    border-radius:${scaled(6)};
    background:#f3f4f6;
    border-color:#e5e7eb;
}
.summary-strip.template-minimalSummary .summary-chip{ border-color:#e5e7eb; background:#fff; border-radius:${scaled(10)}; }
body.template-clinicLetterhead .full-header{ border-color:#cbd5e1; box-shadow:none; }
body.template-clinicLetterhead .cover-wrap::after{ content:"Clinic Print Template"; }
.summary-strip.template-clinicLetterhead .summary-chip{
    border-color:#cbd5e1;
    background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
}
.template-clinicLetterhead .section-header{ background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%); }
body.template-minimalSummary{ background:#fff; }

/* --- Editorial Luxury Template (پورتفولیو لوکس ژورنالی) --- */
body.template-editorialLuxury {
    background: #fffdf9;
}
.template-editorialLuxury.print-section {
    border: none;
    border-bottom: 2px solid #c5a880; /* Elegant gold/bronze accent line */
    background: #ffffff;
    box-shadow: none;
    padding-bottom: ${scaled(18)};
    margin-bottom: ${scaled(20)};
    border-radius: 0;
}
.template-editorialLuxury .section-header {
    background: transparent;
    border-bottom: 1px dashed #e2e8f0;
    padding-bottom: ${scaled(6)};
    margin-bottom: ${scaled(14)};
}
.template-editorialLuxury .section-badge {
    background: #faf6f0;
    border: 1px solid #c5a880;
    color: #a17a4c;
    border-radius: 50%;
}
.template-editorialLuxury .print-image {
    border-radius: ${scaled(4)};
    border: 1.5px solid #dcd1be; /* Elegant bronze frame */
    padding: ${scaled(4)};
    background: #fff;
    box-shadow: 0 4px 14px rgba(165,130,90,.08);
}
.summary-strip.template-editorialLuxury {
    border: 1.5px solid #c5a880;
    background: linear-gradient(135deg, #faf6f0 0%, #ffffff 100%);
    padding: ${scaled(6)};
    border-radius: ${scaled(8)};
}
.summary-strip.template-editorialLuxury .summary-chip {
    border-left: 2px solid #c5a880;
    border-right: none;
    background: transparent;
}

/* --- Nordic Minimal Template (مینیمال اسکاندیناوی) --- */
body.template-nordicMinimal {
    background: #ffffff;
}
.template-nordicMinimal.print-section {
    border: none;
    border-bottom: 1px solid #cbd5e1;
    box-shadow: none;
    background: transparent;
    padding: ${scaled(12)} 0;
    margin-bottom: ${scaled(12)};
    border-radius: 0;
}
.template-nordicMinimal .section-header {
    background: transparent;
    margin: 0 0 ${scaled(8)} 0;
    padding: 0;
}
.template-nordicMinimal .section-badge {
    width: ${scaled(18)};
    height: ${scaled(18)};
    background: transparent;
    border: none;
    color: #64748b;
    box-shadow: none;
}
.template-nordicMinimal .print-image {
    border-radius: 0;
    border: 1px solid #e2e8f0;
    box-shadow: none;
}
.summary-strip.template-nordicMinimal {
    border: none;
    border-bottom: 1.5px solid #94a3b8;
    background: transparent;
    padding: 0 0 ${scaled(8)} 0;
    margin-bottom: ${scaled(14)};
}
.summary-strip.template-nordicMinimal .summary-chip {
    border: none;
    background: #f1f5f9;
    border-radius: ${scaled(4)};
}

/* --- Tech Grid Template (داشبورد مدرن تکنولوژی) --- */
body.template-techGrid {
    background: #f8fafc;
}
.template-techGrid.print-section {
    border: 1.5px solid #e2e8f0;
    border-right: 5px solid #0f766e; /* RTL left border line (actually right in RTL) */
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(15,23,42,.03);
    border-radius: ${scaled(12)};
    padding: ${scaled(16)};
    margin-bottom: ${scaled(18)};
}
.template-techGrid .section-header {
    background: #f0fdfa;
    border-bottom: 1px solid #ccfbf1;
    border-radius: ${scaled(8)};
    padding: ${scaled(6)} ${scaled(10)};
    margin-bottom: ${scaled(12)};
}
.template-techGrid .section-badge {
    background: #0f766e;
    color: #ffffff;
    border: none;
    border-radius: ${scaled(6)};
}
.template-techGrid .print-image {
    border-radius: ${scaled(8)};
    border: 1.5px solid #0d9488;
    box-shadow: 0 4px 10px rgba(13,148,136,.06);
}
.summary-strip.template-techGrid {
    gap: ${scaled(8)};
}
.summary-strip.template-techGrid .summary-chip {
    border: 1px solid #ccfbf1;
    background: #ffffff;
    border-radius: ${scaled(8)};
    box-shadow: 0 2px 6px rgba(15,23,42,.02);
}
@media (max-width:860px) {
    .summary-strip{ grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media print {
    .print-toolbar,.print-ready-indicator{ display:none !important; }
    .print-page{ padding:0; }
    body{ background:#fff; }
    .print-section{ box-shadow:none; }
    a{ color:inherit; text-decoration:none; }
}
`;
    },

    escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    },

    escapeAttr(value) {
        return this.escape(value).replace(/`/g, '&#96;');
    },

    toJalali(gy, gm, gd) {
        let days;
        const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        const gy2 = gm > 2 ? gy + 1 : gy;
        days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
        let jy = -1595 + (33 * Math.floor(days / 12053));
        days %= 12053;
        jy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            jy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        if (days < 186) return [jy, 1 + Math.floor(days / 31), 1 + (days % 31)];
        return [jy, 7 + Math.floor((days - 186) / 30), 1 + ((days - 186) % 30)];
    },

    getJalaliStr() {
        const now = new Date();
        const [jy, jm, jd] = this.toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    }
};

window.PrintManager = PrintManager;
