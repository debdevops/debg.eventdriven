import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:5002'
  const testMode = env.VITE_TEST_MODE || process.env.VITE_TEST_MODE || 'false'

  return {
    plugins: [react()],
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl),
      __VITE_TEST_MODE__: JSON.stringify(testMode)
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5174,
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
