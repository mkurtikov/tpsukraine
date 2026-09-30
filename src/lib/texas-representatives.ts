// Current serving members, checked 2026-09-30 against the Texas section of:
// https://www.house.gov/representatives
// TX-23 is listed as vacant; its former member is deliberately excluded.
// This is a local spelling aid, not an address-to-district lookup.
export const texasRepresentatives = [
  { district: 1, firstName: 'Nathaniel', lastName: 'Moran' },
  { district: 2, firstName: 'Dan', lastName: 'Crenshaw' },
  { district: 3, firstName: 'Keith', lastName: 'Self' },
  { district: 4, firstName: 'Pat', lastName: 'Fallon' },
  { district: 5, firstName: 'Lance', lastName: 'Gooden' },
  { district: 6, firstName: 'Jake', lastName: 'Ellzey' },
  { district: 7, firstName: 'Lizzie', lastName: 'Fletcher' },
  { district: 8, firstName: 'Morgan', lastName: 'Luttrell' },
  { district: 9, firstName: 'Al', lastName: 'Green' },
  { district: 10, firstName: 'Michael', lastName: 'McCaul' },
  { district: 11, firstName: 'August', lastName: 'Pfluger' },
  { district: 12, firstName: 'Craig', lastName: 'Goldman' },
  { district: 13, firstName: 'Ronny', lastName: 'Jackson' },
  { district: 14, firstName: 'Randy', lastName: 'Weber' },
  { district: 15, firstName: 'Monica', lastName: 'De La Cruz' },
  { district: 16, firstName: 'Veronica', lastName: 'Escobar' },
  { district: 17, firstName: 'Pete', lastName: 'Sessions' },
  { district: 18, firstName: 'Christian', lastName: 'Menefee' },
  { district: 19, firstName: 'Jodey', lastName: 'Arrington' },
  { district: 20, firstName: 'Joaquin', lastName: 'Castro' },
  { district: 21, firstName: 'Chip', lastName: 'Roy' },
  { district: 22, firstName: 'Troy', lastName: 'Nehls' },
  { district: 24, firstName: 'Beth', lastName: 'Van Duyne' },
  { district: 25, firstName: 'Roger', lastName: 'Williams' },
  { district: 26, firstName: 'Brandon', lastName: 'Gill' },
  { district: 27, firstName: 'Michael', lastName: 'Cloud' },
  { district: 28, firstName: 'Henry', lastName: 'Cuellar' },
  { district: 29, firstName: 'Sylvia', lastName: 'Garcia' },
  { district: 30, firstName: 'Jasmine', lastName: 'Crockett' },
  { district: 31, firstName: 'John', lastName: 'Carter' },
  { district: 32, firstName: 'Julie', lastName: 'Johnson' },
  { district: 33, firstName: 'Marc', lastName: 'Veasey' },
  { district: 34, firstName: 'Vicente', lastName: 'Gonzalez' },
  { district: 35, firstName: 'Greg', lastName: 'Casar' },
  { district: 36, firstName: 'Brian', lastName: 'Babin' },
  { district: 37, firstName: 'Lloyd', lastName: 'Doggett' },
  { district: 38, firstName: 'Wesley', lastName: 'Hunt' },
] as const;

const normalizeName = (name: string) => name.normalize('NFKD')
  .replace(/\p{M}/gu, '').toLowerCase().replace(/[\s.,'’\-]+/g, '');

const knownNames = new Set(texasRepresentatives.map(({ lastName }) => normalizeName(lastName)));

export function isKnownTexasRepresentative(name: string): boolean {
  return knownNames.has(normalizeName(name));
}
