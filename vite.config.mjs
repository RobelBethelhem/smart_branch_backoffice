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
    server: {
      host: '0.0.0.0',
      port: 4000,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:5000/',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        // https://vitejs.dev/config/server-options.html
      },
    },
  }
})
