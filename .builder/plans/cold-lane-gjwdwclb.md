# Fix: Expand Settings Close Button Clickable Area

## Problem
The Settings menu close button (X) has a clickable area that is still too small despite changing the button size to "default". Users are having difficulty clicking the close button reliably.

## Current State
- Button size is already set to "default" (improved from "sm")
- Clickable area is expanded using CSS pseudo-element: `after:-inset-2` (8px expansion on all sides)
- The expansion is hidden on mobile: `md:after:hidden`

## Root Cause
The `-inset-2` expansion (8px) is not sufficient. The hitbox needs to be significantly larger to provide a comfortable click target for users.

## Recommended Solution
Increase the pseudo-element inset expansion from `-inset-2` (8px) to `-inset-4` (16px) on all sides. This will:
- Double the current clickable area expansion
- Create a much more comfortable and forgiving click target
- Maintain the hidden state on mobile devices
- Keep the visual appearance unchanged while expanding the invisible click region

## Files to Modify
- **src/components/Settings.tsx** (line 1508)
  - Change from: `className="text-muted-foreground hover:text-foreground relative after:absolute after:-inset-2 md:after:hidden"`
  - Change to: `className="text-muted-foreground hover:text-foreground relative after:absolute after:-inset-4 md:after:hidden"`

## Implementation Details
The CSS change uses Tailwind's inset utilities:
- `-inset-2` = `--tw-space * 0.5rem` = 8px expansion
- `-inset-4` = `--tw-space * 1rem` = 16px expansion

This creates an invisible expanded clickable area without changing the visual appearance of the button.

## Test Cases
1. Click the close button from various positions - should be noticeably easier to trigger
2. Verify the button still appears the same visually
3. Confirm the settings menu closes reliably on first click
4. Check on mobile that the expanded hitbox is still hidden (md:after:hidden)
