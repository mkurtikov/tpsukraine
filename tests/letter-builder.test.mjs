import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Use Astro's bundler to exercise the actual TS, JSON and raw Markdown imports.
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, logLevel: 'error' });
after(() => server.close());
const { buildLetter, senators, senatorsForState, nextRecipientForState, contactFor } = await server.ssrLoadModule('/src/lib/letter-builder.ts');
const { states } = await server.ssrLoadModule('/src/lib/states.ts');
const { zipWarning } = await server.ssrLoadModule('/src/lib/zip.ts');
const { requiredLetterIssues } = await server.ssrLoadModule('/src/lib/letter-validation.ts');
const { representatives, searchRepresentatives, representativeById } = await server.ssrLoadModule('/src/lib/representatives.ts');
const details = {
  recipient: 'C001056', state: 'TX', fullName: 'Alex Example', city: 'Dallas',
  zip: '75201', street: '123 Example Street', isUsCitizen: true,
  supportExtension: true, delivery: 'online',
};

test('required validation follows the wizard stages and rejects whitespace-only fields', () => {
  const empty = { ...details, state: '', zip: '  ', fullName: '\t', city: '', isUsCitizen: null, recipient: '', street: '', delivery: 'post' };
  const fields = stage => requiredLetterIssues(empty, stage).map(issue => issue.field);
  assert.deepEqual(fields(0), ['state', 'zip-code']);
  assert.deepEqual(fields(1), ['state', 'zip-code', 'full-name', 'city', 'us-citizen']);
  assert.deepEqual(fields(2), ['state', 'zip-code', 'full-name', 'city', 'us-citizen', 'recipient']);
  assert.deepEqual(fields(3), ['state', 'zip-code', 'full-name', 'city', 'us-citizen', 'recipient', 'street-address']);
  assert.deepEqual(requiredLetterIssues(details, 3), []);
});

test('nonempty questionable ZIP codes never block required validation', () => {
  for (const zip of ['abc', '1', '00000', '60601', '75201-abc']) {
    assert.ok(zipWarning(zip, 'TX'), `${zip} should show an advisory`);
    assert.deepEqual(requiredLetterIssues({ ...details, zip }, 3), [], `${zip} must not block progression`);
  }
  assert.deepEqual(requiredLetterIssues({ ...details, zip: '' }, 0).map(issue => issue.field), ['zip-code']);
});

test('names and cities need only text; extension support and online street address stay optional', () => {
  assert.deepEqual(requiredLetterIssues({ ...details, fullName: '李', city: 'X', street: '',
    isUsCitizen: false, supportExtension: false }, 3), []);
  assert.deepEqual(requiredLetterIssues({ ...details, fullName: '123', city: '123' }, 3), []);
  assert.deepEqual(requiredLetterIssues({ ...details, delivery: 'post', street: ' ' }, 3).map(issue => issue.field), ['street-address']);
  assert.deepEqual(requiredLetterIssues({ ...details, delivery: 'post', street: '' }, 2), []);
});

test('citizenship requires an explicit Yes or No, and No is a valid answer', () => {
  const unanswered = { ...details, isUsCitizen: null };
  assert.deepEqual(requiredLetterIssues(unanswered, 0), []);
  for (const stage of [1, 2, 3]) {
    assert.deepEqual(requiredLetterIssues(unanswered, stage).map(issue => issue.field), ['us-citizen']);
  }
  for (const isUsCitizen of [true, false]) {
    assert.deepEqual(requiredLetterIssues({ ...details, isUsCitizen }, 3), []);
  }
  for (const recipient of [details.recipient, 'representative']) {
    const addressed = { ...details, recipient, representativeId: 'R000614' };
    assert.match(buildLetter({ ...addressed, isUsCitizen: true }), /I am a U\.S\. citizen residing in Dallas/);
    for (const isUsCitizen of [false, null]) {
      const letter = buildLetter({ ...addressed, isUsCitizen });
      assert.match(letter, /I live in Dallas/);
      assert.doesNotMatch(letter, /I am a U\.S\. citizen/);
    }
  }
});

test('a recipient must be selected, including an actual representative search result', () => {
  const rep = { ...details, recipient: 'representative' };
  assert.deepEqual(requiredLetterIssues(rep, 1), []);
  for (const representativeId of ['', 'unknown']) {
    assert.deepEqual(requiredLetterIssues({ ...rep, representativeName: 'Chip Roy', representativeId }, 2).map(issue => issue.field), ['representative-name']);
  }
  assert.deepEqual(requiredLetterIssues({ ...rep, representativeId: 'R000614' }, 2), []);
  assert.deepEqual(requiredLetterIssues({ ...rep, representativeId: 'R000614', state: 'CA' }, 2).map(issue => issue.field), ['representative-name']);
  assert.deepEqual(requiredLetterIssues({ ...details, state: 'IL' }, 2).map(issue => issue.field), ['recipient']);
  assert.deepEqual(requiredLetterIssues({ ...details, recipient: '' }, 2).map(issue => issue.field), ['recipient']);
  assert.match(requiredLetterIssues({ ...details, state: 'no-senators' }, 0)[0].message, /50 states/);
});

test('every state has two unique senators and complete official contact details', () => {
  assert.equal(Object.keys(states).length, 50);
  assert.equal(senators.length, 100);
  assert.equal(new Set(senators.map(person => person.id)).size, 100);
  for (const state of Object.keys(states)) assert.equal(senatorsForState(state).length, 2, state);
  for (const person of senators) {
    assert.ok(person.name && person.lastName && person.address.includes('20510'));
    for (const url of [contactFor(person).url, person.website]) {
      const parsed = new URL(url);
      assert.equal(parsed.protocol, 'https:');
      assert.ok(parsed.hostname.endsWith('.senate.gov'), url);
    }
  }
});

test('all senators receive their own greeting, state and complete inquiry', () => {
  for (const person of senators) {
    const letter = buildLetter({ ...details, recipient: person.id, state: person.state });
    assert.ok(letter.includes(`Dear Senator ${person.lastName},`));
    assert.ok(letter.includes(`Dallas, ${states[person.state]} 75201`));
    assert.ok(letter.includes('4. Please confirm whether Ukraine TPS'));
    assert.ok(letter.includes('https://content.govdelivery.com/accounts/USDHSCISEVERIFY/bulletins/42855b0'));
    assert.doesNotMatch(letter, /\[.*?\]|\\br/);
  }
});

test('stale or invalid recipient cannot produce a letter for the wrong state', () => {
  assert.equal(buildLetter({ ...details, state: 'IL' }), '');
  assert.equal(buildLetter({ ...details, recipient: '' }), '');
  assert.deepEqual(senatorsForState('DC'), []);
});

test('next recipient defaults consider both senators and the representative for all eight history combinations', () => {
  for (const state of Object.keys(states)) {
    const [first, second] = senatorsForState(state);
    const rep = searchRepresentatives(state, '')[0];
    const repKey = `representative:${rep.id}`;
    for (const [history, expected] of [
      [[], ''], [[first.id], ''], [[second.id], ''], [[repKey], ''],
      [[first.id, second.id], 'representative'],
      [[first.id, repKey], second.id], [[second.id, repKey], first.id],
      [[first.id, second.id, repKey], ''],
    ]) {
      assert.equal(nextRecipientForState(state, new Set(history), rep.id), expected, `${state}: ${history}`);
    }
  }
});

test('sent history is scoped to the selected state and never prevents preparing another letter', () => {
  const history = new Set(['D000622', 'C001056']);
  assert.equal(nextRecipientForState('CA', history), '');
  assert.equal(nextRecipientForState('TX', history), '');
  assert.equal(nextRecipientForState('no-senators', history), '');
  assert.ok(buildLetter(details).includes('Dear Senator Cornyn,'));
  history.add('C001098');
  assert.equal(nextRecipientForState('TX', history), 'representative');
  history.add('representative:R000614');
  assert.equal(nextRecipientForState('TX', history, 'R000614'), '');
  assert.ok(buildLetter(details).includes('Dear Senator Cornyn,'));
});

test('unidentified or different representatives remain unsent options without inheriting another member’s mark', () => {
  const senatorsSent = new Set(['C001056', 'C001098', 'representative:R000614']);
  assert.equal(nextRecipientForState('TX', senatorsSent), 'representative');
  assert.equal(nextRecipientForState('TX', senatorsSent, 'unknown'), 'representative');
  const other = searchRepresentatives('TX', '').find(person => person.id !== 'R000614');
  assert.equal(nextRecipientForState('TX', senatorsSent, other.id), 'representative');
  const [first, second] = senatorsForState('CA');
  assert.equal(nextRecipientForState('CA', new Set([first.id, second.id, 'representative:R000614']), 'R000614'), 'representative');
  assert.equal(nextRecipientForState('', senatorsSent, 'R000614'), '');
});

test('optional statements are removed without changing the inquiry', () => {
  const letter = buildLetter({ ...details, isUsCitizen: false, supportExtension: false });
  assert.ok(letter.includes('I live in Dallas, Texas 75201.'));
  assert.doesNotMatch(letter, /I am a U.S. citizen|I support an 18-month extension/);
  assert.ok(letter.includes('4. Please confirm whether Ukraine TPS'));
});

test('postal output contains both addresses and the full letter through signature', () => {
  const person = senators.find(person => person.id === details.recipient);
  const letter = buildLetter({ ...details, delivery: 'post' });
  assert.ok(letter.startsWith('Alex Example\n123 Example Street\nDallas, Texas 75201'));
  assert.ok(letter.includes(person.address));
  assert.ok(letter.endsWith('Sincerely,\n\n\nAlex Example'));
});

test('incomplete details retain editable placeholders; replacement syntax remains literal', () => {
  const incomplete = buildLetter({ ...details, fullName: '', city: '', zip: '', street: '', delivery: 'post' });
  for (const placeholder of ['[Full name]', '[City]', '[ZIP code]', '[Street address]']) assert.ok(incomplete.includes(placeholder));
  const literal = buildLetter({ ...details, fullName: 'Alex $& Example', city: 'City $&' });
  assert.ok(literal.includes('City $&, Texas'));
  assert.ok(literal.includes('Alex $& Example'));
});

test('ZIP advisories handle leading zeroes, ZIP+4, missing codes and cross-state cases', () => {
  for (const [zip, state] of [['75201', 'TX'], ['60601', 'IL'], ['02108', 'MA'], ['99501', 'AK'], ['96813', 'HI'], ['75201-1234', 'TX'], ['06390', 'NY'], ['71854', 'TX']]) {
    assert.equal(zipWarning(zip, state), '', `${zip}/${state}`);
  }
  assert.equal(zipWarning('', 'TX'), '');
  assert.match(zipWarning('abc', 'TX'), /5 digits/);
  assert.match(zipWarning('00000', 'TX'), /not found/);
  assert.match(zipWarning('60601', 'TX'), /may not match/);
});

test('representative letters use the House template and the selected state', () => {
  for (const [state, stateName] of Object.entries(states)) {
    const letter = buildLetter({ ...details, state, recipient: 'representative', representativeName: 'Example', isUsCitizen: false, supportExtension: false });
    assert.ok(letter.includes('Dear Representative Example,'));
    assert.ok(letter.includes(`I live in Dallas, ${stateName} 75201 in your congressional district.`));
    assert.ok(letter.includes('Please submit a congressional inquiry'));
    assert.ok(letter.includes('4. Please confirm whether Ukraine TPS'));
    assert.ok(letter.includes('https://content.govdelivery.com/accounts/USDHSCISEVERIFY/bulletins/42855b0'));
    assert.doesNotMatch(letter, /Dear Senator|as my senator|I support an 18-month extension|\[State\]/);
  }
});

test('a representative can be copied before their name or office address is filled in', () => {
  const letter = buildLetter({ ...details, recipient: 'representative', delivery: 'post' });
  assert.ok(letter.includes('Dear Representative [Representative last name],'));
  assert.ok(letter.includes('[Representative office mailing address]'));
  assert.doesNotMatch(letter, /Senate Office Building|Cornyn/);
});

test('postal representative letters use the entered address and preserve compound surnames', () => {
  const letter = buildLetter({ ...details, recipient: 'representative', representativeName: 'De La Cruz', representativeAddress: '123 Example Office\nWashington, DC 20515', delivery: 'post' });
  assert.ok(letter.includes('Dear Representative De La Cruz,'));
  assert.ok(letter.includes('Representative De La Cruz\n123 Example Office\nWashington, DC 20515'));
  assert.ok(letter.includes('I support an 18-month extension'));
  assert.ok(letter.endsWith('Sincerely,\n\n\nAlex Example'));
  assert.equal(buildLetter({ ...details, state: '', recipient: 'representative' }), '');
});

test('representative search handles full names, accents, compound surnames and state filtering', () => {
  for (const query of ['chip roy', 'ROY', 'roy chip', 'district 21']) {
    assert.ok(searchRepresentatives('TX', query).some(person => person.id === 'R000614'), query);
  }
  assert.ok(searchRepresentatives('TX', 'de la cruz').some(person => person.lastName === 'De La Cruz'));
  assert.ok(searchRepresentatives('IL', 'chuy garcia').some(person => person.lastName === 'García'));
  assert.deepEqual(searchRepresentatives('CA', 'Chip Roy'), []);
  assert.deepEqual(searchRepresentatives('TX', 'zzzz-no-match'), []);
  assert.equal(representativeById('R000614', 'CA'), undefined);
  assert.equal(searchRepresentatives('TX', '').some(person => person.district === 23), false);
  assert.equal(searchRepresentatives('FL', '').some(person => person.district === 20), false);
});

test('selected representatives use their own surname and full mailing address in every state', () => {
  for (const person of representatives.filter(person => person.role === 'representative')) {
    assert.ok(searchRepresentatives(person.state, person.name).slice(0, 8).some(match => match.id === person.id),
      `${person.name} must be selectable from the search suggestions`);
    const letter = buildLetter({ ...details, recipient: 'representative', representativeId: person.id,
      state: person.state, delivery: 'post', representativeName: 'Wrong name', representativeAddress: 'Wrong address' });
    assert.ok(letter.includes(`Dear Representative ${person.lastName},`), person.name);
    assert.equal(letter.split(person.address).length, 2, person.name);
    assert.doesNotMatch(letter, /Wrong name|Wrong address|\[Representative/);
    assert.equal(new URL(person.website).protocol, 'https:');
  }
});

test('stale representative selection never leaks another state’s name or address into a draft', () => {
  const letter = buildLetter({ ...details, recipient: 'representative', representativeId: 'R000614',
    state: 'CA', representativeName: 'Roy', representativeAddress: 'Old address', delivery: 'post' });
  assert.ok(letter.includes('Dear Representative [Representative last name],'));
  assert.ok(letter.includes('[Representative office mailing address]'));
  assert.doesNotMatch(letter, /Chip Roy|Dear Representative Roy|Old address/);
});
