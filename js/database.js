// js/database.js

const STORAGE_BUCKET = 'patient-bucket'; 

function sanitizePathPart(value, fallback = 'file') {
    const cleaned = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9\u0600-\u06FF._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return cleaned || fallback;
}

function getFileExtension(fileName) {
    const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : 'jpg';
}

const DB = {
    
    // === سیستم مدیریت کاربران و تنظیمات سوپابیس (جدید ۲۰۲۶) ===
    
    async hashPassword(password) {
        try {
            const msgBuffer = new TextEncoder().encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (err) {
            console.error('خطا در هش کردن رمز:', err);
            return password; // بازگشت رمز خام به عنوان فال‌بک
        }
    },

    // تابع فوق‌العاده مدرن برای احراز هویت فرمت PBKDF2-SHA256 در مرورگر
    async verifyPbkdf2(password, storedHash) {
        try {
            const parts = storedHash.split('$');
            if (parts.length !== 4) return false;
            
            const iterations = parseInt(parts[1], 10);
            const saltB64 = parts[2];
            const derivedKeyB64 = parts[3];

            // تبدیل نمک Base64 به باینری
            const saltBuf = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
            
            // ایمپورت پسورد به عنوان متد خام در Web Crypto
            const passwordBuf = new TextEncoder().encode(password);
            const baseKey = await crypto.subtle.importKey(
                'raw',
                passwordBuf,
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );

            // استخراج بیت‌های کلید مشتق شده با الگوریتم PBKDF2-SHA256
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuf,
                    iterations: iterations,
                    hash: 'SHA-256'
                },
                baseKey,
                256 // ۳۲ بایت برابر ۲۵۶ بیت
            );

            // تبدیل به Base64 برای مقایسه مستقیم
            const derivedKeyBuf = new Uint8Array(derivedBits);
            const binaryString = String.fromCharCode.apply(null, derivedKeyBuf);
            const calculatedB64 = btoa(binaryString);

            return calculatedB64 === derivedKeyB64;
        } catch (err) {
            console.error('خطا در احراز هویت PBKDF2:', err);
            return false;
        }
    },

    async ensureAdminUser() {
        try {
            const adminPhone = '09337593737';
            const adminPassRaw = 'M@hdi8261';
            const passwordHash = await this.hashPassword(adminPassRaw);

            // بررسی وجود ادمین
            const { data, error } = await window.supabase
                .from('app_users')
                .select('*')
                .eq('phone', adminPhone)
                .maybeSingle();

            if (error) {
                console.warn('تلاش برای بررسی ادمین در دیتابیس:', error.message);
                return;
            }

            if (!data) {
                // ثبت کاربر ادمین اصلی
                const { error: insertError } = await window.supabase
                    .from('app_users')
                    .insert([{
                        phone: adminPhone,
                        password_hash: passwordHash,
                        role: 'admin',
                        created_by: 'system'
                    }]);
                if (insertError) throw insertError;
                console.log('ادمین اصلی با موفقیت در دیتابیس سوپابیس ایجاد شد.');
            }
        } catch (err) {
            console.error('خطا در راه‌اندازی ادمین اصلی:', err.message);
        }
    },

    async loginUser(phone, password) {
        try {
            const { data: user, error } = await window.supabase
                .from('app_users')
                .select('*')
                .eq('phone', phone)
                .maybeSingle();

            if (error) throw error;

            if (!user) {
                // اگر کاربر ادمین اول است و دیتابیس خالی است، ادمین را ایجاد و مجدد ورود کن
                if (phone === '09337593737' && password === 'M@hdi8261') {
                    await this.ensureAdminUser();
                    // مجدداً تلاش برای دریافت اطلاعات کاربر
                    const { data: retryUser, error: retryErr } = await window.supabase
                        .from('app_users')
                        .select('*')
                        .eq('phone', phone)
                        .maybeSingle();
                    if (retryErr) throw retryErr;
                    if (retryUser) {
                        return { success: true, user: retryUser };
                    }
                }
                return { success: false, message: 'کاربری با این شماره تماس یافت نشد.' };
            }

            // بررسی پسورد با انواع مکانیزم‌ها
            let isMatch = false;

            // ۱. بررسی با هش PBKDF2-SHA256 (اگر پسورد ذخیره شده این فرمت را دارد)
            if (user.password_hash.startsWith('pbkdf2-sha256$') || user.password_hash.includes('$')) {
                isMatch = await this.verifyPbkdf2(password, user.password_hash);
            } else {
                // ۲. بررسی با هش ساده SHA-256 یا متن خام (به عنوان فال‌بک)
                const enteredHash = await this.hashPassword(password);
                isMatch = (user.password_hash === enteredHash || user.password_hash === password);
            }

            if (isMatch) {
                return { success: true, user };
            } else {
                return { success: false, message: 'کلمه عبور وارد شده اشتباه است.' };
            }
        } catch (err) {
            console.error('خطا در ورود کاربر:', err.message);
            return { success: false, message: 'خطا در اتصال به شبکه یا پایگاه داده.' };
        }
    },

    async getUsers() {
        try {
            const { data, error } = await window.supabase
                .from('app_users')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('خطا در دریافت کاربران:', err.message);
            return [];
        }
    },

    async createUser(phone, password, role = 'staff', createdBy = '') {
        try {
            const passwordHash = await this.hashPassword(password);
            const { data, error } = await window.supabase
                .from('app_users')
                .insert([{
                    phone,
                    password_hash: passwordHash,
                    role,
                    created_by: createdBy
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (err) {
            console.error('خطا در ثبت کاربر جدید:', err.message);
            let msg = 'خطا در ثبت کاربر جدید.';
            if (err.code === '23505') {
                msg = 'این شماره تماس قبلاً در سیستم ثبت شده است.';
            }
            return { success: false, message: msg };
        }
    },

    async deleteUser(userId) {
        try {
            const { error } = await window.supabase
                .from('app_users')
                .delete()
                .eq('id', userId);
            if (error) throw error;
            return { success: true };
        } catch (err) {
            console.error('خطا در حذف کاربر:', err.message);
            return { success: false, message: 'خطا در حذف کاربر از پایگاه داده.' };
        }
    },

    async deletePatient(patientId) {
        try {
            if (!patientId) return { success: false, message: 'شناسه بیمار نامعتبر است.' };

            // ۱. حذف رکوردهای تصاویر بیمار از جدول patient_images
            const { error: dbImgError } = await window.supabase
                .from('patient_images')
                .delete()
                .eq('patient_id', patientId);

            if (dbImgError) throw dbImgError;

            // ۲. حذف پرونده بیمار از جدول patients
            const { error: patError } = await window.supabase
                .from('patients')
                .delete()
                .eq('id', patientId);

            if (patError) throw patError;

            return { success: true };
        } catch (err) {
            console.error('خطا در حذف کامل پرونده بیمار:', err.message);
            return { success: false, message: `خطا در حذف پرونده: ${err.message}` };
        }
    },

    async savePatientInfo(patientData) {
        try {
            const { data, error } = await window.supabase
                .from('patients')
                .upsert(patientData, { onConflict: 'file_number' })
                .select('id, file_number')
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('خطا در ذخیره اطلاعات بیمار:', err.message);
            return null;
        }
    },

    async getPatient(fileNumber) {
        try {
            const { data: patient, error } = await window.supabase
                .from('patients')
                .select('*')
                .eq('file_number', fileNumber)
                .single();

            if (error && error.code !== 'PGRST116') throw error; 

            if (patient) {
                const { data: images, error: imgError } = await window.supabase
                    .from('patient_images')
                    .select('*')
                    .eq('patient_id', patient.id)
                    .order('created_at', { ascending: true });

                if (imgError) throw imgError;
                patient.images = images || [];
            }
            return patient;
        } catch (err) {
            console.error('خطا در دریافت اطلاعات بیمار:', err.message);
            return null;
        }
    },

    async getAllPatients() {
        try {
            const { data, error } = await window.supabase
                .from('patients')
                .select('*');
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('خطا در دریافت لیست بیماران:', err.message);
            return [];
        }
    },

    buildImagePath(fileNumber, prefix, file) {
        const safeFileNumber = sanitizePathPart(fileNumber, 'unknown-file');
        const safePrefix = sanitizePathPart(prefix, 'image');
        const ext = getFileExtension(file?.name);
        const uniqueName = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        return `${safeFileNumber}/${uniqueName}`;
    },

    async uploadImage(file, filePath) {
        try {
            const { data, error } = await window.supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, { cacheControl: '3600', upsert: true });

            if (error) throw error;

            const { data: urlData } = window.supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (err) {
            console.error('خطا در آپلود عکس:', err.message);
            return null;
        }
    },

    async deleteImage(imageUrl) {
        try {
            const urlParts = imageUrl.split(`${STORAGE_BUCKET}/`);
            if (urlParts.length < 2) return;
            const filePath = decodeURIComponent(urlParts[1].split('?')[0]); 
            const { error } = await window.supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
            if (error) throw error;
        } catch (err) {
            console.error('خطا در حذف عکس:', err.message);
        }
    },

    async syncSectionImages(patientId, sectionName, imageUrlsArray) {
        if (!patientId) return;
        try {
            const uniqueUrls = Array.from(new Set((imageUrlsArray || []).filter(Boolean)));

            // اول قدیمی‌ها را پاک کن
            const { error: delError } = await window.supabase
                .from('patient_images')
                .delete()
                .eq('patient_id', patientId)
                .eq('section', sectionName);
                
            if (delError) throw delError;

            if (uniqueUrls.length === 0) return;

            // بعد جدیدها را اضافه کن
            const newImages = uniqueUrls.map(url => ({
                patient_id: patientId,
                section: sectionName,
                image_url: url
            }));

            const { error: insError } = await window.supabase
                .from('patient_images')
                .insert(newImages);
                
            if (insError) throw insError;
        } catch (err) {
            console.error(`خطا در همگام‌سازی بخش ${sectionName}:`, err.message);
            throw err; // پرتاب خطا تا autosave بداند یک بخش مشکل دارد (اما بقیه بخش‌ها ذخیره می‌شوند)
        }
    }
};

window.DB = DB;
