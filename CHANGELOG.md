## 2025-08-15 — Hotfix: Fix JSX curly braces in TemplatePicker
- Escape {{date}}/{{time}} placeholders using <code>{'{{date}}'}</code> syntax to satisfy esbuild/JSX parser.
