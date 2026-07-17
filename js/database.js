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

async function getConnectedSupabase() {
    const client = window.supabase;
    if (!client?.from || !client?.storage) {
        throw new Error('کلاینت پایگاه داده در مرورگر آماده نیست.');
    }

    const connection = window.SupabaseConnection;
    if (connection?.ready) {
        let connected = await connection.ready;
        if (!connected && navigator.onLine && typeof connection.check === 'function') {
            connection.ready = connection.check();
            connected = await connection.ready;
        }
        if (!connected) {
            throw connection.lastError || new Error('ارتباط با سرویس پایگاه داده برقرار نشد.');
        }
    }

    return client;
}

function logDatabaseError(operation, error) {
    console.error(`[Database:${operation}]`, {
        message: error?.message || String(error),
        code: error?.code || '',
        details: error?.details || '',
        hint: error?.hint || '',
        status: error?.status || ''
    });
}

const DB = {
    lastError: null,

    async healthCheck() {
        try {
            const client = await getConnectedSupabase();
            const { error } = await client
                .from('patients')
                .select('id', { head: true, count: 'exact' })
                .limit(1);
            if (error) throw error;
            this.lastError = null;
            return { ok: true };
        } catch (error) {
            this.lastError = error;
            logDatabaseError('healthCheck', error);
            return { ok: false, error };
        }
    },
    
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
            const client = await getConnectedSupabase();
            const adminPhone = '09337593737';
            const adminPassRaw = 'M@hdi8261';
            const passwordHash = await this.hashPassword(adminPassRaw);

            // بررسی وجود ادمین
            const { data, error } = await client
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
                const { error: insertError } = await client
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
            this.lastError = err;
            logDatabaseError('ensureAdminUser', err);
        }
    },

    async loginUser(phone, password) {
        try {
            const client = await getConnectedSupabase();
            const { data: user, error } = await client
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
                    const { data: retryUser, error: retryErr } = await client
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
                this.lastError = null;
                return { success: true, user };
            } else {
                return { success: false, message: 'کلمه عبور وارد شده اشتباه است.' };
            }
        } catch (err) {
            this.lastError = err;
            logDatabaseError('loginUser', err);
            return { success: false, message: `خطا در اتصال به پایگاه داده: ${err.message || 'خطای نامشخص'}` };
        }
    },

    async getUsers() {
        try {
            const client = await getConnectedSupabase();
            const { data, error } = await client
                .from('app_users')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            this.lastError = null;
            return data || [];
        } catch (err) {
            this.lastError = err;
            logDatabaseError('getUsers', err);
            return [];
        }
    },

    async createUser(phone, password, role = 'staff', createdBy = '') {
        try {
            const client = await getConnectedSupabase();
            const passwordHash = await this.hashPassword(password);
            const { data, error } = await client
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
            this.lastError = null;
            return { success: true, data };
        } catch (err) {
            this.lastError = err;
            logDatabaseError('createUser', err);
            let msg = 'خطا در ثبت کاربر جدید.';
            if (err.code === '23505') {
                msg = 'این شماره تماس قبلاً در سیستم ثبت شده است.';
            }
            return { success: false, message: msg };
        }
    },

    async deleteUser(userId) {
        try {
            const client = await getConnectedSupabase();
            const { error } = await client
                .from('app_users')
                .delete()
                .eq('id', userId);
            if (error) throw error;
            this.lastError = null;
            return { success: true };
        } catch (err) {
            this.lastError = err;
            logDatabaseError('deleteUser', err);
            return { success: false, message: 'خطا در حذف کاربر از پایگاه داده.' };
        }
    },

    async deletePatient(patientId) {
        try {
            if (!patientId) return { success: false, message: 'شناسه بیمار نامعتبر است.' };
            const client = await getConnectedSupabase();

            // ۱. حذف رکوردهای تصاویر بیمار از جدول patient_images
            const { error: dbImgError } = await client
                .from('patient_images')
                .delete()
                .eq('patient_id', patientId);

            if (dbImgError) throw dbImgError;

            // ۲. حذف پرونده بیمار از جدول patients
            const { error: patError } = await client
                .from('patients')
                .delete()
                .eq('id', patientId);

            if (patError) throw patError;

            this.lastError = null;
            return { success: true };
        } catch (err) {
            this.lastError = err;
            logDatabaseError('deletePatient', err);
            return { success: false, message: `خطا در حذف پرونده: ${err.message}` };
        }
    },

    async savePatientInfo(patientData) {
        try {
            const client = await getConnectedSupabase();
            const { data, error } = await client
                .from('patients')
                .upsert(patientData, { onConflict: 'file_number' })
                .select('id, file_number')
                .single();
            if (error) throw error;
            this.lastError = null;
            return data;
        } catch (err) {
            this.lastError = err;
            logDatabaseError('savePatientInfo', err);
            return null;
        }
    },

    async getPatient(fileNumber) {
        try {
            const client = await getConnectedSupabase();
            const { data: patient, error } = await client
                .from('patients')
                .select('*')
                .eq('file_number', fileNumber)
                .single();

            if (error && error.code !== 'PGRST116') throw error; 

            if (patient) {
                const { data: images, error: imgError } = await client
                    .from('patient_images')
                    .select('*')
                    .eq('patient_id', patient.id)
                    .order('created_at', { ascending: true });

                if (imgError) throw imgError;
                patient.images = images || [];
            }
            this.lastError = null;
            return patient;
        } catch (err) {
            this.lastError = err;
            logDatabaseError('getPatient', err);
            return null;
        }
    },

    async getAllPatients() {
        try {
            const client = await getConnectedSupabase();
            const { data, error } = await client
                .from('patients')
                .select('*');
            if (error) throw error;
            this.lastError = null;
            return data || [];
        } catch (err) {
            this.lastError = err;
            logDatabaseError('getAllPatients', err);
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
            const client = await getConnectedSupabase();
            const { data, error } = await client.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, { cacheControl: '3600', upsert: true });

            if (error) throw error;

            const { data: urlData } = client.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (err) {
            this.lastError = err;
            logDatabaseError('uploadImage', err);
            return null;
        }
    },

    async deleteImage(imageUrl) {
        try {
            const urlParts = imageUrl.split(`${STORAGE_BUCKET}/`);
            if (urlParts.length < 2) return;
            const filePath = decodeURIComponent(urlParts[1].split('?')[0]); 
            const client = await getConnectedSupabase();
            const { error } = await client.storage.from(STORAGE_BUCKET).remove([filePath]);
            if (error) throw error;
            this.lastError = null;
        } catch (err) {
            this.lastError = err;
            logDatabaseError('deleteImage', err);
        }
    },

    async syncSectionImages(patientId, sectionName, imageUrlsArray) {
        if (!patientId) return;
        try {
            const client = await getConnectedSupabase();
            const uniqueUrls = Array.from(new Set((imageUrlsArray || []).filter(Boolean)));

            // اول قدیمی‌ها را پاک کن
            const { error: delError } = await client
                .from('patient_images')
                .delete()
                .eq('patient_id', patientId)
                .eq('section', sectionName);

            if (delError) throw delError;

            if (uniqueUrls.length === 0) {
                this.lastError = null;
                return;
            }

            // بعد جدیدها را اضافه کن
            const newImages = uniqueUrls.map(url => ({
                patient_id: patientId,
                section: sectionName,
                image_url: url
            }));

            const { error: insError } = await client
                .from('patient_images')
                .insert(newImages);
                
            if (insError) throw insError;
            this.lastError = null;
        } catch (err) {
            this.lastError = err;
            logDatabaseError(`syncSectionImages:${sectionName}`, err);
            throw err; // پرتاب خطا تا autosave بداند یک بخش مشکل دارد (اما بقیه بخش‌ها ذخیره می‌شوند)
        }
    }
};

window.DB = DB;
