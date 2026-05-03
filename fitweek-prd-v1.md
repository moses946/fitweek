---
Version: 1.0
Last updated: 2026-05-03
Status: Draft
Owner: Solo builder
---

### Changelog

| Version | Date       | Author | Change summary  |
|---------|------------|--------|-----------------|
| 1.0     | 2026-05-03 | PM     | Initial draft — 5 issues from live QA session |

---

# FitWeek — Bug Fix & Feature PRD (Sprint 1)

## Product stage
Iteration on an existing working app. MVP is live. This sprint closes the gap between "it runs" and "it works."

---

## Problem

Five issues discovered during live QA prevent FitWeek from being a coherent daily-use product:

1. **Profile → Update model photo navigates to the wrong screen** — the route resolves to the closet tab instead of the model-photo onboarding screen.
2. **Weather API returns 503** — `OWM_API_KEY` is set in `.env` but not in Replit Secrets, so the server never loads it and the API is dead for all users.
3. **Profile page: Change location and Notifications buttons are inert** — `onPress` is undefined; tapping does nothing and leaves no feedback.
4. **Planner has no way to plan a full week of outfits** — the day-by-day swipe flow exists but there is no "suggest the whole week" entry point. Users have to open each of 7 days manually.
5. **Google Cloud Vision returns broad category tags and no colour** — the `classifyFromLabels` function maps raw Vision labels to buckets (e.g. "T-shirt" → "tops") and loses the specific label. The colour extraction works server-side but the result is not propagated back to the Garment's `color` field correctly in the add-garment flow.

---

## Alternatives & Competitive Landscape

| Alternative | How users solve this today | Gap we exploit |
|---|---|---|
| Stylebook / YourCloset | Manual categorisation, no AI | We auto-classify; bugs here erode that advantage |
| Smart Closet | Weather integration but no VTO | We have VTO; broken weather weakens the diff |
| Status quo (no app) | Screenshots + mental inventory | Any friction sends them back to screenshot folders |

---

## Issues — Detail, Root Cause, and Acceptance Criteria

---

### Issue 1 — Model photo link navigates to closet

**Root cause (confirmed in code)**
`settings.tsx` line 105:
```ts
onPress={() => router.push("/(onboarding)/model-photo")}
```
The route is correct but the `(onboarding)` group layout is not excluded from the `AuthGate`'s "already onboarded" redirect, so the router intercepts and sends the user to the closet (the default authenticated tab). The `_layout.tsx` AuthGate only excludes `segments[0] === "auth"`, not `"(onboarding)"`.

**Scope**: XS — one-line guard change in `_layout.tsx`.

**Acceptance criteria**
```
Given: a signed-in user who has completed onboarding
When:  they tap "Update model photo" on the Profile screen
Then:  the model-photo screen opens
And:   they can pick a new photo and save it without being redirected
And:   pressing the back button returns them to Profile
```

---

### Issue 2 — Weather API returns 503 (OWM_API_KEY not loaded)

**Root cause (confirmed in server logs)**
The Express server reads `process.env.OWM_API_KEY`. The workflow loads `.env` (which exports `DATABASE_PASSWORD OWM_API_KEY`), but `.env` is a development-only file. When Expo Go reloads or the workflow restarts cleanly, the key is not present in the process environment because `.env` exports are not persisted across all restart paths. The key needs to be in Replit Secrets so it is injected reliably at process start.

**Scope**: XS — add secret to Replit, no code change needed.

**Acceptance criteria**
```
Given: OWM_API_KEY is stored in Replit Secrets
When:  the api-server starts
Then:  GET /api/weather/forecast?city=London returns HTTP 200
And:   the planner screen shows weather badges for the current week
And:   the server log shows no 503 errors for /api/weather/forecast
```

---

### Issue 3 — Change location and Notifications buttons are inert

**Root cause (confirmed in code)**
`settings.tsx` lines 109–117: both `SettingsRow` components have no `onPress` prop — the handlers were never implemented.

**Change location** should open a modal or sheet where the user can:
- Tap "Use GPS" to request location permission and refresh the forecast
- Enter a city name manually

This UI already exists in the planner (`LocationPrompt` + `CityInputCard`) and can be re-used via the `WeatherContext` (`requestLocationAndFetch`, `setCity`).

**Notifications** should show the user their current notification permission status and let them toggle daily outfit reminder notifications (already scaffolded in `outfitSlotNotifications.ts`).

**Scope**: S — wire up existing context + show a bottom sheet or modal.

**Acceptance criteria (Change location)**
```
Given: a signed-in user on the Profile screen
When:  they tap "Change location"
Then:  a modal opens with "Use GPS" and "Enter city" options
And:   tapping "Use GPS" requests permission and fetches fresh weather
And:   entering a city and confirming fetches weather for that city
And:   the planner weather badges update accordingly
```

**Acceptance criteria (Notifications)**
```
Given: a signed-in user on the Profile screen
When:  they tap "Notifications"
Then:  a modal opens showing whether daily reminders are on or off
And:   they can toggle the reminder on or off
And:   turning it on schedules a daily 8 AM local push notification
And:   turning it off cancels all pending FitWeek notifications
```

---

### Issue 4 — No weekly outfit planning entry point on the Planner

**Problem**
The swipe flow (`/(swipe)/[date]`) lets users build one outfit per day. There is no way to trigger it for all 7 days in sequence, and no AI suggestion for a whole week. Users who want a full-week plan must tap each day cell and swipe 7 separate times.

**Desired behaviour**
1. A "Plan my week" CTA appears on the Planner screen when ≥1 day in the current week has no confirmed outfit.
2. Tapping it triggers AI suggestion for every unplanned day simultaneously, based on:
   - Weather forecast for each day
   - The user's closet (excluding laundry, deleted, and recently worn items)
   - Garment category balance (no repeat of the same hero garment in the same week)
3. Suggestions are shown as draft slots. The user can then open any day and swipe to adjust (the existing Tinder-style flow).
4. A "Suggest for today" shortcut also appears on the selected-day panel for single-day use.

**Scope**: M — new server endpoint + client orchestration + UI entry point.

**Architecture notes**
- Server: `POST /api/outfit/suggest` — accepts `{ dates: string[], garments: Garment[], forecasts: DailyForecast[] }`, returns `{ [date]: string[] }` (garment IDs per day). Uses a deterministic scoring function (no LLM required for v1): picks top-weighted garment per category per day based on weather + wear-count + skip rules.
- Client: "Plan my week" button calls the endpoint for all unplanned days, writes draft slots into `OutfitSlotContext`, then routes user to the first unplanned day's swipe screen.

**Acceptance criteria**
```
Given: the current week has at least one day without a confirmed outfit
When:  the user is on the Planner screen
Then:  a "Plan my week" button is visible below the week strip
And:   tapping it generates draft outfit suggestions for all unplanned days
And:   each day cell with a draft shows a visual indicator (dashed border)
And:   tapping a day cell with a draft opens the swipe screen pre-loaded with the suggested garments
And:   the user can swipe to replace any suggested garment
And:   confirming locks the outfit as confirmed status
```

```
Given: the user selects a day with no outfit
When:  the outfit panel is shown
Then:  a "Suggest outfit" button appears
And:   tapping it generates a single-day draft and opens the swipe screen
```

---

### Issue 5 — Vision API loses specific label and colour

**Root cause (confirmed in code)**

Two separate sub-issues:

**5a. Tags are overly generic — specific label discarded**
`classifyFromLabels` finds the first matching category label and sets `category`, but the `tags` array is built from *all* labels scored > 0.7 regardless of garment-specificity. The raw Vision label that matched the category (e.g. "T-shirt") often ends up in `tags`, but the `name` field of the saved garment is set to `category` ("tops") — not the specific label — because the add-garment screen uses `category` to auto-name.

**Fix**: return the `matchedLabel` (the specific garment type string, e.g. "T-shirt") from `classifyFromLabels` and use it to pre-populate the garment's name in the add-garment screen.

**5b. Colour returned but not shown**
The server `pickDominantColor` function returns a colour name correctly. However the add-garment screen (`app/(garment)/add.tsx`) does not read the `color` field from the classification response and apply it — the Garment object is saved with color defaulting to `""` or `"Unknown"`.

**Fix**: read `color` from the classify response and set it on the garment before saving.

**Scope**: S — add `matchedLabel` to server response, read `color` + `matchedLabel` in the add-garment screen.

**Acceptance criteria**
```
Given: a user adds a garment photo of a white T-shirt
When:  Vision classifies it
Then:  the garment's name is pre-filled with "T-shirt" (not "tops")
And:   the garment's color field is set to "White"
And:   the category remains "tops"
And:   the user can override name and color before saving
```

```
Given: a user adds a garment photo of a navy blue dress
When:  Vision classifies it
Then:  the garment's name is pre-filled with "Dress" (or the matched label)
And:   the garment's color is set to "Navy"
And:   the category is "dresses"
```

---

## RICE Prioritisation

| Issue | Reach (users/qtr) | Impact | Confidence | Effort (person-days) | RICE Score |
|---|---|---|---|---|---|
| #2 Weather 503 | 100% | 3 | 100% | 0.1 | 3000 |
| #1 Model photo nav | 100% | 2 | 100% | 0.1 | 2000 |
| #3 Inert buttons | 100% | 2 | 100% | 1 | 200 |
| #5 Vision label+color | 90% | 2 | 90% | 1.5 | 108 |
| #4 Weekly planner | 70% | 3 | 80% | 4 | 42 |

**Build order**: #2 → #1 → #3 → #5 → #4

---

## Non-goals (this sprint)

- LLM-powered outfit suggestions (v1 uses deterministic scoring)
- Social sharing of weekly plans
- Custom notification times (hardcoded 8 AM for now)
- Changing garment category after save
- Dark-mode redesign

---

## Open questions

| # | Question | Owner | Target |
|---|---|---|---|
| 1 | Should "Plan my week" only plan unconfirmed days, or also allow re-planning confirmed days? | Builder | Before implementing #4 |
| 2 | Should the Notifications modal deep-link to iOS/Android system settings if permission is denied? | Builder | Before implementing #3 |
| 3 | Vision sometimes returns no label matching the category map — should the name fall back to the category, the top Vision label, or prompt the user to name it manually? | Builder | Before implementing #5 |

---

## Effort summary (t-shirt)

| Issue | Size | ETA |
|---|---|---|
| #2 Add OWM secret | XS | < 15 min |
| #1 Fix onboarding guard | XS | < 30 min |
| #3 Wire location + notifications | S | 2–4 hrs |
| #5 Vision label + colour | S | 2–4 hrs |
| #4 Weekly planner AI suggest | M | 1–2 days |
| **Total** | **S–M** | **~2 days** |
