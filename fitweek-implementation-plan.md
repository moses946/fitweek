# FitWeek — Multi-Agent Implementation Plan

Version: 1.0 | Status: Draft | Date: 2026-05-02

---

## Guiding Principle: Vertical Slices, Not Horizontal Layers

Each issue is a **shippable vertical slice**: it owns everything from Supabase schema + RLS through API client hooks to the UI screens that use them. No issue should deliver only a database migration or only a screen skeleton. Every issue delivers a working feature end-to-end that a demo user can exercise.

---

## Dependency Graph

```
Issue 1: Foundation + Auth
    └── Issue 2: Garment Ingestion + Closet
            └── Issue 3: Garment Status + Laundry Basket
                    └── Issue 4: Weather Service + Suggestion Filter
                            └── Issue 5: Weekly Planner + Swipe Deck
                                    ├── Issue 6: Virtual Try-On (VTO)
                                    └── Issue 7: Calendar Export + Share Card
```

Issues 6 and 7 are parallel after Issue 5 completes. All other issues are strictly sequential — each gates the next.

---

## Issue 1 — Foundation + Auth ⭐ START HERE

**Effort:** S (1–3 days)
**Blocks:** Everything

### Why start here

Authentication is the root dependency for every module. Supabase RLS policies on every table use `auth.uid()` — no table can be built correctly without the auth contract being settled first. The Supabase client singleton, session context provider, and Google OAuth flow must exist before any other agent can write a screen that touches real data.

### Full-stack scope

**Supabase (infrastructure agent)**
- Supabase project initialised; `SUPABASE_URL` and `SUPABASE_ANON_KEY` added to env
- Enable Google OAuth provider in Supabase Auth dashboard
- `users` table created:
  ```sql
  users (
    id uuid PK,           -- matches auth.users.id
    model_image_url text,
    fallback_city text,
    created_at timestamptz
  )
  ```
- RLS: `users` readable/writable only by the owning user (`auth.uid() = id`)
- Trigger or function: on first `auth.users` insert, upsert a row into `users`

**Client (design/frontend agent)**
- `supabase-js` client singleton initialised with env vars
- `AuthContext` provider: exposes `session`, `user`, `signIn`, `signOut`
- Google OAuth sign-in screen (full-page, not modal)
- Session persistence across app restarts via Supabase's built-in token refresh
- Auth gate in root `_layout.tsx`: unauthenticated → sign-in screen; authenticated → app tabs
- Onboarding flag: after first sign-in, navigate to model photo capture before the main tabs

**Contracts settled by this issue**
- `session.user.id` is the canonical `user_id` FK used by every subsequent issue
- `supabase` client import path is fixed for all future agents

### Acceptance criteria (Gherkin)

```
Given: the app is opened for the first time
When: the user taps "Sign in with Google"
Then: Google OAuth sheet opens; on completion, session is persisted
And: the user is redirected to the model photo capture screen

Given: the app is re-opened with a valid session
When: the session token has not expired
Then: the user lands directly on the main tabs, bypassing sign-in

Given: the user taps "Sign out" in settings
When: confirmed
Then: session is cleared and the sign-in screen is shown
```

### Agents

| Agent | Work |
|---|---|
| Agent A (infra) | Supabase project setup, users table, RLS, Google OAuth, trigger |
| Agent B (frontend) | Supabase client, AuthContext, sign-in screen, auth gate, routing |

Agent B can start writing the UI shell (routing, placeholder tabs) before Agent A finishes — it just stubs the Supabase calls with `TODO` until credentials are ready.

---

## Issue 2 — Garment Ingestion + Closet Management

**Effort:** L (2–4 weeks, 2 agents)
**Blocked by:** Issue 1

### Full-stack scope

**Supabase (infra agent)**
- `garments` table:
  ```sql
  garments (
    id uuid PK,
    user_id uuid FK → users.id,
    category text,
    color text,
    image_url text,
    status text,          -- 'clean' | 'worn' | 'laundry'
    last_skipped_at timestamptz,
    skip_until date,
    deleted_at timestamptz,
    created_at timestamptz
  )
  ```
- RLS: all operations restricted to `auth.uid() = user_id`
- Supabase Storage bucket: `garments` (user-scoped path `/garments/{user_id}/{garment_id}`)
- Storage RLS: read/write only to owning user's path

**Backend integration layer (integration agent)**
- Roboflow API wrapper: POST image → `{ category, color, confidence }`
- Confidence routing: `≥ 0.70` → silent classification; `< 0.70` or unrecognised category → `category = 'uncategorized'` + `needs_review = true`
- Supabase Storage upload helper (returns public URL)
- Soft-delete helper: sets `deleted_at = now()`

**Client (design agent)**
- Camera / photo library picker (Expo ImagePicker)
- Upload flow: capture → upload to Storage → send URL to Roboflow → save garment record
- Classification review screen: shown when `needs_review = true`; lets user pick correct category + colour from a picklist
- Closet tab: browsable grid view, grouped by category
- Garment card: flat-lay image, category label, colour badge, status indicator
- Edit garment screen: change category or colour
- Delete garment: soft-delete with confirmation prompt
- Model photo capture: full-body photo picker/camera; uploads to `users/{user_id}/model.jpg`; updates `users.model_image_url`

### Acceptance criteria

```
Given: user taps "Add garment" and captures a photo
When: Roboflow returns confidence ≥ 0.70
Then: garment is saved silently with the classified category and colour
And: it appears immediately in the closet grid under the correct category group

Given: Roboflow returns confidence < 0.70
When: the garment record is created
Then: category = 'uncategorized' and the correction screen is shown before navigating away

Given: user taps the delete icon on a garment and confirms
When: the request completes
Then: deleted_at is set; the garment disappears from the closet grid immediately

Given: the Roboflow API is unreachable
When: the upload flow is attempted
Then: the garment is saved with category = 'uncategorized', the correction screen is shown, and no error is thrown to the user
```

### Agents

| Agent | Work |
|---|---|
| Agent A (infra) | garments table, RLS, Storage bucket + RLS |
| Agent B (integration) | Roboflow wrapper, Storage upload helper, soft-delete helper |
| Agent C (frontend) | All garment screens (camera, review, closet grid, edit, delete, model photo) |

Agent C can build the closet grid with mock data while Agents A and B finish, then wire up real calls.

---

## Issue 3 — Garment Status + Laundry Basket

**Effort:** M (1–2 weeks, 1–2 agents)
**Blocked by:** Issue 2

### Full-stack scope

No new tables. This issue adds behaviour to the `garments` table's existing `status`, `last_skipped_at`, and `skip_until` fields.

**Logic layer (can be a Supabase Edge Function or client-side service)**
- `markWorn(garmentId)` → `status = 'worn'`
- `sendToLaundry(garmentId)` → `status = 'laundry'`
- `markWashed(garmentId)` → `status = 'clean'`, clears `skip_until`
- `skipForSession(garmentId)` → `last_skipped_at = now()`
- `skipForWeek(garmentId)` → `skip_until = next Monday's ISO date`

**Client**
- Long-press context menu on garment card: "Mark worn", "Send to laundry", "Edit", "Delete"
- Status indicator badge on garment card (colour-coded dot: green = clean, amber = worn, red = laundry)
- Laundry Basket tab: lists all garments where `status = 'laundry'`; each row has a "Washed ✓" action
- "Skip for this week" swipe action available in the swipe deck (implemented here as the data contract; UI in Issue 5)
- Settings: retake model photo (navigates to model photo capture from Issue 2)

### Acceptance criteria

```
Given: user long-presses a clean garment card
When: they tap "Send to laundry"
Then: status becomes 'laundry'; the garment disappears from the clean view immediately
And: it appears in the Laundry Basket tab

Given: user taps "Washed ✓" on a laundry basket item
When: the request completes
Then: status returns to 'clean'; skip_until is cleared; the garment reappears in the clean closet

Given: skipForWeek is called on a garment on a Wednesday
When: the suggestion filter runs on any day before the following Monday
Then: the garment is excluded from results

Given: skipForSession is called on a garment at 11pm
When: the suggestion filter runs the following calendar day
Then: the garment is included again (last_skipped_at date ≠ today)
```

### Agents

| Agent | Work |
|---|---|
| Agent A (logic + data) | Status transition functions with RLS-safe Supabase updates; skip logic; unit tests for each transition |
| Agent B (frontend) | Long-press menu, status badges, Laundry Basket tab, Washed action |

---

## Issue 4 — Weather Service + Suggestion Filter

**Effort:** M (1–2 weeks, 2 agents)
**Blocked by:** Issue 3

### Full-stack scope

**Weather service (integration agent)**
- OpenWeatherMap API key in env (`OWM_API_KEY`)
- `getWeatherForecast(lat, lon)` → 7-day daily forecasts
- Location permission flow: request GPS; on denial, fall back to `users.fallback_city` geocoded via OWM
- AsyncStorage cache: store last successful forecast; valid for 24 hours
- Cache fallback: if API fails and cache exists → serve cache + show "Using cached forecast" banner
- No-cache fallback: if API fails and no cache → return all categories + show warning banner
- `getSuggestableCategories(date, forecast)`: static lookup table mapping weather conditions + temp range → allowed garment categories

**Suggestion filter (integration agent — same agent or parallel)**
- Supabase query function: given `userId` and `date`, returns filtered garments:
  - `status = 'clean'`
  - `deleted_at IS NULL`
  - `last_skipped_at` date ≠ today
  - `skip_until IS NULL OR skip_until < today`
  - `id NOT IN` (garment IDs in confirmed or draft slots for this ISO week)
  - `category IN` (categories from `getSuggestableCategories`)
- Result ordering: interleave by category (top → bottom → outerwear → top → …), then by `created_at DESC`

**Client (design agent)**
- Weather badge component: temp + condition icon; used in day cells of the weekly calendar
- Location permission request on first open
- Manual city input screen (shown when location is denied)
- Weather override toggle per day (lets user ignore filter for a specific day)
- Settings: change saved location
- Weather data refreshed on every app open (not background)

### Acceptance criteria

```
Given: user grants location permission
When: the app opens
Then: OWM API is called with device GPS coords; result is cached in AsyncStorage

Given: OWM API call fails and a cache exists (< 24h old)
When: the suggestion filter runs
Then: cached forecast is used; "Using cached forecast" banner is shown

Given: a 32°C sunny forecast
When: getSuggestableCategories is called for that date
Then: heavy coats and boots are excluded from the returned category set

Given: the user taps "Override weather filter" for a day
When: the suggestion filter runs for that day
Then: all clean garments are returned regardless of temperature/condition
```

### Agents

| Agent | Work |
|---|---|
| Agent A (integration) | OWM API wrapper, location permission, AsyncStorage cache, `getSuggestableCategories` lookup table, suggestion filter Supabase query, unit tests for filter edge cases |
| Agent B (frontend) | Weather badge, location permission UI, manual city screen, override toggle, settings location change |

---

## Issue 5 — Weekly Planner + Swipe Deck

**Effort:** L (2–4 weeks, 2–3 agents)
**Blocked by:** Issue 4

### Full-stack scope

**Supabase (infra agent)**
- `outfit_slots` table:
  ```sql
  outfit_slots (
    id uuid PK,
    user_id uuid FK → users.id,
    scheduled_date date,
    garment_ids uuid[],
    name text,           -- auto-generated if null on confirm
    status text,         -- 'draft' | 'confirmed' | 'archived'
    vto_image_url text,
    created_at timestamptz
  )
  ```
- RLS: all operations restricted to `auth.uid() = user_id`
- Draft expiry: on app open, delete draft slots where `created_at < now() - interval '24 hours'`

**Logic layer**
- `addGarmentToSlot(slotId, garmentId)` → append to `garment_ids`
- `removeGarmentFromSlot(slotId, garmentId)` → remove from `garment_ids`
- `confirmSlot(slotId)` → `status = 'confirmed'`; auto-generate `name` from garment list if null
- `clearSlot(slotId)` → delete slot entirely (restoring garments to filter pool)
- `renameSlot(slotId, name)` → update `name`
- `markGarmentWorn(garmentId)` → calls `markWorn` from Issue 3
- `markAllWorn(slotId)` → marks all garments in slot as worn

**Client (design agent)**
- Weekly planner view: Mon–Sun grid; each day shows weather badge, outfit thumbnail if confirmed, empty state if not
- Day cell tap → opens swipe deck for that day
- Swipe deck: card stack of filtered garments (from Issue 4's suggestion filter)
  - Swipe right → add to outfit; swipe left → skip
  - "Skip for this week" button on deck card
  - Haptic feedback: light impact on each swipe; success notification on confirm
- Outfit assembly panel: thumbnail row of swiped-right garments, updates in real time
- Low-deck warning: when ≤ 3 cards remain, reintroduce skipped items
- Confirm / Discard outfit actions
- Edit confirmed outfit: re-open deck in edit mode; remove individual items
- Clear day button
- Rename outfit: inline text field on confirmed outfit card
- "Mark as worn" button on confirmed outfit
- Sunday 7pm local reminder: Expo Notifications, scheduled locally, no backend

### Acceptance criteria

```
Given: user opens the weekly planner and taps Monday
When: the swipe deck opens
Then: only clean, weather-appropriate, non-scheduled garments are shown for Monday

Given: user swipes right on 3 garments and taps "Confirm outfit"
When: confirmSlot completes
Then: status = 'confirmed'; those 3 garment IDs are excluded from suggestion decks for all other days this week

Given: user clears Monday's confirmed outfit
When: clearSlot completes
Then: the 3 garments reappear in the suggestion pool for all days

Given: the swipe deck falls to ≤ 3 unshown cards
When: the user tries to swipe
Then: previously skipped cards are reintroduced and the deck continues without interruption

Given: the app is opened on a day when a draft slot is > 24 hours old
When: the startup cleanup runs
Then: the draft slot is deleted
```

### Agents

| Agent | Work |
|---|---|
| Agent A (infra) | outfit_slots table, RLS, draft expiry function |
| Agent B (logic) | All slot mutation functions, markWorn/markAllWorn wiring, Sunday notification scheduling |
| Agent C (frontend) | Weekly planner view, swipe deck, outfit assembly panel, confirm/edit/clear/rename/worn actions |

---

## Issue 6 — Virtual Try-On (VTO)

**Effort:** M (1–2 weeks, 1–2 agents)
**Blocked by:** Issue 5
**Parallel with:** Issue 7

### Full-stack scope

**Integration agent**
- `@gradio/client` npm package
- `callVTO(modelImageUrl, garmentImageUrl, description)`:
  - Fetch both images as blobs (model + hero garment)
  - Hero garment selection: priority `dress → top/shirt → jacket/outerwear → trousers/skirt`
  - Call `yisol/IDM-VTON` space `/tryon` endpoint
  - On success: upload result image to Supabase Storage at `vto/{user_id}/{slot_id}.jpg`; update `outfit_slots.vto_image_url`
  - On failure: surface error toast; do not update the slot

**Client**
- "Generate Try-On" button on confirmed outfit cards
- Full-screen loading state: visible progress indicator + "This may take up to 60 seconds" message (cold start latency)
- VTO result displayed inline on the outfit card and in the weekly calendar day view
- Model photo missing state: prompt user to add model photo first

### Acceptance criteria

```
Given: a confirmed outfit contains a dress and a jacket
When: "Generate Try-On" is tapped
Then: the dress is selected as the hero garment (highest priority)
And: the IDM-VTON API is called with the model image and dress image

Given: the API call succeeds
When: the result image is received
Then: it is uploaded to Storage; vto_image_url is written to the outfit_slot; the image is shown on the outfit card

Given: the user has no model_image_url set
When: they tap "Generate Try-On"
Then: they are prompted to add a model photo in settings before the call is made
```

### Agents

| Agent | Work |
|---|---|
| Agent A (integration) | @gradio/client wrapper, hero garment selector, Storage upload, outfit_slot update, unit tests for hero selector |
| Agent B (frontend) | Try-on button, loading state, result display, missing-model-photo prompt |

---

## Issue 7 — Calendar Export + Share Card

**Effort:** S (1–3 days, 1 agent)
**Blocked by:** Issue 5
**Parallel with:** Issue 6

### Full-stack scope

This issue is client-only; no new tables or RLS required.

**Client**
- **Calendar export:**
  - `generateICS(outfitSlots, weatherForecast)` → valid iCal `.ics` string
  - Each event: slot `name` (auto-generated if null), garment list, weather summary
  - Export triggered by a single button in the weekly view header
  - Uses `expo-sharing` to open the native share sheet with the `.ics` file
- **Share card:**
  - `generateShareCard(slot)`:
    - If `vto_image_url` populated → use VTO image
    - Else → compose 2×2 flat-lay grid collage of garment images
  - Overlay: day label + weather badge
  - Uses React Native `Share` API to open native share sheet
  - Share button visible on each confirmed outfit card

### Acceptance criteria

```
Given: user taps "Export week to calendar"
When: all confirmed slots are fetched
Then: a valid .ics file is generated; native share sheet opens with the file attached
And: each event contains the outfit name, garment list, and weather summary for that day

Given: an outfit has vto_image_url populated
When: user taps "Share outfit card"
Then: the share card uses the VTO image, not the flat-lay collage

Given: an outfit has no vto_image_url
When: user taps "Share outfit card"
Then: a 2×2 collage of garment flat-lays is composed and used as the share card image
```

### Agents

| Agent | Work |
|---|---|
| Agent A (fullstack) | ICS generator, share card composer, share sheet integration, export + share buttons |

---

## Recommended Starting Point

**Begin with Issue 1 — Foundation + Auth.**

The reason is not merely convention — it is a hard technical constraint. Every subsequent issue writes Supabase RLS policies that reference `auth.uid()`. If auth is not settled first, every other agent will make assumptions about the user context that later prove wrong or require rewriting. Starting here lets all later agents import the real `supabase` client singleton and `useAuth` hook from day one.

**Parallelism within Issue 1:** Agent A (infra) and Agent B (frontend) can work simultaneously once the Supabase project is created and credentials are available. The frontend agent can build the routing shell and sign-in screen UI against a stubbed auth context, then replace the stub when Agent A delivers the working Supabase integration.

---

## Build Priority (from PRD hackathon notes)

| Priority | Issue | Rationale |
|---|---|---|
| 1 | Issue 1: Auth | Root dependency; gates everything |
| 2 | Issue 2: Garment Ingestion | Core data asset; nothing is filterable without a wardrobe |
| 3 | Issue 3: Garment Status | Laundry filtering is the product's #1 differentiator |
| 4 | Issue 4: Weather + Filter | Suggestion engine unlocks the swipe deck |
| 5 | Issue 5: Swipe Deck + Planner | Primary UX — the "Tinder for your wardrobe" moment |
| 6 | Issue 6: VTO | Demo wow factor; independent of export |
| 7 | Issue 7: Calendar Export + Share | Polish tier; independent of VTO |

---

## Agent Parallelism Summary

```
Time →

Phase 1 (Issue 1):   [Infra A] ──────┐
                     [Frontend B] ────┘ → Auth complete

Phase 2 (Issue 2):   [Infra A] ────────────────────────────────┐
                     [Integration B] ───────────────────────────┤ → Closet complete
                     [Frontend C] ──────────────────────────────┘

Phase 3 (Issue 3):   [Logic A] ──────────┐
                     [Frontend B] ────────┘ → Status complete

Phase 4 (Issue 4):   [Integration A] ───────────┐
                     [Frontend B] ───────────────┘ → Weather + Filter complete

Phase 5 (Issue 5):   [Infra A] ───────────────────────────────────────┐
                     [Logic B] ─────────────────────────────────────────┤ → Planner complete
                     [Frontend C] ──────────────────────────────────────┘

Phase 6 (parallel):  [VTO — Agent A + B] ────────────┐
                     [Export — Agent A] ───────────────┘ → Done
```

Maximum parallelism: Issues 6 and 7 can run simultaneously after Issue 5. Within each issue, infra, logic, and frontend agents can overlap as described above.

---

## Open Questions (resolve before building)

1. **Supabase project**: Does one exist, or does the infra agent create it from scratch?
2. **API keys**: `OWM_API_KEY` (OpenWeatherMap), `ROBOFLOW_API_KEY` — who provides these and are they already in env?
3. **Hugging Face rate limits**: IDM-VTON Space is free but rate-limited and has 30–60s cold starts. Is a HF Pro account available to reduce queue time?
4. **Expo account**: Required for Expo push notifications (though Sunday reminder is local, no backend push needed for v1). An Expo account may be needed for EAS builds.
5. **Test environment**: The PRD calls for unit tests on 7 modules. Should each issue's agent write tests as part of the issue, or is testing a separate phase?
