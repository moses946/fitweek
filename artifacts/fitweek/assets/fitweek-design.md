# FitWeek — Design Specification (Brand-Aligned)

> Built around the actual FitWeek brand: purple-to-blue gradient, deep navy wordmark, rounded geometric identity.

---

## Aesthetic Direction

**Gradient Confidence.** FitWeek's brand is already defined: a bold purple-to-blue gradient paired with a deep navy wordmark. The app design honours this identity rather than fighting it. White card surfaces, a barely-tinted lavender page background, and the gradient deployed as a precision accent — not wallpaper. Every screen is clean and structured, with the gradient appearing exactly where the user's attention should land: primary actions, active states, confirmed outfits. Everywhere else is calm and neutral.

**The one thing judges will remember:** Every confirmed outfit — the payoff moment — triggers the gradient. The swipe-right animation, the confirm button, the VTO preview border, the calendar event colour: all gradient. The app trains the user to associate that purple-to-blue sweep with success and completion.

---

## Brand Gradient

Extracted directly from your logo and icon assets:

```
--fw-gradient-start:  #8B2FF5   /* purple */
--fw-gradient-end:    #2563EB   /* blue */
--fw-gradient:        linear-gradient(135deg, #8B2FF5 0%, #2563EB 100%)
--fw-gradient-h:      linear-gradient(90deg,  #8B2FF5 0%, #2563EB 100%)
```

The 135° angle matches the diagonal sweep in the app icon. Use `--fw-gradient` for vertical/square elements (buttons, badges). Use `--fw-gradient-h` for horizontal elements (progress bars, tab indicators).

---

## Colour System

```
/* Surfaces */
--fw-bg:           #F8F7FF   /* page background — lavender-tinted white */
--fw-surface:      #FFFFFF   /* card and sheet surfaces */
--fw-surface-wash: #F0EEFE   /* light gradient wash for inactive states */

/* Text */
--fw-navy:         #1A1F36   /* primary text — matches "Fit" wordmark */
--fw-slate:        #64748B   /* secondary text, labels */
--fw-hint:         #A0ABBB   /* placeholder, disabled text */

/* Borders */
--fw-border:       #E4E0F5   /* default border — purple-tinted */
--fw-border-strong:#C4BAF0   /* hover / focus border */

/* Semantic */
--fw-clean:        #10B981   /* clean status — emerald */
--fw-laundry:      #0EA5E9   /* laundry status — sky blue */
--fw-clean-bg:     #ECFDF5   /* clean badge background */
--fw-laundry-bg:   #F0F9FF   /* laundry badge background */
--fw-warn:         #F59E0B   /* weather warning */
--fw-warn-bg:      #FFFBEB   /* weather warning background */

/* Gradient overlays */
--fw-gradient-glass: rgba(139, 47, 245, 0.08)  /* subtle purple wash on cards */
```

**Usage rules:**
- The gradient appears on: primary buttons, active tab dot, swipe-right overlay, confirmed outfit accents, VTO border, calendar export button.
- Never use the gradient as a page background or large surface fill. The icon already owns that territory.
- `--fw-navy` for all headings and body text. Never pure black (`#000`).
- `--fw-bg` everywhere outside cards. Cards are always `--fw-surface` (white).
- Status colours (`--fw-clean`, `--fw-laundry`) appear only as 8px dot indicators or small badge fills. Never as large surface colours.

---

## Typography

The FitWeek wordmark uses a rounded geometric sans-serif. **Poppins** is the brand-matched choice — same geometric proportions, same rounded terminals, same confident weight.

```
Font family:  Poppins (Google Fonts)
Weights used: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
```

**Scale:**

```
--text-display:   28px / 1.15 / Poppins 700 / --fw-navy
--text-title:     20px / 1.25 / Poppins 600 / --fw-navy
--text-subtitle:  16px / 1.4  / Poppins 600 / --fw-navy
--text-body:      14px / 1.6  / Poppins 400 / --fw-slate
--text-label:     12px / 1.4  / Poppins 500 / --fw-slate
--text-tag:       11px / 1.0  / Poppins 500 / --fw-hint  (uppercase, 0.5px letter-spacing)
--text-style-note: 14px / 1.5 / Poppins 400 italic / --fw-slate
```

**Rules:**
- Sentence case everywhere. No ALL CAPS except `--text-tag` category labels (e.g. `TOPS`, `OUTERWEAR`).
- Garment names on swipe cards: Poppins 700, 20px. This is the confidence moment.
- The Gemini style note is the only italic text in the app.
- Never use font weights below 400.

---

## Spacing & Layout

```
Page horizontal padding:  20px
Section gap:              28px
Card internal padding:    16px
Component gap (small):    8px
Component gap (medium):   12px
Touch target minimum:     44px height
Bottom nav height:        64px + safe area inset
Status bar area:          respected, content starts below
```

---

## Corner Radii

```
--radius-icon:    22px   /* app icon, matches OS rounding */
--radius-card:    16px   /* swipe cards, garment grid items */
--radius-sheet:   24px   /* bottom sheets, top corners only */
--radius-button:  12px   /* all buttons */
--radius-chip:    8px    /* category chips, weather badges */
--radius-badge:   6px    /* status badges */
--radius-dot:     50%    /* status dots */
```

---

## Screen Specifications

### 1. Splash / onboarding

- Full-screen gradient background (`--fw-gradient` at 135°) — this is the only screen with a gradient fill covering the full viewport. It establishes the brand immediately.
- Centred app icon (120px, white rounded rect, `--fw-gradient` fill, hanger+checkmark icon in white at 64px).
- Below icon: `"FitWeek"` wordmark in Poppins 700, 32px, white.
- Tagline: `"Your week, already dressed."` Poppins 400, 16px, white at 80% opacity.
- Bottom: `"Get started"` button — white fill, `--fw-navy` text, full-width, 52px, 12px radius. Slides up with 300ms spring on load.

### 2. Camera / garment upload

- `--fw-bg` background.
- Screen title: `"Add to wardrobe"` — display, navy, left-aligned.
- Camera viewfinder: 280×360px centred rounded rect (radius 16px). Border: 2px dashed gradient (`--fw-gradient-h`). Inside: hanger icon (32px, slate) + `"Point at one garment"` body text, slate, centred.
- Below viewfinder: two options in a row — `"Take photo"` (gradient fill button, 48px, flex 1) and `"Choose from library"` (white fill, navy border, 48px, flex 1). Gap: 12px.
- Post-upload: classification chip slides up from bottom — white surface, 16px radius, shadow `0 4px 20px rgba(139,47,245,0.12)`. Layout: garment thumbnail (40×40px, 8px radius) left + `"Navy t-shirt · Tops"` subtitle right + green dot status indicator far right. `"Looks right"` and `"Edit"` text buttons below.

### 3. Wardrobe grid

- Screen title: `"Wardrobe"` — display, navy, left-aligned.
- Garment count: `"24 items"` — label, slate, inline right of title.
- Category filter strip (horizontal scroll, no scrollbar):
  - Chips: 32px height, 12px horizontal padding, 8px radius.
  - Active chip: `--fw-gradient` fill, white Poppins 500 12px text.
  - Inactive chip: white fill, `--fw-border` border, slate text.
  - Options: `All`, `Tops`, `Bottoms`, `Outerwear`, `Shoes`, `Accessories`.
- 2-column grid. Garment card:
  - White surface, 16px radius, `--fw-border` 1px border.
  - Photo: top 72% of card, object-fit cover, top corners rounded to 16px.
  - Bottom strip (28%): garment name Poppins 600 13px navy, left. Category tag Poppins 500 11px uppercase slate, below name.
  - Status dot: 8px circle, top-right, 8px inset. Green = clean, sky blue = laundry.
  - Long-press: card scales to 0.96 with a 100ms spring, then bottom sheet appears.
- Floating `+` button: 56px circle, `--fw-gradient` fill, white `+` icon (24px). Bottom right, 20px inset above tab bar. Shadow: `0 4px 16px rgba(139,47,245,0.30)`.

### 4. Weekly planner (home screen)

- Screen title: `"This week"` — display, navy.
- Week strip: 7 day cells in a horizontal row, full width, evenly spaced. Each cell (width: (screenWidth - 40) / 7):
  - Day abbreviation: tag, slate, top.
  - Date number: subtitle 600, navy, middle.
  - Weather icon: 14px SVG, bottom.
  - Selected state: `--fw-gradient` fills a 32px circle behind the date number. Date number becomes white.
  - Today indicator: small 4px gradient dot above the date number.
- Style note: Poppins 400 italic 14px, slate, sits directly below the week strip in a 40px tall strip. Full-width, left-aligned. Example: `"Cool and overcast — layers will carry you through."` Fades in when the day is selected.
- Day outfit card (below style note): white surface, 16px radius, `--fw-border` border, 16px padding.
  - Planned state: horizontal row of garment thumbnails (40×40px overlapping by 10px) + `"View outfit"` text link (gradient text colour) right-aligned.
  - Confirmed state: VTO image full-width (16px radius) inside the card + a thin 2px gradient border wrapping the card.
  - Empty state: `"No outfit planned"` body slate + `"Start swiping"` gradient text button, arrow icon.
- Bottom shortcut: `"Plan the week"` full-width gradient button, 52px, 12px radius.

### 5. Swipe deck

- Full-screen. `--fw-bg` background visible at edges.
- Header: `"Monday"` — title 600, navy, left. `"3 of 7 days planned"` — label, slate, right. Gradient progress bar (4px height, full width) below header.
- Active card: 320×440px, centred vertically in available space. White surface, 16px radius, `--fw-border` 1px border. Shadow: `0 8px 40px rgba(139,47,245,0.14)`.
  - Garment photo: top 65%, object-fit cover, corners rounded 16px top only.
  - Bottom section (35%): 16px padding.
    - Garment name: Poppins 700, 20px, navy. Full width.
    - Category + colour row: tag uppercase slate left, 10px colour swatch circle right.
    - Weather note (if borderline): amber chip `"Borderline for today"` — `--fw-warn-bg` fill, `--fw-warn` text, 8px radius, 12px horizontal padding.
- Behind active card: next card at 94% scale, 10px lower, 4px blur. Depth cue without distraction.
- Swipe right feedback: green overlay (`rgba(16,185,129,0.15)`) floods the card as user drags right. `"Adding"` label in `--fw-clean`, Poppins 600 12px, appears at left edge of card at 20% drag threshold.
- Swipe left feedback: mist overlay (`rgba(100,116,139,0.10)`). `"Skip"` label in slate appears at right edge.
- Long-press: bottom sheet (24px top radius, white) with two options: `"Send to laundry"` (sky blue icon + label) and `"Skip for this week"` (slate icon + label).
- Building outfit strip (fixed bottom, above tab bar): white strip, `--fw-border` top border. Left: stacked garment thumbnails (36×36px circles, overlapping 8px, `--fw-gradient` ring on each). Centre: `"Building Monday's outfit"` label, 13px slate. Right: `"Done"` — gradient text button, Poppins 600.
- Deck-low banner: slides down from top, white surface, `--fw-gradient-glass` background, `--fw-border` bottom border. `"Running low — showing earlier skips"` body slate. Auto-dismisses 2s.

### 6. Outfit confirmation & VTO

- Bottom sheet, 24px top radius, white. Drag handle (32×4px, `--fw-border`, 4px radius) centred at top.
- Header: `"Monday's outfit"` title 600, navy.
- Garment pills: horizontal wrapping row. Each pill — white fill, `--fw-border` border, 8px radius, 8px padding. Thumbnail (28×28px, 6px radius) + name label + `×` remove icon (slate, 14px). Tap × removes garment with fade-out.
- `"Preview on avatar"` button: full-width, 52px, 12px radius, gradient fill, white Poppins 600 text, hanger icon left.
- VTO loading: shimmer placeholder (white surface, gradient shimmer animation sweeping left-to-right, 1.5s loop, 16px radius).
- VTO result: full-width image, 16px radius, 2px gradient border (`--fw-gradient` as border-image).
- Action row: `"Confirm outfit"` gradient fill button (flex 1) + `"Keep swiping"` white fill button (flex 1). Gap 12px.
- Confirmed state: green checkmark animation plays over the confirm button (scale 0 → 1 spring, 300ms), then sheet dismisses.

### 7. Laundry basket

- Screen title: `"Laundry basket"` — display, navy.
- Item count badge: `"6 items"` — `--fw-laundry-bg` fill, `--fw-laundry` text, 6px radius, label size. Inline right of title.
- Same 2-column grid as wardrobe. Card differences:
  - Thin 1px `--fw-laundry` border instead of `--fw-border`.
  - Sky blue dot status indicator (always, since all items here are laundry).
  - Below photo: `"Mark as clean"` button — full-width within card, 34px height, white fill, `--fw-border` border, 8px radius, Poppins 500 12px navy. Tap → card slides up and disappears (200ms ease-out).
- Empty state (centred):
  - Hanger icon SVG, 48px, gradient fill.
  - `"Nothing in the wash"` — title 600, navy.
  - `"Your whole wardrobe is ready."` — body, slate.

### 8. Empty deck states

Three distinct layouts, all vertically centred with 20px horizontal padding:

**LAUNDRY:**
- Icon: laundry basket SVG, 56px, `--fw-laundry` fill.
- Title: `"It's all in the wash"` — display, navy.
- Body: `"Mark some items as clean to see outfit suggestions."` — body, slate.
- Button: `"Go to laundry basket"` — gradient fill, full-width, 52px.

**SCHEDULED:**
- Icon: checkmark-in-circle SVG, 56px, gradient fill.
- Title: `"Week sorted"` — display, navy.
- Body: `"You've planned outfits for every day this week."` — body, slate.
- Button: `"View the week"` — gradient fill, full-width, 52px.

**WEATHER:**
- Icon: cloud SVG, 56px, `--fw-warn` fill.
- Title: `"Nothing suits the weather"` — display, navy.
- Body: `"Your available pieces aren't quite right for [condition] today."` — body, slate.
- Two buttons stacked: `"Override weather filter"` (gradient fill, 52px) + `"Go to laundry basket"` (white fill, `--fw-border` border, 52px).

---

## Navigation

Bottom tab bar. Four tabs. 64px height + safe area inset.

```
Tab 1:  Calendar icon   →  Weekly planner (home)
Tab 2:  Grid icon       →  Wardrobe
Tab 3:  Droplet icon    →  Laundry basket
Tab 4:  Share icon      →  Export / share
```

- Active tab: icon filled with gradient (use gradient SVG fill or tint), label Poppins 600 10px gradient text.
- Inactive tab: icon slate 60% opacity, no label.
- Tab bar surface: white, 0.5px top border `--fw-border`. No shadow.
- Active indicator: 4px wide, 3px tall gradient pill above the active icon (not below).

---

## Motion & Interaction

**Swipe deck physics:** React Native Reanimated with spring. `mass: 1, stiffness: 280, damping: 28`. Throw velocity completes the animation; slow drag snaps back. Cards rotate ±15° at full throw.

**Gradient button press:** Scale to 0.97 on press-in (80ms), back to 1.0 on release (120ms spring). Gradient stays static — no shift.

**Outfit confirmation:** Bottom sheet rises with spring `stiffness: 380, damping: 42`. Background dims to `rgba(26,31,54,0.40)`.

**VTO shimmer:** `@keyframes shimmer` — gradient sweeps from `--fw-gradient-glass` left to right across the placeholder, 1.5s infinite.

**Status dot change:** When a garment is sent to laundry, the dot transitions from green to blue with a 300ms colour interpolation. The card then shifts to the laundry grid with a cross-screen animation.

**Week day selection:** Selected circle scales from 0 to 1 (spring, 250ms). Style note fades in (opacity 0→1, translateY 4→0, 200ms ease-out).

**Haptics:**
- Swipe right (add) → `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`
- Swipe left (skip) → `Haptics.impactAsync(ImpactFeedbackStyle.Light)`
- Confirm outfit → `Haptics.notificationAsync(NotificationFeedbackType.Success)`
- Send to laundry → `Haptics.impactAsync(ImpactFeedbackStyle.Rigid)`

---

## Gradient Application Rules

The gradient is the brand's most powerful asset. Misuse destroys it.

**Gradient IS used on:**
- Splash screen background (only screen with full gradient fill)
- Primary CTA buttons (filled gradient)
- Active tab indicator pill
- Active category chip fill
- Swipe deck progress bar
- Confirmed outfit card border (2px gradient border-image)
- VTO preview border
- Floating `+` button
- App icon (already exists)

**Gradient is NOT used on:**
- Page backgrounds (any screen other than splash)
- Card surfaces
- Navigation bar
- Text (except the "Week" wordmark in logo contexts)
- Decorative dividers or section backgrounds
- Secondary buttons

---

## Replit Agent Prompt Hints

Paste these exact phrases when briefing the agent:

- *"Use Poppins as the only font family. Import from Google Fonts. Weights: 400, 500, 600, 700."*
- *"Page background is #F8F7FF (barely lavender, not white). Card surfaces are #FFFFFF."*
- *"Primary text is #1A1F36 (deep navy). Secondary text is #64748B (slate). Never use pure black."*
- *"The primary accent is a gradient: linear-gradient(135deg, #8B2FF5 0%, #2563EB 100%). Use it on gradient-fill buttons, active chips, and the tab indicator only."*
- *"Borders are #E4E0F5 (purple-tinted), 1px. No shadow except: swipe card gets 0 8px 40px rgba(139,47,245,0.14), and the floating + button gets 0 4px 16px rgba(139,47,245,0.30)."*
- *"Swipe cards are 320×440px, centred, white surface, 16px border radius."*
- *"Bottom sheets have border-radius 24px on top corners only, white background."*
- *"Status dots are 8px circles. Green (#10B981) for clean. Sky blue (#0EA5E9) for laundry. Never fill large surfaces with these colours."*
- *"All buttons are 52px height, 12px border-radius. Gradient-fill for primary, white-fill with #E4E0F5 border for secondary."*
- *"All text is sentence case. Category tags are ALL CAPS in 11px Poppins 500."*
- *"Never use the word 'fit' as a noun in any UI label. Always 'outfit'."*

---

## What to avoid

- Gradient page backgrounds on any screen other than splash — it makes the brand feel cheap.
- White tab bars with gradient fills — the gradient is earned through interaction, not decoration.
- Purple text on white backgrounds — use navy (#1A1F36) for all text, gradient only for interactive elements.
- Inter, Roboto, or system fonts — Poppins only.
- Emoji in UI — SVG icons throughout.
- Drop shadows on every element — only the swipe card and floating button get shadows.
- Any font weight below 400.