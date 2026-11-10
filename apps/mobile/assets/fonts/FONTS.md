# Ilé Mobile Fonts

## Families

| Family | Role | Source | License |
|---|---|---|---|
| **DM Serif Display** | Wordmark, editorial headlines, major section titles | [Google Fonts / OFL](https://fonts.google.com/specimen/DM+Serif+Display) | SIL Open Font License 1.1 |
| **Plus Jakarta Sans** | Body, nav, buttons, forms, metadata (300–700) | [Google Fonts / OFL](https://fonts.google.com/specimen/Plus+Jakarta+Sans) | SIL Open Font License 1.1 |
| **Poppins** | Authentication / onboarding UI only (400–700) | [Google Fonts / OFL](https://fonts.google.com/specimen/Poppins) | SIL Open Font License 1.1 |

## Why bundled (not runtime Google Fonts)

The web app loads display/body families via Google Fonts CDN (`globals.css`). No local font files lived in the web repo, so mobile bundles OFL-licensed files under `assets/fonts/` for offline reliability and identical rendering without a network call at startup.

Poppins is reserved for auth screens so the rounded geometric look matches the login / register / OTP references without changing the rest of the product type system.

## Declared in `pubspec.yaml`

- `DM Serif Display` → `DMSerifDisplay-Regular.ttf` (400)
- `Plus Jakarta Sans` → Light / Regular / Medium / SemiBold / Bold (300–700)
- `Poppins` → Regular / Medium / SemiBold / Bold (400–700)

## Fallback

If asset fonts fail to load, Flutter falls back to the platform default. Prefer fixing the asset declaration rather than switching to the `google_fonts` package unless you intentionally want runtime fetching.
