---
'frontend-skills': patch
---

Points the 2.14.0 rule-count step at the right measurement.

The previous patch said to re-measure with `measure-rules.mjs`. That script probes with the
starter's config by design, so it reports 227 for every repo regardless of what the repo's own
config enables — the same wrong number the patch was meant to stop people pasting. The step now
names the command in the consuming repo's own `ci.yml`, which reads that repo's count.
