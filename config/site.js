/**
 * Company details shown on the public website — ONE place to edit.
 *
 * Everything marked "TODO" is placeholder text. Replace it with the real details;
 * the home page, every other page, the footer, the phone "Call / WhatsApp" bar,
 * the plan calculator and the chat assistant all read from this file.
 * After editing, restart the server (node server.js).
 */
module.exports = {
  company: 'Sainand Chits India Pvt. Ltd.',
  shortName: 'Sainand Chits India',
  city: 'Nagpur, Maharashtra',

  // ---- Contact ----
  phone: '+91 92724 60719',
  whatsapp: '+91 92724 60719', // change here if WhatsApp uses a different number
  email: 'support@sainandchits.com',
  hours: 'Monday – Saturday, 10:00 AM – 7:00 PM',
  // Shown on the Support Center page and in the Privacy Policy. Empty email = the office email above.
  grievanceOfficer: { name: 'Narendra Khilwani', email: '', phone: '+91 98230 98270' },
  address: ['Sainand Chits India Pvt. Ltd.', 'Midas Complex, Central Avenue', 'Nagpur, Maharashtra – 440001'], // TODO: confirm
  // Opening hours in 24-hour time, for Google and AI tools (keep in step with `hours` above).
  openingHours: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '10:00', closes: '19:00' },
  areaServed: ['Nagpur', 'Maharashtra'],
  // Links to your official pages elsewhere (Google Business Profile, Facebook, Instagram, YouTube, LinkedIn…).
  // Search engines use these to confirm they belong to the same company. Leave empty until they exist.
  socialProfiles: [],
  mapUrl: 'https://maps.app.goo.gl/BpGzV55ffQsVBGGP7',
  mapQuery: 'Sainand Chits India, Nagpur, Maharashtra', // used for the map on the Contact page

  // ---- Registration (shown only when filled in) ----
  registrationNo: '', // TODO: chit fund registration number, e.g. 'CF/NGP/2025/001'
  registeredUnder: 'Chit Funds Act, 1982',
  yearsOfService: 10, // the organisation's years of service

  // ---- Numbers bar on the home page (keep these honest; change when you have real figures) ----
  stats: [
    { value: 10, suffix: '+', label: 'Years of service' },
    { value: 100, suffix: '+', label: 'Families served' }, // TODO: real figure
    { value: 6, suffix: '', label: 'Bhisi plans' },
    { value: 100, suffix: '%', label: 'Transparent bidding' },
  ],

  // ---- Plans ----
  // Each plan runs for `months` months. The group has `months` members + 1 company share,
  // so the monthly share = plan amount ÷ (months + 1). Example: ₹25 Lakh, 24 months → ÷ 25 = ₹1,00,000.
  // Commission = commissionPercent of that monthly share (₹7,000 for ₹25 Lakh), added every month.
  // Months 1 and 2: share + commission. From month 3: (amount the Bhisi is taken at ÷ group) + commission.
  commissionPercent: 7,
  fixedMonths: 2,
  plans: [
    { amount: 500000, months: 24 },
    { amount: 1000000, months: 24 },
    { amount: 1500000, months: 24 },
    { amount: 2500000, months: 24, featured: true },
    { amount: 5000000, months: 49 },
    { amount: 10000000, months: 49 },
  ],

  // ---- Banners at the top of the home page (cleaned copies in images/banners) ----
  // A banner is shown only when its plan is in the plans list above (so the 50 Lakh banner stays hidden
  // until you add a 50 Lakh plan). Set plan: 0 for a banner that should always show.
  banners: [
    { image: '/images/banners/bhisi-5-lakh', plan: 500000, alt: '5 Lakh Bhisi — secure savings, transparent bidding' },
    { image: '/images/banners/bhisi-10-lakh', plan: 1000000, alt: '10 Lakh Bhisi — professional savings scheme' },
    { image: '/images/banners/bhisi-15-lakh', plan: 1500000, alt: '15 Lakh Bhisi — chit fund savings scheme' },
    { image: '/images/banners/bhisi-25-lakh', plan: 2500000, alt: '25 Lakh Bhisi — premium chit fund savings scheme' },
    { image: '/images/banners/bhisi-50-lakh', plan: 5000000, alt: '50 Lakh Bhisi' },
  ],

  // ---- Leadership (6 people). Sample details — replace with the real team. ----
  // photo: put the image in the images folder and write e.g. '/images/team-1.webp'. Leave '' to show initials.
  // Leadership section on the home page. role/bio: fill in when confirmed (empty = not shown).
  // TODO: 6th member (photo + name) to be added.
  team: [
    { name: 'Ajay Meshram', role: 'Chairman & Managing Director', photo: '/images/team/ajay-meshram.webp', bio: 'Calm, thoughtful and always ready to listen, Ajay leads Sainand Chits India with a fresh outlook and clear values. For more than ten years he has guided families with patience, honest answers and genuine care.' },
    { name: 'Narendra Khilwani', role: 'Director – Governance & Compliance', photo: '/images/team/narendra-khilwani.webp', bio: 'Practical, sharp and principled, Narendra makes sure every group runs by the rules and every rupee is accounted for. For over a decade he has helped members save with complete peace of mind.' },
    { name: 'Bhujang Motghare', role: 'Director – Finance & Accounts', photo: '/images/team/bhujang-motghare.webp', bio: 'A steady, respected presence whose word is his bond. His years of experience and simple, honest values guide the team in keeping every promise we make to our members.' },
    { name: 'Bhushan Giripunje', role: 'Director – Member Relations & Operations', photo: '/images/team/bhushan-giripunje.webp', bio: 'A warm, people-first businessman who has spent over a decade helping families save with confidence. Known for his open door and honest advice, he treats every member’s trust as a personal responsibility.' },
    { name: 'Prashant Deharkar', role: 'Director – Business Development', photo: '/images/team/prashant-deharkar.webp', bio: 'Friendly, approachable and rooted in strong values, Prashant connects easily with every family who walks in. His dedication and kind heart make members feel they are dealing with family, not a company.' },
  ],
};
