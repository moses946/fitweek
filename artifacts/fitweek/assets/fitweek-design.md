# FitWeek — Design Specification

## Aesthetic Direction

**Editorial Wardrobe.** FitWeek looks like a high-end fashion lookbook crossed with a utility planner. The visual language is warm, confident, and magazine-quality — not a generic productivity app with some clothes in it. Every screen should feel like it belongs in a Kinfolk editorial: large white space, strong typography, photography-forward cards, and a single bold accent colour that makes the brand instantly recognisable.

**The one thing judges will remember:** The swipe deck feels like physically leafing through a fashion lookbook. Cards are large, photo-first, and the swipe motion has visible momentum and haptics. No other wardrobe app feels this tactile.

---

## Colour System

```
--fw-cream:       #FAF8F4   /* page background */
--fw-charcoal:    #1C1917   /* primary text */
--fw-stone:       #78716C   /* secondary text, labels */
--fw-mist:        #E8E4DF   /* borders, dividers, card strokes */
--fw-white:       #FFFFFF   /* card surfaces */
--fw-terracotta:  #C4522A   /* primary accent — CTAs, badges, active states */
--fw-terra-light: #F5EAE4   /* accent background washes */
--fw-terra-dark:  #7A2E12   /* accent text on light washes */
--fw-laundry:     #3B82F6   /* laundry status indicator only */
--fw-clean:       #16A34A   /* clean status indicator only */
--fw-weather-bg:  #EFF6FF   /* weather badge background */
```

**Usage rules:**
- `--fw-terracotta` appears on exactly one element per screen: the primary CTA button, the active tab indicator, or the swipe-right confirm action. Never use it decoratively.
- All backgrounds are cream, not white. Card surfaces are white to lift off the page.
- Never use pure black. Charcoal only.
- Status colours (laundry blue, clean green) appear only as small 8px dot indicators. Never as fills on large surfaces.

---

## Typography

```
Display font:  DM Serif Display — headings, screen titles, card garment names
Body font:     DM Sans — labels, body copy, UI chrome
Mono font:     JetBrains Mono — garment metadata tags only
```

**Scale:**
```
--text-display:   28px / 1.15 / DM Serif Display / charcoal
--text-title:     20px / 1.25 / DM Serif Display / charcoal
--text-subtitle:  15px / 1.4  / DM Sans 500       / charcoal
--text-body:      14px / 1.6  / DM Sans 400        / stone
--text-label:     12px / 1.4  / DM Sans 500        / stone
--text-tag:       11px / 1.0  / JetBrains Mono     / stone
```

**Rules:**
- Sentence case everywhere. No ALL CAPS. No title case on UI labels.
- Garment names use DM Serif Display at 22px on swipe cards — this is the editorial moment.
- Weather notes use DM Serif Display italic at 15px — the only italic in the app.

---

## Spacing & Layout

```
Page horizontal padding:  20px
Section gap:              32px
Card internal padding:    16px
Component gap (small):    8px
Component gap (medium):   12px
Touch target minimum:     44px height
Bottom nav height:        64px + safe area inset
```

The weekly calendar uses a 7-column horizontal scroll strip at the top of the screen — each day is 48px wide. The selected day expands to show the weather badge inline. Nothing else in the app scrolls horizontally.

---

## Corner Radii

```
--radius-card:    16px   /* swipe cards, garment grid items */
--radius-chip:    8px    /* weather badges, status chips, tags */
--radius-button:  10px   /* all buttons */
--radius-sheet:   24px   /* bottom sheets */
--radius-dot:     50%    /* status dots */
```

---

## Screen Specifications

### 1. Onboarding / Camera upload

- Full-bleed cream background.
- Centred camera viewfinder: a 280×360px rounded rect (radius 16px) with a 1.5px dashed `--fw-mist` border and a soft camera icon (24px, stone colour) centred inside.
- Below the viewfinder: `"Point at one garment at a time"` in body text, stone, centred.
- Single full-width terracotta button: `"Take photo"`. 52px height.
- After upload: a classification result chip slides up from the bottom — `"Detected: navy t-shirt"` with a green dot. Tap to confirm or tap the chip to correct.

### 2. Wardrobe grid

- Screen title: `"Your wardrobe"` in display font, left-aligned, 28px.
- Horizontal category filter strip below the title: pill chips (`"All"`, `"Tops"`, `"Bottoms"`, `"Outerwear"`, `"Shoes"`). Active chip has terracotta fill + white text. Inactive chips have mist border + stone text.
- 2-column grid of garment cards. Each card:
  - 16px border radius, white surface, 1px mist border.
  - Photo fills the top 75% of the card.
  - Garment name in DM Serif Display 14px at the bottom left.
  - Status dot (8px) at top right: green = clean, blue = laundry.
  - Long-press triggers a bottom sheet with status options.
- Floating `+` button (terracotta, 56px circle) bottom right for adding new garments.

### 3. Weekly planner (home screen)

- Screen title: `"This week"` in display font, 28px, left.
- Day strip: 7 columns, horizontally scrollable. Each day cell is 44×64px. Layout per cell: abbreviated day name (label, stone) top, date number (subtitle, charcoal) middle, weather icon (16px SVG) bottom. Selected day: charcoal background, white text, terracotta underline dot. Today: small terracotta dot above the date number.
- Below the strip: the selected day's outfit summary card. White surface, 16px radius, 16px padding. If no outfit planned: placeholder text `"No outfit planned yet"` in body italic, stone. `"Start swiping →"` button in terracotta below.
- If outfit confirmed: garment thumbnails in a horizontal row (40×40px each, overlapping by 8px), followed by the VTO preview image (if generated) at 100% width with 16px radius.
- Gemini style note: DM Serif Display italic 15px, stone colour, sitting directly below the weather icon in the day card. Example: `"Cool and overcast — layers will carry you through."` Max one line. Truncates with ellipsis.

### 4. Swipe deck

- Full-screen immersive view. Cream background visible at edges.
- Active card: 320×440px, centred, white surface, 16px radius, 1px mist border. Subtle drop shadow: `0 8px 32px rgba(28,25,23,0.10)`.
- Card contents:
  - Garment photo: fills top 70% of card, object-fit cover.
  - Below photo: garment name in DM Serif Display 22px. Category tag in mono 11px, stone. Colour swatch dot (12px circle, actual colour).
  - Weather compatibility note if the garment is marginally appropriate: small amber chip — `"Borderline for today"`.
- Behind the active card: next card visible at 90% scale, 8px lower. Gives depth without distracting.
- Swipe right: card flies off right with a green overlay flash (100ms). Right edge of card shows `"adding"` in green, 12px, as user drags.
- Swipe left: card flies off left with a mist overlay flash. Left edge shows `"skip"` in stone as user drags.
- Long-press: bottom sheet with `"Send to laundry"` and `"Skip for this week"`.
- Bottom strip (fixed): building outfit thumbnails on the left (small circles, 32px), day label centred (`"Monday's outfit"`), `"Done"` button on the right in terracotta.
- Deck-low banner: slides in from top, cream background, `"Running low — bringing back some skips"` in body text, stone. Auto-dismisses after 2s.

### 5. Outfit confirmation & VTO

- Modal sheet (slides up, 24px top radius). Cream background.
- Header: `"Confirm Monday's outfit"` in title font.
- Garment list: each garment in a horizontal pill with thumbnail + name. Tap the × on any pill to remove it from the outfit.
- `"Preview on avatar"` button: full-width, terracotta outline (not filled), 52px. Triggers FASHN API call. Shows a loading shimmer in the card area while waiting.
- VTO result: displays at full width inside the sheet, 16px radius. Saved automatically to the outfit slot.
- Two buttons below: `"Confirm outfit"` (filled terracotta) and `"Keep swiping"` (text link, stone).

### 6. Laundry basket

- Screen title: `"Laundry basket"` in display font.
- Same 2-column grid as wardrobe, but cards have a subtle blue-tinted wash (`rgba(59, 130, 246, 0.06)` background instead of white).
- Each card has a `"Mark as clean"` button below the image (full-width within card, outlined, 36px). Tapping it flips status and removes the card with a slide-up exit animation.
- Empty state: centred illustration (simple SVG of a basket) + `"Nothing in the wash"` in title font + `"Your whole wardrobe is ready to wear"` in body text.

### 7. Empty deck states

Three distinct layouts, all centred on screen:

**LAUNDRY** (everything dirty):
- Laundry basket SVG icon, 48px, blue.
- Title: `"It's all in the wash"` — DM Serif Display, 22px.
- Body: `"Mark some items as clean to see suggestions."` — body, stone.
- Button: `"Go to laundry basket"` — terracotta, full-width.

**SCHEDULED** (whole week planned):
- Checkmark SVG icon, 48px, green.
- Title: `"Week sorted"` — DM Serif Display, 22px.
- Body: `"You've planned outfits for every day this week."` — body, stone.
- Button: `"View the week"` — terracotta, full-width.

**WEATHER** (suppression):
- Cloud SVG icon, 48px, stone.
- Title: `"Nothing suits the weather"` — DM Serif Display, 22px.
- Body: `"Your available pieces aren't quite right for [condition] today."` — body, stone.
- Two buttons: `"Override weather filter"` (terracotta outline) and `"Go to laundry basket"` (text link).

---

## Navigation

Bottom tab bar. Four tabs. 64px height + safe area.

```
Tab 1:  House icon    →  Weekly planner (home)
Tab 2:  Grid icon     →  Wardrobe
Tab 3:  Droplet icon  →  Laundry basket
Tab 4:  Calendar icon →  Export / share
```

Active tab: terracotta icon + terracotta label (11px DM Sans 500). Inactive: stone icon, no label. Tab bar surface: white, 0.5px top border in mist. No shadow.

---

## Motion & Interaction

- **Swipe deck:** Cards use spring physics. Throw velocity determines whether the card completes the animation or snaps back. `stiffness: 300, damping: 30` in React Native Reanimated.
- **Status change (long-press → laundry):** Card slides up and fades out (200ms ease-out). Grid reflows with a smooth layout animation.
- **Outfit confirmation:** Bottom sheet slides up with `spring({ stiffness: 400, damping: 40 })`.
- **VTO loading:** Shimmer placeholder (horizontal gradient animation, 1.5s loop) replaces the VTO area while FASHN generates.
- **Week day selection:** Selected day expands width from 44px to 64px with a 200ms ease. Weather badge fades in below.
- **Haptics:** Right swipe → `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`. Left swipe → `Haptics.impactAsync(ImpactFeedbackStyle.Light)`. Confirmation → `Haptics.notificationAsync(NotificationFeedbackType.Success)`.

---

## Replit Agent Prompt Hints

When briefing the agent, use these exact phrases for consistent output:

- *"Use DM Serif Display for all headings and card titles, DM Sans for all body and UI text."*
- *"Background is #FAF8F4 (cream), not white. Card surfaces are #FFFFFF."*
- *"The only accent colour is #C4522A (terracotta). Use it only on the primary action per screen."*
- *"Swipe cards are 320×440px centred, white surface, 16px border radius, shadow 0 8px 32px rgba(28,25,23,0.10)."*
- *"Status indicators are 8px dots only — green (#16A34A) for clean, blue (#3B82F6) for laundry. Never fill large surfaces with these colours."*
- *"Bottom sheet radius is 24px top corners only."*
- *"All text is sentence case. No ALL CAPS anywhere."*

---

## What to avoid

- Purple gradients, white backgrounds, Inter font — this is the generic AI app look. Do not use.
- Shadows on every element — only the active swipe card gets a shadow.
- Coloured tab bars — white only.
- Emoji in the UI — use SVG icons throughout.
- Any use of the word "fit" as a noun in UI labels — always "outfit".
