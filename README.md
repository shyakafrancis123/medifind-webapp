# MediFind
ok so, this is my little app. its called MediFind. i made it to look up medicines and see quick info like warnings, dosage, side effects, that kinda thing. its simple, static, js/html/css only, nothing fancy.
ive used the OpenFDA public apis to get the data.


MediFind is a small single-page web app that helps users search for medicines and view structured information such as brand/generic names, indications, warnings, dosage, approvals, and recalls. It is a client-side (static) app built with plain HTML/CSS/JavaScript and uses the U.S. Food & Drug Administration (OpenFDA) public APIs as its data source.

This README covers what the project does, the OpenFDA endpoints used, caching and storage behavior, how to run locally, deployment notes, and a few developer tips.

## Features
- Live search (debounced) across OpenFDA endpoints
- Consolidated results: label data (human-readable sections), approval metadata (drugsfda), and enforcement/recall notices
- Favorites persisted in localStorage (export/import available)
- Simple client-side cache for API responses (TTL configurable)
- Centralized logging and graceful error handling (see `js/logger.js` and `js/error-handler.js`)
- Responsive single-page layout with sections: Search, Favorites, About, Settings

## the APIs i hit (endpoints)
these are the ones the app uses, raw urls below so you can test direct in browser if you want
- Label endpoint — human-friendly drug data (indications, warnings, dosage, adverse reactions)
  - URL pattern: https://api.fda.gov/drug/label.json?search={query}&limit=10
  - Example encoded query used by the app: openfda.brand_name:"aspirin" OR openfda.generic_name:"aspirin"

- Drugs FDA endpoint — approval history and product metadata
  - URL pattern: https://api.fda.gov/drug/drugsfda.json?search={query}&limit=5
  - The app uses this to collect approvals, sponsor names, and product-level metadata.

- Enforcement endpoint — recalls and market actions
  - URL pattern: https://api.fda.gov/drug/enforcement.json?search={query}&limit=10
  - The app attaches recalls to matching results when the enforcement records mention the product.

Notes about behavior
- Endpoints may return 404 when no hits are available for a query — the app treats each endpoint independently and only shows a "no results" message when all three endpoints return nothing for the same query.
- The app implements a small retry/backoff for transient 5xx/network errors (configured in `js/api.js`).
- There is no API key required for OpenFDA for lightweight client usage, but the API is rate-limited. The code checks HTTP 429 and surfaces a friendly message.

## Caching & Storage
- Client cache: The app keeps a small in-memory and storage-backed cache (key: `medifind_api_cache_v1`) with a default TTL of 10 minutes to reduce duplicate network calls.
- Favorites: persisted in localStorage under `medifind_favorites_v1` and exported/imported via JSON.
- Settings: persisted in localStorage under `medifind_settings_v2`.

If localStorage writes fail due to quota, the app attempts sessionStorage and uses the centralized `reportUserError()` to inform the user.

## How to run locally
The app is a static site; any static server will work. You can also open `index.html` directly in your browser, but serving it is recommended for consistent behavior.

Example (PowerShell):

```powershell
# Run a quick local server from the project root
python -m http.server 8080

## the APIs i hit (endpoints)
these are the ones the app uses, raw urls below so you can test direct in browser if you want

- label endpoint (human readable sections: indications, warnings, dosage)
  - https://api.fda.gov/drug/label.json?search={query}&limit=10
  - query example used: openfda.brand_name:"aspirin" OR openfda.generic_name:"aspirin"

- drugsfda endpoint (approval history + sponsor/product metadata)
  - https://api.fda.gov/drug/drugsfda.json?search={query}&limit=5

- enforcement endpoint (recalls and market actions)
  - https://api.fda.gov/drug/enforcement.json?search={query}&limit=10

note: sometimes endpoints return 404 if nothing found. the app treats each one separate, and only shows "no results" to user if ALL three returned nothing. so if one is 404 but another has info, you still get results. (i did this because some names only show up in recalls etc)

then open http://localhost:8080 and try searching. easy.

## rate limits / errors
- OpenFDA is public and has rate limits. if you hit 429 the app will show a friendly message, its not silent.
- the app retries transient network/server failures small number of times, with backoff (see `js/api.js`).

## testing / things to try
1) search for "aspirin" or "ibuprofen" and see label + approvals
2) search for stuff that may only have recalls and see enforcement entries
3) save a favorite, reload page, check its still there

## notes / disclaimers
this is NOT medical advice. its a helper, use official sources for decisions. i know this is obvious but writing it here.

## repo
https://github.com/shyakafrancis123/medifind-webapp

-- end