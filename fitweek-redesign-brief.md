# FitWeek — Full Redesign Implementation Brief

---
Version: 1.0
Last updated: 2026-05-03
Status: Approved
Owner: Agent (Driver)
---

## Problem

The app ships with Inter as its typeface and a neutral `#F1F5F9` slate-grey background. The brand document (`fitweek-design.md`) specifies Poppins and a lavender-tinted `#F8F7FF` background with a revised gradient (`#8B2FF5 → #2563EB`), purple-tinted borders, and a sky-blue laundry status colour. Every screen deviates from the spec in font, colour, and spacing. The result is a product that doesn't match its own brand identity.

**Why now**: The core feature set is complete (113 tests passing). Design debt addressed before launch is 10× cheaper than after.

---

## Proposed Solution

Implement the full `fitweek-design.md` spec in four ordered layers. Each layer unblocks the next.

---

## Layer 1 — Design Tokens (unblocks everything)

**File: `artifacts/fitweek/constants/colors.ts`**

| Token | Current | Spec |
|---|---|---|
| `background` | `#F1F5F9` | `#F8F7FF` (lavender) |
| `foreground` / `text` | `#0F172A` | `#1A1F36` (navy) |
| `border` | `#E2E8F0` | `#E4E0F5` (purple-tinted) |
| `primary` (gradient start) | `#7B61FF` | `#8B2FF5` |
| `primaryEnd` (gradient end) | `#4DA3FF` | `#2563EB` |
| `statusClean` | `#22C55E` | `#10B981` (emerald) |
| `statusLaundry` | `#F97316` (orange) | `#0EA5E9` (sky blue) |

**Add new tokens:**

```
borderStrong:    #C4BAF0
surfaceWash:     #F0EEFE
gradientGlass:   rgba(139, 47, 245, 0.08)
statusWarn:      #F59E0B
statusWarnBg:    #FFFBEB
statusCleanBg:   #ECFDF5
statusLaundryBg: #F0F9FF
```

**File: `artifacts/fitweek/hooks/useColors.ts`** — expose new tokens.

---

## Layer 2 — Typography (swap Inter → Poppins globally)

**Files affected:**
- `artifacts/fitweek/app/_layout.tsx` — swap `@expo-google-fonts/inter` import for `@expo-google-fonts/poppins`. Load weights 400, 500, 600, 700.
- **All** `fontFamily: "Inter_*"` references across every file → `"Poppins_*"`.

**Search scope** (files containing `Inter_`):
- `app/_layout.tsx`
- `app/(auth)/sign-in.tsx`
- `app/(onboarding)/model-photo.tsx`
- `app/(tabs)/index.tsx`, `planner.tsx`, `settings.tsx`, `laundry.tsx`
- `app/(garment)/add.tsx`
- `app/(swipe)/[date].tsx`
- `components/GradientButton.tsx`
- `components/SwipeCard.tsx`
- `components/OutfitAssemblyPanel.tsx`
- `components/WeatherBadge.tsx`

**Mapping:**
```
Inter_400Regular  → Poppins_400Regular
Inter_500Medium   → Poppins_500Medium
Inter_600SemiBold → Poppins_600SemiBold
Inter_700Bold     → Poppins_700Bold
```

---

## Layer 3 — Shared Components

### GradientButton (`components/GradientButton.tsx`)
- `borderRadius`: 14 → 12
- `height`: 54 → 52
- `fontSize`: 16 → 14 (spec: Poppins 600)
- Add press-scale animation: `scale(0.97)` on press-in, `1.0` on release (80ms in, 120ms out spring)
- Gradient direction: `start {x:0, y:0} end {x:1, y:0}` → `135°` diagonal (`start {x:0, y:0} end {x:1, y:1}`)

### SwipeCard (`components/SwipeCard.tsx`)
- `borderRadius`: 20 → 16
- Shadow: `shadowColor: "rgba(139,47,245,0.14)"`, `shadowOffset {0,8}`, `shadowRadius: 40`
- Image: currently `flex:1` (full card) → top 65% only; bottom 35% is a white info strip
- Bottom info strip (35%): white `#FFFFFF` background
  - Garment name: Poppins 700, 20px, `#1A1F36`
  - Category tag: Poppins 500, 11px, ALL CAPS, `#64748B` (left)
  - 10px colour swatch circle (right), filled with garment colour
- **ADD overlay**: `rgba(16,185,129,0.15)` floods card on right-drag; label `"Adding"` in `#10B981` Poppins 600 12px at left edge (20% threshold)
- **SKIP overlay**: `rgba(100,116,139,0.10)` on left-drag; label `"Skip"` in `#64748B` at right edge
- Remove existing ADD/SKIP stamped labels (they don't match spec)
- Back card: scale 0.94, translateY 10, blur via `opacity: 0.6` (RN has no blur on a view cheaply)
- Swipe spring physics: `mass: 1, stiffness: 280, damping: 28`

### OutfitAssemblyPanel (`components/OutfitAssemblyPanel.tsx`)
- Bottom sheet: `borderTopLeftRadius: 24, borderTopRightRadius: 24`
- Drag handle: 32×4px, `#E4E0F5`, `borderRadius: 2`, centred
- Garment pills: `borderRadius: 8`, `#E4E0F5` border
- "Preview on avatar" button: gradient fill, hanger icon left, full-width 52px
- VTO shimmer: gradient wash sweeping left→right, 1.5s loop
- VTO result: `borderWidth: 2`, gradient border (use `borderColor: #8B2FF5` as approximation — RN doesn't support border-image natively)

### WeatherBadge (`components/WeatherBadge.tsx`)
- Warning state: `backgroundColor: #FFFBEB`, `color: #F59E0B`, `borderRadius: 8`

---

## Layer 4 — Screens

### Sign-in / Splash (`app/(auth)/sign-in.tsx`)
- Full-screen gradient background (`#8B2FF5 → #2563EB` at 135°) — **only screen with gradient fill**
- Centred app icon placeholder (120×120px, white rounded rect, `borderRadius: 22`)
- Wordmark `"FitWeek"` — Poppins 700, 32px, white
- Tagline `"Your week, already dressed."` — Poppins 400, 16px, white 80% opacity
- CTA button: white fill, `#1A1F36` text, Poppins 600, 52px, `borderRadius: 12`, full-width
- Slides up with 300ms spring on mount

### Model photo onboarding (`app/(onboarding)/model-photo.tsx`)
- `background: #F8F7FF` (updated via token — auto)
- Typography: Poppins (auto via Layer 2)
- No structural changes needed

### Wardrobe grid (`app/(tabs)/index.tsx`)
- Screen title: Poppins 700, 28px, `#1A1F36`, left-aligned. Item count inline right in Poppins 400 12px `#64748B`
- Category filter strip (horizontal scroll):
  - Chip height: 32px, `paddingHorizontal: 12`, `borderRadius: 8`
  - Active: gradient fill (`#8B2FF5 → #2563EB`), white Poppins 500 12px
  - Inactive: white fill, `#E4E0F5` border, `#64748B` text
- Garment card (2-col grid):
  - White surface, `borderRadius: 16`, `#E4E0F5` border 1px
  - Photo: top 72% of card, `borderTopLeftRadius: 16, borderTopRightRadius: 16`
  - Name: Poppins 600, 13px, `#1A1F36`
  - Category tag: Poppins 500, 11px, ALL CAPS, `#64748B`
  - Status dot: 8px circle, top-right inset 8px. `#10B981` clean, `#0EA5E9` laundry
- FAB (`+` button): 56px circle, gradient fill, `shadowColor: "rgba(139,47,245,0.30)"`, `shadowRadius: 16`, bottom-right 20px above tab bar

### Weekly planner (`app/(tabs)/planner.tsx`)
- Screen title: `"This week"` Poppins 700, 28px, `#1A1F36`
- Week strip: 7 cells, full width evenly spaced, each `(screenWidth - 40) / 7`
  - Day abbrev: Poppins 500 11px `#64748B`
  - Date number: Poppins 600 16px `#1A1F36`
  - Selected: 32px gradient circle behind date, date number white
  - Today indicator: 4px gradient dot above date
- Style note: Poppins 400 italic 14px `#64748B`, 40px tall strip below week strip, fades in on day select
- Day outfit card: white, `borderRadius: 16`, `#E4E0F5` border, 16px padding
  - Confirmed state: 2px gradient border on card
  - Empty state: `"No outfit planned"` body slate + `"Start swiping"` gradient text link
- "Plan the week" button: full-width gradient, 52px, `borderRadius: 12`

### Laundry (`app/(tabs)/laundry.tsx`)
- Title: `"Laundry basket"` Poppins 700, 28px, `#1A1F36`
- Item count badge: `#F0F9FF` fill, `#0EA5E9` text, `borderRadius: 6`
- Card grid: same as wardrobe but `borderColor: #0EA5E9` (1px sky blue border)
- "Mark as clean" button inside card: 34px, white fill, `#E4E0F5` border, `borderRadius: 8`, Poppins 500 12px `#1A1F36`
- Empty state: hanger SVG 48px gradient fill, title Poppins 600 20px navy, body slate

### Settings / Profile (`app/(tabs)/settings.tsx`)
- Already updated (Google avatar, birthday) — typography auto via Layer 2

### Swipe deck (`app/(swipe)/[date].tsx`)
- Gradient progress bar: 4px height, full width, below header
- `"X of 7 days planned"` counter label, Poppins 400 13px slate, right-aligned

### Tab bar (`app/(tabs)/_layout.tsx`)
- Active tab: gradient pill indicator (4px wide, 3px tall, `borderRadius: 2`) **above** icon
- Active icon: tint with gradient start colour `#8B2FF5`
- Active label: Poppins 600 10px, colour `#8B2FF5`
- Inactive: `#64748B` at 60% opacity, no label
- Bar: white, `#E4E0F5` top border 0.5px, no shadow

---

## Non-goals

- Dark mode — not in spec, do not add
- Animated gradient (moving/shifting) — static gradient only
- Custom SVG icon set — use Feather icons already in place; replace only where spec gives a specific layout
- RN border-image (gradient borders) — approximate with solid `#8B2FF5` where spec says gradient border; native border-image is unsupported
- Splash screen native asset — in-app screen only; no `expo-splash-screen` asset rebuild

---

## Success Criteria

- Zero occurrences of `Inter_` in any `.tsx` file
- `colors.ts` matches all spec tokens
- Background on every screen (except sign-in) reads `#F8F7FF`
- Sign-in screen has full-gradient background
- SwipeCard info strip is white with Poppins name + category tag (not the current dark overlay)
- Status dots are emerald (`#10B981`) for clean and sky blue (`#0EA5E9`) for laundry
- All buttons are 52px height, `borderRadius: 12`
- All 113 tests still pass

---

## Build Order

```
1. colors.ts          — tokens (all screens auto-update via useColors)
2. _layout.tsx        — swap font package
3. Replace Inter_ → Poppins_ across all files (global find-replace)
4. GradientButton     — radius, height, press animation
5. SwipeCard          — layout restructure (biggest component change)
6. OutfitAssemblyPanel
7. sign-in.tsx        — gradient splash
8. index.tsx          — wardrobe grid, chips, FAB, cards
9. planner.tsx        — week strip, style note, day cards
10. laundry.tsx       — sky blue border, card button, empty state
11. (tabs)/_layout.tsx — tab bar active indicator
12. [date].tsx        — progress bar
```

---

## Open Questions

| # | Question | Impact | Owner |
|---|---|---|---|
| 1 | Is `@expo-google-fonts/poppins` already in the lockfile? If not, `pnpm add` needed | Blocks Layer 2 | Agent (check before build) |
| 2 | Gradient border on confirmed outfit card — approximate with solid or skip? | Visual fidelity | Product owner |
| 3 | Swipe card fixed 320px width vs. current full-width — keep responsive? | Layout | Product owner |

---

### Changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-05-03 | Agent | Initial draft from design spec audit |
