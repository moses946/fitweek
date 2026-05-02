# FitWeek — Multi-Agent Implementation Plan

Version: 1.1 | Status: Draft | Date: 2026-05-02

---

## Guiding Principle: Vertical Slices, Not Horizontal Layers

Each issue is a **shippable vertical slice**: it owns everything from Supabase schema + RLS through API client hooks to the UI screens that use them. No issue should deliver only a database migration or only a screen skeleton. Every issue delivers a working feature end-to-end that a demo user can exercise.

**All agents follow Test-Driven Development (TDD).** For every module, tests are written before the implementation. Red → Green → Refactor. Tests are committed in the same PR as the code they cover, not as a follow-up. No module is considered done until its tests pass.

---

## Why Expo?

FitWeek is a React Native mobile application. Expo is the framework that makes building it feasible without needing native iOS/Android toolchains (Xcode, Android Studio, CocoaPods). Here is what Expo provides and why each part matters to FitWeek specifically:

| Native capability | Expo package | Why FitWeek needs it |
|---|---|---|
| Camera + photo library access | `expo-image-picker` | Garment upload flow — user photographs clothes |
| GPS location | `expo-location` | Weather service — get coordinates for OWM forecast |
| Haptic feedback | `expo-haptics` | Swipe deck — satisfying tap/swipe response |
| Local push notifications | `expo-notifications` | Sunday 7pm outfit planning reminder |
| File sharing / native share sheet | `expo-sharing`, `expo-file-system` | Calendar export (.ics) and share card |
| Secure storage | `expo-secure-store` | Session token persistence |

Without Expo, each of these would require writing Objective-C/Swift (iOS) and Java/Kotlin (Android) native modules and configuring them through Xcode and Gradle — weeks of work per capability. Expo wraps all of it into JavaScript APIs that work across both platforms from a single codebase.

**For the hackathon / demo**, no Expo account is needed. The app runs inside the free **Expo Go** client on a physical device or simulator — just scan a QR code. An Expo account (free tier) is only required if you later want to build a standalone `.ipa` or `.apk` binary for distribution via EAS Build. That is out of scope for v1.

---

## Intelligent Garment Labeling — No Manual Work

The PRD mentions Roboflow for garment classification. Here is why we are replacing it with a vision LLM, and how the pipeline works.

### Why not Roboflow alone

Roboflow's fashion model returns a single `category` and a `color` string. That is useful but shallow. It does not capture pattern, fabric weight, style, or formality — all of which affect whether a garment is appropriate for a given day's weather or occasion. More importantly, Roboflow's confidence scores are inconsistent on flat-lay photos taken in typical home lighting, which means the `< 0.70` fallback triggers often, dumping users into a manual correction flow that the product is supposed to avoid.

### The replacement: Vision LLM structured extraction

When a user photographs a garment, the image is sent to a vision-capable LLM (GPT-4o Vision via the Replit OpenAI integration, or Gemini Vision as a fallback) with a structured prompt that requests a JSON response. The model sees the full image and returns:

```json
{
  "category": "top",
  "subcategory": "t-shirt",
  "dominant_color": "navy blue",
  "secondary_color": "white",
  "pattern": "striped",
  "fabric_weight": "light",
  "style_tags": ["casual", "athletic"],
  "season_suitability": ["spring", "summer"],
  "formality": "casual",
  "ai_description": "Navy blue and white horizontal-striped cotton t-shirt, crew neck, short sleeves",
  "confidence": "high"
}
```

The `ai_description` field is particularly important: it is passed verbatim to the IDM-VTON API as the garment description parameter, which significantly improves try-on quality without any user input.

### What changes in the user experience

| Scenario | Roboflow behaviour | Vision LLM behaviour |
|---|---|---|
| Clear flat-lay, good lighting | Shows category + color, silent save | Saves category, color, pattern, style, description — silent, no interaction |
| Ambiguous photo (folded, partial) | Confidence < 0.70 → blank correction form | Returns `"confidence": "low"` → shows pre-filled confirmation card; user taps ✓ or adjusts one field |
| Completely unidentifiable | Saves as `uncategorized` → blank form | Returns best guess with explicit uncertainty flag → pre-filled form with "Please confirm this looks right" prompt |

The key difference in the fallback: instead of a blank category picker the user must fill out from scratch, they see a pre-filled card ("We think this is a navy striped t-shirt — is that right?"). A single tap confirms. Editing is one field at a time, not a full form.

### Schema additions

The `garments` table gains two fields:

```sql
ai_labels   jsonb    -- full structured output from vision LLM (pattern, style_tags, season, formality, etc.)
ai_description text  -- natural language garment description, used as VTO prompt input
```

`category` and `color` remain as top-level columns because they are indexed and used in the suggestion filter query. Everything else lives in `ai_labels` for flexible access without schema churn.

### TDD for the labeling pipeline

```
Test 1: given a mocked LLM response with confidence = 'high'
→ garment is saved with all fields populated, no correction UI shown

Test 2: given a mocked LLM response with confidence = 'low'
→ garment is saved with category = 'uncategorized', correction UI is shown with pre-filled values

Test 3: given an LLM API failure
→ garment is saved with category = 'uncategorized', ai_description = null, correction UI shown

Test 4: given a response where subcategory = 'dress'
→ category is normalised to 'dress' (not 'top'), matching the hero priority order
```

---

## Resolved Decisions

| Item | Decision |
|---|---|
| Supabase setup | Infra agent creates a new project from scratch after the full schema is finalised in this document |
| API keys | Owner provides all keys after the infra agent creates the `.env` file with placeholder entries |
| Garment classification | Vision LLM (GPT-4o / Gemini) replaces Roboflow. See "Intelligent Garment Labeling" section above |
| HF Pro access | Not available. VTO uses the free IDM-VTON Space with a visible loading state and explicit cold-start warning in UI. No queue-jumping; graceful error handling if the Space is unavailable |
| Expo account | Not required for v1. App runs in Expo Go for demo. EAS Build deferred |
| Test strategy | TDD in every issue. Each agent writes failing tests first, then implements to make them pass |
| VTO hero garment priority | `dress / overalls → tops / t-shirts / shirts → skirts / trousers` |

---

## Full Schema (settled before infra agent starts)

```sql
-- Matches auth.users.id; row created by trigger on first sign-in
users (
  id                uuid        PK,
  model_image_url   text,
  fallback_city     text,
  created_at        timestamptz DEFAULT now()
)

garments (
  id                uuid        PK DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id),
  category          text        NOT NULL,              -- 'dress' | 'top' | 'skirt' | 'trousers' | 'outerwear' | 'shoes' | 'uncategorized'
  color             text,
  image_url         text        NOT NULL,
  ai_labels         jsonb,                             -- full vision LLM output
  ai_description    text,                              -- natural language description for VTO
  status            text        NOT NULL DEFAULT 'clean', -- 'clean' | 'worn' | 'laundry'
  last_skipped_at   timestamptz,
  skip_until        date,
  deleted_at        timestamptz,
  created_at        timestamptz DEFAULT now()
)

outfit_slots (
  id                uuid        PK DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id),
  scheduled_date    date        NOT NULL,
  garment_ids       uuid[]      NOT NULL DEFAULT '{}',
  name              text,                              -- auto-generated on confirm if null
  status            text        NOT NULL DEFAULT 'draft', -- 'draft' | 'confirmed' | 'archived'
  vto_image_url     text,
  created_at        timestamptz DEFAULT now()
)
```

**RLS policy pattern (applied to all tables):**
```sql
-- Read
CREATE POLICY "owner_read" ON <table>
  FOR SELECT USING (auth.uid() = user_id);

-- Write
CREATE POLICY "owner_write" ON <table>
  FOR ALL USING (auth.uid() = user_id);
```

**Supabase Storage buckets:**
- `garments` — path pattern `/garments/{user_id}/{garment_id}` — private, owner-only RLS
- `user-models` — path pattern `/models/{user_id}/model.jpg` — private, owner-only RLS
- `vto-results` — path pattern `/vto/{user_id}/{slot_id}.jpg` — private, owner-only RLS

---

## Dependency Graph

```
Issue 1: Foundation + Auth
    └── Issue 2: Garment Ingestion + Closet (+ Intelligent Labeling)
            └── Issue 3: Garment Status + Laundry Basket
                    └── Issue 4: Weather Service + Suggestion Filter
                            └── Issue 5: Weekly Planner + Swipe Deck
                                    ├── Issue 6: Virtual Try-On (VTO)
                                    └── Issue 7: Calendar Export + Share Card
```

Issues 6 and 7 are parallel after Issue 5. All others are strictly sequential.

---

## Issue 1 — Foundation + Auth ⭐ START HERE

**Effort:** S (1–3 days) | **Blocks:** Everything

### Why start here

Authentication is the root dependency for every module. Supabase RLS policies on every table use `auth.uid()` — no table can be built correctly without the auth contract being settled first. The Supabase client singleton, session context provider, and Google OAuth flow must exist before any other agent can write a screen that touches real data.

### Infra agent — Supabase setup sequence

The infra agent creates the project from scratch in this order:
1. Create new Supabase project; note project URL and anon key
2. Create `.env` file in the repo with placeholder entries: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OWM_API_KEY`, `OPENAI_API_KEY` — owner fills in values
3. Enable Google OAuth in Supabase Auth dashboard
4. Run `users` table migration
5. Add RLS policies to `users`
6. Create DB trigger: on insert into `auth.users`, upsert corresponding row in `users`
7. Verify trigger fires correctly with a test sign-in

### TDD for this issue

```
Test 1: AuthContext — given a valid Supabase session in storage,
  useAuth() returns { user: <user>, session: <session>, isLoading: false }

Test 2: AuthContext — given no session in storage,
  useAuth() returns { user: null, session: null, isLoading: false }

Test 3: Auth gate — given unauthenticated state,
  root navigator renders the SignIn screen, not the tab navigator

Test 4: Auth gate — given authenticated state,
  root navigator renders the tab navigator and bypasses SignIn

Test 5: signOut() — clears session and navigates to SignIn
```

### Full-stack scope

**Infra agent**
- Supabase project + credentials in `.env`
- Google OAuth provider enabled
- `users` table + RLS + auth trigger (see schema above)

**Frontend agent**
- `supabase-js` client singleton (`lib/supabase.ts`)
- `AuthContext` + `useAuth` hook: exposes `session`, `user`, `signIn`, `signOut`, `isLoading`
- Google OAuth sign-in screen
- Session persistence via Supabase token refresh + `expo-secure-store`
- Root navigator auth gate: unauthenticated → SignIn; authenticated → Tab navigator
- Onboarding gate: first sign-in → model photo capture screen before tabs

**Contracts settled by this issue (all future agents depend on these):**
- `session.user.id` — canonical `user_id` FK
- `lib/supabase.ts` — import path for the Supabase client
- `useAuth()` — hook signature

### Acceptance criteria

```
Given: app opened for the first time
When: user taps "Sign in with Google"
Then: Google OAuth sheet opens; on success, session is persisted
And: user is redirected to the model photo capture screen

Given: app re-opened with a valid cached session
When: token has not expired
Then: user lands on tab navigator, bypassing sign-in

Given: user taps "Sign out"
When: confirmed
Then: session is cleared; sign-in screen is shown

Given: new user completes OAuth
When: auth.users trigger fires
Then: a row exists in users with id = auth.uid()
```

### Agents

| Agent | Work |
|---|---|
| Infra A | Supabase project, .env scaffold, users table + RLS + trigger, Google OAuth |
| Frontend B | Supabase client, AuthContext, sign-in screen, auth gate, session persistence, TDD test suite |

Frontend B can build and test the auth gate logic against a mocked Supabase client before Infra A delivers credentials.

---

## Issue 2 — Garment Ingestion + Intelligent Labeling + Closet

**Effort:** L (2–4 days, 3 agents) | **Blocked by:** Issue 1

### TDD for this issue

```
Test 1: labelGarment() — mocked LLM response with confidence 'high'
  → returns structured labels; needs_review = false

Test 2: labelGarment() — mocked LLM response with confidence 'low'
  → returns labels with needs_review = true

Test 3: labelGarment() — LLM API throws
  → returns { category: 'uncategorized', needs_review: true, ai_description: null }

Test 4: uploadGarment() — given a valid image URI
  → uploads to Supabase Storage; returns public URL

Test 5: createGarment() — given label result with needs_review = false
  → garment record created with correct category, color, ai_labels, ai_description

Test 6: createGarment() — given label result with needs_review = true
  → garment record created with category = 'uncategorized'; correction flag set in local state

Test 7: normaliseCategory() — given subcategory 'dress'
  → category output is 'dress' (not 'top')

Test 8: Closet grid — renders garments grouped by category
Test 9: Closet grid — garments with deleted_at set are not rendered
Test 10: Soft delete — sets deleted_at; garment disappears from grid without refetch
```

### Full-stack scope

**Infra agent**
- `garments` table migration (full schema including `ai_labels`, `ai_description`)
- RLS policies on `garments`
- Supabase Storage buckets: `garments`, `user-models` with owner-only policies

**Integration agent (labeling pipeline)**
- OpenAI Vision API wrapper (`lib/labelGarment.ts`):
  - Accepts image URL or base64 blob
  - Sends structured prompt requesting JSON response
  - Parses and validates response; normalises `subcategory` to `category` enum
  - Returns `{ category, color, ai_labels, ai_description, needs_review }`
- Storage upload helper: uploads image, returns public URL
- `createGarment()`: writes full record to Supabase

**Frontend agent**
- Camera / photo library picker (`expo-image-picker`)
- Upload flow: capture → upload to Storage → call `labelGarment` → save record
- Loading state during upload + classification (steps shown: "Uploading… Analysing…")
- Classification confirmation card (shown when `needs_review = true`): pre-filled fields, single-tap confirm or tap-to-edit
- Closet tab: browsable grid, grouped by category
- Garment card: flat-lay image, category chip, color swatch, status dot
- Edit garment screen: change category, color, any `ai_labels` field
- Delete garment: soft-delete with undo toast (3 seconds)
- Model photo screen: camera picker → upload to `user-models` bucket → update `users.model_image_url`

### Acceptance criteria

```
Given: user photographs a t-shirt in good lighting
When: labelGarment() runs
Then: category = 'top', ai_description is populated, needs_review = false
And: garment appears in Closet under "Tops" immediately

Given: LLM returns confidence = 'low' on a folded jacket
When: the garment record is created
Then: correction card is shown pre-filled with the LLM's best guess
And: user taps ✓ — garment is saved with the confirmed values

Given: OpenAI API is unreachable during upload
When: the upload flow runs
Then: garment is saved with category = 'uncategorized', correction card is shown
And: no unhandled error or crash occurs

Given: user long-presses a garment and taps "Delete"
When: soft-delete completes
Then: garment vanishes from closet; undo toast appears for 3 seconds
```

### Agents

| Agent | Work |
|---|---|
| Infra A | garments table, RLS, Storage buckets + RLS |
| Integration B | Vision LLM wrapper, upload helper, createGarment(), normalisation, TDD test suite |
| Frontend C | All garment screens, closet grid, model photo screen, TDD component tests |

---

## Issue 3 — Garment Status + Laundry Basket

**Effort:** M (1–2 days, 2 agents) | **Blocked by:** Issue 2

No new tables. This issue adds behaviour on top of the existing `garments` table fields.

### TDD for this issue

```
Test 1: markWorn(id) → status = 'worn' in DB
Test 2: sendToLaundry(id) → status = 'laundry'
Test 3: markWashed(id) → status = 'clean', skip_until = null
Test 4: skipForSession(id) → last_skipped_at = today's date
Test 5: skipForWeek(id) called on a Wednesday
  → skip_until = the following Monday's ISO date
Test 6: suggestion filter — garment with last_skipped_at = today → excluded
Test 7: suggestion filter — garment with last_skipped_at = yesterday → included
Test 8: suggestion filter — garment with skip_until = next Monday → excluded
Test 9: suggestion filter — garment with skip_until = last Monday → included
Test 10: Laundry Basket screen — only renders garments where status = 'laundry'
Test 11: markWashed() from basket — garment moves out of laundry list immediately
```

### Full-stack scope

**Logic agent**
- Status transition functions (thin Supabase update wrappers) in `lib/garmentStatus.ts`
- `markWorn`, `sendToLaundry`, `markWashed`, `skipForSession`, `skipForWeek`
- Each function validated by RLS (no server-side auth check needed; Supabase enforces it)
- Full unit test suite with mocked Supabase client

**Frontend agent**
- Long-press context menu on garment card: "Mark worn", "Send to laundry", "Edit", "Delete"
- Status indicator dot on garment card (green = clean, amber = worn, red = laundry)
- Laundry Basket tab: list of all `status = 'laundry'` garments; "Washed ✓" CTA per row
- Settings entry: "Retake model photo" → navigates to model photo screen from Issue 2

### Acceptance criteria

```
Given: user long-presses a clean garment and taps "Send to laundry"
When: sendToLaundry() completes
Then: status = 'laundry'; garment disappears from closet clean view
And: it appears in the Laundry Basket tab immediately

Given: user taps "Washed ✓" on a basket item
When: markWashed() completes
Then: status = 'clean'; skip_until = null; garment reappears in the clean closet

Given: skipForWeek called on Thursday 1 May
When: skip_until is written
Then: skip_until = '2025-05-05' (the following Monday)
```

### Agents

| Agent | Work |
|---|---|
| Logic A | Status functions, skip logic, TDD unit tests (mocked Supabase) |
| Frontend B | Long-press menu, status dots, Laundry Basket tab, TDD component tests |

---

## Issue 4 — Weather Service + Suggestion Filter

**Effort:** M (2–3 days, 2 agents) | **Blocked by:** Issue 3

### TDD for this issue

```
Test 1: getWeatherForecast() — mocked OWM success response
  → returns 7 days of parsed daily forecasts

Test 2: getWeatherForecast() — OWM fails, valid cache exists (< 24h old)
  → returns cached data; sets flag 'usingCache' = true

Test 3: getWeatherForecast() — OWM fails, no cache
  → returns null; sets flag 'weatherUnavailable' = true

Test 4: getSuggestableCategories() — 32°C sunny day
  → 'outerwear' and 'boots' excluded; 'sandals' included

Test 5: getSuggestableCategories() — 5°C rainy day
  → 'sandals' excluded; 'outerwear' included

Test 6: getSuggestableCategories() — weather unavailable
  → all categories returned (no filtering applied)

Test 7: suggestion filter — excludes status != 'clean'
Test 8: suggestion filter — excludes deleted_at IS NOT NULL
Test 9: suggestion filter — excludes last_skipped_at = today
Test 10: suggestion filter — excludes skip_until in the future
Test 11: suggestion filter — excludes garment_ids already in confirmed/draft slots this week
Test 12: suggestion filter — result order interleaves categories (top, trousers, top, trousers…)
Test 13: suggestion filter — newer garments (created_at DESC) surface first within category
```

### Full-stack scope

**Integration agent**
- OWM API wrapper (`lib/weather.ts`): `getWeatherForecast(lat, lon)` → 7-day parsed forecasts
- `expo-location` permission request; fallback to `users.fallback_city` geocoding via OWM
- AsyncStorage cache: write on success, read on failure, invalidate after 24 hours
- `getSuggestableCategories(date, forecast)`: static lookup table (category → min/max temp + conditions)
- Suggestion filter (`lib/suggestionFilter.ts`): Supabase query implementing all filter conditions
- Full unit test suite with mocked OWM responses and mocked Supabase client

**Frontend agent**
- Weather badge component: `<WeatherBadge temp={..} condition={..} />` used in day cells
- Location permission prompt on first app open
- Manual city input screen (shown when location denied)
- "Override weather filter" toggle per day (stored in local state, not persisted)
- Settings: "Change location" → manual city input screen
- "Using cached forecast" banner and "Weather unavailable" warning banner

### Acceptance criteria

```
Given: user grants location permission on first open
When: app loads
Then: OWM called with device GPS; forecast cached; weather badges populate in weekly view

Given: OWM fails and cache exists
When: suggestion filter runs
Then: cached forecast used; "Using cached forecast" banner shown

Given: user taps "Override weather filter" for Tuesday
When: swipe deck opens for Tuesday
Then: all clean, non-scheduled garments shown regardless of weather category

Given: suggestion filter called with userId and a date
When: all conditions evaluated
Then: result contains only clean, non-deleted, non-skipped, non-scheduled, weather-appropriate garments
And: result is interleaved by category with newer additions first within each category group
```

### Agents

| Agent | Work |
|---|---|
| Integration A | OWM wrapper, location permission, cache, category lookup, suggestion filter, TDD tests |
| Frontend B | Weather badge, location UI, city input, override toggle, setting, banners, TDD component tests |

---

## Issue 5 — Weekly Planner + Swipe Deck

**Effort:** L (3–5 days, 3 agents) | **Blocked by:** Issue 4

### TDD for this issue

```
Test 1: addGarmentToSlot(slotId, garmentId) → garment_ids array contains new ID
Test 2: removeGarmentFromSlot(slotId, garmentId) → garment_ids array no longer contains ID
Test 3: confirmSlot(slotId) where name is null
  → status = 'confirmed'; name auto-generated from garment categories e.g. "Top + Trousers"
Test 4: confirmSlot(slotId) where name is set
  → name unchanged
Test 5: clearSlot(slotId) → slot deleted; garment_ids no longer appear in any slot for this week
Test 6: renameSlot(slotId, 'Date Night') → name = 'Date Night'
Test 7: draft expiry — slot with created_at > 24h ago is deleted on cleanup run
Test 8: draft expiry — slot with created_at < 24h ago is preserved
Test 9: markAllWorn(slotId) → all garments in garment_ids have status = 'worn'
Test 10: Sunday notification — scheduled at 7pm local time on the current week's Sunday
Test 11: Swipe deck — swiping right calls addGarmentToSlot
Test 12: Swipe deck — swiping left calls skipForSession on that garment
Test 13: Swipe deck — when card count ≤ 3, skipped items are reintroduced
Test 14: Weekly grid — confirmed slots show outfit thumbnail; empty days show placeholder
```

### Full-stack scope

**Infra agent**
- `outfit_slots` table migration + RLS (see schema above)
- Draft expiry: Supabase scheduled function or app-open client cleanup deleting drafts > 24h old

**Logic agent**
- Slot mutation functions in `lib/outfitSlots.ts`
- `addGarmentToSlot`, `removeGarmentFromSlot`, `confirmSlot`, `clearSlot`, `renameSlot`
- `markGarmentWorn`, `markAllWorn`
- Auto-name generator: concatenate category labels of garment_ids e.g. "Dress" or "Top + Trousers + Shoes"
- Sunday notification: `expo-notifications` local trigger, 7pm in device local timezone

**Frontend agent**
- Weekly planner view: Mon–Sun grid; weather badge per day; outfit thumbnail or empty state
- Day cell tap → swipe deck screen for that day
- Swipe deck: card stack with `react-native-deck-swiper` or `react-native-gesture-handler`
  - Swipe right → add to outfit assembly; swipe left → skip (skipForSession)
  - "Skip for this week" long-press action on card → skipForWeek
  - Haptic: `expo-haptics` light impact on each swipe; success notification on confirm
- Outfit assembly panel (bottom sheet): thumbnail row, updates in real time as swipes occur
- Low-deck warning: visible banner when ≤ 3 cards remain; skipped items reintroduced automatically
- Confirm / Discard buttons on assembly panel
- Confirmed outfit card on calendar: thumbnail, name, edit / clear / rename / "Mark all worn" actions
- Edit mode: re-open swipe deck for that day; remove individual items from assembled list

### Acceptance criteria

```
Given: user taps Monday in the weekly planner and the swipe deck opens
When: the deck is loaded
Then: only clean, weather-appropriate, non-scheduled garments for Monday are shown

Given: user swipes right on a dress and taps "Confirm outfit"
When: confirmSlot() completes
Then: status = 'confirmed'; the dress is excluded from all other days' suggestion decks this week

Given: user clears Monday's confirmed outfit
When: clearSlot() completes
Then: the dress reappears in the suggestion pool for all other days

Given: swipe deck reaches ≤ 3 remaining cards
When: user swipes
Then: session-skipped cards are silently appended to the bottom of the deck; no empty-deck state shown

Given: the app is opened on Monday and there is a draft slot from Saturday
When: startup cleanup runs
Then: the Saturday draft slot is deleted
```

### Agents

| Agent | Work |
|---|---|
| Infra A | outfit_slots table, RLS, draft expiry function |
| Logic B | Slot mutation functions, auto-name generator, markAllWorn, Sunday notification, TDD tests |
| Frontend C | Weekly planner, swipe deck, outfit assembly panel, all outfit actions, TDD component tests |

---

## Issue 6 — Virtual Try-On (VTO)

**Effort:** M (1–2 days, 2 agents) | **Blocked by:** Issue 5 | **Parallel with:** Issue 7

### Hero garment priority

```
dress / overalls  →  tops / t-shirts / shirts  →  skirts / trousers
```

Only the single hero garment is sent per VTO generation. Multi-garment compositing is deferred to v2.

### Handling the free-tier IDM-VTON Space

The Space has no SLA. Cold starts take 30–60 seconds after inactivity. There is no HF Pro account to skip the queue. The app must handle this gracefully:

- Show a full-screen loading state with a progress message: "Generating your try-on — this can take up to 60 seconds"
- Allow the user to cancel the request and return to the outfit view without losing the confirmed outfit
- If the Space returns a queue timeout or error, show a toast: "Try-on is busy right now — try again in a few minutes"
- Retry is always manual; no background polling

### TDD for this issue

```
Test 1: selectHeroGarment([dress, jacket, trousers]) → returns the dress
Test 2: selectHeroGarment([jacket, trousers]) → returns jacket (no dress present)
Test 3: selectHeroGarment([trousers]) → returns trousers
Test 4: selectHeroGarment([]) → returns null; no API call made
Test 5: callVTO() — mocked Gradio success → result blob returned
Test 6: callVTO() — mocked Gradio timeout → throws with code 'VTO_TIMEOUT'
Test 7: callVTO() — mocked Gradio error → throws with code 'VTO_ERROR'
Test 8: saveVTOResult(slotId, blob) → uploads to vto-results bucket; writes vto_image_url to slot
Test 9: VTO flow — model_image_url is null → call is not made; user is redirected to settings
Test 10: VTO result displayed on outfit card after successful generation
```

### Full-stack scope

**Integration agent**
- `@gradio/client` wrapper (`lib/vto.ts`):
  - `selectHeroGarment(garments[])` — returns single hero using category priority
  - Fetch model image and garment image as blobs
  - Call `yisol/IDM-VTON` `/tryon` endpoint with correct parameter shape
  - `saveVTOResult(slotId, blob)` — uploads to `vto-results` bucket; writes `vto_image_url` to `outfit_slots`
- Full unit test suite with mocked Gradio client

**Frontend agent**
- "Generate Try-On" button on confirmed outfit card (hidden if `model_image_url` is null)
- Full-screen loading overlay with cancel button
- VTO result displayed inline on outfit card and in weekly calendar day view
- "Add model photo" prompt if model photo is missing

### Acceptance criteria

```
Given: confirmed outfit contains overalls, a top, and trousers
When: "Generate Try-On" is tapped
Then: overalls is selected as hero; VTO is called with the overalls image

Given: IDM-VTON Space is cold and takes 55 seconds
When: user waits
Then: loading state is visible the entire time; result is shown when the call completes

Given: IDM-VTON returns a queue timeout
When: error is caught
Then: toast shown: "Try-on is busy right now — try again in a few minutes"
And: outfit remains confirmed; no state is lost

Given: user has no model photo
When: they tap "Generate Try-On"
Then: they are navigated to Settings > Retake Model Photo; VTO is not called
```

### Agents

| Agent | Work |
|---|---|
| Integration A | Gradio wrapper, hero selector, blob fetcher, Storage upload, slot update, TDD tests |
| Frontend B | Try-on button, loading overlay with cancel, result display, missing photo prompt, TDD tests |

---

## Issue 7 — Calendar Export + Share Card

**Effort:** S (1 day, 1 agent) | **Blocked by:** Issue 5 | **Parallel with:** Issue 6

Client-only. No new tables or RLS required.

### TDD for this issue

```
Test 1: generateICS([slot1, slot2], weatherForecast)
  → output is a valid iCal string; contains BEGIN:VCALENDAR and END:VCALENDAR
Test 2: each event contains SUMMARY = slot name (or auto-generated name)
Test 3: each event contains DESCRIPTION with garment list and weather summary
Test 4: slot with no custom name → SUMMARY uses auto-generated category-based name
Test 5: soft-deleted garment referenced in slot → skipped silently in garment list
Test 6: generateShareCard(slot) where vto_image_url is set → uses VTO image
Test 7: generateShareCard(slot) where vto_image_url is null → composes 2×2 flat-lay collage
Test 8: share sheet is opened with correct MIME type for .ics file
```

### Full-stack scope

**Calendar export**
- `generateICS(outfitSlots, weatherForecast)` → valid `.ics` string
- Soft-deleted garments in `garment_ids` are silently skipped (no error)
- Export button in weekly view header
- `expo-file-system` writes `.ics` to temp directory; `expo-sharing` opens native share sheet

**Share card**
- `generateShareCard(slot)`: VTO image if available, else 2×2 flat-lay collage
- Day label + weather badge overlaid on image
- React Native `Share` API opens native share sheet
- Share button on each confirmed outfit card

### Acceptance criteria

```
Given: user taps "Export week to calendar"
When: confirmed slots are fetched and ICS generated
Then: native share sheet opens with a valid .ics file attached
And: each event includes outfit name, garment list, and weather summary

Given: slot references a soft-deleted garment
When: ICS is generated
Then: that garment is silently omitted; no crash; other garments in the event are correct

Given: outfit has vto_image_url set
When: user taps "Share outfit card"
Then: VTO image is used in the share card

Given: outfit has no vto_image_url
When: user taps "Share outfit card"
Then: 2×2 flat-lay collage is composed from garment images
```

### Agents

| Agent | Work |
|---|---|
| Single A | ICS generator, share card composer, share sheet wiring, export + share buttons, full TDD test suite |

---

## Build Priority

| Priority | Issue | Rationale |
|---|---|---|
| 1 | Issue 1: Auth | Root dependency; nothing else is buildable without `auth.uid()` |
| 2 | Issue 2: Garment Ingestion + Labeling | Core wardrobe data; all filtering depends on it |
| 3 | Issue 3: Garment Status | Laundry basket is the product's #1 differentiator |
| 4 | Issue 4: Weather + Filter | Suggestion engine unlocks the swipe deck |
| 5 | Issue 5: Swipe Deck + Planner | The central UX — the "Tinder for your wardrobe" moment |
| 6 | Issue 6: VTO | Demo wow factor |
| 7 | Issue 7: Calendar Export + Share | Polish; parallel with VTO |

---

## Agent Parallelism Summary

```
Phase 1 (Issue 1):   [Infra A: Supabase project + users table] ──┐
                     [Frontend B: Auth shell, tests, stubbed]      ┘ → Auth done

Phase 2 (Issue 2):   [Infra A: garments table + Storage]  ────────────┐
                     [Integration B: Vision LLM + upload]  ─────────────┤ → Closet done
                     [Frontend C: Camera, closet grid, edit]  ──────────┘

Phase 3 (Issue 3):   [Logic A: Status functions + tests]  ──────┐
                     [Frontend B: Long-press menu, basket tab]  ──┘ → Status done

Phase 4 (Issue 4):   [Integration A: OWM + filter + tests]  ──────┐
                     [Frontend B: Weather UI + location]  ──────────┘ → Filter done

Phase 5 (Issue 5):   [Infra A: outfit_slots table]  ────────────────────────────┐
                     [Logic B: Slot functions + notification]  ───────────────────┤ → Planner done
                     [Frontend C: Swipe deck + weekly grid]  ────────────────────┘

Phase 6 (parallel):  [VTO — Integration A + Frontend B]  ──────┐
                     [Export — Single A]  ───────────────────────┘ → Done
```

---

## .env File Structure (infra agent creates this first, owner fills values)

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=

# OpenAI (Vision LLM for garment labeling)
OPENAI_API_KEY=

# OpenWeatherMap
OWM_API_KEY=
```
