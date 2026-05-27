/**
 * Single source of truth for the current legal-document version users accept
 * on signup. Bump this whenever Terms / Privacy / Refund change materially —
 * any future re-acceptance gate (not yet built) can compare a stored
 * `terms_version` against this constant.
 *
 * Keep in sync with `server/legal.js`.
 */
export const CURRENT_TERMS_VERSION = "2026-05-25";
