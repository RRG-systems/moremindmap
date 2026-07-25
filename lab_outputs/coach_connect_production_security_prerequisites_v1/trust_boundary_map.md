# Trust boundary map

`untrusted client → verified assertion → canonical subscriber subject → atomic
server session → shared security-state port → retention/deletion/operator policy
→ governed Coach Connect decision`

Transport trust is separately gated by an exact host, verified HTTPS termination,
and platform-attested single-edge metadata. Subscriber, coach, developer,
operator, billing, and canonical Business Engine authorities remain disjoint.
The local append-only JSONL journal remains development-only and
logical-denial-only; physical deletion is not claimed.
