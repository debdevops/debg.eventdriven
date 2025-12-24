import { useEffect, useRef } from 'react'

/**
 * Selection guards (stability): prevent stale in-flight updates when switching entities/views.
 *
 * Contract: preserves the existing StreamPanel behavior exactly:
 * - increments epoch on mount and on selection change
 * - aborts the previous AbortController and replaces it on mount/selection change
 */
export function useSelectionGuards(selectionId: string) {
  const selectionIdRef = useRef(selectionId)
  const selectionEpochRef = useRef(0)
  const selectionAbortRef = useRef<AbortController>(new AbortController())

  useEffect(() => {
    selectionIdRef.current = selectionId
    selectionEpochRef.current += 1
    try {
      selectionAbortRef.current.abort('selection-changed')
    } catch {
      // ignore
    }
    selectionAbortRef.current = new AbortController()
  }, [selectionId])

  return { selectionIdRef, selectionEpochRef, selectionAbortRef }
}
