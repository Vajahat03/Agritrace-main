/**
 * AgriTrace Shelf-Life Display Formatters
 *
 * Requirements:
 * 1. Display whole-day shelf life consistently across scans, dashboards, batches, inventory and recommendations.
 * 2. For a positive estimate below one day, display "Less than 1 day".
 * 3. For whole-day displays, use correct singular ("1 day") / plural ("N days") formatting.
 * 4. Preserve underlying numeric predictions for calculations and date arithmetic.
 */

export function formatShelfLifeDays(days: number | null | undefined): string {
  if (days === null || days === undefined || isNaN(days)) {
    return 'N/A';
  }
  if (days <= 0) {
    return 'Expired';
  }
  if (days < 1) {
    return 'Less than 1 day';
  }
  const rounded = Math.round(days);
  return rounded === 1 ? '1 day' : `${rounded} days`;
}

export function formatShelfLifeValue(days: number | null | undefined): { value: string; unit: string } {
  if (days === null || days === undefined || isNaN(days)) {
    return { value: 'N/A', unit: '' };
  }
  if (days <= 0) {
    return { value: '0', unit: 'Days' };
  }
  if (days < 1) {
    return { value: 'Less than 1', unit: 'Day' };
  }
  const rounded = Math.round(days);
  return { value: String(rounded), unit: rounded === 1 ? 'Day' : 'Days' };
}

export function formatShelfLifeInterval(
  minDays: number | null | undefined,
  maxDays: number | null | undefined
): string {
  if (minDays === null || minDays === undefined || maxDays === null || maxDays === undefined) {
    return 'N/A';
  }
  const minText = minDays < 1 ? '< 1' : String(Math.round(minDays));
  const maxText = maxDays < 1 ? '< 1' : String(Math.round(maxDays));
  return `${minText} - ${maxText} days`;
}
