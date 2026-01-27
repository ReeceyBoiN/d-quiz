/**
 * Responsive sizing utilities and helper functions
 * Provides convenient functions for responsive design patterns
 */

import { BREAKPOINTS, RESPONSIVE_SIZES, ASPECT_RATIOS } from './responsiveConfig';

/**
 * Create responsive value object with Tailwind classes
 * Returns an object with size names for different breakpoints
 * 
 * @example
 * responsiveSize(16, 20, 24, 28) // Returns object with width and height values
 * responsiveSize('12px', '16px', '20px', '24px')
 */
export function responsiveSize(
  mobile: string | number,
  tablet: string | number,
  desktop: string | number,
  large: string | number
): { mobile: string | number; tablet: string | number; desktop: string | number; large: string | number } {
  return { mobile, tablet, desktop, large };
}

/**
 * Create a fluid size using CSS clamp()
 * Perfect for responsive sizing without breakpoints
 * 
 * @example
 * fluidSize(12, 2, 24) // Returns 'clamp(12px, 2vw, 24px)'
 * fluidSize(200, 50, 800) // Returns 'clamp(200px, 50vw, 800px)'
 */
export function fluidSize(
  minPx: number,
  prefVw: number,
  maxPx: number
): string {
  return `clamp(${minPx}px, ${prefVw}vw, ${maxPx}px)`;
}

/**
 * Create fluid height based on viewport height
 * @example
 * fluidHeight(100, 50, 400) // Returns 'clamp(100px, 50vh, 400px)'
 */
export function fluidHeight(
  minPx: number,
  prefVh: number,
  maxPx: number
): string {
  return `clamp(${minPx}px, ${prefVh}vh, ${maxPx}px)`;
}

/**
 * Create responsive font size using CSS clamp()
 * @example
 * fluidFontSize(14, 2, 32) // Returns 'clamp(14px, 2vw, 32px)'
 */
export function fluidFontSize(
  minPx: number,
  prefVw: number,
  maxPx: number
): string {
  return fluidSize(minPx, prefVw, maxPx);
}

/**
 * Calculate responsive dimensions based on aspect ratio
 * @example
 * aspectRatioDimensions(300, 2/3) // Returns { width: 300, height: 450 }
 */
export function aspectRatioDimensions(
  width: number,
  aspectRatio: number
): { width: number; height: number } {
  return {
    width,
    height: Math.round(width / aspectRatio),
  };
}

/**
 * Get aspect ratio string from width and height
 * @example
 * getAspectRatio(16, 9) // Returns '16/9'
 */
export function getAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}/${height / divisor}`;
}

/**
 * Convert pixels to viewport width percentage
 * Useful for scaling calculations
 * @example
 * pxToVw(400) // Returns 'clamp with px converted to vw'
 */
export function pxToVw(pixels: number): number {
  return (pixels / window.innerWidth) * 100;
}

/**
 * Convert pixels to viewport height percentage
 */
export function pxToVh(pixels: number): number {
  return (pixels / window.innerHeight) * 100;
}

/**
 * Scale a value based on viewport ratio compared to expected size
 * Useful for responsive scaling in calculations
 * @example
 * const scale = getViewportScale(1920, 1080) // Get scale factor if viewport differs from 1920x1080
 */
export function getViewportScale(
  expectedWidth: number,
  expectedHeight: number
): number {
  const widthRatio = window.innerWidth / expectedWidth;
  const heightRatio = window.innerHeight / expectedHeight;
  return Math.min(widthRatio, heightRatio);
}

/**
 * Get responsive padding value based on breakpoint
 * @example
 * getResponsivePadding() // Returns padding string based on current viewport
 */
export function getResponsivePadding(): string {
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.sm) return RESPONSIVE_SIZES.padding.mobile;
  if (width < BREAKPOINTS.md) return RESPONSIVE_SIZES.padding.tablet;
  if (width < BREAKPOINTS.lg) return RESPONSIVE_SIZES.padding.desktop;
  return RESPONSIVE_SIZES.padding.large;
}

/**
 * Get responsive gap value based on breakpoint
 */
export function getResponsiveGap(): string {
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.sm) return RESPONSIVE_SIZES.gap.mobile;
  if (width < BREAKPOINTS.md) return RESPONSIVE_SIZES.gap.tablet;
  if (width < BREAKPOINTS.lg) return RESPONSIVE_SIZES.gap.desktop;
  return RESPONSIVE_SIZES.gap.large;
}

/**
 * Get responsive button size based on breakpoint
 */
export function getResponsiveButtonSize(): { height: string; width: string } {
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.sm) return RESPONSIVE_SIZES.button.mobile;
  if (width < BREAKPOINTS.md) return RESPONSIVE_SIZES.button.tablet;
  return RESPONSIVE_SIZES.button.desktop;
}

/**
 * Get responsive image preview size based on breakpoint
 */
export function getResponsiveImagePreviewSize(): { width: string; height: string } {
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.sm) return RESPONSIVE_SIZES.imagePreview.mobile;
  if (width < BREAKPOINTS.md) return RESPONSIVE_SIZES.imagePreview.tablet;
  return RESPONSIVE_SIZES.imagePreview.desktop;
}

/**
 * Calculate sidebar width constraints
 * @example
 * getSidebarConstraints(300) // Ensures sidebar doesn't exceed 50% of screen
 */
export function getSidebarConstraints(
  preferredWidth: number
): { min: string; max: string; default: string } {
  const maxWidth = window.innerWidth * 0.5; // Never exceed 50% of screen
  const constrainedWidth = Math.min(preferredWidth, maxWidth);
  
  return {
    min: RESPONSIVE_SIZES.sidebar.min,
    max: RESPONSIVE_SIZES.sidebar.max,
    default: `${constrainedWidth}px`,
  };
}

/**
 * Get viewport dimensions with safe defaults
 */
export function getViewportDimensions(): { width: number; height: number } {
  return {
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  };
}

/**
 * Check if viewport is in portrait orientation
 */
export function isPortraitOrientation(): boolean {
  const { width, height } = getViewportDimensions();
  return height > width;
}

/**
 * Check if viewport is in landscape orientation
 */
export function isLandscapeOrientation(): boolean {
  const { width, height } = getViewportDimensions();
  return width > height;
}

/**
 * Get viewport aspect ratio
 * @example
 * getViewportAspectRatio() // Returns approximately 16/9 for 1920x1080
 */
export function getViewportAspectRatio(): number {
  const { width, height } = getViewportDimensions();
  return width / height;
}

/**
 * Check if viewport is ultra-wide (aspect ratio > 2.5:1)
 */
export function isUltraWide(): boolean {
  return getViewportAspectRatio() > 2.5;
}

/**
 * Check if viewport is square-ish (aspect ratio between 0.8 and 1.2)
 */
export function isSquareViewport(): boolean {
  const ratio = getViewportAspectRatio();
  return ratio >= 0.8 && ratio <= 1.2;
}

/**
 * Combine multiple responsive values into a single object
 * Useful for managing multiple responsive properties
 * @example
 * const sizes = combineResponsiveValues(
 *   { mobile: '12px', tablet: '16px', desktop: '20px', large: '24px' },
 *   { mobile: '8px', tablet: '12px', desktop: '16px', large: '20px' }
 * )
 */
export function combineResponsiveValues<T extends Record<string, any>>(
  ...values: T[]
): T {
  return Object.assign({}, ...values);
}

/**
 * Create responsive CSS custom properties for use in inline styles or CSS
 * @example
 * const vars = createResponsiveVars({ '--padding': getResponsivePadding() })
 */
export function createResponsiveVars(
  values: Record<string, string>
): React.CSSProperties {
  return values as React.CSSProperties;
}
