export const UNSET_EVENT_DATE = 'undated';

export function eventDateForStorage(date?: string | null): string {
  const trimmed = typeof date === 'string' ? date.trim() : '';
  if (!trimmed || trimmed === UNSET_EVENT_DATE) return UNSET_EVENT_DATE;
  return trimmed;
}

export function eventDateForForm(date?: string | null): string {
  if (!date || date === UNSET_EVENT_DATE) return '';
  return date;
}

export function isEventDateSet(date?: string | null): boolean {
  return !!date && date !== UNSET_EVENT_DATE;
}
