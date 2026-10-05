import senatorTemplate from '../templates/letters/senator.md?raw';
import representativeTemplate from '../templates/letters/representative.md?raw';
import directory from '../data/senators.json';
import { states } from './states';
import { representativeById } from './representatives';

export const senators = directory.senators;
export const directoryUpdated = directory.retrieved;
export type Senator = (typeof senators)[number];
export const senatorsForState = (state: string) => senators.filter(person => person.state === state);
export const representativeRecipient = 'representative';
export const representativeFinder = 'https://www.house.gov/representatives/find-your-representative';

export function nextRecipientForState(state: string, previouslySent: ReadonlySet<string>, representativeId = ''): string {
  if (!states[state]) return '';
  const representative = representativeById(representativeId, state);
  const choices = [
    ...senatorsForState(state).map(person => ({ id: person.id, historyKey: person.id })),
    // My Representative remains an unsent option until a specific member is identified and marked.
    { id: representativeRecipient, historyKey: representative ? `representative:${representative.id}` : '' },
  ];
  const remaining = choices.filter(choice => !choice.historyKey || !previouslySent.has(choice.historyKey));
  return remaining.length === 1 ? remaining[0].id : '';
}

export function contactFor(person: Senator) {
  const overrides: Record<string, string> = {
    C001056: 'https://www.cornyn.senate.gov/share-opinion/',
    C001098: 'https://www.cruz.senate.gov/contact/write-ted',
    D000622: 'https://www.duckworth.senate.gov/connect/email-tammy',
  };
  const url = overrides[person.id] ?? person.contact;
  const isHomepage = new URL(url).pathname.replace(/\//g, '') === '' && !new URL(url).search;
  return { url, isHomepage };
}

export const duckworthInitiative = 'https://www.duckworth.senate.gov/news/press-releases/duckworth-leads-bipartisan-group-of-senators-in-demanding-the-trump-administration-to-extend-and-redesignate-tps-for-ukrainians';

export interface LetterDetails {
  recipient: string;
  state: string;
  fullName: string;
  city: string;
  zip: string;
  street: string;
  isUsCitizen: boolean | null;
  supportExtension: boolean;
  delivery: 'online' | 'post';
  representativeId?: string;
  representativeName?: string;
  representativeAddress?: string;
}
const singleLine = (value: string) => value.replace(/\s+/g, ' ').trim();
const septemberNotice = 'https://content.govdelivery.com/accounts/USDHSCISEVERIFY/bulletins/42855b0';

export function buildLetter(details: LetterDetails): string {
  const person = senators.find(person => person.id === details.recipient && person.state === details.state);
  const isRepresentative = details.recipient === representativeRecipient;
  if (!states[details.state] || (!person && !isRepresentative)) return '';
  const representative = representativeById(details.representativeId ?? '', details.state);
  const representativeName = representative?.lastName
    || singleLine(details.representativeId ? '' : details.representativeName ?? '') || '[Representative last name]';
  const name = singleLine(details.fullName) || '[Full name]';
  const city = singleLine(details.city) || '[City]';
  const zip = singleLine(details.zip) || '[ZIP code]';
  const street = singleLine(details.street) || '[Street address]';
  const state = states[details.state];
  const location = `${city}, ${state} ${zip}`;
  const introduction = person?.id === 'D000622'
    ? 'Your office led the September 22 bipartisan letter supporting an extension and redesignation of Temporary Protected Status (TPS) for Ukraine. I ask your office to follow up with specific questions about any DHS determination and practical guidance after October 19, 2026.'
    : 'I ask you, as my senator, to seek urgent answers from DHS and USCIS about Ukraine Temporary Protected Status (TPS) after October 19, 2026.';
  let body = (isRepresentative ? representativeTemplate : senatorTemplate)
    .replaceAll('[Last name]', () => representativeName)
    .replaceAll('[Senator last name]', () => person!.lastName)
    .replaceAll('[Senator introduction]', () => introduction)
    .replaceAll('[Inquiry introduction]', 'Please use your oversight role to obtain a documented response to these questions:')
    .replace(/\*\*/g, '')
    .replace(/I am a U\.S\. citizen residing in/, details.isUsCitizen ? 'I am a U.S. citizen residing in' : 'I live in')
    .replace(/\[As a matter of public policy,([\s\S]*?)\]/, paragraph => details.supportExtension ? paragraph.slice(1, -1) : '')
    .split('Sincerely,')[0]
    .replaceAll('[City]', () => city)
    .replaceAll('[State]', () => state)
    .replaceAll('[ZIP code]', () => zip)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  body += `\n\nReference: USCIS E-Verify bulletin, September 3, 2026\n${septemberNotice}`;
  if (details.delivery === 'post') {
    const representativeAddress = (details.representativeId ? '' : details.representativeAddress ?? '').split(/\r?\n/).map(singleLine).filter(Boolean).join('\n')
      || '[Representative office mailing address]';
    const officeAddress = isRepresentative ? representative?.address || `Representative ${representativeName}\n${representativeAddress}` : person!.address;
    body = `${name}\n${street}\n${location}\n\n${officeAddress}\n\n${body}\n\nSincerely,\n\n\n${name}`;
  } else {
    body += `\n\nSincerely,\n${name}\n${location}`;
  }
  return body;
}
