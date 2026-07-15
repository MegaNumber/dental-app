// js/supabaseClient.js

const SUPABASE_URL = 'https://vigrilziqevjkkppuata.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpZ3JpbHppcWV2amtrcHB1YXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzMwNjI2NSwiZXhwIjoyMDk4ODgyMjY1fQ.QJJ5iQ-BXKoMDO1GaQyQbUaR8g_yycNhBNKuugrcGls';

// ایجاد کلاینت با غیرفعال کردن Realtime برای جلوگیری از هشدارهای کنسول
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    },
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

window.supabase = supabaseClient;
console.log("سلام گلللم اتصال به سوپابیس برقرار شد.");
