# Quarantined non-production API source

These handlers were removed from the deployable `api/` tree during the P0 Production diagnostic-exposure containment campaign because they exposed diagnostic, raw-storage, repair, ping, test, or superseded synchronous-generation behavior that must not be anonymously deployed. They remain here only to preserve source custody and review history.

The quarantine includes the obsolete `api/moremindmap/mini-profile-v2.js` synchronous generator. The canonical resumable BOS path remains `api/moremindmap/start.js` plus `api/moremindmap/status.js`, with the candidate’s server-grant enforcement boundary.

Nothing in this directory may be imported by deployable source or restored to an HTTP surface without a separate architecture and security review.
