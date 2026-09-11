# Observed setup failures converted to controls

| Observed failure | Maintained control |
| --- | --- |
| Operators existed only in temporary storage | Tracked contract, runner, browser preflight, plans, rulebook and receipts |
| Candidate branch and runtime identity diverged | One plan carries exact branch-independent source/tree/deployment custody; resume refuses digest drift |
| Active/restored settings were counted inconsistently | One environment definition and plan validation govern both selection and rollback |
| Terminal input closed before delayed work | Every phase is a fresh invocation over an atomic durable state file; no live terminal is required |
| Browser package pointed to an absent executable | Headless data-URL launch and clean-close preflight runs before remote browser work |
| Private host was missing from Origin authorization | One exact stable host must generate the exact HTTPS allowed Origin |
| Error redaction hid the failed phase/status | Receipts expose only fixed phase/code/field and numeric HTTP status, never bodies or values |
| Canonical work completed while authored work had no progress | Plans require separate canonical-completion and authored-completion phases |
| In-memory sessions were lost at closeout | Resume persists only nonsecret plan/state digests; inspect/status need no session and advance declares one minimal subject session |
| Clean-candidate lint fell through to whole-repository lint | The rulebook requires an explicit file list and defines an empty list as a successful no-op |
| A Production-target build moved an auxiliary alias | Pre/post public-alias snapshots are mandatory; any unrequested movement blocks and permits only the exact authorized restoration |
