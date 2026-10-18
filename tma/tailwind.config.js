/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bis: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    500: '#3b82f6',
                    600: '#2563eb',
                    900: '#1e3a8a',
                },
                glass: {
                    bg: 'rgba(255, 255, 255, 0.65)',
                    border: 'rgba(255, 255, 255, 0.5)',
                }
            },
            backdropBlur: {
                xs: '2px',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.12)',
            },
        },
    },
    safelist: [
        'bg-blue-600', 'text-blue-600', 'bg-blue-100', 'bg-blue-50', 'text-blue-900',
        'text-blue-400', 'bg-blue-500', 'ring-blue-500',
        'bg-white/40', 'bg-white/50', 'bg-white/60', 'bg-white/80',
        'border-white/40', 'border-white/50',
        'text-white', 'bg-black/50', 'bg-transparent',
    ],
    plugins: [],
}
