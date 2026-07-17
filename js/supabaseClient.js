// js/supabaseClient.js

(() => {
    const SUPABASE_URL = 'https://vigrilziqevjkkppuata.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpZ3JpbHppcWV2amtrcHB1YXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzMwNjI2NSwiZXhwIjoyMDk4ODgyMjY1fQ.QJJ5iQ-BXKoMDO1GaQyQbUaR8g_yycNhBNKuugrcGls';
    const library = window.supabase;

    function dispatchConnectionState(status, error = null) {
        window.dispatchEvent(new CustomEvent('supabase:connection', {
            detail: {
                status,
                message: error?.message || ''
            }
        }));
    }

    function delay(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    if (!library?.createClient) {
        const error = new Error('کتابخانه اتصال به پایگاه داده بارگذاری نشد.');
        window.SupabaseConnection = {
            status: 'unavailable',
            lastError: error,
            ready: Promise.resolve(false),
            check: async () => false
        };
        console.error('[Supabase] Browser client failed to load.', error);
        dispatchConnectionState('unavailable', error);
        return;
    }

    const client = library.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        },
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storageKey: 'dental-clinic-supabase-auth'
        },
        global: {
            headers: {
                'x-application-name': 'dental-clinic-web'
            }
        }
    });

    const connection = {
        status: 'initializing',
        lastError: null,
        ready: null,

        async check({ attempts = 3 } = {}) {
            this.status = 'checking';
            this.lastError = null;
            dispatchConnectionState('checking');

            for (let attempt = 1; attempt <= attempts; attempt += 1) {
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), 10000);

                try {
                    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
                        method: 'GET',
                        headers: {
                            apikey: SUPABASE_ANON_KEY
                        },
                        signal: controller.signal
                    });

                    if (!response.ok) {
                        throw new Error(`Supabase health request failed with HTTP ${response.status}.`);
                    }

                    this.status = 'connected';
                    this.lastError = null;
                    dispatchConnectionState('connected');
                    console.info('[Supabase] Connection verified.');
                    return true;
                } catch (error) {
                    this.lastError = error;
                    if (attempt < attempts) await delay(attempt * 700);
                } finally {
                    window.clearTimeout(timeoutId);
                }
            }

            this.status = 'unavailable';
            dispatchConnectionState('unavailable', this.lastError);
            console.error('[Supabase] Connection check failed.', {
                message: this.lastError?.message || 'Unknown error'
            });
            return false;
        }
    };

    window.supabase = client;
    window.SupabaseConnection = connection;
    connection.ready = connection.check();

    window.addEventListener('online', () => {
        connection.ready = connection.check();
    });
})();
