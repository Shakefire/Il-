# Marketplace fixture filter

## Root cause

Phase 6–9 Node integration tests seed `PUBLISHED` properties (e.g. "Phase 7 Stay",
"Phase 9 Stay") into the **same Neon database** the guest apps read. Hosts use
emails like `host_p9_<ts>@test.ile.ng`. Rows often persist via
`onConflictDoNothing`, so Explore/Search show fixture stays with placeholder
images and test titles.

This is **not** a Flutter hardcoded-list bug on the marketplace path
(`ExploreScreen` calls `GET /api/properties`). The API correctly returns
published rows — those rows are leftover fixtures.

## Fix

Public marketplace queries (`getPublishedProperties`, search) exclude hosts
whose email ends with `@test.ile.ng` or `@ile.test`. Real published listings
from real hosts remain visible. Fixtures stay available for service-level tests
that load by id.

## What was not done

- No title-string filter like `/^Phase \d+/` as the sole gate.
- No deploy / no mass DB wipe from this change set (ops may still unpublish
  leftover fixtures manually if desired).
