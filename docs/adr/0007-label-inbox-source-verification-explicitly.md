---
status: accepted
---

# Label Inbox source verification explicitly

Every Inbox distinguishes Events from a Verified Source from those received without source authentication. A private receiving address may accept Events from an Unverified Source, but the product must never infer authenticity from a request's payload or present such Events as verified; configured provider signatures or generic HMAC establish verification, and failed verification is rejected.
