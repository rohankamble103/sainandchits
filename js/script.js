/**
 * Sainand Chits Website - JavaScript
 * Enhanced with animations, interactivity, and smooth performance
 */

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
  const messages = [{ role: 'assistant', content: '👋 Hi, I am Sai. How can I help you today?' }];
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
    if (!e.target.closest('.bot-widget') && popupOpenedByUser) {
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

      loadingMessage.textContent = result.answer;
      messages.push({ role: 'assistant', content: result.answer });
      if (result.showEnquiryForm) showChatEnquiryForm();
    } catch (error) {
      loadingMessage.textContent = 'Sorry, I could not connect right now. Please call +91 98765 43210.';
    } finally {
      loadingMessage.classList.remove('bot-message-loading');
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  function addChatMessage(content, sender, loading = false) {
    const message = document.createElement('div');
    message.className = `bot-message bot-message-${sender}${loading ? ' bot-message-loading' : ''}`;
    message.textContent = content;
    messagesEl.appendChild(message);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return message;
  }

  function showChatEnquiryForm() {
    if (messagesEl.querySelector('.bot-enquiry-form')) return;

    const form = document.createElement('form');
    form.className = 'bot-enquiry-form';
    form.innerHTML = `
      <strong>Want more information?</strong>
      <span>Share your details and our team will contact you.</span>
      <label>Name<input name="name" type="text" maxlength="120" placeholder="Your full name" required></label>
      <label>Email<input name="email" type="email" maxlength="254" placeholder="your.email@example.com" required></label>
      <label>Phone number<input name="phone" type="tel" maxlength="40" placeholder="98765 43210" required></label>
      <label>Interested plan
        <select name="plan" required>
          <option value="">Select a Bhisi plan</option>
          <option>₹5 Lakh Bhisi (20 members, ₹25,000/mo)</option>
          <option>₹10 Lakh Bhisi (25 members, ₹40,000/mo) - Most Popular</option>
          <option>₹15 Lakh Bhisi (30 members, ₹50,000/mo)</option>
          <option>₹20 Lakh Bhisi (36 members, ₹55,500/mo)</option>
          <option>Not sure yet - Need more information</option>
        </select>
      </label>
      <button type="submit">Request a callback</button>
      <div class="bot-enquiry-status" role="status" aria-live="polite"></div>
    `;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submitButton = form.querySelector('button');
      const status = form.querySelector('.bot-enquiry-status');
      const formData = new FormData(form);
      submitButton.disabled = true;
      status.textContent = 'Saving your details...';

      try {
        const response = await fetch('/api/enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            plan: formData.get('plan'),
            message: 'Callback requested through Sai chat.',
            chatTranscript: messages,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to save your details.');
        status.textContent = result.duplicate
          ? 'We already have this enquiry and kept it in one record.'
          : 'Thanks — your details and chat have been sent to our team.';
        form.querySelectorAll('input, select, button').forEach(field => { field.disabled = true; });
      } catch (error) {
        status.textContent = error.message || 'Unable to save your details. Please call +91 98765 43210.';
        submitButton.disabled = false;
      }
    });

    messagesEl.appendChild(form);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    form.querySelector('input')?.focus();
  }

  // Give visitors a short welcome without forcing the full chat panel open.
  setTimeout(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (isMobile) {
      botGreeting?.classList.add('show');
      greetingTimer = setTimeout(() => botGreeting?.classList.remove('show'), 2000);
      return;
    }

    botPopup.classList.add('show');
    autoCloseTimer = setTimeout(() => botPopup.classList.remove('show'), 3000);
  }, 2500);
}

// ========== ACTIVE NAV LINK ON SCROLL ==========
function initActiveNav() {
  const navLinks = document.querySelectorAll('nav ul.menu-desktop a[href^="#"]');
  const navSections = [...navLinks]
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  const navIO = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = '#' + entry.target.id;
          navLinks.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === id);
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

// ========== AUTO-SCROLLING CAROUSEL WITH TOUCH AND CLICK NAVIGATION ==========
function initCarousel() {
  const track = document.getElementById('carouselTrack');
  const carousel = document.getElementById('home');
  const slides = document.querySelectorAll('.slide');
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

// ========== ENHANCED CONTACT FORM WITH VALIDATION ==========
function initContactForm() {
  const form = document.getElementById('enquiryForm');
  const note = document.getElementById('formNote');
  const success = document.getElementById('formSuccess');

  form?.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('fname').value.trim();
    const phone = document.getElementById('fphone').value.trim();
    const email = document.getElementById('femail').value.trim();
    const plan = document.getElementById('fplan').value;
    const message = document.getElementById('fmsg').value.trim();

    // Validation
    if (!name || !phone || !email) {
      note.classList.add('show');
      success.classList.remove('show');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      note.textContent = 'Please enter a valid email address.';
      note.classList.add('show');
      success.classList.remove('show');
      return;
    }

    // Phone validation (basic)
    const phoneRegex = /^[\d\s+\-()]{10,}$/;
    if (!phoneRegex.test(phone)) {
      note.textContent = 'Please enter a valid phone number.';
      note.classList.add('show');
      success.classList.remove('show');
      return;
    }

    note.classList.remove('show');

    const enquiry = {
      name,
      phone,
      email,
      plan,
      message: message || 'No message provided',
    };

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enquiry),
    })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to send enquiry');
        return result;
      })
      .then(() => {
        success.textContent = '✓ Enquiry sent successfully. Our team will contact you soon.';
        success.classList.add('show');
        form.reset();
      })
      .catch(error => {
        note.textContent = error.message || 'Unable to send the enquiry. Please try again.';
        note.classList.add('show');
      })
      .finally(() => {
        if (submitButton) submitButton.disabled = false;
      });

    setTimeout(() => {
      success.classList.remove('show');
    }, 5000);
  });
}

// ========== SMOOTH SCROLL FOR ANCHOR LINKS ==========
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
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
  const menuDesktop = document.querySelector('.menu-desktop');

  if (menuToggle && menuDesktop) {
    menuToggle.addEventListener('click', () => {
      const menu = document.querySelector('nav ul');
      menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
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
  initCarousel();
  initContactForm();
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
