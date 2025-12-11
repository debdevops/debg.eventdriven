import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '../src/index.css'

// Attach test hooks in test mode (Vite env)
if (import.meta.env.VITE_TEST_MODE === 'true') {
  import('./debug/testHooks').then(mod => mod.attachTestHooks?.()).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
