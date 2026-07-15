window.tailwind = window.tailwind || {};

window.tailwind.config = {
    corePlugins: {
        preflight: false
    },
    theme: {
        extend: {
            fontFamily: {
                vazir: ['Vazirmatn', 'ui-sans-serif', 'system-ui', 'sans-serif']
            },
            colors: {
                clinical: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    500: '#2563eb',
                    700: '#1e40af'
                },
                care: {
                    50: '#f0fdf4',
                    500: '#22c55e',
                    700: '#166534'
                }
            },
            borderRadius: {
                ui: 'var(--radius)',
                control: 'var(--radius-sm)'
            },
            boxShadow: {
                card: 'var(--shadow-md)',
                panel: 'var(--surface-shadow)'
            }
        }
    }
};
