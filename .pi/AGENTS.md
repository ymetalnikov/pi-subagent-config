# AGENTS.md
Always delegate to `sub_agent` first; do direct work only as fallback.
For code: `other/pre_review` → `code` → `review` (high-risk: `critical_review`).
On timeout/error, retry with smaller scope; default `timeoutSeconds: 420`.
Before any `git commit` or `git push`, ask for explicit user approval.
