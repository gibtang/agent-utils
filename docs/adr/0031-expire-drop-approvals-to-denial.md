# Expire Drop approvals to denial

An unanswered Drop approval request expires after 24 hours to denial and deletion, never automatic approval, because silence cannot authorize release. This adds a purpose-built Drops exception to ADR-0012 and bypasses ADR-0024's recoverable Trash for denied Drops; implementation must distinguish immediate access denial from verified physical deletion.
