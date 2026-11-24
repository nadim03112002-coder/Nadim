import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async ({ command }) => {
  const isBuild = command === 'build';
  if (isBuild) {
    process.env.NODE_ENV = 'production';
  }

  const plugins: any[] = [tailwindcss()];
  if (isBuild) {
    const { VitePWA } = await import('vite-plugin-pwa');
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: false },
        includeAssets: [
          'favicon.svg',
          'opengraph.jpg',
          'branding/nsta-logo.png',
          'icons/apple-touch-icon.png',
          'icons/badge-monochrome.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-maskable-512.png',
        ],
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifest: {
          id: '/',
          name: 'SCHOOL+',
          short_name: 'SCHOOL+',
          description:
            'SCHOOL+ Official Digital Campus — Online Admission, Fee Passbook, Live Attendance, Exam Results & Smart Learning.',
          theme_color: '#121212',
          background_color: '#121212',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icons/icon-192.png?v=3', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-maskable-512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/badge-monochrome.png?v=4', sizes: '192x192', type: 'image/png', purpose: 'monochrome' },
            { src: '/icons/apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png', purpose: 'any' },
          ],
        },
        injectManifest: {
          globPatterns: [
            'index.html',
            'manifest.webmanifest',
            'favicon.svg',
            'branding/schoolplus-splash-logo.png',
            'branding/nsta-logo.png',
            'icons/icon-192.png',
            'assets/index-*.{js,css}',
            'assets/vendor-react-*.js',
          ],
          globIgnores: ['**/*.map', '**/*.wasm', 'assets/aistudio/**', 'onnx-wasm/**', 'models/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      })
    );
  }

  const fallbackMapsKey =
    !process.env.VITE_GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY
      ? process.env.GOOGLE_MAPS_API_KEY
      : undefined;

  const defineConfigObj: Record<string, string> = {
    ...(isBuild ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {}),
    ...(fallbackMapsKey
      ? { 'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(fallbackMapsKey) }
      : {}),
  };

  return {
    define: Object.keys(defineConfigObj).length > 0 ? defineConfigObj : undefined,
    esbuild: {
      jsx: 'automatic',
      jsxDev: !isBuild,
      minifySyntax: isBuild,
      minifyWhitespace: isBuild,
    },
    optimizeDeps: {
      entries: ['index.html', 'src/main.tsx'],
      holdUntilCrawlEnd: false,
      exclude: [
        '@vladmandic/face-api',
        '@vladmandic/face-api/dist/face-api.esm.js',
        'onnxruntime-web',
        'onnxruntime-web/wasm',
      ],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/database',
        '@supabase/supabase-js',
        'localforage',
        'sonner',
        'clsx',
        'tailwind-merge',
      ],
    },
    plugins,
    build: {
      target: 'es2022',
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
            warning.code === 'CIRCULAR_DEPENDENCY' ||
            (typeof warning.message === 'string' &&
              (warning.message.includes('Module level directives cause errors when bundled') ||
                warning.message.includes('"use client"') ||
                (warning.message.includes('is dynamically imported by') &&
                  warning.message.includes('statically imported by'))))
          ) {
            return;
          }
          defaultHandler(warning);
        },
        treeshake: {
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
          unknownGlobalSideEffects: false,
        },
        output: {
          manualChunks(id) {
            if (id.includes('commonjsHelpers') || id.includes('vite/preload-helper')) {
              return 'vendor-react';
            }
            if (!id.includes('node_modules')) return;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('/firebase/') || id.includes('/@firebase/')) {
              return 'vendor-firebase';
            }
            if (id.includes('/@supabase/')) {
              return 'vendor-supabase';
            }
            if (id.includes('/recharts/') || id.includes('/d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('/jspdf/') || id.includes('/html2canvas/')) {
              return 'vendor-pdf';
            }
            if (id.includes('/three/')) {
              return 'vendor-three';
            }
            if (id.includes('/katex/') || id.includes('/rehype-katex/') || id.includes('/remark-math/') || id.includes('/react-markdown/')) {
              return 'vendor-math';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
        'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      },
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: false,
      ws: false,
      watch: {
        ignored: [
          '**/.aistudio/**',
          '**/public/assets/aistudio/**',
          '**/public/models/**',
          '**/public/onnx-wasm/**',
          '**/android/**',
          '**/dist/**',
          '**/.vapid-keys.json',
          '**/.push-subscriptions.json',
        ],
      },
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
