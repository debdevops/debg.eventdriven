import { useCallback, useEffect, useRef } from 'react'

/**
 * Small stability helper to enforce a "frozen" UI contract (Snapshot mode).
 *
 * Design goal: make it hard to accidentally introduce a new mutation path that
 * changes UI/data while frozen.
 */
export function useFrozenGuard(isFrozen: boolean) {
  const frozenRef = useRef(isFrozen)

  useEffect(() => {
    frozenRef.current = isFrozen
  }, [isFrozen])

  const guard = useCallback(<Args extends any[], R>(fn: (...args: Args) => R) => {
    return (...args: Args): R | undefined => {
      if (frozenRef.current) return undefined
      return fn(...args)
    }
  }, [])

  const guardAsync = useCallback(<Args extends any[], R>(fn: (...args: Args) => Promise<R>) => {
    return async (...args: Args): Promise<R | undefined> => {
      if (frozenRef.current) return undefined
      return fn(...args)
    }
  }, [])

  return { frozenRef, guard, guardAsync }
}
