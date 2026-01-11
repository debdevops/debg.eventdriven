/**
 * Namespace Switcher Dropdown Component
 * Quick switcher for recently used namespaces with localStorage persistence
 */

import { useState, useEffect, useRef } from 'react'
import './NamespaceSwitcher.css'

export interface NamespaceOption {
  name: string
  friendlyName: string
  lastUsed: number
}

export interface NamespaceSwitcherProps {
  currentNamespace: string
  onSwitch: () => void // Opens connect modal for switching
  onAdd: () => void // Opens connect modal for adding new namespace
}

const STORAGE_KEY = 'namespaceSwitcher.recentNamespaces'
const MAX_RECENT = 5

export function NamespaceSwitcher({ currentNamespace, onSwitch, onAdd }: NamespaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [recentNamespaces, setRecentNamespaces] = useState<NamespaceOption[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load recent namespaces from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as NamespaceOption[]
        setRecentNamespaces(parsed.slice(0, MAX_RECENT))
      } catch (e) {
        console.error('Failed to parse recent namespaces:', e)
      }
    }
  }, [])

  // Save current namespace to recent list
  useEffect(() => {
    if (!currentNamespace) return

    const updated = [
      { name: currentNamespace, friendlyName: currentNamespace, lastUsed: Date.now() },
      ...recentNamespaces.filter(n => n.name !== currentNamespace)
    ].slice(0, MAX_RECENT)

    setRecentNamespaces(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [currentNamespace])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSwitch = (namespace: string) => {
    if (namespace !== currentNamespace) {
      onSwitch()
    }
    setIsOpen(false)
  }

  return (
    <div className="namespace-switcher" ref={dropdownRef}>
      <button
        className="namespace-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="namespace-icon">🏢</span>
        <span className="namespace-name">{currentNamespace || 'Select Namespace'}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="namespace-dropdown">
          <div className="dropdown-section">
            <div className="dropdown-header">Recent Namespaces</div>
            {recentNamespaces.length === 0 ? (
              <div className="dropdown-item disabled">
                No recent namespaces
              </div>
            ) : (
              recentNamespaces.map(ns => (
                <button
                  key={ns.name}
                  className={`dropdown-item ${ns.name === currentNamespace ? 'active' : ''}`}
                  onClick={() => handleSwitch(ns.name)}
                >
                  <span className="item-icon">🏢</span>
                  <span className="item-name">{ns.friendlyName}</span>
                  {ns.name === currentNamespace && <span className="item-badge">Current</span>}
                </button>
              ))
            )}
          </div>

          <div className="dropdown-divider" />

          <div className="dropdown-section">
            <button className="dropdown-item action" onClick={() => { setIsOpen(false); onSwitch(); }}>
              <span className="item-icon">🔄</span>
              <span className="item-name">Switch Namespace...</span>
            </button>
            <button className="dropdown-item action" onClick={() => { setIsOpen(false); onAdd(); }}>
              <span className="item-icon">➕</span>
              <span className="item-name">Add Namespace...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
