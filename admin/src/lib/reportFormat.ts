/** Safe text for table cells when API may return nested objects (older servers or mixed shapes). */
export function reportCellText(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.name === 'string' && o.name) return o.name;
    if ('firstName' in o || 'lastName' in o) {
      const name = `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim();
      if (name) return name;
      if (typeof o.staffId === 'string' || typeof o.staffId === 'number') return String(o.staffId);
      return '—';
    }
  }
  return '—';
}

export function staffIdFromEmployeeField(employee: unknown): string {
  if (employee != null && typeof employee === 'object' && 'staffId' in employee) {
    const id = (employee as { staffId?: unknown }).staffId;
    if (typeof id === 'string' || typeof id === 'number') return String(id);
  }
  return '';
}
