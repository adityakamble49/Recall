# Design System Specification: Technical Utility & Refined Flatness

## 1. Overview & Creative North Star: "The Precision Instrument"
This design system moves away from the "layered stack" of traditional UI and toward the aesthetic of a high-end physical tool—think of a Swiss-engineered Leica or a precision drafting compass. Our North Star is **The Precision Instrument**. 

We are stripping away the "fluff" of heavy drop shadows and faux-depth to embrace a "flat-plus" philosophy. We achieve hierarchy through extreme typographic contrast, surgical use of the `primary` #5D5FEF (Electric Indigo) accent, and solid color blocking. The goal is a "handy" mobile experience that feels instantaneous, tactile, and intentional. We aren't just building an app; we are providing a digital utility that feels as reliable as a physical tool.

## 2. Colors & Surface Architecture
The palette is rooted in a clinical, clean base (`surface`: #fcf8ff) punctuated by the high-energy Electric Indigo.

### The "No-Line" Rule (Sectioning)
Standard 1px borders for sectioning are strictly prohibited. Boundaries between major content blocks must be defined by **Background Shifts**. Use `surface-container-low` (#f5f2fe) to set off a section against the main `surface`. On mobile, this creates a "card-less" look where content groups are defined by subtle tonal changes rather than boxes.

### Surface Hierarchy & Nesting
Instead of using shadows to lift elements, we use "Tonal Steps."
*   **Base Layer:** `background` (#fcf8ff)
*   **Secondary Content Area:** `surface-container` (#efecf9)
*   **Interactive Components:** `surface-container-highest` (#e4e1ed)
*   **High-Contrast Highlights:** `surface-container-lowest` (#ffffff) — Reserved for the "active" focal point of a screen.

### Signature Textures & "Glass"
To ensure the system doesn't feel "cheap" or "default," utilize **Glassmorphism** for floating action bars and navigation:
*   Use `surface` at 80% opacity with a `backdrop-blur` of 20px. 
*   **Signature Gradient:** For primary CTAs, apply a linear gradient from `primary` (#4343d5) to `primary_container` (#5d5fef) at 135 degrees. This adds "visual soul" to a flat environment without resorting to skeuomorphism.

## 3. Typography: Hierarchy through Scale
We use **Plus Jakarta Sans** as a structural element. In a flat system, typography *is* the architecture.

*   **Display vs. Body:** Create "Editorial Tension" by pairing massive `display-lg` headers (3.5rem) with tight, functional `label-md` (0.75rem) metadata.
*   **Weight as Depth:** Use `bold` weights for `title-sm` to denote interactivity, replacing the need for a raised button shadow.
*   **Functional Labels:** `label-sm` (0.6875rem) should be used aggressively for utility-style micro-copy, acting like the etched markings on a lens or a ruler.

## 4. Elevation & Depth: Tonal Layering
Traditional structural lines and heavy shadows are deprecated in favor of sophisticated tonal stacking.

*   **The Layering Principle:** Depth is "stacked," not "floated." To make a card feel interactive, change its background from `surface-container-low` to `surface-container-highest` on tap/hover. 
*   **Ambient Shadows:** If a floating element (like a FAB) requires separation, use an "Ambient Trace."
    *   **Shadow:** 0px 4px 20px, Color: `on-surface` (#1b1b23) at **4% opacity**. It should be felt, not seen.
*   **The "Ghost Border" Fallback:** For input fields or containers requiring a hard boundary, use the `outline-variant` (#c7c4d7) at **20% opacity**. Never use 100% opaque borders.
*   **Tactile Feedback:** Use the `surface_tint` (#4849da) as a 2px bottom-border on active tabs to provide a "high-end tool" highlight.

## 5. Components: The Utility Set

### Buttons (The Tooling Logic)
*   **Primary:** Solid `primary` (#4343d5). No shadow. Roundedness: `md` (0.375rem).
*   **Secondary:** `surface-container-highest` (#e4e1ed) with `on-surface` text.
*   **Tertiary:** Ghost style. No background, `primary` text. Use `spacing-2` for horizontal padding to keep it tight.

### Input Fields (The Precision Slot)
*   **Style:** Flat backgrounds using `surface-container-high` (#e9e6f3). 
*   **Indicator:** A 2px bottom-accent of `primary` appears only on focus. This mimics the "active state" of a precision instrument.

### Cards & Lists
*   **Forbid Dividers:** Use `spacing-4` (0.9rem) of vertical white space or a subtle shift to `surface-container-low` to separate items.
*   **Mobile Lists:** Use `label-sm` for "Section Headers" in all-caps with 0.05em letter spacing to provide clear hierarchy without taking up vertical real estate.

### The "Control Strip" (Custom Component)
Instead of a standard bottom nav, use a "Control Strip"—a docked, semi-transparent (`surface` 80% + blur) horizontal bar using `spacing-2.5` internal padding and `primary` icons. It should feel like a floating tool palette.

## 6. Do's and Don'ts

### Do:
*   **DO** use `spacing-1.5` and `spacing-2` for tight, tool-like information density.
*   **DO** use `primary` (#5D5FEF) sparingly. It is a "signal" color for action, not a decoration.
*   **DO** rely on the `surface-container` tiers to create hierarchy. If it doesn't look right, try a different surface token before reaching for a shadow.

### Don't:
*   **DON'T** use 100% black text. Always use `on-surface` (#1b1b23) for a sophisticated, ink-like feel.
*   **DON'T** use `rounded-full` for everything. Stick to `md` (0.375rem) for a more professional, "machined" look. Save `full` for chips and toggle switches only.
*   **DON'T** use 1px solid borders to separate list items. It creates visual noise and breaks the "handy" tool aesthetic.