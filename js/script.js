/**
 * Sainand Chits Website - JavaScript
 * Enhanced with animations, interactivity, and smooth performance
 */

// ========== FORM PROTECTION: security check, bot trap, consent ==========
// Adds to any enquiry/application form: a required consent checkbox, a security check
// (Cloudflare Turnstile when its key is set, otherwise a small "quick check" sum),
// and a hidden field that only bots fill in.
window.SainandForms = (() => {
  // Short privacy notice shown right above the tick box (DPDP: notice before consent, understandable on its own).
  const officeEmail = () => (window.SAINAND_SITE && window.SAINAND_SITE.email) || 'support@sainandchits.com';
  const NOTICE = {
    enquiry: () => `<strong>How we use your details:</strong> We use your name, mobile number, email and message only to reply to you. We do not sell or share them for marketing. You can withdraw your consent at any time through our <a href="/support-center" target="_blank" rel="noopener">Support Center</a> or by emailing <a href="mailto:${officeEmail()}">${officeEmail()}</a>, and you may complain to the Data Protection Board of India. <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>`,
    compact: () => `We use these details only to call you back. Withdraw consent any time via our <a href="/support-center" target="_blank" rel="noopener">Support Center</a>; you may also complain to the Data Protection Board of India. <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>`,
    application: () => `<strong>How we use your details:</strong> We use your application and CV only to consider you for jobs at Sainand Chits India and to contact you about it. You can ask us to delete them at any time by emailing <a href="mailto:${officeEmail()}">${officeEmail()}</a>, and you may complain to the Data Protection Board of India. <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>`,
  };
  const CONSENT = {
    enquiry: 'I agree to be contacted by phone, WhatsApp or email about my enquiry, as per the <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>.',
    application: 'I agree to Sainand Chits India using my application and CV for hiring, as per the <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>.',
  };

  // ---- Cloudflare Turnstile (used instead of the sum when the site key is set) ----
  const siteKey = () => (window.SAINAND_SITE && window.SAINAND_SITE.turnstileSiteKey) || '';
  let turnstileReady = null;
  function loadTurnstile() {
    if (turnstileReady) return turnstileReady;
    turnstileReady = new Promise((resolve, reject) => {
      if (window.turnstile) { resolve(window.turnstile); return; }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('not loaded')));
      script.onerror = () => reject(new Error('blocked'));
      document.head.appendChild(script);
    });
    return turnstileReady;
  }
  // Render once the box is on the page (the chat form is built before it is shown).
  function renderTurnstile(box) {
    const slot = box.querySelector('.hc-turnstile');
    if (!slot || slot.dataset.widgetId) return;
    let tries = 0;
    const attempt = () => {
      if (!slot.isConnected) { if (tries++ < 100) setTimeout(attempt, 150); return; }
      loadTurnstile().then(ts => {
        if (slot.dataset.widgetId) return;
        slot.dataset.widgetId = ts.render(slot, {
          sitekey: siteKey(),
          appearance: 'interaction-only',   // most visitors see nothing; a tick box only if Cloudflare needs it
          size: 'flexible',
          theme: 'light',
          'refresh-expired': 'auto',
          'error-callback': () => slot.classList.add('is-error'),
          callback: () => slot.classList.remove('is-error'),
        });
      }).catch(() => slot.classList.add('is-error'));
    };
    attempt();
  }
  function turnstileToken(box) {
    const input = box.querySelector('input[name="cf-turnstile-response"]');
    return input ? input.value : '';
  }

  // Wait (up to ~12 s) for Cloudflare's invisible check to finish. If it seems stuck, restart it once.
  function waitForToken(box, ms = 12000) {
    const slot = box.querySelector('.hc-turnstile');
    let restarted = false;
    return new Promise(resolve => {
      const started = Date.now();
      const tick = () => {
        if (turnstileToken(box)) return resolve(true);
        const waited = Date.now() - started;
        if (!restarted && waited > 4000 && window.turnstile && slot?.dataset.widgetId) {
          restarted = true;
          slot.classList.remove('is-error');
          window.turnstile.reset(slot.dataset.widgetId);
        }
        if (waited > ms) return resolve(false);
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  // When someone presses Send before the check is done, hold the form, show "Checking…",
  // and send it automatically as soon as Cloudflare confirms. Runs before the form's own handler.
  function holdUntilVerified(form, box) {
    form.addEventListener('submit', async event => {
      if (form.dataset.tsPass) { delete form.dataset.tsPass; return; }
      if (turnstileToken(box)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (form.dataset.tsWaiting) return;
      form.dataset.tsWaiting = '1';
      const button = form.querySelector('button[type="submit"]');
      const label = button ? button.innerHTML : '';
      if (button) { button.disabled = true; button.textContent = 'Checking…'; }
      const ok = await waitForToken(box);
      delete form.dataset.tsWaiting;
      if (button) { button.disabled = false; button.innerHTML = label; }
      if (!ok) form.dataset.tsPass = '1'; // let the form show the "tick the box" message
      form.requestSubmit();
    }, true);
  }

  async function refresh(form) {
    const box = form.querySelector('.human-check');
    if (!box) return;
    const slot = box.querySelector('.hc-turnstile');
    if (slot) {
      if (slot.dataset.widgetId && window.turnstile) window.turnstile.reset(slot.dataset.widgetId);
      return;
    }
    const q = box.querySelector('.hc-question');
    const answer = box.querySelector('input[name="challengeAnswer"]');
    answer.value = '';
    q.textContent = '…';
    try {
      const response = await fetch('/api/form-challenge', { cache: 'no-store' });
      const data = await response.json();
      box.querySelector('input[name="challengeToken"]').value = data.token;
      q.textContent = `${data.question} =`;
    } catch {
      q.textContent = '(could not load, tap ↻)';
    }
  }

  function attach(form, { compact = false, purpose = 'enquiry', noPuzzle = false } = {}) {
    if (!form || form.querySelector('.human-check')) return;
    const box = document.createElement('div');
    box.className = `human-check${compact ? ' is-compact' : ''}${noPuzzle ? ' no-puzzle' : ''}`;
    if (noPuzzle) box.dataset.noPuzzle = '1';
    // One short consent line with the Privacy Policy link (the full details live in the policy).
    box.innerHTML = `
      <label class="hc-consent"><input type="checkbox" name="consent" value="true"><span>${CONSENT[purpose] || CONSENT.enquiry}</span></label>
      ${siteKey() && !noPuzzle ? '<div class="hc-turnstile"></div>' : `<div class="hc-puzzle">
        <span class="hc-label">Quick check: <strong class="hc-question">…</strong></span>
        <input name="challengeAnswer" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" aria-label="Answer to the quick check" placeholder="?">
        <button type="button" class="hc-refresh" aria-label="Show a different question" title="Different question">↻</button>
      </div>
      <input type="hidden" name="challengeToken">`}
      <div class="hc-trap" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>`;
    const submit = form.querySelector('button[type="submit"], button:not([type])');
    form.insertBefore(box, submit || null);
    if (siteKey() && !noPuzzle) { renderTurnstile(box); holdUntilVerified(form, box); return; }
    box.querySelector('.hc-refresh').addEventListener('click', () => refresh(form));
    refresh(form);
  }

  /** Returns an error message, or '' when the form is ready to send. */
  const CONSENT_MISSING = 'consent-missing';
  function problem(form) {
    const box = form.querySelector('.human-check');
    if (!box) return '';
    const consent = box.querySelector('input[name="consent"]');
    if (!consent.checked) {
      // No extra message: the tick-box line already says what it is. Just point the person to it.
      const row = consent.closest('.hc-consent');
      row.classList.remove('is-missing'); void row.offsetWidth; row.classList.add('is-missing');
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      consent.focus({ preventScroll: true });
      consent.addEventListener('change', () => row.classList.remove('is-missing'), { once: true });
      return CONSENT_MISSING;
    }
    const slot = box.querySelector('.hc-turnstile');
    if (slot) {
      if (slot.classList.contains('is-error') && !turnstileToken(box)) return 'The security check could not load. Please check your internet connection, refresh the page and try again.';
      if (!turnstileToken(box)) {
        return slot.getBoundingClientRect().height > 10
          ? 'Please tick “Verify you are human” above, then send again.'
          : 'The security check is taking longer than usual. Please check your internet connection and send again.';
      }
      return '';
    }
    if (box.dataset.noPuzzle) return '';
    if (!box.querySelector('input[name="challengeAnswer"]').value.trim()) return 'Please answer the quick check (the small sum).';
    return '';
  }

  function values(form) {
    const box = form.querySelector('.human-check');
    if (!box) return {};
    if (box.querySelector('.hc-turnstile')) {
      return {
        consent: box.querySelector('input[name="consent"]').checked,
        turnstileToken: turnstileToken(box),
        website: box.querySelector('input[name="website"]').value,
      };
    }
    return {
      consent: box.querySelector('input[name="consent"]').checked,
      challengeToken: box.querySelector('input[name="challengeToken"]').value,
      challengeAnswer: box.querySelector('input[name="challengeAnswer"]').value.trim(),
      website: box.querySelector('input[name="website"]').value,
      ...(box.dataset.noPuzzle ? { chatFlow: true } : {}),
    };
  }

  function reset(form) {
    const consent = form.querySelector('.human-check input[name="consent"]');
    if (consent) consent.checked = false;
    refresh(form);
  }

  return { attach, refresh, problem, values, reset, CONSENT_MISSING };
})();

// ========== INTERSECTION OBSERVER FOR SCROLL REVEAL ==========
function initScrollReveal() {
  function animateCount(el) {
    const target = parseInt(el.dataset.target, 10);
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.floor(p * target);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    }

    requestAnimationFrame(tick);
  }

  const revealEls = document.querySelectorAll('.reveal');
  const revealIO = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          const counter = entry.target.querySelector('.count');
          if (counter) animateCount(counter);
          revealIO.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealEls.forEach(el => revealIO.observe(el));
}

// ========== HEADER SCROLL EFFECTS ==========
function initHeaderScroll() {
  const headerEl = document.querySelector('header');
  const toTopBtn = document.getElementById('toTopBtn');

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY > 10;
    headerEl.classList.toggle('scrolled', scrolled);
    toTopBtn?.classList.toggle('show', window.scrollY > 500);
  });

  toTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ========== BOT BUBBLE CLOSE ==========
function initBotBubble() {
  const botBubble = document.getElementById('botBubble');
  const bubbleClose = document.getElementById('bubbleClose');

  bubbleClose?.addEventListener('click', e => {
    e.preventDefault();
    botBubble.style.display = 'none';
  });
}

// Copy contact details before the browser opens the phone or email handler.
function initTopBarContacts() {
  document.querySelectorAll('.top-contact[data-copy]').forEach(contact => {
    contact.addEventListener('click', () => {
      const value = contact.dataset.copy;
      if (!value) return;

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value).catch(() => {});
        return;
      }

      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    });
  });
}

// ========== BOT POPUP WIDGET ==========
function initBotPopup() {
  const botAvatar = document.getElementById('botAvatar');
  const botGreeting = document.getElementById('botGreeting');
  const botPopup = document.getElementById('botPopup');
  const botClose = document.getElementById('botClose');
  const chatForm = document.getElementById('botChatForm');
  const chatInput = document.getElementById('botInput');
  const messagesEl = document.getElementById('botMessages');
  const messages = [{ role: 'assistant', content: '👋 Hi, I\u2019m Sai from Sainand Chits! Planning to save for something special? Ask me anything, or get a free call from our team.' }];
  let popupOpenedByUser = false;
  let greetingTimer;
  let autoCloseTimer;

  if (!botAvatar || !botPopup) return;

  // Toggle popup on avatar click
  botAvatar.addEventListener('click', (e) => {
    e.preventDefault();
    clearTimeout(greetingTimer);
    clearTimeout(autoCloseTimer);
    botGreeting?.classList.remove('show');
    botPopup.classList.toggle('show');
    popupOpenedByUser = true;
    if (botPopup.classList.contains('show')) chatInput?.focus();
  });

  // Close popup when close button is clicked
  botClose?.addEventListener('click', (e) => {
    e.preventDefault();
    botPopup.classList.remove('show');
    clearTimeout(autoCloseTimer);
  });

  // Close popup when clicking outside (but not from user-triggered open)
  document.addEventListener('click', (e) => {
    // A button inside the chat may remove itself when clicked; that is not a click outside the chat.
    if (e.target.isConnected && !e.target.closest('.bot-widget') && popupOpenedByUser) {
      botPopup.classList.remove('show');
    }
  });

  chatForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const content = chatInput.value.trim();
    if (!content) return;

    addChatMessage(content, 'user');
    messages.push({ role: 'user', content });
    chatInput.value = '';
    if (lead && lead.step !== 'done') { handleLeadAnswer(content); return; }
    chatInput.disabled = true;
    const loadingMessage = addChatMessage('Sai is thinking...', 'sai', true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Chat request failed');

      const alreadySent = Boolean(messagesEl.querySelector('.bot-enquiry-form.is-sent')) || lead?.step === 'done';
      const answer = result.showEnquiryForm && alreadySent
        ? 'We already have your details 😊 Our team will call you shortly. Anything else I can help you with meanwhile?'
        : result.answer;
      if (result.showEnquiryForm && !alreadySent) {
        // One message only: Sai's own "Happy to arrange a call…" line replaces the AI reply.
        loadingMessage.remove();
        showChatEnquiryForm();
      } else {
        loadingMessage.textContent = answer;
        messages.push({ role: 'assistant', content: answer });
        revealMessage(loadingMessage);
      }
    } catch (error) {
      loadingMessage.textContent = 'Sorry, I could not connect right now. Our team can call you instead.';
      showChatEnquiryForm();
    } finally {
      loadingMessage?.classList.remove('bot-message-loading');
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  // Bring a Sai reply into view once its text is in. A long reply is shown from its
  // first line (so it can be read top to bottom); a short one scrolls to the bottom.
  function revealMessage(el) {
    requestAnimationFrame(() => {
      const boxTop = messagesEl.getBoundingClientRect().top;
      const start = el.getBoundingClientRect().top - boxTop + messagesEl.scrollTop - 8;
      const end = messagesEl.scrollHeight - messagesEl.clientHeight;
      messagesEl.scrollTo({ top: Math.max(0, Math.min(start, end)), behavior: 'smooth' });
    });
  }

  function addChatMessage(content, sender, loading = false) {
    const message = document.createElement('div');
    message.className = `bot-message bot-message-${sender}${loading ? ' bot-message-loading' : ''}`;
    message.textContent = content;
    messagesEl.appendChild(message);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return message;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // ---- Callback request as a short conversation: name → mobile → email → plan → confirm ----
  let lead = null;
  const leadPlans = () => [...(window.SAINAND_SITE?.plans || []).map(p => p.option), 'Not sure yet - Need more information'];
  const firstNameOf = name => {
    const first = String(name || '').trim().split(/\s+/)[0] || '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
  };
  const placeholder = chatInput ? chatInput.placeholder : '';

  // A question bubble with a small "1 of 4" step label.
  function saiAsk(text, stepNo) {
    const msg = document.createElement('div');
    msg.className = 'bot-message bot-message-sai bot-ask';
    msg.innerHTML = `<span class="bot-ask-step">${stepNo} of 4</span><span class="bot-ask-q"></span>`;
    msg.querySelector('.bot-ask-q').textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    messages.push({ role: 'assistant', content: text });
    return msg;
  }

  function saiSays(text) {
    const msg = addChatMessage(text, 'sai');
    messages.push({ role: 'assistant', content: text });
    return msg;
  }

  function askFor(step) {
    lead.step = step;
    chatInput.type = 'text';
    chatInput.removeAttribute('inputmode');
    chatInput.setAttribute('autocomplete', 'off');
    if (step === 'name') {
      chatInput.placeholder = 'Enter your name';
      chatInput.setAttribute('autocomplete', 'name');
    } else if (step === 'phone') {
      saiAsk('Your contact number', 2);
      chatInput.placeholder = 'Enter 10-digit number';
      chatInput.setAttribute('inputmode', 'tel');
      chatInput.setAttribute('autocomplete', 'tel');
    } else if (step === 'email') {
      saiAsk('Your email address', 3);
      chatInput.placeholder = 'Enter email address';
      chatInput.setAttribute('inputmode', 'email');
      chatInput.setAttribute('autocomplete', 'email');
    } else if (step === 'plan') {
      saiAsk('Select your plan', 4);
      chatInput.placeholder = 'Select a plan above';
      showPlanChoices();
    }
    chatInput.focus();
  }

  function showPlanChoices() {
    const wrap = document.createElement('div');
    wrap.className = 'bot-choices';
    leadPlans().forEach(option => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = option.startsWith('Not sure') ? 'Not sure yet' : option.replace(' Bhisi', '').replace(/\s*\((.+)\)/, ' · $1');
      btn.addEventListener('click', () => {
        if (!lead || lead.step !== 'plan') return;
        addChatMessage(btn.textContent, 'user');
        messages.push({ role: 'user', content: btn.textContent });
        choosePlan(option);
      });
      wrap.appendChild(btn);
    });
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function choosePlan(option) {
    lead.plan = option;
    messagesEl.querySelectorAll('.bot-choices').forEach(el => el.remove());
    lead.step = 'confirm';
    chatInput.placeholder = placeholder;
    chatInput.removeAttribute('inputmode');
    showConfirmCard();
  }

  function handleLeadAnswer(text) {
    const value = text.trim();
    if (/^(cancel|stop|no thanks|not now)$/i.test(value)) {
      lead = null;
      messagesEl.querySelectorAll('.bot-choices, .bot-enquiry-form:not(.is-sent)').forEach(el => el.remove());
      chatInput.placeholder = placeholder;
      saiSays('No problem! Ask me anything else, or say "call me" whenever you want a call from our team.');
      return;
    }
    if (lead.step === 'name') {
      if (value.length < 2 || /\d{3,}/.test(value)) return saiSays('Please enter a valid name.');
      lead.name = value.slice(0, 120);
      return askFor('phone');
    }
    if (lead.step === 'phone') {
      const digits = value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      if (!/^[6-9]\d{9}$/.test(digits)) return saiSays('Please enter a valid 10-digit mobile number.');
      lead.phone = digits;
      return askFor('email');
    }
    if (lead.step === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return saiSays('Please enter a valid email address.');
      lead.email = value.slice(0, 254);
      return askFor('plan');
    }
    if (lead.step === 'plan') {
      const options = leadPlans();
      const said = value.toLowerCase().replace(/\s+/g, '');
      const match = options.find(o => {
        const amount = o.toLowerCase().replace(/₹|\s+/g, '').match(/^\d+(lakh|crore)/);
        return amount && said.includes(amount[0]);
      }) || (/not\s*sure|don.?t\s*know|any/i.test(value) ? options[options.length - 1] : null);
      if (!match) return saiSays('Please select a plan from the options above.');
      return choosePlan(match);
    }
    if (lead.step === 'confirm') return saiSays('Please confirm your details below.');
  }

  function showConfirmCard() {
    const form = document.createElement('form');
    form.className = 'bot-enquiry-form bot-confirm';
    const planText = lead.plan.startsWith('Not sure') ? 'Not decided yet' : lead.plan;
    form.innerHTML = `
      <strong>Confirm your details</strong>
      <dl class="bot-summary">
        <div><dt>Name</dt><dd>${escapeHtml(lead.name)}</dd></div>
        <div><dt>Mobile</dt><dd>${escapeHtml(lead.phone)}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(lead.email)}</dd></div>
        <div><dt>Plan</dt><dd>${escapeHtml(planText)}</dd></div>
      </dl>
      <button type="submit">Request a call</button>
      <button type="button" class="bot-edit">Edit details</button>
      <div class="bot-enquiry-status" role="status" aria-live="polite"></div>`;
    window.SainandForms.attach(form, { compact: true, noPuzzle: true });
    // put the tick box and quick check above the buttons
    const check = form.querySelector('.human-check');
    if (check) form.insertBefore(check, form.querySelector('button[type="submit"]'));

    form.querySelector('.bot-edit').addEventListener('click', () => {
      form.remove();
      lead = { step: 'name' };
      saiAsk('Your name', 1);
      askFor('name');
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      const status = form.querySelector('.bot-enquiry-status');
      const checkProblem = window.SainandForms.problem(form);
      if (checkProblem) { status.textContent = checkProblem === window.SainandForms.CONSENT_MISSING ? '' : checkProblem; return; }
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
      status.textContent = '';
      try {
        const response = await fetch('/api/enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            plan: lead.plan,
            message: 'Callback requested through Sai chat.',
            chatTranscript: messages,
            ...window.SainandForms.values(form),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (result.refreshChallenge) window.SainandForms.refresh(form);
          throw new Error(result.error || 'Unable to save your details.');
        }
        const firstName = firstNameOf(lead.name);
        lead.step = 'done';
        // Replace the details card with a short thank-you message in the chat.
        form.classList.add('is-sent');
        form.innerHTML = `
          <div class="bot-enquiry-done">
            <span class="bot-enquiry-tick" aria-hidden="true">✓</span>
            <strong>Thank you${firstName ? ', ' + escapeHtml(firstName) : ''}!</strong>
            <span>${result.duplicate
              ? 'We already have your request. Our team will call you soon.'
              : 'Your request is received. Our team will call you soon.'}</span>
          </div>`;
        chatInput.placeholder = placeholder;
        requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
      } catch (error) {
        status.textContent = error.message || `Unable to save your details. Please call ${window.SAINAND_SITE?.phone || 'our office'}.`;
        submitButton.disabled = false;
        submitButton.textContent = 'Request a call';
        requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
      }
    });

    messagesEl.appendChild(form);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showChatEnquiryForm() {
    if (lead && lead.step !== 'done') return; // already collecting details
    lead = { step: 'name' };
    saiSays('Happy to arrange a call from our team. Please share a few details.');
    saiAsk('Your name', 1);
    askFor('name');
  }

  // Give visitors a short welcome without forcing the full chat panel open.
  // Only a small "Hi, I am Sai" bubble appears by itself; the chat box opens when the visitor taps Sai.
  setTimeout(() => {
    if (botPopup.classList.contains('show')) return;
    botGreeting?.classList.add('show');
    greetingTimer = setTimeout(() => botGreeting?.classList.remove('show'), 4500);
  }, 2500);
}

// ========== ACTIVE NAV LINK ON SCROLL ==========
function initActiveNav() {
  // On the home page, highlight the menu item of the section in view ("/#plans" etc.).
  if (location.pathname !== '/') return;
  const hashOf = a => (a.getAttribute('href') || '').replace(/^\//, '');
  const navLinks = [...document.querySelectorAll('nav ul.menu-desktop a')].filter(a => /^\/?#\w/.test(a.getAttribute('href') || '') || a.getAttribute('href') === '/');
  const navSections = navLinks
    .map(a => (a.getAttribute('href') === '/' ? document.getElementById('home') : document.querySelector(hashOf(a))))
    .filter(Boolean);

  const navIO = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = '#' + entry.target.id;
          navLinks.forEach(a => {
            const match = a.getAttribute('href') === '/' ? id === '#home' : hashOf(a) === id;
            a.classList.toggle('active', match);
          });
        }
      });
    },
    { rootMargin: '-40% 0px -50% 0px' }
  );

  navSections.forEach(s => navIO.observe(s));
}

// ========== ENHANCED 3D PRICING CARD TILT ==========
function initCardTilt() {
  const planCards = document.querySelectorAll('.plan-card');

  planCards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateX = ((e.clientY - rect.top - cy) / cy) * -8;
      const rotateY = ((e.clientX - rect.left - cx) / cx) * 8;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}


// ========== ENQUIRY FORM SUBMISSION ==========
function bindEnquiryForm(form, fields) {
  const { nameInput, phoneInput, emailInput, planInput, messageInput, note, success } = fields;
  const defaultNote = note.textContent;
  window.SainandForms.attach(form);

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const plan = planInput.value;
    const message = messageInput.value.trim();
    const submitButton = form.querySelector('button[type="submit"]');

    success.classList.remove('show');
    if (!name || !phone || !email) {
      note.textContent = defaultNote;
      note.classList.add('show');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      note.textContent = 'Please enter a valid email address.';
      note.classList.add('show');
      return;
    }

    const phoneRegex = /^[\d\s+\-()]{10,}$/;
    if (!phoneRegex.test(phone)) {
      note.textContent = 'Please enter a valid phone number.';
      note.classList.add('show');
      return;
    }

    const checkProblem = window.SainandForms.problem(form);
    if (checkProblem === window.SainandForms.CONSENT_MISSING) { note.classList.remove('show'); return; }
    if (checkProblem) {
      note.textContent = checkProblem;
      note.classList.add('show');
      return;
    }

    note.classList.remove('show');
    const enquiry = {
      name,
      phone,
      email,
      plan,
      message: message || 'No message provided',
      ...window.SainandForms.values(form),
    };

    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enquiry),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.refreshChallenge) window.SainandForms.refresh(form);
        throw new Error(result.error || 'Unable to send enquiry');
      }

      // The pop-up shows its own thank-you card in place of the form.
      if (typeof fields.onSuccess === 'function') {
        fields.onSuccess({ ...result, name, phone, email, plan });
        form.reset();
        window.SainandForms.reset(form);
        return;
      }
      success.textContent = result.duplicate
        ? '✓ Thank you! We already have your enquiry, and our team will call you shortly.'
        : result.emailQueued
          ? '✓ Thank you! Your enquiry has been received. A confirmation email is on its way, and our team will call you shortly.'
          : '✓ Thank you! Your enquiry has been received. Our team will call you shortly.';
      success.classList.add('show');
      form.reset();
      window.SainandForms.reset(form);
      window.setTimeout(() => success.classList.remove('show'), 5000);
    } catch (error) {
      note.textContent = error.message || 'Unable to send the enquiry. Please try again.';
      note.classList.add('show');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function initContactForm() {
  const form = document.getElementById('enquiryForm');
  if (!form) return;

  bindEnquiryForm(form, {
    nameInput: document.getElementById('fname'),
    phoneInput: document.getElementById('fphone'),
    emailInput: document.getElementById('femail'),
    planInput: document.getElementById('fplan'),
    messageInput: document.getElementById('fmsg'),
    note: document.getElementById('formNote'),
    success: document.getElementById('formSuccess'),
  });
}

// ========== ENQUIRY MODAL ==========
function initEnquiryModal() {
  const modal = document.getElementById('enquiryModal');
  const form = document.getElementById('modalEnquiryForm');
  if (!modal || !form) return;

  const closeButton = document.getElementById('enquiryModalClose');
  const planInput = document.getElementById('modalPlan');
  let lastFocusedElement = null;
  let closeTimer;

  bindEnquiryForm(form, {
    nameInput: document.getElementById('modalName'),
    phoneInput: document.getElementById('modalPhone'),
    emailInput: document.getElementById('modalEmail'),
    planInput,
    messageInput: document.getElementById('modalMessage'),
    note: document.getElementById('modalFormNote'),
    success: document.getElementById('modalFormSuccess'),
    onSuccess: showThanks,
  });

  const start = modal.querySelector('.enquiry-modal-start');
  const thanks = document.getElementById('modalThanks');
  const dialog = modal.querySelector('.enquiry-modal-dialog');

  // Swap the form for a thank-you card, so the customer clearly sees we have their enquiry.
  function showThanks(result) {
    const first = String(result.name || '').trim().split(/\s+/)[0] || '';
    const firstName = first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
    document.getElementById('modalThanksTitle').textContent = firstName ? `Thank you, ${firstName}!` : 'Thank you!';
    document.getElementById('modalThanksText').textContent = result.duplicate
      ? 'We already have your enquiry. Our team will contact you within 1 to 7 working days.'
      : 'We have received your enquiry. Our team will contact you within 1 to 7 working days.';
    start.hidden = true;
    thanks.hidden = false;
    dialog.scrollTop = 0;
    thanks.focus({ preventScroll: true });
  }

  // Next time the pop-up opens, the form is back.
  function resetToForm() {
    thanks.hidden = true;
    start.hidden = false;
  }

  // "View Details" on a plan card: same pop-up, with the plan's details on top and no plan or message fields.
  const head = document.getElementById('enquiryModalHead');
  const detail = document.getElementById('planDetail');
  const planGroup = document.getElementById('modalPlanGroup');
  const messageGroup = document.getElementById('modalMessageGroup');
  const submitLabel = form.querySelector('.enquiry-modal-submit');
  const defaultSubmit = submitLabel ? submitLabel.textContent : '';
  const rupees = n => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const formHead = document.getElementById('planFormHead');
  // A short line about what each plan size is good for.
  const planGoal = amount => amount <= 500000
    ? 'a vehicle, education or a family function'
    : amount <= 1000000 ? 'a wedding, home upgrade or your business'
      : amount <= 2500000 ? 'a home down payment or business growth'
        : 'property, a big business move or long-term plans';

  // Plan pop-up has two steps: "detail" (the plan, with an Enquire Now button) and "form" (the short form).
  function setPlanStep(step) {
    const isDetail = step === 'detail';
    if (detail) detail.hidden = !isDetail;
    if (formHead) formHead.hidden = isDetail;
    form.hidden = isDetail;
    dialog.scrollTop = 0;
  }

  function setPlanMode(plan) {
    const on = Boolean(plan);
    if (head) head.hidden = on;
    if (planGroup) planGroup.hidden = on;
    if (messageGroup) messageGroup.hidden = on;
    if (submitLabel) submitLabel.textContent = on ? 'Send my enquiry' : defaultSubmit;
    dialog.setAttribute('aria-labelledby', on ? 'planDetailTitle' : 'enquiryModalTitle');
    dialog.classList.toggle('is-plan', on);
    if (!on) {
      if (detail) detail.hidden = true;
      if (formHead) formHead.hidden = true;
      form.hidden = false;
      return;
    }
    document.getElementById('planDetailTitle').textContent = `${plan.label} Bhisi`;
    document.getElementById('planFormTitle').textContent = `Enquire about the ${plan.label} Bhisi`;
    document.getElementById('planDetailTag').hidden = !plan.featured;
    document.getElementById('planDetailLead').textContent =
      `Save monthly, take your Bhisi when you need it most.`;
    document.getElementById('planDetailAmount').textContent = plan.label;
    document.getElementById('planDetailMonths').textContent = `${plan.months} months`;
    document.getElementById('planDetailMembers').textContent = `${plan.members}`;
    document.getElementById('planDetailInstalment').textContent = rupees(plan.instalment);
    setPlanStep('detail');
  }

  document.getElementById('planDetailCta')?.addEventListener('click', () => {
    setPlanStep('form');
    window.setTimeout(() => document.getElementById('modalName')?.focus(), 60);
  });
  document.getElementById('planFormBack')?.addEventListener('click', () => {
    setPlanStep('detail');
    document.getElementById('planDetailCta')?.focus();
  });


  document.getElementById('modalThanksClose')?.addEventListener('click', () => closeModal());

  // Stop the page behind the pop-up from scrolling (also on iPhone), and put it back where it was on close.
  let lockedY = 0;
  function lockPage() {
    lockedY = window.scrollY;
    const root = document.documentElement;
    root.style.scrollBehavior = 'auto';
    root.style.overflow = 'hidden';
    Object.assign(document.body.style, { position: 'fixed', top: `-${lockedY}px`, left: '0', right: '0', width: '100%' });
  }
  function unlockPage() {
    const root = document.documentElement;
    root.style.overflow = '';
    Object.assign(document.body.style, { position: '', top: '', left: '', right: '', width: '' });
    window.scrollTo(0, lockedY);
    root.style.scrollBehavior = '';
  }

  function closeModal() {
    if (!modal.classList.contains('is-open')) return;
    unlockPage();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      modal.hidden = true;
      resetToForm();
    }, 220);
    lastFocusedElement?.focus({ preventScroll: true });
  }

  function openModal(trigger) {
    window.clearTimeout(closeTimer);
    lastFocusedElement = document.activeElement;
    const selectedPlan = trigger.dataset.plan;
    if (selectedPlan && [...planInput.options].some(option => option.value === selectedPlan)) {
      planInput.value = selectedPlan;
    }

    const plans = (window.SAINAND_SITE && window.SAINAND_SITE.plans) || [];
    const plan = trigger.classList.contains('plan-details-btn') ? plans[Number(trigger.dataset.planIndex)] : null;
    setPlanMode(plan);
    dialog.scrollTop = 0;

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    if (!document.body.classList.contains('modal-open')) lockPage();
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    window.setTimeout(() => (plan ? document.getElementById('enquiryModalClose') : document.getElementById('modalName'))?.focus(), 80);
  }

  document.querySelectorAll('.enquiry-trigger, .plan-details-btn').forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.preventDefault();
      openModal(trigger);
    });
  });

  closeButton?.addEventListener('click', closeModal);
  modal.querySelector('[data-enquiry-close]')?.addEventListener('click', closeModal);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });
}

// ========== BANNER SLIDER (original full-width slider) ==========
function initCarousel() {
  const track = document.getElementById('carouselTrack');
  const carousel = document.getElementById('home');
  const slides = document.querySelectorAll('.slide');
  if (!track || !carousel || !slides.length) return;

  let index = 0;
  let autoTimer;
  let isPaused = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let didSwipe = false;

  function goToSlide(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  function moveSlide(dir) {
    goToSlide(index + dir);
    resetAuto();
  }

  function resetAuto() {
    clearInterval(autoTimer);
    if (!isPaused) {
      autoTimer = setInterval(() => goToSlide(index + 1), 4500);
    }
  }

  // Pause on hover
  track.addEventListener('mouseenter', () => {
    isPaused = true;
    clearInterval(autoTimer);
  });

  track.addEventListener('mouseleave', () => {
    isPaused = false;
    resetAuto();
  });

  // Desktop and laptop navigation: click the side of the banner.
  carousel.addEventListener('click', event => {
    if (didSwipe) {
      didSwipe = false;
      return;
    }

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const bounds = carousel.getBoundingClientRect();
    moveSlide(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1);
  });

  carousel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveSlide(event.key === 'ArrowLeft' ? -1 : 1);
  });

  // Touch navigation: keep vertical page scrolling natural and only
  // intercept a deliberate horizontal swipe.
  carousel.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    didSwipe = false;
    clearInterval(autoTimer);
  }, { passive: true });

  carousel.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      didSwipe = true;
      moveSlide(deltaX < 0 ? 1 : -1);
    } else {
      resetAuto();
    }
  }, { passive: true });

  // Keep the existing global hook available for keyboard/dev-console use.
  window.moveSlide = moveSlide;

  resetAuto();
}

// (newer slider, used only if its markup is present)
function initBanners() {
  const root = document.getElementById('bannerCarousel');
  if (!root) return;
  const track = root.querySelector('.bnr-track');
  const slides = [...root.querySelectorAll('.bnr-slide')];
  const dots = [...root.querySelectorAll('.bnr-dots button')];
  if (slides.length < 2) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer;
  const go = i => {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((s, k) => s.setAttribute('aria-hidden', String(k !== index)));
    slides.forEach((s, k) => { s.tabIndex = k === index ? 0 : -1; });
    dots.forEach((d, k) => d.toggleAttribute('aria-current', k === index));
  };
  const play = () => { clearInterval(timer); if (!reduceMotion) timer = setInterval(() => go(index + 1), 5000); };
  const stop = () => clearInterval(timer);
  root.querySelector('.prev')?.addEventListener('click', () => { go(index - 1); play(); });
  root.querySelector('.next')?.addEventListener('click', () => { go(index + 1); play(); });
  dots.forEach((d, k) => d.addEventListener('click', () => { go(k); play(); }));
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', play);
  root.addEventListener('focusin', stop);
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
  });
  // Swipe on phones; a swipe never counts as a tap on the banner.
  let startX = 0; let startY = 0; let swiped = false;
  root.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; swiped = false; stop(); }, { passive: true });
  root.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX; const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; go(index + (dx < 0 ? 1 : -1)); }
    play();
  }, { passive: true });
  slides.forEach(s => s.addEventListener('click', e => { if (swiped) { e.preventDefault(); e.stopImmediatePropagation(); swiped = false; } }, true));
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));
  go(0);
  play();
}

// ========== LEADERSHIP ROW: keeps moving right in an endless loop; dots show who is first ==========
// Hovering or just watching does not stop it. Clicking, dragging or scrolling sideways does, until 8–12 seconds of no activity.
function initTeamRow() {
  const row = document.getElementById('teamRow');
  const dotsBox = document.getElementById('teamDots');
  if (!row) return;
  const originals = [...row.querySelectorAll('.team-card')];
  const count = originals.length;
  if (count < 2) return;
  // Copies of every card go after the last one, so the row can keep moving right.
  // When the copies reach the start position, we jump back invisibly to the real cards.
  originals.forEach(card => {
    const copy = card.cloneNode(true);
    copy.classList.add('is-copy');
    copy.setAttribute('aria-hidden', 'true');
    copy.classList.remove('reveal'); // copies are always fully visible (no fade-in wait)
    row.appendChild(copy);
  });
  const all = () => [...row.querySelectorAll('.team-card')];
  const step = () => all()[1].offsetLeft - all()[0].offsetLeft;
  const loopWidth = () => all()[count].offsetLeft - all()[0].offsetLeft;
  const current = () => Math.round(row.scrollLeft / step()) % count;

  // Dots: one per person.
  dotsBox.innerHTML = originals.map((card, i) => `<button type="button" role="tab" aria-label="Show ${card.querySelector('h3')?.textContent || `person ${i + 1}`}"></button>`).join('');
  const dots = [...dotsBox.querySelectorAll('button')];
  const paintDots = () => { const i = current(); dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i))); };

  let gesture = false; // true while someone is dragging or swiping the row
  // Back to the real cards once we've moved into the copies (no visible jump).
  const normalise = () => {
    if (gesture) return;
    const width = loopWidth();
    if (row.scrollLeft >= width - 2) {
      row.style.scrollBehavior = 'auto';
      row.style.scrollSnapType = 'none';
      row.scrollLeft -= width;
      row.offsetHeight; // apply before restoring smooth scrolling
      row.style.scrollBehavior = '';
      row.style.scrollSnapType = '';
    }
    paintDots();
  };
  let settle;
  row.addEventListener('scroll', () => { clearTimeout(settle); settle = setTimeout(normalise, 140); paintDots(); }, { passive: true });

  const next = () => row.scrollBy({ left: step(), behavior: 'smooth' });
  dots.forEach((d, i) => d.addEventListener('click', () => { row.scrollTo({ left: i * step(), behavior: 'smooth' }); takeControl(RESUME_AFTER_CLICK); }));

  // Moving on its own: keeps going while people just look or hover.
  // It stops only when someone takes control (clicks a person, drags or scrolls sideways, uses the dots or arrow keys)
  // and starts again after a quiet spell with no more interaction.
  const RESUME_AFTER_CLICK = 12000;
  const RESUME_AFTER_SCROLL = 8000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = null; let paused = false; let resumeTimer = null; let onScreen = false;
  const play = () => { clearInterval(timer); if (!reduceMotion && !paused && onScreen && !document.hidden) timer = setInterval(next, 3000); };
  const clearSelected = () => row.querySelectorAll('.team-card.is-selected').forEach(card => card.classList.remove('is-selected'));
  const hold = () => { paused = true; clearInterval(timer); clearTimeout(resumeTimer); row.classList.add('is-held'); };
  const release = (delay = RESUME_AFTER_SCROLL) => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { paused = false; row.classList.remove('is-held'); clearSelected(); play(); }, delay);
  };
  const takeControl = delay => { hold(); release(delay); };
  // Going left from the very first card: jump invisibly to the copies so there is always room to move.
  const roomOnLeft = () => {
    if (row.scrollLeft < step() * 0.5) {
      row.style.scrollBehavior = 'auto';
      row.scrollLeft += loopWidth();
      row.style.scrollBehavior = '';
    }
  };
  // Glide to the nearest person, then switch card-snapping back on (switching it on first makes it jump).
  let snapBack = null;
  const snapToNearest = () => {
    // The exact spot the browser's own card-snapping uses, so nothing moves again when snapping comes back on.
    const rowBox = row.getBoundingClientRect();
    const pad = (parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0) + row.clientLeft;
    const spots = all().map(card => row.scrollLeft + card.getBoundingClientRect().left - rowBox.left - pad);
    const target = spots.reduce((best, spot) => (Math.abs(spot - row.scrollLeft) < Math.abs(best - row.scrollLeft) ? spot : best), spots[0]);
    row.scrollTo({ left: target, behavior: 'smooth' });
    clearTimeout(snapBack);
    snapBack = setTimeout(() => { if (!gesture) { row.style.scrollSnapType = ''; normalise(); } }, 600);
  };

  // Mouse wheel: up/down keeps scrolling the page as normal; sideways (trackpad swipe or Shift + wheel) moves the people.
  // The row follows the fingers 1:1 with card-snapping switched off (snapping on every tiny trackpad step is what
  // makes it jerky), then glides to the nearest person once the swipe ends.
  let wheelEnd = null;
  const wrapAround = () => {
    const width = loopWidth();
    if (row.scrollLeft < step() * 0.5) row.scrollLeft += width;
    else if (row.scrollLeft >= width + step() * 0.5) row.scrollLeft -= width;
  };
  row.addEventListener('wheel', event => {
    const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY) || (event.shiftKey && event.deltaY);
    if (!sideways) return;
    event.preventDefault();
    if (!gesture) {
      gesture = true;
      hold();
      row.style.scrollSnapType = 'none';
      row.style.scrollBehavior = 'auto';
    }
    let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (event.deltaMode === 1) delta *= 32; // a mouse wheel that reports lines instead of pixels
    row.scrollLeft += delta;
    wrapAround();
    clearTimeout(wheelEnd);
    wheelEnd = setTimeout(() => {
      gesture = false;
      row.style.scrollBehavior = '';
      snapToNearest();
      release(RESUME_AFTER_SCROLL);
    }, 160);
  }, { passive: false });

  // Mouse drag: hold the left button and pull left or right.
  let drag = null; let dragged = false;
  row.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: row.scrollLeft, id: event.pointerId };
    dragged = false;
  });
  row.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!dragged && Math.abs(dx) < 6) return;
    if (!dragged) {
      dragged = true;
      hold();
      row.setPointerCapture(drag.id);
      row.classList.add('is-dragging');
      row.style.scrollSnapType = 'none';
      row.style.scrollBehavior = 'auto';
      gesture = true;
    }
    const target = drag.left - dx;
    row.scrollLeft = target;
    wrapAround();
    drag.left += row.scrollLeft - target; // keep following the mouse after a wrap-around
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    if (!dragged) return;
    row.classList.remove('is-dragging');
    gesture = false;
    row.style.scrollBehavior = '';
    snapToNearest();
    release(RESUME_AFTER_SCROLL);
  };
  row.addEventListener('pointerup', endDrag);
  row.addEventListener('pointercancel', endDrag);
  row.addEventListener('dragstart', event => event.preventDefault()); // photos shouldn't be picked up while dragging

  // Click on a person: stop on them (highlighted) and start again after a quiet spell.
  row.addEventListener('click', event => {
    if (dragged) { dragged = false; event.preventDefault(); return; }
    const card = event.target.closest('.team-card');
    if (!card) return;
    clearSelected();
    card.classList.add('is-selected');
    takeControl(RESUME_AFTER_CLICK);
  });
  // Any further activity while stopped (moving the mouse over the row, touching it) keeps it stopped a little longer.
  row.addEventListener('pointermove', () => { if (paused && !drag) release(row.querySelector('.is-selected') ? RESUME_AFTER_CLICK : RESUME_AFTER_SCROLL); }, { passive: true });

  // Phones: swiping moves the people; it starts again after a quiet spell.
  row.addEventListener('touchstart', hold, { passive: true });
  row.addEventListener('touchend', () => release(RESUME_AFTER_SCROLL), { passive: true });

  row.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); takeControl(RESUME_AFTER_CLICK); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); roomOnLeft(); row.scrollBy({ left: -step(), behavior: 'smooth' }); takeControl(RESUME_AFTER_CLICK); }
  });
  new IntersectionObserver(entries => { entries.forEach(en => { onScreen = en.isIntersecting; play(); }); }, { threshold: 0.25 }).observe(row);
  document.addEventListener('visibilitychange', play);
  window.addEventListener('resize', () => { normalise(); play(); });
  paintDots();
}

// ========== PLANS: sliding plan row ==========
function initPlans() {
  // Plan cards in one row; arrows appear when they don't all fit.
  const grid = document.getElementById('planGrid');
  if (grid) {
    const prev = document.querySelector('.plan-nav.prev');
    const next = document.querySelector('.plan-nav.next');
    const sync = () => {
      const overflow = grid.scrollWidth > grid.clientWidth + 4;
      prev.hidden = !overflow || grid.scrollLeft < 8;
      next.hidden = !overflow || grid.scrollLeft + grid.clientWidth > grid.scrollWidth - 8;
    };
    const step = dir => grid.scrollBy({ left: dir * (grid.querySelector('.plan-card')?.offsetWidth + 16 || 260), behavior: 'smooth' });
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    grid.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }
}

// ========== SMOOTH SCROLL FOR ANCHOR LINKS ==========
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      if (this.classList.contains('enquiry-trigger') || this.classList.contains('plan-details-btn')) return;
      let href = this.getAttribute('href');
      if (href.startsWith('/#')) {
        if (location.pathname !== '/') return;
        href = href.slice(1);
      }
      if (href !== '#' && document.querySelector(href)) {
        e.preventDefault();
        document.querySelector(href).scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    });
  });
}

// ========== HERO LAYOUT STABILITY ==========
function initParallax() {
  // Intentionally left disabled to prevent the banner image from shifting
  // over the below hero text and causing the visual merge.
}


// ========== PAGE LOAD ANIMATIONS ==========
function initPageLoadAnimations() {
  // Fade in body
  document.body.style.opacity = '0';
  setTimeout(() => {
    document.body.style.transition = 'opacity 0.6s ease-out';
    document.body.style.opacity = '1';
  }, 100);

  // Stagger intro animations
  const introElements = document.querySelectorAll('.brand, nav');
  introElements.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.animation = `slideDown 0.6s ease-out ${i * 0.15}s forwards`;
  });
}

// ========== MOBILE MENU TOGGLE ==========
function initMobileMenu() {
  const menuToggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('nav ul.menu-desktop');

  if (menuToggle && menu) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-controls', 'site-menu');
    menu.id = menu.id || 'site-menu';

    const closeMenu = () => {
      menu.classList.remove('menu-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menu.querySelectorAll('.mobile-login-details').forEach(item => item.removeAttribute('open'));
    };

    menuToggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('menu-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      if (!isOpen) {
        menu.querySelectorAll('.mobile-login-details').forEach(item => item.removeAttribute('open'));
      }
    });

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', event => {
      if (!menu.contains(event.target) && !menuToggle.contains(event.target)) {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        closeMenu();
      }
    });
  }
}


// ========== PERFORMANCE MONITORING ==========
function initPerformanceMonitoring() {
  if (window.performance && window.performance.timing) {
    window.addEventListener('load', () => {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd > timing.navigationStart
        ? timing.loadEventEnd - timing.navigationStart
        : null;
      if (loadTime !== null) console.log(`Page loaded in ${loadTime}ms`);
    });
  }
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initHeaderScroll();
  initBotBubble();
  initTopBarContacts();
  initBotPopup();
  initActiveNav();
  initCardTilt();
  initContactForm();
  initBanners();
  initCarousel();
  initPlans();
  initTeamRow();
  initEnquiryModal();
  initSmoothScroll();
  initParallax();
  initMobileMenu();
  initPerformanceMonitoring();

  // Page load animations
  initPageLoadAnimations();

  console.log('✓ Sainand Chits website initialized successfully!');
});

// ========== GLOBAL ERROR HANDLER ==========
window.addEventListener('error', event => {
  console.error('Global error:', event.error);
});

// ========== UNHANDLED PROMISE REJECTION ==========
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

/* ---------- How it works: "Getting started" timeline ---------- */
(function initJourney() {
  const root = document.querySelector('[data-journey]');
  if (!root) return;
  const list = root.querySelector('.jr-steps');
  const svg = root.querySelector('.jr-svg');
  const base = root.querySelector('.jr-base');
  const glow = root.querySelector('.jr-glow');
  const mask = root.querySelector('.jr-mask');
  const startDot = root.querySelector('.jr-start');
  const finishDot = root.querySelector('.jr-finish-dot');
  const steps = [...root.querySelectorAll('.jr-step')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let total = 0;
  let marks = [];   // 0..1 position of each step along the track
  let shown = 0;
  let target = 0;
  let frame = 0;
  let vertical = false;

  // ---- the wavy track through the four icons ----
  function layout() {
    vertical = window.matchMedia('(max-width: 700px)').matches;
    if (vertical) { measure(); paint(true); return; }
    const box = list.getBoundingClientRect();
    const nodes = steps.map(step => {
      const r = step.querySelector('.jr-node').getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    });
    const y = nodes[0].y;
    const w = box.width;
    svg.setAttribute('viewBox', `0 0 ${w} ${svg.getBoundingClientRect().height}`);
    const pts = [{ x: 4, y }, ...nodes, { x: w - 4, y }];
    // gentle wave: each gap between points bows up or down in turn
    let d = `M ${pts[0].x} ${y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const bow = (i % 2 ? -1 : 1) * Math.min(18, (b.x - a.x) * 0.12);
      d += ` C ${a.x + (b.x - a.x) * 0.35} ${y + bow}, ${a.x + (b.x - a.x) * 0.65} ${y + bow}, ${b.x} ${y}`;
    }
    [base, glow, mask].forEach(path => path.setAttribute('d', d));
    total = base.getTotalLength();
    // where each icon sits along the track (sample along the path)
    marks = nodes.map(n => {
      let lo = 0; let hi = total;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (base.getPointAtLength(mid).x < n.x) lo = mid; else hi = mid; }
      return lo / total;
    });
    startDot.setAttribute('cx', pts[0].x); startDot.setAttribute('cy', y);
    finishDot.setAttribute('cx', pts[pts.length - 1].x); finishDot.setAttribute('cy', y);
    mask.style.strokeDasharray = `${total} ${total}`;
    measure();
    paint(true);
  }

  function measure() {
    const vh = window.innerHeight;
    if (vertical) {
      // phones: the line fills down to the middle of the screen, so each step lights up as it reaches the centre
      const r = list.getBoundingClientRect();
      target = Math.min(1, Math.max(0, (vh * 0.55 - r.top) / Math.max(1, r.height - 30)));
      marks = steps.map(step => {
        const n = step.querySelector('.jr-node').getBoundingClientRect();
        return Math.max(0, (n.top + n.height / 2 - r.top) / Math.max(1, r.height - 30));
      });
      return;
    }
    // desktop: the glow runs while the dotted line moves from ~70% down the screen to just above the centre
    const lineY = list.getBoundingClientRect().top + (svg.getBoundingClientRect().height / 2);
    const startAt = vh * 0.72;
    const doneAt = vh * 0.42;
    target = Math.min(1, Math.max(0, (startAt - lineY) / (startAt - doneAt)));
  }

  function paint() {
    if (!vertical && total) mask.style.strokeDashoffset = String(total * (1 - shown));
    list.style.setProperty('--jr-p', shown.toFixed(3));
    root.classList.toggle('is-complete', shown > 0.985);
    const selected = root.querySelector('.jr-step.is-selected');
    let current = -1;
    steps.forEach((step, i) => {
      const lit = shown > 0.01 && shown >= marks[i] - 0.005;
      step.classList.toggle('is-lit', lit);
      if (lit) current = i;
    });
    steps.forEach((step, i) => step.classList.toggle('is-current', i === current && !selected && shown < 0.985));
  }

  function tick() {
    const diff = target - shown;
    shown = Math.abs(diff) < 0.002 ? target : shown + diff * 0.12;
    paint();
    frame = shown !== target ? requestAnimationFrame(tick) : 0;
  }

  function onScroll() {
    measure();
    if (reduce) { shown = target; paint(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  steps.forEach(step => {
    const select = () => {
      const was = step.classList.contains('is-selected');
      steps.forEach(s => s.classList.remove('is-selected'));
      if (!was) step.classList.add('is-selected');
      paint();
    };
    step.addEventListener('click', select);
    step.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
  });

  layout();
  if (reduce) { shown = target; paint(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(layout);
})();
