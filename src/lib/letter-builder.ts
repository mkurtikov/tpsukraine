import senatorTemplate from '../templates/letters/senator.md?raw';
import representativeTemplate from '../templates/letters/representative.md?raw';

export const recipients = {
  cornyn: {
    kind: 'senator', name: 'John Cornyn', lastName: 'Cornyn', state: 'Texas',
    letterIntroduction: 'As my senator and Chair of the Senate Judiciary Subcommittee on Border Security and Immigration, please seek urgent answers from DHS and USCIS about Ukraine Temporary Protected Status (TPS) after October 19, 2026.',
    inquiryIntroduction: 'Please use your oversight role to obtain a documented response to these questions:',
    context: 'Senator Cornyn represents Texas. This letter asks his office to obtain documented answers from DHS and USCIS.',
    form: 'https://www.cornyn.senate.gov/share-opinion/',
    topic: 'Choose an immigration-related topic and request a response if the form offers that option.',
    address: 'The Honorable John Cornyn\n517 Hart Senate Office Building\nWashington, DC 20510',
    office: 'https://www.cornyn.senate.gov/contact-john-cornyn/',
  },
  cruz: {
    kind: 'senator', name: 'Ted Cruz', lastName: 'Cruz', state: 'Texas',
    letterIntroduction: 'I ask you, as my senator and a member of the Senate Judiciary Subcommittee on Border Security and Immigration, to seek urgent answers about Ukraine Temporary Protected Status (TPS) after October 19, 2026.',
    inquiryIntroduction: 'Please request a written response from DHS and USCIS to these questions:',
    context: 'Senator Cruz represents Texas. This letter asks his office to obtain documented answers from DHS and USCIS.',
    form: 'https://www.cruz.senate.gov/contact/write-ted',
    topic: 'Choose Border/Immigration, or the closest immigration-related topic, and request a response when offered.',
    address: 'The Honorable Ted Cruz\n167 Russell Senate Office Building\nWashington, DC 20510',
    office: 'https://www.cruz.senate.gov/contact/office-locations',
  },
  duckworth: {
    kind: 'senator', name: 'Tammy Duckworth', lastName: 'Duckworth', state: 'Illinois',
    letterIntroduction: 'Your office led the September 22 bipartisan letter supporting an extension and redesignation of Temporary Protected Status (TPS) for Ukraine. I ask your office to follow up with specific questions about any DHS determination and practical guidance after October 19, 2026.',
    inquiryIntroduction: 'Please supplement that initiative by requesting written answers from DHS and USCIS:',
    context: 'Senator Duckworth represents Illinois. This letter asks her office to follow up on its Ukraine TPS initiative; it does not describe you as an Illinois constituent. Use your actual Texas address and follow the office’s contact requirements.',
    contextLink: {
      text: 'Ukraine TPS initiative',
      href: 'https://www.duckworth.senate.gov/news/press-releases/duckworth-leads-bipartisan-group-of-senators-in-demanding-the-trump-administration-to-extend-and-redesignate-tps-for-ukrainians',
    },
    form: 'https://www.duckworth.senate.gov/connect/email-tammy',
    topic: 'Choose “Share your opinion on legislation” and an immigration-related topic. Use your actual state and address; follow any residency instructions shown by the office.',
    address: 'The Honorable Tammy Duckworth\n524 Hart Senate Office Building\nWashington, DC 20510',
    office: 'https://www.duckworth.senate.gov/connect/email-tammy',
  },
  representative: {
    kind: 'representative', name: 'My U.S. Representative', state: 'Texas',
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
const septemberNotice = 'https://content.govdelivery.com/accounts/USDHSCISEVERIFY/bulletins/42855b0';

export function buildLetter(details: LetterDetails): string {
  const person = recipients[details.recipient];
  const name = singleLine(details.fullName) || '[Full name]';
  const city = singleLine(details.city) || '[City]';
  const zip = singleLine(details.zip) || '[ZIP code]';
  const street = singleLine(details.street) || '[Street address]';
  const location = `${city}, Texas ${zip}`;
  const template = person.kind === 'senator'
    ? senatorTemplate
      .replaceAll('[Senator last name]', () => person.lastName)
      .replaceAll('[Senator introduction]', () => person.letterIntroduction)
      .replaceAll('[Inquiry introduction]', () => person.inquiryIntroduction)
    : representativeTemplate;
  let body = template
    .replace(/\*\*/g, '')
    .replace(/I am a U\.S\. citizen residing in/, details.isUsCitizen ? 'I am a U.S. citizen residing in' : 'I live in')
    .replace(/\[As a matter of public policy,([\s\S]*?)\]/, (paragraph) => details.supportExtension ? paragraph.slice(1, -1) : '')
    .split('Sincerely,')[0]
    .replaceAll('[City]', () => city)
    .replaceAll('[ZIP code]', () => zip)
    .replaceAll('[Last name]', () => singleLine(details.representativeName) || '[Representative’s last name]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  body += `\n\nReference: USCIS E-Verify bulletin, September 3, 2026\n${septemberNotice}`;
  if (details.delivery === 'post') {
    const recipientAddress = person.address ? `${person.address}\n\n` : '';
    body = `${name}\n${street}\n${location}\n\n${recipientAddress}${body}\n\nSincerely,\n\n${name}`;
  } else {
    body += `\n\nSincerely,\n${name}\n${location}`;
  }
  return body;
}
