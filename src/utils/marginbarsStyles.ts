/**
 * Shared styles and utilities for all margin bar components
 * Import this file in all margin bar components to avoid code duplication
 */

/**
 * Calculate gradient background with opacity based on position
 * - Left margin bar: 100% opacity on left (outside), 0% on right (inside)
 * - Right margin bar: 0% opacity on left (inside), 100% on right (outside)
 */
export function getGradientBackground(
  teamColors: { primary: string; secondary?: string },
  position: 'left' | 'right'
): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(teamColors.primary);
  const r = result ? parseInt(result[1], 16) : 255;
  const g = result ? parseInt(result[2], 16) : 255;
  const b = result ? parseInt(result[3], 16) : 255;
  
  // Use secondary color if available, otherwise use a darker version of primary
  const secondaryResult = teamColors.secondary 
    ? /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(teamColors.secondary)
    : null;
  const secondaryR = secondaryResult ? parseInt(secondaryResult[1], 16) : Math.max(0, r - 40);
  const secondaryG = secondaryResult ? parseInt(secondaryResult[2], 16) : Math.max(0, g - 40);
  const secondaryB = secondaryResult ? parseInt(secondaryResult[3], 16) : Math.max(0, b - 40);
  
  // For left margin bar: 25% opacity on left (outside), 0% on right (inside)
  // For right margin bar: 0% opacity on left (inside), 25% on right (outside)
  return position === 'left'
    ? `linear-gradient(to right, rgba(${secondaryR}, ${secondaryG}, ${secondaryB}, 0.25), rgba(${secondaryR}, ${secondaryG}, ${secondaryB}, 0))`
    : `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0), rgba(${r}, ${g}, ${b}, 0.25))`;
}

/**
 * Generate data row styles for margin bar tables
 */
export function getDataRowStyles(
  teamColors: { primary: string; secondary?: string },
  position: 'left' | 'right',
  rowHeight: string = 'calc((100vh - 40px) / 16)',
  isActive: boolean = false
) {
  const gradientBackground = getGradientBackground(teamColors, position);
  
  return {
    mb: 0.25,
    borderRadius: '4px',
    height: rowHeight,
    minHeight: '32px',
    background: gradientBackground,
    border: 'none',
    p: 0.5,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    cursor: 'pointer',
    '&:hover': {
      background: gradientBackground,
    },
  };
}

/**
 * Header row styles (consistent across all margin bars)
 */
export const headerRowStyles = {
  mb: 0.25,
  borderRadius: '4px',
  height: 'calc((100vh - 40px) / 16)',
  bgcolor: '#000000',
  p: 0.5,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  border: 'none',
};

/**
 * Helper function to convert hex to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return `rgba(255, 255, 255, ${opacity})`;
  }
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

