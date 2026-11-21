/**
 * Structured data (JSON-LD) for Google, Bing and AI assistants. Invisible to visitors.
 * Built from config/site.js, so it always matches what the website shows.
 *   - every page: the company (FinancialService), the website, the page and its breadcrumb
 *   - home page: the leadership team as people
 *   - FAQ page: every published question and answer
 */
function lakhLabel(amount) {
  return amount >= 10000000 ? `₹${amount / 10000000} Crore` : `₹${amount / 100000} Lakh`;
}

function parseAddress(lines) {
  const [, street = '', last = ''] = lines || [];
  const postal = (last.match(/\b\d{6}\b/) || [])[0] || '';
  const [locality = '', region = ''] = last.replace(/[–-]\s*\d{6}.*/, '').split(',').map(part => part.trim());
  return {
    '@type': 'PostalAddress',
    streetAddress: street,
    addressLocality: locality,
    addressRegion: region,
    ...(postal ? { postalCode: postal } : {}),
    addressCountry: 'IN',
  };
}

function telephone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function organization(site, base) {
  const id = `${base}/#organization`;
  const contactPoints = [{
    '@type': 'ContactPoint',
    contactType: 'customer service',
    telephone: telephone(site.phone),
    email: site.email,
    areaServed: 'IN',
    availableLanguage: ['English', 'Hindi', 'Marathi'],
  }];
  if (site.grievanceOfficer?.phone) {
    contactPoints.push({
      '@type': 'ContactPoint',
      contactType: 'complaints',
      name: `Grievance Officer: ${site.grievanceOfficer.name}`,
      telephone: telephone(site.grievanceOfficer.phone),
      email: site.grievanceOfficer.email || site.email,
    });
  }
  const amounts = (site.plans || []).map(plan => plan.amount);
  const org = {
    '@type': ['FinancialService', 'Organization'],
    '@id': id,
    name: site.shortName,
    legalName: site.company,
    url: `${base}/`,
    logo: { '@type': 'ImageObject', url: `${base}/images/logo.png` },
    image: `${base}/images/og-image.jpg`,
    description: `${site.shortName} runs chit fund (Bhisi) savings groups in ${site.city}, with fixed monthly instalments and open, transparent monthly bidding (Boli).`,
    slogan: 'Secure your future with us',
    telephone: telephone(site.phone),
    email: site.email,
    address: parseAddress(site.address),
    areaServed: (site.areaServed || []).map(name => ({ '@type': name === 'Maharashtra' ? 'State' : 'City', name })),
    contactPoint: contactPoints,
    knowsAbout: ['Chit funds', 'Bhisi', 'Group savings', 'Chit Funds Act, 1982'],
    ...(amounts.length ? { priceRange: `${lakhLabel(Math.min(...amounts))} – ${lakhLabel(Math.max(...amounts))}` } : {}),
    currenciesAccepted: 'INR',
  };
  if (site.mapUrl) org.hasMap = site.mapUrl;
  if (site.openingHours) {
    org.openingHoursSpecification = [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: site.openingHours.days,
      opens: site.openingHours.opens,
      closes: site.openingHours.closes,
    }];
  }
  if (site.registrationNo) {
    org.identifier = { '@type': 'PropertyValue', name: `Chit fund registration number (${site.registeredUnder})`, value: site.registrationNo };
  }
  if ((site.socialProfiles || []).length) org.sameAs = site.socialProfiles;
  if (amounts.length) {
    org.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Bhisi (chit fund) plans',
      itemListElement: site.plans.map(plan => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'FinancialProduct', name: `${lakhLabel(plan.amount)} Bhisi`, description: `${lakhLabel(plan.amount)} chit fund group running for ${plan.months} months` },
      })),
    };
  }
  return org;
}

/**
 * @param {object} site      config/site.js
 * @param {string} base      https://sainandchits.com
 * @param {object} page      { path, name, title, description, faqs?: [{question, answer}], team?: true }
 */
function buildGraph(site, base, page) {
  const orgId = `${base}/#organization`;
  const url = `${base}${page.path === '/' ? '/' : page.path}`;
  const graph = [
    organization(site, base),
    {
      '@type': 'WebSite',
      '@id': `${base}/#website`,
      url: `${base}/`,
      name: site.shortName,
      publisher: { '@id': orgId },
      inLanguage: 'en-IN',
    },
  ];

  const crumbs = [{ name: 'Home', url: `${base}/` }];
  if (page.path !== '/') crumbs.push({ name: page.name, url });
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: crumb.url })),
  });

  const pageNode = {
    '@type': page.faqs?.length ? ['WebPage', 'FAQPage'] : (page.path === '/contact-us' ? 'ContactPage' : (page.path === '/about' ? 'AboutPage' : 'WebPage')),
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    isPartOf: { '@id': `${base}/#website` },
    about: { '@id': orgId },
    breadcrumb: { '@id': `${url}#breadcrumb` },
    inLanguage: 'en-IN',
  };
  if (page.faqs?.length) {
    pageNode.mainEntity = page.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    }));
  }
  graph.push(pageNode);

  if (page.team) {
    for (const person of site.team || []) {
      if (!person.name) continue;
      graph.push({
        '@type': 'Person',
        name: person.name,
        ...(person.role ? { jobTitle: person.role } : {}),
        ...(person.bio ? { description: person.bio } : {}),
        ...(person.photo ? { image: `${base}${person.photo}` } : {}),
        worksFor: { '@id': orgId },
      });
    }
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function jsonLdScript(site, base, page) {
  const json = JSON.stringify(buildGraph(site, base, page), null, 0).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

module.exports = { buildGraph, jsonLdScript, lakhLabel };
