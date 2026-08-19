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
    toTopBtn.classList.toggle('show', window.scrollY > 500);
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
  const botPopup = document.getElementById('botPopup');
  const botClose = document.getElementById('botClose');
  const chatForm = document.getElementById('botChatForm');
  const chatInput = document.getElementById('botInput');
  const messagesEl = document.getElementById('botMessages');
  const messages = [];
  let popupShownFromLoad = false;

  if (!botAvatar || !botPopup) return;

  // Toggle popup on avatar click
  botAvatar.addEventListener('click', (e) => {
    e.preventDefault();
    botPopup.classList.toggle('show');
    popupShownFromLoad = true;
    if (botPopup.classList.contains('show')) chatInput?.focus();
  });

  // Close popup when close button is clicked
  botClose?.addEventListener('click', (e) => {
    e.preventDefault();
    botPopup.classList.remove('show');
  });

  // Close popup when clicking outside (but not from user-triggered open)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.bot-widget') && popupShownFromLoad) {
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

  // Auto-show popup on page load - show immediately and keep visible
  setTimeout(() => {
    botPopup.classList.add('show');
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

// ========== AUTO-SCROLLING CAROUSEL WITH ENHANCED CONTROLS ==========
function initCarousel() {
  const track = document.getElementById('carouselTrack');
  const dotsWrap = document.getElementById('carouselDots');
  const slides = document.querySelectorAll('.slide');
  let index = 0;
  let autoTimer;
  let isPaused = false;

  // Create dot buttons
  slides.forEach((s, i) => {
    const dot = document.createElement('button');
    if (i === 0) dot.className = 'active';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => {
      goToSlide(i);
      resetAuto();
    });
    dotsWrap.appendChild(dot);
  });

  function updateDots() {
    [...dotsWrap.children].forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
  }

  function goToSlide(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    updateDots();
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

  // Global slide controls
  window.moveSlide = moveSlide;

  resetAuto();
}

// ========== ENHANCED CONTACT FORM WITH VALIDATION ==========
const GOOGLE_APPS_SCRIPT_URL = '';

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

    if (!GOOGLE_APPS_SCRIPT_URL) {
      note.textContent = 'Email service is not configured yet. Add the Google Apps Script Web App URL first.';
      note.classList.add('show');
      return;
    }

    const enquiry = {
      timestamp: new Date().toISOString(),
      name,
      phone,
      email,
      plan,
      message: message || 'No message provided',
    };

    fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(enquiry),
    })
      .then(() => {
        success.textContent = '✓ Enquiry sent successfully.';
        success.classList.add('show');
        form.reset();
      })
      .catch(() => {
        note.textContent = 'Unable to send the enquiry. Please try again.';
        note.classList.add('show');
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
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      console.log(`Page loaded in ${loadTime}ms`);
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
