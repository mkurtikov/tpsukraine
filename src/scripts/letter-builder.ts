import { buildLetter, contactFor, duckworthInitiative, nextRecipientForState, representativeFinder, representativeRecipient, senatorsForState, type LetterDetails, type Senator } from '../lib/letter-builder';
import { states } from '../lib/states';
import { zipWarning } from '../lib/zip';
import { representativeById, representativeLabel, searchRepresentatives, type Representative } from '../lib/representatives';
import { requiredLetterIssues, type RequiredField } from '../lib/letter-validation';

const root = document.querySelector<HTMLFormElement>('#letter-builder');
if (root) {
  const element = (id: string) => document.getElementById(id)!;
  const input = (id: string) => element(id) as HTMLInputElement;
  const button = (id: string) => element(id) as HTMLButtonElement;
  const show = (id: string, visible: boolean) => { element(id).hidden = !visible; };
  const state = element('state') as HTMLSelectElement;
  const zip = input('zip-code');
  const fullName = input('full-name');
  const city = input('city');
  const street = input('street-address');
  const citizenship = input('us-citizen');
  const extension = input('support-extension');
  const representativeName = input('representative-name');
  const representativeDetails = element('representative-details') as HTMLDetailsElement;
  const preview = element('letter-text') as HTMLTextAreaElement;
  const editor = element('details-editor') as HTMLDetailsElement;
  const editorSummary = editor.querySelector('summary')!;
  const reviewWorkspace = root.querySelector<HTMLElement>('.review-workspace')!;
  const reviewControls = root.querySelector<HTMLElement>('.review-controls')!;
  const previewPanel = root.querySelector<HTMLElement>('.letter-preview')!;
  const wideReview = window.matchMedia('(min-width: 1200px)');
  function arrangeReview() {
    const focused = document.activeElement as HTMLElement | null;
    const restoreFocus = !!focused && previewPanel.contains(focused);
    // Move the same preview, so mobile reading/tab order and all form state stay intact.
    if (wideReview.matches) reviewWorkspace.append(previewPanel);
    else reviewControls.insertBefore(previewPanel, element('action-status'));
    if (restoreFocus) focused?.focus({ preventScroll: true });
  }
  arrangeReview();
  wideReview.addEventListener('change', arrangeReview);
  const attentionTimers = new Map<HTMLElement, number>();
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const editorFields = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-detail-field]')];
  const editorRecipient = element('review-recipient') as HTMLSelectElement;
  const panels = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const stepLinks = [...root.querySelectorAll<HTMLButtonElement>('[data-step-link]')];
  const previouslySent = new Set<string>();
  const requiredReviewed = new Set<RequiredField>();
  const dataWarning = 'Please double check your data. It may be incomplete or incorrect.';
  let step = 0;
  let furthestStep = 0;
  let recipientId = '';
  let version = 0;
  let zipReviewed = false;
  let representativeNameReviewed = false;
  let representativeId = '';

  const person = () => senatorsForState(state.value).find(person => person.id === recipientId);
  const isRepresentative = () => recipientId === representativeRecipient;
  const selectedRepresentative = () => representativeById(representativeId, state.value);
  const hasRecipient = () => !!states[state.value] && (isRepresentative() || !!person());
  const recipientLabel = () => isRepresentative()
    ? (selectedRepresentative() ? `Representative ${selectedRepresentative()!.name}` : 'your U.S. representative')
    : person() ? `Senator ${person()!.name}` : '';
  const representativeHistoryKey = () => selectedRepresentative() ? `representative:${representativeId}` : '';
  const representativeNameWarning = () => isRepresentative() && !selectedRepresentative()
    ? 'Please choose your representative from the search results. Confirm their name and district on House.gov.' : '';
  const isPost = () => root.querySelector<HTMLInputElement>('input[name="delivery"]:checked')?.value === 'post';
  const details = (): LetterDetails => ({
    recipient: recipientId, state: state.value, fullName: fullName.value, city: city.value,
    zip: zip.value, street: street.value, isUsCitizen: citizenship.checked,
    supportExtension: extension.checked, delivery: isPost() ? 'post' : 'online',
    representativeId,
  });
  const hasDataIssues = () => requiredLetterIssues(details(), 3).length > 0 || !!zipWarning(zip.value, state.value);
  const requiredWarning = (field: RequiredField) => requiredReviewed.has(field)
    ? requiredLetterIssues(details(), 3).find(issue => issue.field === field)?.message ?? '' : '';

  function renderRequiredWarnings() {
    for (const field of ['state', 'full-name', 'city', 'street-address', 'recipient'] as const) {
      const message = requiredWarning(field);
      for (const prefix of ['', 'review-']) {
        const warningId = field === 'recipient' && prefix ? 'review-recipient-required' : `${prefix}${field}-warning`;
        element(warningId).textContent = message; show(warningId, !!message);
        if (field === 'recipient' && !prefix) {
          root!.querySelectorAll<HTMLInputElement>('input[name="recipient"]').forEach(radio => radio.setAttribute('aria-invalid', String(!!message)));
        } else element(`${prefix}${field}`).setAttribute('aria-invalid', String(!!message));
      }
    }
  }

  function revealMissingFields(throughStep: number) {
    const issues = requiredLetterIssues(details(), throughStep);
    issues.forEach(issue => requiredReviewed.add(issue.field));
    renderRequiredWarnings(); renderZipWarning(); renderRepresentativeWarning();
    return issues;
  }

  function renderRepresentativeWarning() {
    const warning = requiredWarning('representative-name') || (representativeNameReviewed ? representativeNameWarning() : '');
    for (const prefix of ['', 'review-']) {
      element(`${prefix}representative-name-warning`).textContent = warning;
      show(`${prefix}representative-name-warning`, !!warning);
      element(`${prefix}representative-name`).setAttribute('aria-invalid', String(!!warning));
      const person = selectedRepresentative();
      element(`${prefix}representative-selection`).textContent = person
        ? `Selected: ${representativeLabel(person)}${previouslySent.has(representativeHistoryKey()) ? ' · Previously sent' : ''}` : '';
      show(`${prefix}representative-selection`, !!person);
    }
  }

  const searchControls = ['', 'review-'].map(prefix => {
    const field = input(`${prefix}representative-name`);
    const list = element(`${prefix}representative-results`);
    const status = element(`${prefix}representative-search-status`);
    let matches: Representative[] = [];
    let active = -1;
    function close() {
      list.hidden = true; field.setAttribute('aria-expanded', 'false');
      field.removeAttribute('aria-activedescendant'); active = -1; status.textContent = '';
    }
    function render() {
      const all = searchRepresentatives(state.value, field.value);
      matches = all.slice(0, 8); active = -1; list.replaceChildren();
      field.removeAttribute('aria-activedescendant');
      for (const [index, person] of matches.entries()) {
        const option = document.createElement('li');
        option.id = `${prefix}representative-option-${index}`;
        option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
        const name = document.createElement('strong'); name.textContent = person.name;
        const district = document.createElement('span');
        district.textContent = `${person.stateName} · ${person.district === 0 ? person.districtLabel : `District ${person.district}`}${previouslySent.has(`representative:${person.id}`) ? ' · Previously sent' : ''}`;
        option.append(name, district);
        // Keep input focus until click selection, including when its blur handler runs.
        option.addEventListener('mousedown', event => event.preventDefault());
        option.addEventListener('click', () => choose(person));
        list.append(option);
      }
      list.hidden = !matches.length;
      field.setAttribute('aria-expanded', String(!!matches.length));
      status.textContent = !all.length ? `No matches in ${states[state.value] ?? 'your state'}. Check the spelling or try just the last name.`
        : `${all.length} ${all.length === 1 ? 'match' : 'matches'}${all.length > 8 ? '. Showing the first 8; type more to narrow the results' : ''}.`;
    }
    function choose(person: Representative) {
      representativeId = person.id; representativeName.value = person.name;
      representativeNameReviewed = true;
      clearActionStatus(); updateLetter(); closeRepresentativeSearches();
      field.focus({ preventScroll: true }); close();
    }
    field.addEventListener('focus', render);
    field.addEventListener('input', () => {
      representativeId = ''; representativeNameReviewed = false; render();
    });
    field.addEventListener('blur', () => {
      // A touch click follows blur; defer closing until that click can select its option.
      window.setTimeout(() => {
        if (document.activeElement !== field) {
          close(); representativeNameReviewed = true; renderRepresentativeWarning();
        }
      }, 180);
    });
    field.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
      }
      if (event.key === 'Escape') { close(); return; }
      if (event.key === 'Enter') {
        if (!list.hidden && active >= 0) choose(matches[active]);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (list.hidden) render();
      if (!matches.length) return;
      active = event.key === 'ArrowDown' ? (active + 1) % matches.length
        : active < 0 ? matches.length - 1 : (active - 1 + matches.length) % matches.length;
      [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
      const option = list.children[active] as HTMLElement;
      field.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    });
    return { close };
  });
  function closeRepresentativeSearches() { searchControls.forEach(control => control.close()); }

  function renderZipWarning() {
    const warning = requiredWarning('zip-code') || (zipReviewed ? zipWarning(zip.value, state.value) : '');
    for (const prefix of ['', 'review-']) {
      element(`${prefix}zip-warning`).textContent = warning;
      show(`${prefix}zip-warning`, !!warning);
      element(`${prefix}zip-code`).setAttribute('aria-invalid', String(!!warning));
    }
  }

  function syncEditorFields() {
    for (const field of editorFields) {
      const original = input(field.dataset.detailField!);
      if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = original.checked;
      else if (field.value !== original.value) field.value = original.value;
    }
    editorRecipient.value = recipientId;
  }

  function applyEditorField(target: HTMLInputElement | HTMLSelectElement) {
    if (!target.dataset.detailField) return;
    const original = input(target.dataset.detailField);
    if (target instanceof HTMLInputElement && target.type === 'checkbox') original.checked = target.checked;
    else original.value = target.value;
  }

  function clearActionStatus() {
    version++;
    for (const [target, timer] of attentionTimers) {
      window.clearTimeout(timer); target.classList.remove('attention-cue');
    }
    attentionTimers.clear();
    show('action-status', false);
    for (const id of ['action-result', 'action-next-step', 'action-validation']) {
      element(id).textContent = ''; show(id, false);
    }
    button('copy-letter').textContent = 'Copy letter';
    button('copy-postal-letter').textContent = 'Copy letter';
  }

  function renderProgress() {
    stepLinks.forEach((link, index) => {
      link.disabled = index !== step && index > furthestStep;
      if (index === step) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  }

  function renderRecipients() {
    const list = element('recipient-list');
    list.replaceChildren();
    const choices = senatorsForState(state.value);
    editorRecipient.replaceChildren(new Option('Choose a recipient', ''));
    editorRecipient.disabled = !choices.length;
    for (const senator of choices) {
      editorRecipient.add(new Option(`${senator.name}${previouslySent.has(senator.id) ? ' — Previously sent' : ''}`, senator.id));
      const label = document.createElement('label');
      label.className = 'recipient-card';
      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'recipient'; radio.value = senator.id;
      radio.required = true;
      radio.checked = senator.id === recipientId;
      const description = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = senator.name;
      const office = document.createElement('span');
      office.className = 'field-help'; office.textContent = `U.S. Senator · ${states[senator.state]}`;
      description.append(name, office);
      if (previouslySent.has(senator.id)) {
        const badge = document.createElement('span');
        badge.className = 'previously-sent'; badge.textContent = 'Previously sent';
        description.append(badge);
      }
      label.append(radio, description); list.append(label);
    }
    if (states[state.value]) {
      editorRecipient.add(new Option('My Representative', representativeRecipient));
      const label = document.createElement('label');
      label.className = 'recipient-card representative-card';
      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'recipient'; radio.value = representativeRecipient;
      radio.required = true;
      radio.checked = isRepresentative();
      radio.setAttribute('aria-controls', 'representative-details');
      const description = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = 'My Representative';
      const office = document.createElement('span'); office.className = 'field-help';
      office.textContent = 'U.S. House of Representatives · Your congressional district';
      const badge = document.createElement('span'); badge.id = 'representative-sent-badge';
      badge.className = 'previously-sent'; badge.textContent = 'Previously sent';
      badge.hidden = !previouslySent.has(representativeHistoryKey());
      description.append(name, office, badge); label.append(radio, description); list.append(label);
    }
    editorRecipient.value = recipientId;
    element('recipient-intro').textContent = `Choose one of your senators from ${states[state.value] ?? 'your state'}, or your U.S. representative below.`;
  }

  function renderRecipientContext(senator: Senator | undefined) {
    const context = element('recipient-context');
    context.replaceChildren();
    if (isRepresentative()) {
      context.textContent = 'The letter will address your representative and ask their office to obtain documented answers from DHS and USCIS.';
    } else if (senator?.id === 'D000622') {
      const link = document.createElement('a');
      link.href = duckworthInitiative; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Ukraine TPS initiative';
      context.append('This letter asks Senator Duckworth to follow up on her ', link, '.');
    } else if (senator) {
      context.textContent = `This letter asks Senator ${senator.lastName} to obtain documented answers from DHS and USCIS.`;
    }
  }

  function updateLetter() {
    const senator = person();
    const representative = isRepresentative();
    syncEditorFields(); renderRequiredWarnings(); renderZipWarning(); renderRepresentativeWarning(); renderProgress(); renderRecipientContext(senator);
    show('representative-details', representative);
    show('review-representative-details', representative);
    show('representative-postal-details', representative);
    const badge = document.getElementById('representative-sent-badge');
    if (badge) badge.hidden = !previouslySent.has(representativeHistoryKey());
    const representativeOption = [...editorRecipient.options].find(option => option.value === representativeRecipient);
    if (representativeOption) representativeOption.textContent = `My Representative${previouslySent.has(representativeHistoryKey()) ? ' — Previously sent' : ''}`;
    const location = `${states[state.value] ?? 'Choose your state'} · ${zip.value.trim() || 'ZIP not entered'}`;
    element('details-location').textContent = location;
    element('details-recipient').textContent = hasRecipient() ? `Preparing a letter to ${recipientLabel()}.` : 'Add your details, then choose a recipient on the next step.';
    element('letter-recipient').textContent = hasRecipient() ? `To ${recipientLabel()} · ${states[state.value]}` : '';
    element('review-details').textContent = `${fullName.value.trim() || 'Name not entered'} · ${city.value.trim() || 'City not entered'}\n${location}\n${citizenship.checked ? 'U.S. citizenship stated in the letter' : 'Opening: “I live in…”'} · ${extension.checked ? 'Supports an 18-month extension' : 'Information request only'}`;
    show('postal-details', isPost()); show('postal-instructions', hasRecipient() && isPost()); show('online-instructions', hasRecipient() && !isPost());
    show('review-recipient-warning', step === 3 && !hasRecipient());
    street.disabled = !isPost();
    street.required = isPost(); input('review-street-address').required = isPost();
    show('review-street-required', isPost());
    preview.value = buildLetter(details());
    button('copy-letter').disabled = !preview.value;
    button('copy-postal-letter').disabled = !preview.value;
    button('print-letter').disabled = !preview.value;
    element('print-letter-content').textContent = preview.value;
    const link = element('official-form') as HTMLAnchorElement;
    const officeSource = element('office-source') as HTMLAnchorElement;
    if (representative) {
      const selected = selectedRepresentative();
      link.href = selected?.website ?? representativeFinder;
      link.textContent = selected ? `Open Representative ${selected.lastName}’s website ↗` : 'Find my representative on House.gov ↗';
      element('online-heading').textContent = 'Copy, then submit on the representative’s website.';
      element('form-instruction').textContent = selected
        ? 'Copy your letter, then open your representative’s official website using the button below. Choose Contact or Email, paste your letter into the form, review it, and submit it.'
        : 'Select your representative in “Update my details” to add their name and official website. You can still copy the draft and complete it yourself.';
      element('online-note').textContent = 'The official website opens in a new tab. Fill in the details it requests and submit the letter yourself. If there is a subject field, move the first line of the letter there.';
      element('postal-instruction').textContent = selected
        ? 'The Washington office address below is already included in your letter. Print, sign, and mail it with your return address and postage.'
        : 'Select your representative in “Update my details” to add their office mailing address before printing, or complete the address yourself.';
      element('mailing-address').textContent = selected?.address ?? 'Representative not selected — office address is missing.';
      officeSource.href = selected?.website ?? representativeFinder;
      officeSource.textContent = 'Check the office address on the official website ↗';
    } else if (senator) {
      const contact = contactFor(senator);
      link.href = contact.url;
      link.textContent = `Open Senator ${senator.lastName}’s ${contact.isHomepage ? 'website' : 'contact form'} ↗`;
      element('online-heading').textContent = 'Copy, then submit on the senator’s website.';
      element('form-instruction').textContent = contact.isHomepage
        ? 'Copy your letter, then open the senator’s official website and look for Contact or Email. Choose an immigration-related topic if asked.'
        : 'Copy your letter, then open the senator’s official contact form. Choose an immigration-related topic if asked.';
      element('mailing-address').textContent = senator.address;
      element('online-note').textContent = 'The official website opens in a new tab. Fill in its contact details, paste your letter, review it, and submit it yourself. If there is a subject field, move the first line of the letter there.';
      element('postal-instruction').textContent = 'Sign above your name, then mail your letter to the office below. Add your return address and postage to the envelope.';
      officeSource.href = senator.website;
      officeSource.textContent = 'Check the office address on the official website ↗';
    }
  }

  function showStep(next: number) {
    step = Math.max(0, Math.min(3, next));
    furthestStep = Math.max(step, furthestStep);
    panels.forEach((panel, i) => { panel.hidden = i !== step; });
    updateLetter();
    const heading = panels[step].querySelector<HTMLElement>('h2')!;
    heading.focus({ preventScroll: true });
    root!.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  function validateRequired(throughStep: number) {
    const [first] = revealMissingFields(throughStep);
    if (!first) return true;
    let field: HTMLElement;
    if (step === 3) {
      editor.open = true;
      field = element(`review-${first.field}`);
    } else {
      if (step !== first.step) showStep(first.step);
      if (first.field === 'representative-name') representativeDetails.open = true;
      field = first.field === 'recipient'
        ? root!.querySelector<HTMLInputElement>('input[name="recipient"]')!
        : element(first.field);
    }
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: 'instant', block: 'center' });
    return false;
  }

  function goTo(next: number) {
    next = Math.max(0, Math.min(3, next));
    closeRepresentativeSearches();
    if (next > step) {
      zipReviewed = true;
      if (!validateRequired(next - 1)) return;
    }
    showStep(next);
  }

  root.addEventListener('submit', event => { event.preventDefault(); if (step < 3) goTo(step + 1); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type === 'text') {
      event.preventDefault(); zipReviewed = true; if (step < 3) goTo(step + 1);
    }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-next]').forEach(link => link.addEventListener('click', () => {
    zipReviewed = true; goTo(step + 1);
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-back]').forEach(link => link.addEventListener('click', () => goTo(step - 1)));
  root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(link => link.addEventListener('click', () => goTo(Number(link.dataset.go))));
  stepLinks.forEach(link => link.addEventListener('click', () => goTo(Number(link.dataset.stepLink))));

  function changeState() {
    representativeName.value = ''; representativeId = ''; representativeNameReviewed = false;
    closeRepresentativeSearches();
    recipientId = nextRecipientForState(state.value, previouslySent, representativeId);
    if (isRepresentative()) representativeDetails.open = true;
    furthestStep = step === 3 ? 3 : Math.min(furthestStep, 2);
    if (state.value === 'no-senators') requiredReviewed.add('state');
    renderRecipients();
  }
  root.addEventListener('change', event => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    applyEditorField(target);
    if (target === state || target.dataset.detailField === 'state') changeState();
    if (target.name === 'recipient' || target === editorRecipient) {
      closeRepresentativeSearches();
      recipientId = target.value; show('recipient-warning', false);
      if (isRepresentative()) representativeDetails.open = true;
      if (target === editorRecipient) renderRecipients();
    }
    clearActionStatus(); updateLetter();
  });
  root.addEventListener('input', event => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    // Selects and checkboxes synchronize on change; syncing earlier would reset their new value.
    if (target instanceof HTMLSelectElement || target.type === 'checkbox' || target.type === 'radio') return;
    applyEditorField(target);
    if (target === zip || target.dataset.detailField === 'zip-code') zipReviewed = false;
    if (target === representativeName || target.dataset.detailField === 'representative-name') representativeNameReviewed = false;
    clearActionStatus(); updateLetter();
  });
  for (const name of ['state', 'zip-code', 'full-name', 'city', 'street-address'] as const) {
    for (const prefix of ['', 'review-']) {
      const field = element(`${prefix}${name}`);
      field.addEventListener('blur', () => {
        // Let the next click finish before a new warning shifts the form layout.
        window.setTimeout(() => {
          if (document.activeElement === field || !field.getClientRects().length) return;
          requiredReviewed.add(name);
          if (name === 'zip-code') zipReviewed = true;
          renderRequiredWarnings(); renderZipWarning();
        }, 180);
      });
    }
  }
  function highlightAction(target: HTMLElement) {
    window.clearTimeout(attentionTimers.get(target));
    target.classList.remove('attention-cue');
    // Restart the short highlight even when the same action is clicked again.
    void target.offsetWidth;
    target.classList.add('attention-cue');
    attentionTimers.set(target, window.setTimeout(() => {
      target.classList.remove('attention-cue'); attentionTimers.delete(target);
    }, 3400));
  }
  button('action-validation').addEventListener('click', () => {
    editor.open = true;
    editorSummary.focus({ preventScroll: true });
    editorSummary.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' });
    highlightAction(editorSummary);
  });
  button('open-details-editor').addEventListener('click', () => {
    editor.open = true; input('review-full-name').focus();
  });
  button('close-details-editor').addEventListener('click', () => {
    zipReviewed = true;
    if (!validateRequired(3)) return;
    editor.open = false; editor.querySelector('summary')!.focus();
  });

  function actionStatus(result: string, next: string, warning = false) {
    element('action-result').textContent = result;
    element('action-next-step').textContent = next;
    element('action-validation').textContent = warning ? dataWarning : '';
    show('action-result', !!result); show('action-next-step', !!next); show('action-validation', warning);
    show('action-status', true);
  }

  async function copyLetter(copyButton: HTMLButtonElement) {
    zipReviewed = true; representativeNameReviewed = true; revealMissingFields(3); updateLetter();
    const text = preview.value;
    if (!text) return;
    const currentVersion = version;
    const issues = hasDataIssues();
    try {
      await navigator.clipboard.writeText(text);
      if (version !== currentVersion) return;
      copyButton.textContent = 'Copied!';
      const contact = person() ? contactFor(person()!) : undefined;
      const next = isPost()
        ? 'You can paste it into a document to edit and print it.'
        : isRepresentative()
          ? selectedRepresentative()
            ? `Open Representative ${selectedRepresentative()!.lastName}’s website using the button below. Find Contact or Email, paste your letter into the form, review it, and submit it.`
            : 'Choose your representative in “Update my details” to get their website link, or use House.gov to find their official contact page.'
        : contact!.isHomepage
          ? `Open Senator ${person()!.lastName}’s website and find Contact or Email. Paste your letter into the contact form, review it, and submit it.`
          : `Open Senator ${person()!.lastName}’s contact form, paste your letter, review it, and submit it.`;
      actionStatus('', next, issues);
      if (!isPost()) highlightAction(element('official-form'));
    } catch {
      if (version !== currentVersion) return;
      preview.focus(); preview.select();
      actionStatus('Automatic copying is unavailable.', 'Your letter is selected: use your device’s Copy command (Ctrl+C or ⌘C).', issues);
    }
  }
  button('copy-letter').addEventListener('click', () => void copyLetter(button('copy-letter')));
  button('copy-postal-letter').addEventListener('click', () => void copyLetter(button('copy-postal-letter')));
  button('print-letter').addEventListener('click', () => {
    zipReviewed = true; representativeNameReviewed = true; updateLetter();
    if (!validateRequired(3)) return;
    if (!preview.value) return;
    actionStatus('', 'After printing, sign and mail your letter.', hasDataIssues());
    window.print();
  });
  window.addEventListener('beforeprint', () => {
    element('print-letter-content').textContent = buildLetter(details()) || 'Choose a recipient and prepare your letter before printing.';
  });
  button('another-recipient').addEventListener('click', () => {
    // The user advances after sending; copying or selecting alone never adds a mark.
    const historyKey = isRepresentative() ? representativeHistoryKey() : person()?.id;
    if (historyKey) previouslySent.add(historyKey);
    recipientId = nextRecipientForState(state.value, previouslySent, representativeId);
    if (isRepresentative()) representativeDetails.open = true;
    furthestStep = 2; editor.open = false; clearActionStatus();
    show('recipient-warning', false); renderRecipients(); goTo(2);
  });

  function resetSession() {
    root!.reset(); previouslySent.clear(); step = 0; furthestStep = 0; recipientId = ''; zipReviewed = false;
    requiredReviewed.clear();
    representativeId = ''; closeRepresentativeSearches();
    editor.open = false;
    representativeDetails.open = true; representativeNameReviewed = false;
    show('recipient-warning', false);
    for (const prefix of ['', 'review-']) {
      show(`${prefix}state-warning`, false); element(`${prefix}state`).setAttribute('aria-invalid', 'false');
    }
    panels.forEach((panel, i) => { panel.hidden = i !== 0; });
    clearActionStatus(); renderRecipients(); updateLetter();
  }
  // Browser form restoration must not retain details after a reload or history restore.
  resetSession();
  window.addEventListener('pageshow', event => { if (event.persisted) resetSession(); });
}
