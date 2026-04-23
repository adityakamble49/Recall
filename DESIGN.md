# Recall Design System

## 1. Visual Theme & Atmosphere

Recall is built as a high-performance utility for software engineers. The interface is defined by **precision, density, and monochromatic clarity**. Unlike tools that rely on vibrant illustrations or soft gradients, Recall uses a structured "Obsidian" palette that prioritizes information hierarchy and reduced eye strain.

The design philosophy is centered on the **"Original Recall" aesthetic**: generous 12px/16px rounding that feels modern but professional, relaxed 16px vertical spacing for readability, and a deep charcoal foundation. It uses a dual-surface approach where content lives on `surface` cards elevated from a `void` background.

The system is fully dynamic, supporting both **Obsidian Dark** (a desaturated deep charcoal) and **Refined Light** (a clean, high-contrast monochrome). Typography is used as a functional tool: **Inter** handles the interface and reading, while **JetBrains Mono** is reserved for technical metadata, counts, and the brand logo — signaling that this is a tool built by engineers, for engineers.

**Key Characteristics:**
- **Charcoal Foundation** (`#0d0e12`): A lighter, more readable alternative to pure black.
- **Dynamic Theming**: First-class support for both Light and Dark modes via semantic CSS variables.
- **Precision Rounding**: Standard 12px for cards and 8px for smaller items, creating a soft but structured look.
- **Information Density**: High-density bookmark lists with subtle dividers and hover-triggered actions.
- **Typographic Hierarchy**: Inter for UI text, JetBrains Mono for metadata and technical data.
- **Shadow-Border Technique**: Using subtle shadows in Light mode and distinct border steps in Dark mode to communicate depth.
- **Full-Width Utility**: The capture bar spans the full dashboard width, emphasizing its role as the primary entry point.

## 2. Color Palette & Roles (Semantic)

Recall uses a semantic variable system (`data-theme`) to ensure consistency across themes.

### Dark Theme (Obsidian)
- **Void** (`#0d0e12`): The base canvas.
- **Surface** (`#16181d`): Primary card backgrounds.
- **Raised** (`#21242b`): Hover states, secondary buttons, and sidebar items.
- **Border** (`#2d3139`): Default UI borders.
- **Border Hover** (`#3e444e`): Interactive border highlights.

### Light Theme (Refined)
- **Void** (`#fafafa`): The base canvas.
- **Surface** (`#ffffff`): Primary card backgrounds.
- **Raised** (`#f4f4f5`): Hover states, secondary buttons, and sidebar items.
- **Border** (`#e4e4e7`): Default UI borders.
- **Border Hover** (`#d4d4d8`): Interactive border highlights.

### Shared Colors
- **Brand** (`#3b82f6`): Used sparingly for focus and accents.
- **Destructive** (`#ef4444`): For irreversible actions (Delete).
- **Text Primary**: High contrast for headings and titles.
- **Text Secondary**: Medium contrast for body and sidebar labels.
- **Text Muted**: Low contrast for placeholders and technical metadata.

## 3. Typography Rules

### Font Families
- **UI/Reading**: `Inter` (sans-serif) — used for all standard interface text.
- **Technical/Meta**: `JetBrains Mono` (monospace) — used for the "Recall" logo, bookmark counts, domains, and timestamps.

### Hierarchy

| Role | Font | Size | Weight | Tracking | Tailwind | Use |
|------|------|------|--------|----------|----------|-----|
| Main Heading | Inter | 48px / 3rem | 700 | -0.025em | `text-4xl md:text-5xl font-bold tracking-tight` | Dashboard headline |
| Page Title | Inter | 30px / 1.875rem | 700 | -0.025em | `text-3xl font-bold tracking-tight` | Settings headline |
| Section Label | Inter | 12px / 0.75rem | 600 | 0.05em | `text-xs font-semibold uppercase tracking-wider` | "COLLECTIONS", "ACCOUNT" |
| Brand Logo | Mono | 16px / 1rem | 700 | -0.025em | `text-base font-bold tracking-tight font-mono` | Navbar logo |
| Meta Data | Mono | 12px / 0.75rem | 400 | normal | `text-xs font-mono` | Timestamps, domain names |
| Counts | Mono | Inherit | 700 | normal | `font-mono` | Numbers within headings/buttons |

## 4. Component Stylings

### Capture Bar (Primary Utility)
The entry point of the app. It must feel fast and expansive.
- **Width**: `w-full` within its container (max-width: 800px area in preview, 5xl in app).
- **Styling**: `h-11 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20`.
- **Button**: `bg-primary text-void rounded-lg` positioned absolutely on the right.

### Bookmark Cards
Designed for scanning and high-volume management.
- **Container**: `px-4 py-3 border-b border-border hover:bg-raised transition-all`.
- **Icon**: `w-10 h-10 rounded-lg bg-raised border border-border`.
- **Actions**: `opacity-0 group-hover:opacity-100 transition-opacity`.
- **Hierarchy**: Bold title above Mono metadata.

### Dashboard Layout
- **Sidebar**: `w-[280px]` sidebar for collections.
- **Active Item**: `bg-primary text-void border-primary` for the "All Bookmarks" toggle.
- **Inactive Item**: `bg-surface border-border text-secondary hover:text-primary`.
- **Gaps**: `gap-12` between sidebar and content.

### Modals & Overlays
- **Overlay**: `bg-overlay-bg backdrop-blur-sm`.
- **Container**: `rounded-2xl border border-border-hover shadow-floating`.
- **Radius**: `rounded-2xl` (16px) for major floating windows.

## 5. Layout Principles

### Spacing Scale
- `px-6 md:px-10`: Standard horizontal padding for page containers.
- `py-10 md:py-16`: Standard vertical padding for page content.
- `mb-16`: Large vertical gap after primary actions (Capture Bar).
- `mb-8`: Standard heading margin.

### Grid Standards
- **Standard Page**: `max-w-5xl mx-auto`.
- **Narrow Page**: `max-w-lg mx-auto` (Settings, Onboarding).
- **Grid Layout**: `grid grid-cols-1 lg:grid-cols-[280px_1fr]`.

## 6. Responsive Behavior

- **Navbar**: Constant 56px height, logo and theme toggle always visible.
- **Sidebar**: Collapses to full width on mobile (`grid-cols-1`), stacks above content.
- **Rounding**: Maintains 12px/16px radius across all breakpoints to preserve the "Original Recall" feel.
- **Interactive**: Hover states are disabled or de-emphasized on touch devices.

## 7. Do's and Don'ts

### Do
- Always use semantic classes (`text-primary`, `bg-surface`, `border-border`).
- Use `JetBrains Mono` for any data-heavy or technical string (IDs, counts, domains).
- Maintain generous rounding (12px minimum for cards) to preserve the brand aesthetic.
- Use `transition-all` or `transition-colors` on every interactive state.
- Ensure the capture bar is always `w-full` and prominently positioned.

### Don't
- Don't use hardcoded Tailwind zinc/gray classes (`zinc-900`).
- Don't use pure black (`#000000`) for dark mode background; use Obsidian (`#0d0e12`).
- Don't reduce information density too much; Recall is a utility first.
- Don't introduce non-monochrome colors unless they are for `brand` or `destructive` actions.
- Don't rearrange core UI components without a specific layout directive.

## 8. Agent Reference (Quick Setup)

- **Canvas Background**: `bg-void`
- **Card Background**: `bg-surface border border-border rounded-xl shadow-card`
- **Primary Text**: `text-primary font-bold tracking-tight`
- **Metadata**: `text-xs text-muted font-mono`
- **Primary Button**: `bg-primary text-void rounded-xl py-2 px-4 font-medium`
- **Secondary Button**: `bg-surface text-primary border border-border rounded-xl`
- **Input**: `h-11 px-4 bg-raised border border-border rounded-xl focus:ring-primary/20`
