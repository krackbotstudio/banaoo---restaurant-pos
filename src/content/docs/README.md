# Public documentation

User-facing guides served at **/docs** on the marketing site.

## Files

| File | Role |
|------|------|
| `registry.ts` | Article list, sections, `lastUpdated` dates |
| `articles/*.md` | Markdown content |

## Adding or editing

1. Edit or add `articles/<slug>.md`.
2. Register the article in `DOC_ARTICLES` inside `registry.ts`.
3. Bump `lastUpdated` when content changes.

Cursor rule `.cursor/rules/public-docs.mdc` reminds agents to update docs with feature work.

## Release checklist

- [ ] Docs article(s) updated for user-visible changes
- [ ] `lastUpdated` updated in `registry.ts`
