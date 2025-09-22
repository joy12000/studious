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

export function getPastelColorStringFromText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = hash % 360;
  const saturation = 70;
  const lightness = 90;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function generateFallbackIconDataUrl(name: string): string {
  const firstLetter = name.charAt(0).toUpperCase();
  const color = getPastelColorStringFromText(name); // Use the new helper
  const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="32" fill="${color}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="32" font-family="sans-serif">${firstLetter}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}