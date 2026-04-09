# Hotel Tracker — UI/UX Style Guide

This document is the authoritative reference for visual design and interaction patterns across all pages. It was derived from an audit of the app as of April 2026, selecting the best/most common existing pattern as the standard where inconsistencies existed.

---

## 1. Color Palette

All colors use the shadcn/ui CSS custom property tokens defined in `globals.css`. Never use raw Tailwind color utilities (e.g. `bg-gray-100`) for structural UI — only semantic tokens.

| Token                                    | Purpose                                  |
| ---------------------------------------- | ---------------------------------------- |
| `bg-background` / `text-foreground`      | Page background and primary text         |
| `text-muted-foreground`                  | Secondary text, captions, labels         |
| `bg-primary` / `text-primary-foreground` | Primary button fill (near-black / white) |
| `bg-secondary`                           | Muted chip/badge backgrounds             |
| `border`                                 | All borders                              |
| `bg-destructive`                         | Delete/error actions                     |
| `bg-card`                                | Card backgrounds                         |

### Semantic color exceptions (raw Tailwind is OK here)

| Usage                             | Class                                                                 |
| --------------------------------- | --------------------------------------------------------------------- |
| Savings / positive amounts        | `text-green-600`                                                      |
| Warning callouts & "Needs Review" | `text-amber-600`, `bg-amber-50`, `border-amber-200`, `text-amber-700` |
| "Active" status badge             | `text-green-700`, `bg-green-50`                                       |
| "Closed" status badge             | `text-muted-foreground`, `bg-muted`                                   |

---

## 2. Typography

### Page Titles (H1)

```tsx
<h1 className="text-2xl font-bold">Page Title</h1>
```

- **All** pages use `text-2xl font-bold`. No exceptions.
- Do not use `font-semibold`, `tracking-tight`, or `text-3xl` on H1s.
- The Dashboard's `text-3xl` is a known deviation — it should be normalized to `text-2xl`.

### Page Subtitles

All list pages include a subtitle immediately below the H1:

```tsx
<h1 className="text-2xl font-bold">Page Title</h1>
<p className="text-muted-foreground text-sm mt-1">Brief description of this page.</p>
```

| Page             | Subtitle                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| Dashboard        | "Overview of your bookings and savings" ✓ exists                                       |
| Bookings         | "All your hotel and apartment stays."                                                  |
| Promotions       | "Track loyalty, credit card, and portal promotions."                                   |
| Earnings Tracker | "Track points, cashback, and promotion postings across stays."                         |
| Price Watch      | "Monitor hotel rates and get alerted when prices drop below your thresholds." ✓ exists |
| Settings         | "Manage your cards, statuses, and reference data."                                     |

### Section Headings (H2)

```tsx
<h2 className="text-lg font-semibold">Section Name</h2>
```

Used within cards and settings tab content to introduce sub-sections.

### Field Labels

```tsx
<label className="text-sm font-medium text-foreground">Field Name</label>
```

Required fields append ` *` to the label text. The asterisk does not get special color — it is part of the label text.

### Table / Column Headers

- Always **sentence case** (e.g. `Hotel chain`, `Check-in`, `Net/night`).
- Never ALL CAPS. The Earnings Tracker's uppercase headers (`BOOKING`, `PORTAL`, etc.) are a known deviation.
- Use shadcn's `<TableHead>` component.

### Captions and Helper Text

```tsx
<p className="text-xs text-muted-foreground">Helper text here.</p>
```

---

## 3. Page Layout

### Root Container

Set globally in `layout.tsx` — do not override per-page:

```tsx
<div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 h-full flex flex-col">
```

### Per-Page Root

All pages use this as their outermost div:

```tsx
<div className="flex flex-col flex-1 min-h-0 space-y-6">
```

### Form Pages (narrow content)

All single-entity create/edit forms use a centered container. The width is `max-w-4xl` — a middle ground between the cramped `max-w-2xl` (too narrow for booking's 3-column field grids) and the sprawling full-width layout currently used by booking forms:

```tsx
<div className="mx-auto max-w-4xl space-y-6 pb-8">
```

This should be verified visually after implementation — if the Booking form feels too wide or too narrow at `max-w-4xl`, adjust to `max-w-3xl` or `max-w-5xl` accordingly. The goal is a focused, readable layout that doesn't leave large empty gutters on wide screens.

---

## 4. Page Header Pattern

### Standard List Page Header

```tsx
<div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
  <h1 className="text-2xl font-bold">Page Title</h1>
  <div className="flex items-center gap-2">
    {/* optional filters */}
    <Button asChild>
      <Link href="/entity/new">
        <Plus className="size-4" />
        Add Entity
      </Link>
    </Button>
  </div>
</div>
```

Rules:

- H1 always on the left.
- Filters and CTA always on the right, in a flex row.
- CTA button always uses `<Plus className="size-4" />` icon prefix.
- CTA label: **"Add [Entity]"** (not "New [Entity]").

### Page Title vs CTA Label

| Page            | H1 Title         | CTA Button                  |
| --------------- | ---------------- | --------------------------- |
| Bookings list   | "Bookings"       | "Add Booking"               |
| New Booking     | "Add Booking"    | "Create Booking" (submit)   |
| Edit Booking    | "Edit Booking"   | "Save Changes" (submit)     |
| Promotions list | "Promotions"     | "Add Promotion"             |
| New Promotion   | "Add Promotion"  | "Create Promotion" (submit) |
| Edit Promotion  | "Edit Promotion" | "Save Changes" (submit)     |

---

## 5. Navigation

### Sidebar (Desktop)

- Fixed left sidebar, `w-48` or similar.
- Active item: `bg-sidebar-accent text-sidebar-accent-foreground`, bold or medium weight.
- Each item: icon + label, consistent icon sizing.
- "Hotel Tracker" wordmark at top links to `/`.
- "Sign out" at bottom.

### Mobile Header

- Full-width banner: hamburger on left, "Hotel Tracker" centered, no right controls.
- Hamburger opens a left-slide drawer with the same nav items as desktop sidebar.
- No breadcrumbs currently — consider adding for detail pages.

---

## 6. Buttons

### Variants

Use shadcn `<Button>` component exclusively. Do not style raw `<button>` elements to look like buttons.

| Variant              | Use case                                   |
| -------------------- | ------------------------------------------ |
| Default (black fill) | Primary CTA — Add, Create, Save Changes    |
| `outline`            | Secondary actions — View, Edit, Sub-brands |
| `destructive`        | Delete actions                             |
| `ghost`              | Icon-only toolbar actions                  |
| `link`               | Inline text actions (navigation only)      |

### Sizes

- Default: list page CTAs, form submit buttons.
- `sm`: action buttons inside table rows.
- `icon`: icon-only buttons (e.g. map button on Dashboard).

### Row Actions

All list tables should have a consistent Actions column:

```tsx
<div className="flex gap-2">
  <Link href={`/entity/${id}`}>
    <Button variant="outline" size="sm">
      View
    </Button>
  </Link>
  <Button variant="destructive" size="sm" onClick={() => handleDelete(id)}>
    Delete
  </Button>
</div>
```

- **All** filter states (Ongoing, Expired, etc.) show the same actions.
- Do not conditionally hide Edit/Delete based on status — the Promotions Expired/Ongoing inconsistency is a known deviation to fix.
- Settings tabs currently use plain text "Edit" / "Delete" links — these should be normalized to `<Button>` components.

---

## 7. Confirmation Dialogs

Always use the `<ConfirmDialog>` component for destructive operations. Never use the native browser `confirm()`.

```tsx
<ConfirmDialog
  open={deleteOpen}
  onOpenChange={setDeleteOpen}
  title="Delete [Entity]?"
  description="Are you sure? This cannot be undone."
  onConfirm={handleDeleteConfirm}
/>
```

Known deviations: Promotions and Price Watch still use native `confirm()`.

---

## 8. Filter Controls

### Year Filter

Use `<Select>` dropdown. Width `w-40` on desktop, `flex-1` on mobile.

### Segmented Control (binary or multi-option toggle)

One consistent pattern across all pages:

```tsx
<div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">
  {options.map((opt) => (
    <button
      key={opt.value}
      onClick={() => setFilter(opt.value)}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md transition-colors",
        filter === opt.value
          ? "bg-background shadow-sm font-medium"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {opt.label}
    </button>
  ))}
</div>
```

Known deviations: Dashboard's Savings Breakdown (Value/Raw) and Payment Type (Stays/Nights) toggles use a dark pill active style instead of the light `bg-background shadow-sm` style.

### Type Filters (multi-category)

Use shadcn `<Tabs>` / `<TabsList>` / `<TabsTrigger>` for category tabs below the header (e.g. Promotions type filter: All / Credit Card / Portal / Loyalty).

---

## 9. Form Patterns

### Card-based Sections

Group related fields into `<Card>` components with a section label:

```tsx
<Card>
  <CardContent className="space-y-4 pt-6">
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      Section Name
    </div>
    {/* fields */}
  </CardContent>
</Card>
```

### Field Layout

- Desktop: 2–3 column grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`).
- Mobile: single column (no grid — let it stack).

### Required Fields

Append ` *` to the label. Do not color the asterisk differently from the label.

### Form Action Buttons

Inline at the bottom of the form:

```tsx
<div className="flex gap-2">
  <Button type="submit">Save Changes</Button>
  <Button variant="outline" onClick={handleCancel}>
    Cancel
  </Button>
</div>
```

On mobile, these may be displayed in a sticky bottom bar — but both desktop and mobile show the same two buttons in the same order (primary left, cancel right).

### Mobile Sticky Submit Bar

The booking form currently shows a sticky bottom bar on mobile with only the submit button. The Cancel button is hidden in this bar. Consider including Cancel or making this pattern explicit.

---

## 10. Tables

### Desktop

Use shadcn `<Table>` with sticky header:

```tsx
<TableHeader className="sticky top-0 bg-background z-20">
```

- Sticky first column for property/name: `className="sticky left-0 bg-background z-10"`.
- Right-align numeric columns.
- Sentence case headers.

### Mobile Fallback

Use a card list (`md:hidden`). Each card should show:

- Entity name (bold, prominent)
- Key metadata (2-column grid of label+value pairs)
- Action buttons at the bottom (View Details + Delete)

The Bookings mobile card (`<BookingCard>`) is the reference implementation.

**Earnings Tracker mobile exception:** Keep the current summary-only ("N pending") approach — the per-category data is too dense for mobile cards.

### Empty States

Use the `<EmptyState>` component with an icon, title, description, and optional action link.

---

## 11. Status Badges

Use shadcn `<Badge>` component.

| Status                       | Variant                | Extra classes                                 |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| Needs Review                 | `outline`              | `border-amber-400 bg-amber-50 text-amber-700` |
| Loyalty (promotion type)     | `default` (black fill) | —                                             |
| Credit Card (promotion type) | `secondary`            | —                                             |
| Portal (promotion type)      | `secondary`            | —                                             |
| Active (card status)         | `outline`              | `border-green-400 bg-green-50 text-green-700` |
| Closed (card status)         | `outline`              | —                                             |
| Hotel Code needed            | `outline`              | `border-amber-400 bg-amber-50 text-amber-700` |

---

## 12. Responsive Breakpoints

Sourced from `layout.tsx` and page patterns:

| Breakpoint           | Behavior                                                 |
| -------------------- | -------------------------------------------------------- |
| `< md` (< 768px)     | Mobile: hamburger nav, card lists, single-column forms   |
| `md–lg` (768–1024px) | Tablet: sidebar appears, table views, 2-column forms     |
| `> lg` (> 1024px)    | Desktop: full sidebar, 3-column forms, full table widths |

Key breakpoint classes in use:

- `md:hidden` — hide mobile card list
- `hidden md:flex` — show desktop table
- `sm:hidden` — mobile-only header layout
- `hidden sm:flex` — desktop header layout

---

## 13. Notification / Toast

Use `sonner` toasts via `toast.error(...)` and `toast.success(...)`. Always provide a user-readable message.

Do not use `alert()` or `console.error()` as user feedback.

---

## 14. Entity Pages — View vs Edit

Currently only Bookings have a dedicated View page (`/bookings/:id`). Promotions go directly to Edit.

**Standard to establish:** Every entity that has an Edit page should also have a View page. The View page is read-only and is the default destination when clicking a row. The Edit page is reached via an explicit "Edit" button/link on the View page.

The Bookings view page (`/bookings/:id`) is the reference implementation. The next entity to add a View page is Promotions (`/promotions/:id`).
