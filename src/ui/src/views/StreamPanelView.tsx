/**
 * View entrypoint for the message/DLQ inspector.
 *
 * FIX(refactor): introduce /views as a stable layer so screens can be composed
 * without importing directly from /components (pure UI).
 */

export { default } from '../components/StreamPanel'
