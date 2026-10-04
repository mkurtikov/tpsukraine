import directory from '../data/zip-directory.json';

const assignedCodes = new Set(directory.codes.split(' '));
const prefixStates: Record<string, string[]> = directory.prefixStates;
const crossBorderStates: Record<string, string[]> = {
  '06390': ['NY', 'CT'], '71854': ['AR', 'TX'], '73960': ['OK', 'TX'],
  '83414': ['ID', 'WY'],
};

/** Advisory only: postal/facility boundaries do not prove residence.
 * ZIP+4 suffixes are checked for format, not whether they are assigned.
 * Never use this result to choose a state or block preparing a letter.
 */
export function zipWarning(value: string, state: string): string {
  const zip = value.trim();
  if (!zip) return '';
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return 'Please double check your ZIP code. Use 5 digits or ZIP+4 (for example, 12345-6789).';
  const base = zip.slice(0, 5);
  if (!assignedCodes.has(base)) return 'Please double check your ZIP code. It was not found in our ZIP list.';
  const possible = [...(prefixStates[base.slice(0, 3)] ?? []), ...(crossBorderStates[base] ?? [])];
  if (state && possible.length && !possible.includes(state)) return 'Please double check your ZIP code and state. They may not match; some ZIP codes cross state lines.';
  return '';
}
