import { representativeRecipient, senatorsForState, type LetterDetails } from './letter-builder';
import { representativeById } from './representatives';
import { states } from './states';

export type RequiredField = 'state' | 'zip-code' | 'full-name' | 'city' | 'recipient' | 'representative-name' | 'street-address';
export interface RequiredIssue { field: RequiredField; step: number; message: string }

/** Presence/selection only. ZIP correctness is a separate, non-blocking advisory. */
export function requiredLetterIssues(details: LetterDetails, throughStep: number): RequiredIssue[] {
  const issues: RequiredIssue[] = [];
  const missing = (field: RequiredField, step: number, absent: boolean, message: string) => {
    if (step <= throughStep && absent) issues.push({ field, step, message });
  };
  missing('state', 0, !states[details.state], details.state === 'no-senators'
    ? 'D.C. and U.S. territories do not have U.S. senators. This builder currently supports residents of the 50 states.'
    : 'Please choose your home state.');
  missing('zip-code', 0, !details.zip.trim(), 'Please enter your ZIP code.');
  missing('full-name', 1, !details.fullName.trim(), 'Please enter your full name.');
  missing('city', 1, !details.city.trim(), 'Please enter your city.');
  missing('recipient', 2, details.recipient !== representativeRecipient
    && !senatorsForState(details.state).some(person => person.id === details.recipient), 'Please choose a recipient.');
  missing('representative-name', 2, details.recipient === representativeRecipient
    && !representativeById(details.representativeId ?? '', details.state), 'Please select your representative from the search results.');
  missing('street-address', 3, details.delivery === 'post' && !details.street.trim(), 'Please enter your street address for postal mail. Apartment or unit is optional.');
  return issues;
}
