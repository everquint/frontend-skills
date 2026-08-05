# Constraints

Hard limits an issue or an approach must respect — the list that answers "is this feasible?".
Each entry states the rule, the reason, and the module that enforces it where one exists. An
issue that violates an entry is rejected with a link to it, never silently descoped. A changed
limit is an edit here, in the PR that changes it.

`NOT SUPPORTED:` entries record what the product deliberately does not do — absence is invisible
in code, so these are the highest-value lines in this file.

1. <constraint> — <why> — <enforcing module, if any>

- NOT SUPPORTED: <deliberately absent behaviour> — <why, or the decision that ruled it out>
