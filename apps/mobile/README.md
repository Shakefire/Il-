# Ilé Mobile (`apps/mobile`)

Flutter guest marketplace for Ilé — Explore, search, property details, wishlist,
bookings, inbox placeholder, and profile — wired to the **same Fastify backend**
as the web app (`/api/search`, `/api/locations/search`, `/api/properties`, `/api/bookings`).

Brand tokens follow `brand.md` (emerald `#0B5D45`, warm alabaster, Plus Jakarta / DM Serif).

## Run / preview

```bash
cd apps/mobile
flutter pub get

# Production Railway API (default)
flutter run

# Local Fastify backend (next.config default: 127.0.0.1:4000)
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000
```

Android emulator → host machine: `http://10.0.2.2:4000`.

## Navigation

```
Welcome → Continue as Guest / Sign in → Marketplace shell
  Explore · Wishlist · Bookings · Inbox · Profile

Search: Destination (Nominatim via /api/locations) → Dates & guests → Results
Property → Reserve (availability request; no Paystack as first step) → Status
```

## Geolocation note

Web does **not** use Google Places/Maps. Location autocomplete is Nominatim/OSM
through `GET /api/locations/search`. Near me uses device GPS only on explicit tap.

## Quality

```bash
flutter analyze
# Prefer skipping heavy screenshot tests when disk is tight
```

## Architecture

```
lib/
  app/                 # Theme, router (StatefulShellRoute marketplace)
  core/api/            # ApiClient + IleApi (same contracts as src/lib/api.ts)
  core/models/         # Property, Location, Search, Booking
  core/state/          # SearchSession, WishlistStore (local)
  features/
    shell/             # Bottom nav: Explore · Wishlist · Bookings · Inbox · Profile
    explore/ search/ property/ wishlist/ bookings/ inbox/ profile/
  shared/widgets/      # Ile* components + skeletons
```
