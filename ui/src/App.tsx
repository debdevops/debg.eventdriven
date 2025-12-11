import React from 'react'
import { SessionProvider } from './context/SessionContext'
import { ConnectForm } from './components/ConnectForm'
import { Sidebar } from './components/Sidebar'
import { MessageGrid } from './components/MessageGrid'
import { SendDock } from './components/SendDock'
import { StreamPanel } from './components/StreamPanel'
import './index.css'

export function App() {
  return (
    <SessionProvider>
      <div className="app">
        <header className="topbar">Service Bus Inspector</header>
        <div className="layout">
          <aside className="sidebar">
            <ConnectForm />
            <Sidebar />
          </aside>
          <main className="content">
            <StreamPanel />
            <MessageGrid />
          </main>
        </div>
        <SendDock />
      </div>
    </SessionProvider>
  )
}
