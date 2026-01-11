import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Injected by Vite at build/dev time via `define` in vite.config.ts.
// Avoids `import.meta.env` so Jest/Node can parse this file.
declare const __VITE_TEST_MODE__: string | undefined

// Attach test hooks in test mode (Vite env)
const testMode =
  (typeof __VITE_TEST_MODE__ !== 'undefined' && __VITE_TEST_MODE__) ||
  (typeof process !== 'undefined' && (process as any).env?.VITE_TEST_MODE) ||
  'false'

if (testMode === 'true') {
  import('./debug/testHooks').then(mod => mod.attachTestHooks?.()).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
