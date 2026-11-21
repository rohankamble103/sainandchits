/**
 * Privacy Policy for the public website (/privacy-policy).
 * Written for Sainand Chits India Pvt. Ltd. Company details come from config/site.js.
 * Format: blank line between paragraphs, "## " for a heading, "- " for a bullet point.
 * Staff can also replace this text from Admin → Site pages; a saved version there takes priority.
 */
module.exports = function privacyPolicy(site) {
  const office = site.address.join(', ');
  return `Last updated: 5 November 2026

This Privacy Policy explains how ${site.company} ("Sainand Chits", "we", "us" or "our") collects, uses, stores and protects your personal information when you visit our website, send us an enquiry, chat with our website assistant, apply for a job, or speak with our team. Where we rely on your consent, we ask for it separately on each form, next to a short notice explaining how your details will be used.

## 1. Who we are
${site.company} runs registered Bhisi (chit fund) savings groups from ${site.city}. For this policy, we are the organisation that decides how and why your personal information is used.

Office: ${office}
Email: ${site.email}
Phone: ${site.phone}

## 2. Information we collect
Information you give us on this website:
- Enquiry forms: your name, mobile number, email address, the plan you are interested in, and any message you write.
- Your consent: a record that you agreed to be contacted, with the date and time.
- Website chat assistant ("Sai"): the questions you type and, if you ask for a callback, your name, mobile number and email.
- Job applications: your name, contact details, the role you applied for, your résumé and anything else you choose to send.

Information we record when we contact you:
- Notes from our calls, emails and messages with you, scheduled call-backs, and the status of your enquiry, so that our team can help you properly.

Information collected automatically:
- Basic technical details such as your IP address, browser type and the time of your visit. We use these to protect our forms from spam and misuse and to keep the website secure.

Information we do NOT ask for on this website:
- We do not ask for Aadhaar, PAN, bank account, card or other financial details through this website or the chat assistant. Please do not share them there. If you decide to join a Bhisi group, any identity or financial documents required by law are collected separately at the time of joining.

## 3. How we use your information
- To reply to your enquiry and explain our Bhisi plans by phone, email, SMS or WhatsApp.
- To schedule and make call-backs you have asked for.
- To send you a confirmation email when you submit an enquiry.
- To answer your questions through the website chat assistant.
- To consider your job application and contact you about it.
- To keep accurate records of our conversations with you.
- To protect our website from spam, fraud and misuse.
- To meet our legal and regulatory obligations, including those under the Chit Funds Act, 1982.
- With your consent, to tell you about new Bhisi groups or services. You can ask us to stop at any time.

## 4. Who we share your information with
We do not sell, rent or trade your personal information.

We share it only with:
- Our own staff, who see only what they need to help you.
- Trusted service providers who help us run the website and our business, such as website hosting, database storage, email delivery and the service that powers our chat assistant. They may use your information only to provide their service to us.
- Some of these providers, such as the service that powers our chat assistant, may process information on servers outside India. We use only providers that protect it, and only as allowed under Indian law.
- Government, regulatory or law-enforcement authorities, courts or the Registrar of Chits, when the law requires it.
- Professional advisers such as auditors and lawyers, where needed to protect our legal rights or defend a claim.

Our News page may show YouTube or Instagram videos, and our Contact page may show a Google Map. When you view these, those companies may collect information under their own privacy policies.

## 5. Cookies
Our public website does not use advertising or tracking cookies. A small security cookie is used only when our staff sign in to the admin area. Embedded videos and maps described above may set their own cookies.

## 6. How we protect your information
- Our website uses a secure, encrypted (https) connection.
- Your enquiry is stored in a protected database that only authorised staff can access, using individual passwords and optional two-step sign-in.
- Uploaded résumés can be opened only by signed-in staff.
- Our staff are required to keep customer information confidential.

No method of storage or transfer over the internet is completely secure, but we take reasonable steps to protect your information and will act promptly if a problem occurs, including informing you and the authorities where the law requires it.

## 7. How long we keep your information
We keep your information only for as long as we need it:
- Enquiries and call notes: while we are helping you, and for a reasonable period afterwards so we can answer any follow-up questions.
- Job applications: for as long as needed to fill the role and for a reasonable period afterwards, unless you ask us to delete them sooner.
- Member records: for the period required by the Chit Funds Act, 1982 and other applicable laws.

When information is no longer needed, we delete it or make it anonymous.

## 8. Your rights
Under applicable Indian law, including the Digital Personal Data Protection Act, 2023, you can:
- Ask what personal information we hold about you.
- Ask us to correct or update information that is wrong or incomplete.
- Ask us to delete your information, unless we must keep it by law.
- Withdraw your consent at any time. The easiest way is our Support Center (choose "Withdraw my consent / stop contacting me"), or email ${site.email}. Once you withdraw, we stop contacting you and cancel any planned calls. Withdrawing does not affect anything we did with your consent before that.
- Nominate another person to use these rights on your behalf if you die or become unable to do so.
- Raise a concern or complaint with us about how your information is handled.

To use any of these rights, use our Support Center, email ${site.email} or call ${site.phone}. We may need to confirm your identity before acting on your request. We will reply as soon as reasonably possible, and within 90 days at the latest.

## 9. Children
Our services are meant for adults. We do not knowingly collect personal information from anyone under 18. If you believe a child has sent us their details, please contact us and we will delete them.

## 10. Keeping yourself safe
- Our team will never ask for your passwords, OTPs or card PIN by phone, SMS, email or WhatsApp.
- Make all payments only through the official methods confirmed at our office.
- If you receive a suspicious message using our name, please contact us before responding.

## 11. Changes to this policy
We may update this Privacy Policy from time to time. The latest version will always be on this page, with the date it was last updated at the top.

## 12. Contact and grievances
If you have any question, request or complaint about your personal information, please contact our Grievance Officer:

${site.grievanceOfficer && site.grievanceOfficer.name ? `${site.grievanceOfficer.name}, Grievance Officer` : 'Grievance Officer'}, ${site.company}
${office}
Email: ${(site.grievanceOfficer && site.grievanceOfficer.email) || site.email}
Phone: ${(site.grievanceOfficer && site.grievanceOfficer.phone) || site.phone}
Hours: ${site.hours}

If you are not satisfied with our reply, you have the right to complain to the Data Protection Board of India.`;
};
