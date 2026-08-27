#!/usr/bin/env bash
# SessionStart hook: state the prototype's question and expiry at the top of every session, and say
# loudly when the expiry has passed.
#
# WHY a hook and not a line in PROTOTYPE.md alone: a file is read once, on day one. The relaxations
# in prototype mode are only safe while the repo is still short-lived, and an expired prototype
# looks exactly like a healthy one from the inside. This is the only thing in the repo that
# notices time passing.
#
# WHY exit 0 always: a SessionStart hook that can fail blocks the session. This prints and returns.
#
# WHY node and not jq: jq is not installed everywhere; node is already a requirement of the repo.
set -uo pipefail

command -v node >/dev/null 2>&1 || exit 0

project_dir=${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)}
[ -f "$project_dir/package.json" ] || exit 0

node -e '
const { readFileSync } = require("node:fs");
let marker;
try {
    marker = JSON.parse(readFileSync(process.argv[1] + "/package.json", "utf8")).eqPrototype;
} catch { process.exit(0); }
if (!marker) process.exit(0);

const question = marker.question || "(no question recorded — this prototype has no defined end)";
const expires = marker.expires;
// Date-only comparison in UTC: a prototype does not expire at a timezone boundary. `>=`, not `>`:
// PROTOTYPE.md says the repo is deleted or graduated ON that date, so the date itself is due.
const today = new Date().toISOString().slice(0, 10);

console.log(`PROTOTYPE MODE — reduced gates. Question: ${question}`);
if (!expires) {
    console.log("No expiry date recorded. Set eqPrototype.expires in package.json or graduate the repo now (eq-prototype SKILL.md, section 6).");
} else if (typeof expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires))) {
    // A malformed date compares lexically or as NaN and would read as "still fine" forever, so it is
    // reported as unusable rather than compared. Same rule as standard-check.mjs.
    console.log(`Unusable expiry ${JSON.stringify(expires)} in package.json — it must be a "YYYY-MM-DD" string. Nothing can tell whether this prototype is overdue. Fix it or graduate the repo (eq-prototype references/graduation.md).`);
} else if (today >= expires) {
    const days = Math.floor((Date.parse(today) - Date.parse(expires)) / 86400000);
    const when = days === 0 ? `DUE TODAY (${expires})` : `EXPIRED ${days} day(s) ago (${expires})`;
    console.log(`${when}. Two moves only: delete this repo, or graduate it to the full standard — eq-prototype references/graduation.md. Do not add features to an expired prototype.`);
} else {
    console.log(`Expires ${expires}. On that date: delete or graduate (eq-prototype SKILL.md, section 6).`);
}
' "$project_dir"

exit 0
