import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import autoprefixer from 'autoprefixer'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    build: {
      outDir: 'build',
      // Split heavy third-party code into stable vendor chunks so a change in
      // app code (or a single dependency bump) doesn't invalidate the entire
      // cached bundle for every returning user. Greatly improves repeat-visit
      // cache hit rate across the branch fleet.
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'mui-vendor': [
              '@mui/material',
              '@mui/icons-material',
              '@mui/x-date-pickers',
              '@emotion/react',
              '@emotion/styled',
            ],
            'coreui-vendor': [
              '@coreui/react',
              '@coreui/coreui',
              '@coreui/icons-react',
              '@coreui/utils',
            ],
            'table-vendor': ['material-react-table'],
            'charts-vendor': ['recharts', 'chart.js', 'react-chartjs-2'],
            'pdf-vendor': ['jspdf', 'html2canvas'],
            'xlsx-vendor': ['xlsx'],
          },
        },
      },
    },
    css: {
      postcss: {
        plugins: [
          autoprefixer({}), // add options if needed
        ],
      },
    },
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      // `force: true` re-bundled deps on every dev start (slow cold start) with
      // no production benefit. Vite already re-optimizes when deps change.
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
      include: ['qrcode.react']
    },
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: 'src/',
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
    },
    // Shared /api proxy used by both the dev server and the preview server.
    // It forwards /api/* to the Express backend (VITE_API_BASE_URL) and strips
    // the leading /api so /api/api/login -> /api/login on the backend.
    server: {
      // 0.0.0.0 binds every network interface so the app is reachable at the
      // server's LAN IP (e.g. http://10.1.1.181:4000), not just localhost.
      host: '0.0.0.0',
      port: 4000,
      // Permit requests whose Host header is the server IP/hostname. Without
      // this, newer Vite versions reject LAN access with
      // "Blocked request. This host is not allowed."
      allowedHosts: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:5000/',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        // https://vitejs.dev/config/server-options.html
      },
    },
    // `npm run serve` (vite preview of the production build) — same IP access +
    // /api proxy so the built app behaves like the dev server when deployed.
    preview: {
      host: '0.0.0.0',
      port: 4000,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:5000/',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
      },
    },
  }
})
