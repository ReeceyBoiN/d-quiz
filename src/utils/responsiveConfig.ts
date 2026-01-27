/**
 * Centralized responsive configuration for the entire application
 * This ensures consistent breakpoints across both Tailwind CSS and JavaScript
 */

// Breakpoint values in pixels
export const BREAKPOINTS = {
  xs: 640,      // Mobile phones
  sm: 768,      // Tablets
  md: 1024,     // Laptops/monitors
  lg: 1440,     // Large monitors
  xl: 1920,     // Full HD
  '2xl': 3840,  // 4K
} as const;

// Media query strings for use in JavaScript
export const MEDIA_QUERIES = {
  xs: `(max-width: ${BREAKPOINTS.xs - 1}px)`,
  sm: `(max-width: ${BREAKPOINTS.sm - 1}px)`,
  md: `(max-width: ${BREAKPOINTS.md - 1}px)`,
  lg: `(max-width: ${BREAKPOINTS.lg - 1}px)`,
  xl: `(max-width: ${BREAKPOINTS.xl - 1}px)`,
  '2xl': `(max-width: ${BREAKPOINTS['2xl'] - 1}px)`,
  // Min-width queries for "at least this size"
  'xs-up': `(min-width: ${BREAKPOINTS.xs}px)`,
  'sm-up': `(min-width: ${BREAKPOINTS.sm}px)`,
  'md-up': `(min-width: ${BREAKPOINTS.md}px)`,
  'lg-up': `(min-width: ${BREAKPOINTS.lg}px)`,
  'xl-up': `(min-width: ${BREAKPOINTS.xl}px)`,
  '2xl-up': `(min-width: ${BREAKPOINTS['2xl']}px)`,
} as const;

// Breakpoint type for TypeScript
export type Breakpoint = keyof typeof BREAKPOINTS;
export type MediaQuery = keyof typeof MEDIA_QUERIES;

// Helper function to check if window matches a breakpoint
export const matchesBreakpoint = (query: MediaQuery): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MEDIA_QUERIES[query]).matches;
};

// Helper function to get current breakpoint name
export const getCurrentBreakpoint = (): Breakpoint | null => {
  if (typeof window === 'undefined') return null;
  
  // Check from largest to smallest to get the most specific match
  const breakpointEntries = Object.entries(BREAKPOINTS).reverse() as [Breakpoint, number][];
  
  for (const [name, value] of breakpointEntries) {
    if (window.innerWidth >= value) {
      return name;
    }
  }
  
  return 'xs'; // Default to smallest
};

/**
 * Responsive sizing utilities
 * These provide consistent size mappings across breakpoints
 */

export const RESPONSIVE_SIZES = {
  // Padding
  padding: {
    mobile: '20px',
    tablet: '32px',
    desktop: '40px',
    large: '48px',
  },
  // Gap between elements
  gap: {
    mobile: '12px',
    tablet: '16px',
    desktop: '20px',
    large: '24px',
  },
  // Border radius
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  // Font sizes (use clamp() for these in CSS instead)
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '60px',
  },
  // Sidebar widths
  sidebar: {
    mobile: '0px',      // Collapsed/hidden
    tablet: '250px',
    desktop: '345px',
    max: '600px',
    min: '200px',
  },
  // Button sizes
  button: {
    mobile: {
      height: '44px',
      width: '44px',
    },
    tablet: {
      height: '48px',
      width: '48px',
    },
    desktop: {
      height: '56px',
      width: '56px',
    },
  },
  // Image preview sizes
  imagePreview: {
    mobile: {
      width: '120px',
      height: '180px',
    },
    tablet: {
      width: '200px',
      height: '300px',
    },
    desktop: {
      width: '300px',
      height: '450px',
    },
  },
} as const;

// Aspect ratios
export const ASPECT_RATIOS = {
  portrait: '2/3',
  landscape: '16/9',
  square: '1/1',
  video: '16/9',
  thumbnail: '4/3',
} as const;

// Z-index scale for consistent layering
export const Z_INDEX = {
  background: 0,
  content: 10,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  notification: 700,
  debug: 9999,
} as const;
