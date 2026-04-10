/**
 * Live status — the single source of truth for Bhargav's availability.
 *
 * Flip `open` to toggle the home header pulse and its label. When `open`
 * is true, the header dot animates in accent and reads "open · {timezone}".
 * When false, the dot dims to ink-low static and reads "closed · {timezone}".
 *
 * This is the only "real-time" element on the site, and changing it is
 * a deliberate, committed act. Per spec §3.5.
 */
export const STATUS = {
  open: true,
  timezone: 'IST',
  offset: 'UTC+5:30',
} as const;

export type StatusOpen = boolean;
