# CHANGELOG

## 2025-08-15 — Patch: Clipboard Hardening (Fix 'reading length' crash)
- Added `readClipboardText()` with granular errors (no_api / denied / empty / unknown).
- `CapturePage` now uses the safe clipboard helper; never passes `undefined` to cleaners/savers.
- `cleanPaste()` now safely coerces input to string (handles `null/undefined`).
- Extra guards in `TemplatePicker` (defensive against unexpected localStorage values).
- No new dependencies.
