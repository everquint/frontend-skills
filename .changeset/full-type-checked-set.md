---
'frontend-skills': minor
---

Close the type-aware gap to the industry baseline, and finish the formatter's paperwork:

- `.oxlintrc.strict.json` now pins the complete type-aware half of typescript-eslint's
  `recommended-type-checked` preset — 23 rules, up from 3. The old subset was an
  oxlint-tsgolint coverage ceiling that no longer exists (59/61 implemented). Measured before
  enabling: 14 of the 20 new rules at zero violations on a real adopted repo (ADR 0011). The
  config-file override widens to the whole type-aware set.
- `.oxlintrc.json` enables `import/no-cycle` in the fast loop — the one import defect `tsc`
  cannot catch, measured at zero violations on both adopted repos (ADR 0012).
- The asserted rule count moves 214 → 226 in both `EXPECTED_OXLINT_RULES` (starter ci.yml) and
  `EXPECTED_RULES` (measure-rules.mjs); shortfall hints re-measured (199 no flag, 206 no
  jsPlugins, 168 fast config).
- `singleQuote: true` gets its decision record (ADR 0010) — every `.oxfmtrc.json` value is now
  decided, not inherited.
- `.vscode/settings.json` maps `.oxlintrc*.json` / `.oxfmtrc.json` to JSONC so editors stop
  flagging the configs' documented comments as JSON errors.
- Migration entry `1.4.0` names the adopter steps.
