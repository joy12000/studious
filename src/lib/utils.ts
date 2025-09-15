import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generatePastelColorFromText(text: string): { backgroundColor: string; color: string } {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate HSL values
  const hue = hash % 360;
  const saturation = 70; // Keep saturation constant for a consistent look
  const lightness = 90; // Light pastel background

  // Determine text color for contrast
  // With a light background (lightness > 65), dark text is better.
  const textColor = 'hsl(0, 0%, 20%)'; // A very dark gray

  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: textColor,
  };
}