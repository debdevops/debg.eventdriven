/**
 * useDebounce Hook
 * 
 * Delays updating a value until after a specified delay.
 * Essential for search/filter inputs to prevent excessive re-renders.
 * 
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 300)
 * // debouncedSearch updates 300ms after searchTerm stops changing
 */

import { useState, useEffect } from 'react'

/**
 * Debounces a value by the specified delay in milliseconds.
 * Returns the debounced value which updates after the delay.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set up timer to update debounced value
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clean up timer on value change or unmount
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Debounces a callback function.
 * Returns a stable function reference that delays execution.
 * 
 * @example
 * const debouncedSearch = useDebouncedCallback((term) => search(term), 300)
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null)

  const debouncedCallback = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    const newTimeoutId = setTimeout(() => {
      callback(...args)
    }, delay)
    
    setTimeoutId(newTimeoutId)
  }) as T

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [timeoutId])

  return debouncedCallback
}

export default useDebounce
