"""Import public directories into local build assets; never runs for visitors.

Usage: python3 scripts/import-directories.py senators.xml ZIP_Locale_Detail.xlsx YYYY-MM-DD
Sources: https://www.senate.gov/general/contact_information/senators_cfm.xml
         https://postalpro.usps.com/ZIP_Locale_Detail
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile

senate_path, zip_path, retrieved = sys.argv[1:]
output = Path(__file__).resolve().parents[1] / 'src/data'
output.mkdir(exist_ok=True)
senators = []
for member in ET.parse(senate_path).getroot().findall('member'):
    data = {child.tag: (child.text or '').strip() for child in member}
    if not data['bioguide_id']:
        continue
    senators.append({
        'id': data['bioguide_id'],
        'name': f"{data['first_name']} {data['last_name']}",
        'lastName': data['last_name'],
        'state': data['state'],
        'website': data['website'].replace('http://', 'https://', 1),
        'contact': (data['email'] or data['website']).replace('http://', 'https://', 1),
        'address': f"The Honorable {data['first_name']} {data['last_name']}\n"
                   + data['address'].replace(' Washington DC ', '\nWashington, DC '),
    })
counts = Counter(s['state'] for s in senators)
assert len(senators) == 100 and len(counts) == 50 and set(counts.values()) == {2}
assert len({s['id'] for s in senators}) == len(senators)
assert all(re.match(r'https://[^/]+\.senate\.gov(?:/|$)', s[key])
           for s in senators for key in ('contact', 'website'))
senators.sort(key=lambda s: (s['state'], s['lastName']))
(output / 'senators.json').write_text(json.dumps({
    'source': 'https://www.senate.gov/general/contact_information/senators_cfm.xml',
    'retrieved': retrieved,
    'senators': senators,
}, indent=2) + '\n')

ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
codes = set()
prefix_states = defaultdict(set)
with ZipFile(zip_path) as workbook:
    strings = [''.join(el.itertext()) for el in ET.fromstring(workbook.read('xl/sharedStrings.xml'))]
    for filename in workbook.namelist():
        if not re.match(r'xl/worksheets/sheet\d+\.xml$', filename):
            continue
        for row in ET.fromstring(workbook.read(filename)).findall('.//s:row', ns):
            cells = {}
            for cell in row:
                value = cell.find('s:v', ns)
                if value is not None:
                    cells[re.sub(r'\d', '', cell.get('r'))] = (
                        strings[int(value.text)] if cell.get('t') == 's' else value.text
                    ).strip()
            code = cells.get('D', '')
            if not re.fullmatch(r'\d{5}', code):
                continue
            codes.add(code)
            if re.fullmatch(r'[A-Z]{2}', cells.get('K', '')):
                prefix_states[code[:3]].add(cells['K'])
assert len(codes) > 40000
# Physical facility states are only a coarse prefix advisory. They do not
# establish the recipient's residence. Accept known cross-border exceptions.
(output / 'zip-directory.json').write_text(json.dumps({
    'source': 'https://postalpro.usps.com/mnt/glusterfs/2026-09/ZIP_Locale_Detail.xlsx',
    'retrieved': retrieved,
    'codes': ' '.join(sorted(codes)),
    'prefixStates': {p: sorted(v) for p, v in sorted(prefix_states.items())},
}, separators=(',', ':')) + '\n')
print(f'Imported {len(senators)} senators and {len(codes)} ZIP codes.')
