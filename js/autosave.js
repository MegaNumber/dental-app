// js/autosave.js

const Autosave = {
    timeoutId: null,
    currentPatientId: null, 
    saveDelay: 1500,
    fastSaveDelay: 250,
    isSaving: false, // قفل جلوگیری از تداخل همزمانی
    pendingSaveRequested: false,
    imageSectionSignatures: new Map(),
    imageStatePatientId: null,
    contextVersion: 0,

    trigger(sourceElement, options = {}) {
        if (sourceElement && sourceElement.id === 'fileNumber') return;
        if (sourceElement && !sourceElement.isConnected) return;
        clearTimeout(this.timeoutId);
        this.updateStatus('در حال ذخیره...', '#f59e0b');
        this.timeoutId = setTimeout(() => {
            this.executeSave();
        }, options.delay ?? this.saveDelay);
    },

    triggerSoon(sourceElement) {
        this.trigger(sourceElement, { delay: this.fastSaveDelay });
    },

    async executeSave(options = {}) {
        if (this.hasPendingUploads()) {
            this.updateStatus('در انتظار پایان آپلود...', '#f59e0b');
            clearTimeout(this.timeoutId);
            this.timeoutId = setTimeout(() => this.executeSave(options), 800);
            return;
        }

        const fileNumber = document.getElementById('fileNumber').value.trim();
        if (!fileNumber) {
            this.updateStatus('نیاز به شماره پرونده', '#ef4444');
            return;
        }
        if (!this.currentPatientId && !options.allowCreate) {
            this.updateStatus('ابتدا شماره پرونده را جستجو کنید', '#f59e0b');
            return;
        }

        // اگر قبلاً در حال ذخیره است، اجازه اجرای مجدد نده
        if (this.isSaving) {
            this.pendingSaveRequested = true;
            return;
        }
        this.isSaving = true;
        this.pendingSaveRequested = false;
        const saveContextVersion = this.contextVersion;

        const patientData = {
            name: document.getElementById('patientName').value.trim(),
            file_number: fileNumber,
            mobile: document.getElementById('mobileNumber')?.value.trim() || null,
            orthodontic_start_date: document.getElementById('orthodonticStartDate')?.value.trim() || null,
            cover_url: document.getElementById('coverZone').getAttribute('data-db-url') || null,
            profile_url: document.getElementById('profilePicZone').getAttribute('data-db-url') || null,
            treatments: this.collectTreatments(),
            results: this.collectResults()
        };

        try {
            const savedPatient = await DB.savePatientInfo(patientData);
            
            if (savedPatient && savedPatient.id) {
                if (saveContextVersion === this.contextVersion) {
                    this.currentPatientId = savedPatient.id;
                    await this.syncChangedImageSections(savedPatient.id);
                    this.updateStatus('ذخیره شد ✓', '#22c55e');
                }
                return savedPatient;
            } else {
                this.updateStatus('خطا در ذخیره!', '#ef4444');
            }
        } catch (error) {
            console.error('Error in autosave:', error);
            this.updateStatus('خطا در ذخیره!', '#ef4444');
        } finally {
            // در هر صورت قفل را باز کن
            this.isSaving = false; 
            if (this.pendingSaveRequested && saveContextVersion === this.contextVersion) {
                this.trigger();
            }
        }
    },

    hasPendingUploads() {
        return Boolean(document.querySelector('[data-uploading="true"]'));
    },

    getImageUrlsInSection(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];
        
        const rects = container.querySelectorAll('.upload-rect[data-db-url]');
        return Array.from(rects).map(r => r.getAttribute('data-db-url')).filter(url => url);
    },

    getImageSectionSignature(containerId) {
        return this.getImageUrlsInSection(containerId).join('|');
    },

    primeImageSectionState(patientId = this.currentPatientId) {
        this.imageSectionSignatures.clear();
        this.imageStatePatientId = patientId || null;
        this.collectImageSections().forEach(section => {
            this.imageSectionSignatures.set(section.id, this.getImageSectionSignature(section.id));
        });
    },

    async syncChangedImageSections(patientId) {
        const patientChanged = this.imageStatePatientId !== patientId;
        const sectionsToSync = this.collectImageSections().filter(section => {
            const nextSignature = this.getImageSectionSignature(section.id);
            const previousSignature = this.imageSectionSignatures.get(section.id);
            return patientChanged || previousSignature !== nextSignature;
        });

        if (!sectionsToSync.length) {
            this.imageStatePatientId = patientId;
            return;
        }

        await Promise.all(sectionsToSync.map(async (section) => {
            try {
                const urls = this.getImageUrlsInSection(section.id);
                await DB.syncSectionImages(patientId, section.name, urls);
                this.imageSectionSignatures.set(section.id, this.getImageSectionSignature(section.id));
            } catch (err) {
                console.error(`خطا در بخش ${section.name}:`, err);
            }
        }));

        this.imageStatePatientId = patientId;
    },

    collectTreatments() {
        const notes = document.querySelectorAll('#treatmentNotes .treatment-note-text');
        return Array.from(notes)
            .map((textarea) => ({ note: textarea.value.trim() }))
            .filter((item) => item.note);
    },

    collectImageSections() {
        const sections = [
            { id: 'patientImages', name: 'patient_info' },
            { id: 'doctorImages', name: 'doctor_notes' },
            { id: 'initialImages', name: 'initial' },
            { id: 'duringImages', name: 'during' },
            { id: 'fileImages', name: 'file_image' },
            { id: 'extractImages', name: 'extract' }
        ];

        document.querySelectorAll('.custom-card[data-custom-section="true"]').forEach(card => {
            sections.push({ id: `${card.dataset.sectionKey}Images`, name: card.dataset.sectionKey });
        });
        return sections;
    },

    collectPatientMeta() {
        const customSections = Array.from(document.querySelectorAll('.custom-card[data-custom-section="true"]')).map(card => ({
            key: card.dataset.sectionKey,
            title: card.querySelector('.custom-section-title')?.value.trim() || 'کادر جدید',
            notes: Array.from(card.querySelectorAll('.custom-notes .treatment-note-text'))
                .map(textarea => textarea.value.trim())
                .filter(Boolean)
        }));

        return {
            type: 'patient_meta',
            patientStatus: document.getElementById('patientStatus')?.value || 'under_treatment',
            sectionOrder: Array.from(document.querySelectorAll('.container > .card[data-section-key]')).map(card => card.dataset.sectionKey),
            sectionTitles: Array.from(document.querySelectorAll('.container > .card[data-section-key]:not([data-custom-section="true"])')).map(card => ({
                key: card.dataset.sectionKey,
                title: card.querySelector('.section-title-text')?.textContent.trim() || ''
            })).filter(item => item.key && item.title),
            summary: document.getElementById('treatmentSummary')?.value.trim() || '',
            imageTitles: Array.from(document.querySelectorAll('.image-upload-card .upload-rect[data-db-url]')).map(rect => ({
                url: rect.getAttribute('data-db-url'),
                title: rect.closest('.image-upload-card')?.querySelector('.image-upload-card-title')?.textContent.trim() || ''
            })).filter(item => item.url),
            patientDetailRows: window.PatientDetails?.collect ? window.PatientDetails.collect() : [],
            initialNotes: Array.from(document.querySelectorAll('#initialNotes .treatment-note-text'))
                .map(textarea => textarea.value.trim())
                .filter(Boolean),
            duringNotes: Array.from(document.querySelectorAll('#duringNotes .treatment-note-text'))
                .map(textarea => textarea.value.trim())
                .filter(Boolean),
            extractNotes: Array.from(document.querySelectorAll('#extractNotes .treatment-note-text'))
                .map(textarea => textarea.value.trim())
                .filter(Boolean),
            customSections
        };
    },

    collectResults() {
        const results = window.ResultFields?.collect
            ? window.ResultFields.collect()
            : Array.from(document.querySelectorAll('[data-print-section="result"] .result-grid .field-group')).map(fg => ({
                label: fg.querySelector('label')?.textContent || 'فیلد',
                value: fg.querySelector('input')?.value || '',
                placeholder: fg.querySelector('input')?.getAttribute('placeholder') || 'وارد کنید...',
                fieldType: fg.dataset.resultType || 'text',
                key: fg.dataset.resultKey || ''
            }));
        results.push(this.collectPatientMeta());
        return results;
    },

    updateStatus(text, color) {
        const dot = document.querySelector('.nav-status .status-dot');
        const span = document.querySelector('.nav-status span');
        if(dot) {
            dot.style.background = color;
            dot.style.boxShadow = `0 0 0 4px ${color}22`;
        }
        if(span) span.textContent = text;
    },

    resetForNewPatient() {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        this.contextVersion += 1;
        this.currentPatientId = null;
        this.pendingSaveRequested = false;
        this.imageSectionSignatures.clear();
        this.imageStatePatientId = null;
    },

    async forceSave(options = {}) {
        clearTimeout(this.timeoutId);
        while(this.hasPendingUploads()) {
            this.updateStatus('در انتظار پایان آپلود...', '#f59e0b');
            await new Promise(r => setTimeout(r, 300));
        }
        // در ذخیره دستی، صبر کن تا ذخیره قبلی تمام شود
        while(this.isSaving) {
            await new Promise(r => setTimeout(r, 200));
        }
        this.updateStatus('در حال ذخیره...', '#f59e0b');
        return this.executeSave({ allowCreate: options.allowCreate !== false });
    }
};

window.Autosave = Autosave;
