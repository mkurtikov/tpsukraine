import directory from '../data/representatives.json';

export const representatives = directory.representatives;
export type Representative = (typeof representatives)[number];
export const representativeById = (id: string, state: string) =>
  representatives.find(person => person.id === id && person.state === state);
export const representativeLabel = (person: Representative) =>
  `${person.name} — ${person.stateName}, ${person.district === 0 ? person.districtLabel : `District ${person.district}`}`;

const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function searchRepresentatives(state: string, query: string): Representative[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return representatives.filter(person => person.state === state
    && words.every(word => normalize(`${person.name} ${person.lastName} ${person.state} ${person.stateName} district ${person.district} ${person.districtLabel}`).includes(word)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
