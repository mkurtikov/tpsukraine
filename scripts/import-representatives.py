"""Build a local House directory from two official downloads; no visitor API.

Usage: python3 scripts/import-representatives.py MemberData.xml representatives.html YYYY-MM-DD
Download XML from https://clerk.house.gov/xml/lists/MemberData.xml
Download HTML from https://www.house.gov/representatives
"""

import argparse
from collections import Counter
from datetime import date, datetime
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlparse
import xml.etree.ElementTree as ET


BUILDINGS = {
    'CHOB': 'Cannon House Office Building',
    'LHOB': 'Longworth House Office Building',
    'RHOB': 'Rayburn House Office Building',
    'FHOB': 'Ford House Office Building',
    'OFOB': "O’Neill Federal Office Building",
}
NONVOTING_STATES = {'AS', 'DC', 'GU', 'MP', 'PR', 'VI'}
# House.gov still lists HTTP here; the official HTTPS homepage was checked 2026-10-04.
WEBSITE_OVERRIDES = {'http://menefee.house.gov/': 'https://menefee.house.gov/'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).casefold()
                   if c.isalnum())


def seat_code(member):
    raw = member.findtext('statedistrict')
    # The Clerk uses AQ00 for American Samoa's seat, but AS for its postal state.
    return 'AS00' if raw == 'AQ00' else raw


class HouseDirectory(HTMLParser):
    """Read only the directory's state tables, not its duplicate alphabetical list."""

    def __init__(self):
        super().__init__()
        self.active = False
        self.in_caption = False
        self.cell = None
        self.state = ''
        self.rows = []
        self.cells = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'table':
            self.active = attrs.get('id', '').startswith('housegov_reps_by_state-')
        if not self.active:
            return
        if tag == 'caption':
            self.in_caption = True
            self.state = ''
        elif tag == 'tr':
            self.cells, self.links = [], []
        elif tag == 'td':
            self.cell = ''
        elif tag == 'a' and self.cell is not None and len(self.cells) == 1:
            self.links.append(attrs.get('href', ''))

    def handle_data(self, data):
        if self.active and self.in_caption:
            self.state += data
        if self.active and self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if not self.active:
            return
        if tag == 'caption':
            self.in_caption = False
            self.state = ' '.join(self.state.split())
        elif tag == 'td' and self.cell is not None:
            self.cells.append(' '.join(self.cell.split()))
            self.cell = None
        elif tag == 'tr' and self.cells:
            require(len(self.cells) == 6, f'Unexpected table row: {self.cells}')
            require(len(self.links) == 1, f'Expected one member link: {self.cells}')
            self.rows.append((self.state, self.cells, self.links[0]))
        elif tag == 'table':
            self.active = False


def build_directory(xml_bytes, html_bytes, retrieved):
    root = ET.fromstring(xml_bytes)
    require(root.tag == 'MemberData', 'Unexpected XML document')
    published = datetime.strptime(root.attrib['publish-date'], '%B %d, %Y').date()
    require(published <= date.fromisoformat(retrieved), 'Source date is after retrieval date')
    members = root.findall('./members/member')
    require(len(members) == 441, 'Expected 435 state seats and six nonvoting seats; review source')
    state_codes = {m.findtext('./member-info/state/state-fullname'):
                   m.find('./member-info/state').attrib['postal-code'] for m in members}
    require(len(state_codes) == 56, 'Incomplete state/territory coverage')

    directory = HouseDirectory()
    directory.feed(html_bytes.decode('utf-8'))
    websites = {}
    for state_name, cells, url in directory.rows:
        require(state_name in state_codes, f'Unknown state: {state_name}')
        district = 0 if cells[0] in ('At Large', 'Delegate', 'Resident Commissioner') else int(
            re.fullmatch(r'(\d+)(?:st|nd|rd|th)', cells[0]).group(1))
        seat = f'{state_codes[state_name]}{district:02}'
        require(seat not in websites, f'Duplicate House.gov seat: {seat}')
        websites[seat] = (cells, url)
    xml_seats = [seat_code(m) for m in members]
    require(len(set(xml_seats)) == 441, 'Duplicate XML seat')
    require(set(websites) == set(xml_seats), 'House.gov and XML seat lists differ')

    representatives, vacancies = [], []
    for member in members:
        seat = seat_code(member)
        info = member.find('member-info')
        value = lambda tag: (info.findtext(tag) or '').strip()
        state = info.find('state').attrib['postal-code']
        require(seat[:2] == state, f'State mismatch: {seat}')
        cells, website = websites[seat]
        vacant = not value('bioguideID')
        require(vacant == ('vacancy' in cells[1].lower()), f'Vacancy mismatch: {seat}')
        common = {
            'state': state,
            'stateName': value('state/state-fullname'),
            'district': int(seat[2:]),
            'districtLabel': value('district'),
        }
        if vacant:
            vacancies.append({**common, 'reason': value('footnote')})
            continue

        require(normalized(cells[1].split(',')[0]) == normalized(value('lastname')),
                f'Name mismatch between sources: {seat}')
        website = WEBSITE_OVERRIDES.get(website, website)
        parsed = urlparse(website)
        require(parsed.scheme == 'https' and (parsed.hostname or '').endswith('.house.gov')
                and parsed.hostname not in ('clerk.house.gov', 'www.house.gov'),
                f'Expected a member official HTTPS website: {seat}: {website}')
        require(not parsed.username and not parsed.password, f'Invalid website URL: {seat}')
        require(value('office-building') in BUILDINGS, f'Unknown building: {seat}')
        require(value('office-room').isdigit(), f'Missing office room: {seat}')
        require(value('office-zip') == '20515' and re.fullmatch(r'\d{4}', value('office-zip-suffix')),
                f'Invalid mailing ZIP+4: {seat}')
        require(re.fullmatch(r'\(202\) \d{3}-\d{4}', value('phone')), f'Invalid phone: {seat}')
        require(normalized(cells[3]) == normalized(f"{value('office-room')} {value('office-building')}"),
                f'Office address mismatch: {seat}')
        require(normalized(cells[4]) == normalized(value('phone')), f'Phone mismatch: {seat}')
        require(re.fullmatch(r'[A-Z]\d{6}', value('bioguideID')), f'Invalid member ID: {seat}')
        require(value('official-name') and value('lastname'), f'Missing name: {seat}')
        role = ('resident-commissioner' if state == 'PR' else
                'delegate' if state in NONVOTING_STATES else 'representative')
        address = (f"The Honorable {value('official-name')}\n"
                   f"{value('office-room')} {BUILDINGS[value('office-building')]}\n"
                   f"Washington, DC {value('office-zip')}-{value('office-zip-suffix')}")
        representatives.append({
            'id': value('bioguideID'),
            'name': value('official-name'),
            'lastName': value('lastname'),
            **common,
            'role': role,
            'website': website,
            'address': address,
            'phone': value('phone'),
        })

    require(len({m['id'] for m in representatives}) == len(representatives), 'Duplicate member ID')
    require(sum(m['state'] not in NONVOTING_STATES for m in representatives + vacancies) == 435,
            'Unexpected number of state seats')
    representatives.sort(key=lambda m: (m['state'], m['district']))
    vacancies.sort(key=lambda m: (m['state'], m['district']))
    return {
        'sources': [
            {'url': 'https://clerk.house.gov/xml/lists/MemberData.xml',
             'sha256': sha256(xml_bytes).hexdigest()},
            {'url': 'https://www.house.gov/representatives',
             'sha256': sha256(html_bytes).hexdigest()},
        ],
        'retrieved': retrieved,
        'sourcePublished': published.isoformat(),
        'congress': int(root.findtext('./title-info/congress-num')),
        'addressType': 'Washington, DC office mailing address',
        'websiteType': 'Official member website; not necessarily a contact form',
        'representatives': representatives,
        'vacancies': vacancies,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('xml', type=Path)
    parser.add_argument('html', type=Path)
    parser.add_argument('retrieved', type=date.fromisoformat)
    args = parser.parse_args()
    result = build_directory(args.xml.read_bytes(), args.html.read_bytes(), args.retrieved.isoformat())
    output = Path(__file__).resolve().parents[1] / 'src/data/representatives.json'
    # All checks precede the write so inconsistent downloads leave the previous snapshot intact.
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    counts = Counter(m['role'] for m in result['representatives'])
    print(f'Imported {dict(counts)}; {len(result["vacancies"])} vacancies. Saved {output}')


if __name__ == '__main__':
    main()
