/**
 * This file must be the first `import` in `index.ts`.
 * ES modules hoist imports above `index.ts` body, so `./App` would load before any
 * inline code there. Only assign **plain** globals here — do **not** `require()` RN
 * native modules (FormData/WebSocket/etc.) yet, or release can fail with
 * `AppRegistryBinding::startSurface failed. Global was not installed.`
 *
 * `index.ts` imports `InitializeCore` next; that wires FormData, fetch, WebSocket, etc.
 *
 * Hermes: some web libs read `window` / `self` at import time before `InitializeCore`.
 */
const glb = globalThis as typeof globalThis & {
  window?: unknown;
  self?: unknown;
};
if (!("window" in glb)) {
  (glb as { window: typeof globalThis }).window = globalThis;
}
if (!("self" in glb)) {
  (glb as { self: typeof globalThis }).self = globalThis;
}
