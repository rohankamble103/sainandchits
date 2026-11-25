/**
 * Sainand Chits India - Careers Page Behavior
 * Dynamic job openings loading, Join Us application modal, and resume upload handling.
 */

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[c]));
}

let activeOpenings = [];

async function loadOpenings() {
  const container = document.getElementById('openingsContainer');
  const positionSelect = document.getElementById('applyPosition');
  if (!container) return;

  try {
    const res = await fetch('/api/careers/openings');
    const data = await res.json();
    activeOpenings = data.openings || [];

    // Populate Position dropdown in modal
    if (positionSelect) {
      positionSelect.innerHTML = '<option value="General Application">General Application / Any Suitable Role</option>';
      activeOpenings.forEach(opening => {
        const opt = document.createElement('option');
        opt.value = opening.title;
        opt.dataset.id = opening.id;
        opt.textContent = `${opening.title} (${opening.department} - ${opening.location})`;
        positionSelect.appendChild(opt);
      });
    }

    // Render Openings Grid or Empty State
    if (!activeOpenings.length) {
      container.innerHTML = `
        <div class="openings-empty">
          <div class="openings-empty-icon" aria-hidden="true">💼</div>
          <h3>No Open Positions at the Moment</h3>
          <p>We do not have an active opening right now, but we are always eager to connect with talented and passionate professionals. Submit your resume through our <strong>Join Us</strong> form and we will reach out when a suitable role opens!</p>
          <button type="button" class="btn-fill btn-join-general" data-job="General Application">Join Us &middot; Submit Resume</button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="openings-grid">
          ${activeOpenings.map(op => `
            <article class="opening-card">
              <div class="opening-card-top">
                <div class="opening-tags">
                  <span class="opening-tag opening-tag-dept">${escapeHtml(op.department)}</span>
                  <span class="opening-tag">&#128197; ${escapeHtml(op.jobType)}</span>
                  <span class="opening-tag">&#9874; ${escapeHtml(op.experience)}</span>
                </div>
                <h3>${escapeHtml(op.title)}</h3>
                <p>${escapeHtml(op.description)}</p>
                ${op.requirements ? `
                  <div class="opening-card-req">
                    <strong>Requirements</strong>
                    ${escapeHtml(op.requirements)}
                  </div>
                ` : ''}
              </div>
              <div class="opening-card-bottom">
                <span class="opening-loc">&#128205; ${escapeHtml(op.location)}</span>
                <button type="button" class="btn-fill btn-apply-job" data-id="${op.id}" data-job="${escapeHtml(op.title)}">Apply Now &rarr;</button>
              </div>
            </article>
          `).join('')}
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load openings:', err);
    container.innerHTML = `
      <div class="openings-empty">
        <div class="openings-empty-icon">💼</div>
        <h3>Join Our Team</h3>
        <p>Ready to start a rewarding career with Sainand Chits India? Share your details and resume with our recruitment team below.</p>
        <button type="button" class="btn-fill btn-join-general" data-job="General Application">Join Us &middot; Submit Resume</button>
      </div>
    `;
  }
}

// ========== MODAL LOGIC ==========
function initCareerModal() {
  const modal = document.getElementById('careerModal');
  const closeBtn = document.getElementById('careerModalClose');
  const form = document.getElementById('careerForm');
  const positionSelect = document.getElementById('applyPosition');
  const openingIdInput = document.getElementById('applyOpeningId');
  const fileInput = document.getElementById('resumeFile');
  const fileSelectedText = document.getElementById('fileSelectedText');
  const formNote = document.getElementById('careerFormNote');
  const formSuccess = document.getElementById('careerFormSuccess');
  const submitBtn = document.getElementById('careerSubmitBtn');

  if (!modal || !form) return;

  function openModal(jobTitle = 'General Application', openingId = '') {
    form.reset();
    formNote.classList.remove('show');
    formSuccess.classList.remove('show');
    if (fileSelectedText) fileSelectedText.textContent = '';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Application';
    }

    if (positionSelect) {
      // Look for matching option
      let found = false;
      for (const opt of positionSelect.options) {
        if (opt.value === jobTitle || opt.textContent.includes(jobTitle)) {
          opt.selected = true;
          found = true;
          break;
        }
      }
      if (!found) positionSelect.value = 'General Application';
    }

    if (openingIdInput) openingIdInput.value = openingId || '';

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('applicantFirstName')?.focus(), 100);
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Handle clicks on page to open modal
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-job]');
    if (trigger) {
      event.preventDefault();
      const jobTitle = trigger.dataset.job || 'General Application';
      const jobId = trigger.dataset.id || '';
      openModal(jobTitle, jobId);
    }
  });

  closeBtn?.addEventListener('click', closeModal);
  modal.querySelector('.career-modal-backdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  // Resume File Selection Feedback
  fileInput?.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      if (file.size > 10 * 1024 * 1024) {
        formNote.textContent = 'Resume file size exceeds the 10 MB limit. Please select a smaller document.';
        formNote.classList.add('show');
        fileInput.value = '';
        fileSelectedText.textContent = '';
        return;
      }
      formNote.classList.remove('show');
      fileSelectedText.textContent = `✓ Selected: ${file.name} (${sizeMb} MB)`;
    } else {
      fileSelectedText.textContent = '';
    }
  });

  // Form Submission
  form.addEventListener('submit', async event => {
    event.preventDefault();
    formNote.classList.remove('show');
    formSuccess.classList.remove('show');

    const firstName = document.getElementById('applicantFirstName').value.trim();
    const lastName = document.getElementById('applicantLastName').value.trim();
    const email = document.getElementById('applicantEmail').value.trim();
    const phone = document.getElementById('applicantPhone').value.trim();
    const city = document.getElementById('applicantCity').value.trim();
    const state = document.getElementById('applicantState').value.trim();
    const pincode = document.getElementById('applicantPincode').value.trim();
    const resume = fileInput?.files?.[0];

    if (!firstName || !lastName || !email || !phone || !city || !state || !pincode) {
      formNote.textContent = 'Please fill in all required fields (marked with *).';
      formNote.classList.add('show');
      return;
    }

    if (!resume) {
      formNote.textContent = 'Please upload your resume file (PDF, DOC, or DOCX up to 10 MB).';
      formNote.classList.add('show');
      return;
    }

    const checkProblem = window.SainandForms ? window.SainandForms.problem(form) : '';
    if (checkProblem && checkProblem === window.SainandForms.CONSENT_MISSING) { formNote.classList.remove('show'); return; }
    if (checkProblem) {
      formNote.textContent = checkProblem;
      formNote.classList.add('show');
      return;
    }

    const formData = new FormData(form);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting application...';

    try {
      const response = await fetch('/api/careers/apply', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.refreshChallenge && window.SainandForms) window.SainandForms.refresh(form);
        throw new Error(result.error || 'Failed to submit application.');
      }

      formSuccess.innerHTML = `
        <strong>✓ Application Submitted Successfully!</strong><br>
        Thank you, <strong>${escapeHtml(firstName)}</strong>. We have received your application for <strong>${escapeHtml(formData.get('positionName'))}</strong>. A confirmation email has been dispatched to <strong>${escapeHtml(email)}</strong>. Our hiring team will review your profile.
      `;
      formSuccess.classList.add('show');
      form.reset();
      window.SainandForms?.reset(form);
      fileSelectedText.textContent = '';
      submitBtn.textContent = 'Application Submitted';

      setTimeout(() => {
        closeModal();
      }, 4500);
    } catch (err) {
      formNote.textContent = err.message || 'Unable to submit application. Please try again.';
      formNote.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Application';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  window.SainandForms?.attach(document.getElementById('careerForm'), { purpose: 'application' });
  loadOpenings();
  initCareerModal();
});
