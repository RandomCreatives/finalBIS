import { defineConfig, loadEnv } from 'vite';

// The Mini App is served from https://<host>/tma/ in production (see the root
// vercel.json), so every built asset must resolve under that prefix.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        base: '/tma/',
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: false,
        },
        server: {
            host: '0.0.0.0',
            port: 5173,
            // Local development talks to the Express API. In production the API
            // is same-origin, so the app uses relative /api URLs and needs no
            // proxy.
            proxy: {
                '/api': {
                    target: env.VITE_DEV_API_PROXY || 'http://localhost:5000',
                    changeOrigin: true,
                },
            },
            allowedHosts: true,
        },
        preview: {
            host: '0.0.0.0',
            allowedHosts: true,
        },
    };
});
