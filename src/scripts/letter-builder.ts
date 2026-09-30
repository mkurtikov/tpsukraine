import { buildLetter, recipients, type RecipientId } from '../lib/letter-builder';
import { isKnownTexasRepresentative } from '../lib/texas-representatives';
import { isTexasZip } from '../lib/texas-zip';

const root = document.querySelector<HTMLElement>('#letter-builder');
if (root) {
  const input = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
  const fullName = input('full-name');
  const city = input('city');
  const zip = input('zip-code');
  const street = input('street-address');
  const extension = input('support-extension');
  const citizenship = input('us-citizen');
  const representativeName = input('representative-name');
  const recipient = root.querySelector<HTMLSelectElement>('#recipient')!;
  const preview = root.querySelector<HTMLTextAreaElement>('#letter-text')!;
  const copy = root.querySelector<HTMLButtonElement>('#copy-letter')!;
  const status = root.querySelector<HTMLElement>('#preview-status')!;
  let version = 0;
  let hasDataIssues = false;
  const reviewedFields = new Set<HTMLInputElement>();
  const dataWarning = 'Please double check your data. It may be incomplete or incorrect.';

  const element = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const link = (id: string) => root.querySelector<HTMLAnchorElement>(`#${id}`)!;
  const show = (id: string, visible: boolean) => { element(id).hidden = !visible; };

  function update() {
    version++;
    const isPost = root!.querySelector<HTMLInputElement>('input[name="delivery"]:checked')?.value === 'post';
    const id = recipient.value as RecipientId;
    const person = recipients[id];
    const isRepresentative = id === 'representative';
    show('representative-fields', isRepresentative);
    representativeName.disabled = !isRepresentative;
    const unknownName = isRepresentative && !!representativeName.value.trim()
      && !isKnownTexasRepresentative(representativeName.value);
    const showNameWarning = unknownName && reviewedFields.has(representativeName);
    show('representative-name-warning', showNameWarning);
    element('representative-name-warning').textContent = showNameWarning ? 'Please double check the name.' : '';
    representativeName.setAttribute('aria-invalid', String(showNameWarning));
    const validZip = isTexasZip(zip.value);
    const invalidZip = !!zip.value.trim() && !validZip && reviewedFields.has(zip);
    zip.setAttribute('aria-invalid', String(invalidZip));
    show('zip-warning', invalidZip);
    element('zip-warning').textContent = invalidZip ? 'Please double check your Texas ZIP code.' : '';
    show('street-field', isPost);
    show('postal-recommendation', isPost);
    street.required = isPost;
    street.disabled = !isPost;
    show('instructions-empty', !person);
    show('online-instructions', !!person && !isPost);
    show('postal-instructions', !!person && isPost);
    copy.textContent = 'Copy text';
    status.classList.remove('copy-warning');
    hasDataIssues = false;
    if (!person) {
      preview.value = '';
      copy.disabled = true;
      status.textContent = 'Choose a recipient to start your letter.';
      element('recipient-context').textContent = 'Choose one recipient for each letter. You can return and prepare another.';
      return;
    }
    element('recipient-context').textContent = person.context;
    if ('contextLink' in person) {
      const [before, after] = person.context.split(person.contextLink.text);
      const sourceLink = document.createElement('a');
      sourceLink.textContent = person.contextLink.text;
      sourceLink.href = person.contextLink.href;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      element('recipient-context').replaceChildren(before, sourceLink, after);
    }
    element('topic-instruction').textContent = person.topic;
    element('mailing-address').textContent = person.address;
    show('mailing-address', !isRepresentative);
    link('official-form').href = person.form;
    link('official-form').textContent = isRepresentative ? 'Find my representative ↗' : `Open ${person.name}’s contact form ↗`;
    element('form-instruction').textContent = isRepresentative
      ? 'Use Find my representative to locate your member’s official website, then open its Contact or Email page. Enter the details it requests and paste your letter into the message field. If there is a subject field, move the first line there.'
      : 'Open the senator’s official form. Enter the contact details it requests, then paste your letter into the message field. If there is a subject field, move the first line there.';
    element('envelope-instruction').textContent = isRepresentative
      ? 'Use Find my representative to open your member’s official website and find their office mailing address. Write their full name and that address on the envelope, add your return address and postage, then mail it.'
      : 'Address an envelope to the office below. Add your return address and postage, then mail it.';
    link('office-source').href = person.office;
    link('office-source').textContent = isRepresentative ? 'Find my representative ↗' : 'Check the address on the official website ↗';
    preview.value = buildLetter({
      recipient: id, representativeName: representativeName.value, fullName: fullName.value, city: city.value, zip: zip.value.trim(),
      street: street.value, isUsCitizen: citizenship.checked, supportExtension: extension.checked, delivery: isPost ? 'post' : 'online',
    });
    hasDataIssues = unknownName
      || (isRepresentative && !representativeName.value.trim())
      || !fullName.value.trim()
      || !city.value.trim()
      || !validZip
      || (isPost && !street.value.trim());
    copy.disabled = !preview.value.trim();
    status.textContent = '';
  }

  root.addEventListener('input', (event) => {
    if (event.target === zip || event.target === representativeName) reviewedFields.delete(event.target);
    update();
  });
  root.addEventListener('change', update);
  root.addEventListener('focusout', (event) => {
    if (event.target === zip || event.target === representativeName) {
      reviewedFields.add(event.target);
      update();
    }
  });
  copy.addEventListener('click', async () => {
    reviewedFields.add(zip);
    reviewedFields.add(representativeName);
    update();
    if (copy.disabled) return;
    const currentVersion = version;
    const letter = preview.value;
    const needsReview = hasDataIssues;
    try {
      await navigator.clipboard.writeText(letter);
      if (version !== currentVersion) return;
      copy.textContent = 'Copied!';
      status.classList.toggle('copy-warning', needsReview);
      status.textContent = needsReview
        ? `Letter copied. ${dataWarning}`
        : 'Letter copied. Follow the sending instructions for your chosen recipient.';
    } catch {
      if (version !== currentVersion) return;
      preview.focus();
      preview.select();
      status.classList.add('copy-warning');
      status.textContent = 'Automatic copying is unavailable. Your letter is selected: use your device’s Copy command (Ctrl+C or ⌘C).'
        + (needsReview ? ` ${dataWarning}` : '');
    }
  });
  update();
}
