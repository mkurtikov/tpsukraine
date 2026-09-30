import cornynTemplate from '../../../docs/2. John Cornyn.md?raw';
import cruzTemplate from '../../../docs/3. Ted Cruz.md?raw';
import duckworthTemplate from '../../../docs/5. Tammy Duckworth.md?raw';
import representativeTemplate from '../../../docs/4. Your U.S. Representative.md?raw';

export const recipients = {
  cornyn: {
    name: 'John Cornyn', state: 'Texas', template: cornynTemplate,
    context: 'Senator Cornyn represents Texas. This letter asks his office to obtain documented answers from DHS and USCIS.',
    form: 'https://www.cornyn.senate.gov/share-opinion/',
    topic: 'Choose an immigration-related topic and request a response if the form offers that option.',
    address: 'The Honorable John Cornyn\n517 Hart Senate Office Building\nWashington, DC 20510',
    office: 'https://www.cornyn.senate.gov/contact-john-cornyn/',
  },
  cruz: {
    name: 'Ted Cruz', state: 'Texas', template: cruzTemplate,
    context: 'Senator Cruz represents Texas. This letter asks his office to obtain documented answers from DHS and USCIS.',
    form: 'https://www.cruz.senate.gov/contact/write-ted',
    topic: 'Choose Border/Immigration, or the closest immigration-related topic, and request a response when offered.',
    address: 'The Honorable Ted Cruz\n167 Russell Senate Office Building\nWashington, DC 20510',
    office: 'https://www.cruz.senate.gov/contact/office-locations',
  },
  duckworth: {
    name: 'Tammy Duckworth', state: 'Illinois', template: duckworthTemplate,
    context: 'Senator Duckworth represents Illinois. This letter asks her office to follow up on its Ukraine TPS initiative; it does not describe you as an Illinois constituent. Use your actual Texas address and follow the office’s contact requirements.',
    form: 'https://www.duckworth.senate.gov/connect/email-tammy',
    topic: 'Choose “Share your opinion on legislation” and an immigration-related topic. Use your actual state and address; follow any residency instructions shown by the office.',
    address: 'The Honorable Tammy Duckworth\n524 Hart Senate Office Building\nWashington, DC 20510',
    office: 'https://www.duckworth.senate.gov/connect/email-tammy',
  },
  representative: {
    name: 'My U.S. Representative', state: 'Texas', template: representativeTemplate,
    context: 'Use House.gov to find the representative for your home address, then enter their last name below. This letter asks your district’s representative to request answers from DHS and USCIS.',
    form: 'https://www.house.gov/representatives/find-your-representative',
    topic: 'Choose an immigration-related topic and request a response if the form offers that option.',
    // The user finds their member’s office address on the official website.
    address: '',
    office: 'https://www.house.gov/representatives/find-your-representative',
  },
} as const;

export type RecipientId = keyof typeof recipients;
export interface LetterDetails {
  recipient: RecipientId;
  representativeName: string;
  fullName: string;
  city: string;
  zip: string;
  street: string;
  isUsCitizen: boolean;
  supportExtension: boolean;
  delivery: 'online' | 'post';
}

const singleLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export function buildLetter(details: LetterDetails): string {
  const person = recipients[details.recipient];
  const name = singleLine(details.fullName) || '[Full name]';
  const city = singleLine(details.city) || '[City]';
  const zip = singleLine(details.zip) || '[ZIP code]';
  const street = singleLine(details.street) || '[Street address]';
  const location = `${city}, Texas ${zip}`;
  // Keep the supplied recipient-specific letters and reflect the selected citizenship statement.
  let body = person.template
    .replace(/\*\*/g, '')
    .replace(/I am a U\.S\. citizen residing in/, details.isUsCitizen ? 'I am a U.S. citizen residing in' : 'I live in')
    .replace(/\[As a matter of public policy,([\s\S]*?)\]/, (paragraph) => details.supportExtension ? paragraph.slice(1, -1) : '')
    .split('Sincerely,')[0]
    .replaceAll('[City]', () => city)
    .replaceAll('[ZIP code]', () => zip)
    .replaceAll('[Last name]', () => singleLine(details.representativeName) || '[Representative’s last name]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (details.delivery === 'post') {
    const recipientAddress = person.address ? `${person.address}\n\n` : '';
    body = `${name}\n${street}\n${location}\n\n${recipientAddress}${body}\n\nSincerely,\n\n${name}`;
  } else {
    body += `\n\nSincerely,\n${name}\n${location}`;
  }
  return body;
}
