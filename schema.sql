CREATE TABLE IF NOT EXISTS enquiries (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(254) NOT NULL,
  plan VARCHAR(180) NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  follow_up_1 TEXT NOT NULL DEFAULT '',
  follow_up_2 TEXT NOT NULL DEFAULT '',
  follow_up_3 TEXT NOT NULL DEFAULT '',
  admin_notes TEXT NOT NULL DEFAULT '',
  contact_key VARCHAR(254) NOT NULL DEFAULT '',
  phone_key VARCHAR(40) NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL DEFAULT '',
  chat_transcript JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS news_posts (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category VARCHAR(20) NOT NULL CHECK (category IN ('youtube', 'instagram', 'news')),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS site_pages (
  slug VARCHAR(60) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  intro VARCHAR(500) NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_faqs (
  id SERIAL PRIMARY KEY,
  question VARCHAR(240) NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_items (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_certificates (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_name VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS enquiries_created_at_idx ON enquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_contact_key_idx ON enquiries (contact_key);
CREATE INDEX IF NOT EXISTS enquiries_phone_key_idx ON enquiries (phone_key);
CREATE INDEX IF NOT EXISTS enquiries_dedupe_key_idx ON enquiries (dedupe_key);
CREATE INDEX IF NOT EXISTS news_posts_category_created_at_idx ON news_posts (category, created_at DESC);
CREATE INDEX IF NOT EXISTS site_faqs_sort_order_idx ON site_faqs (sort_order, id);
CREATE INDEX IF NOT EXISTS support_items_sort_order_idx ON support_items (sort_order, id);
CREATE INDEX IF NOT EXISTS site_certificates_sort_order_idx ON site_certificates (sort_order, id);

INSERT INTO site_pages (slug, title, intro, body)
VALUES
  ('faq', 'Frequently asked questions', 'Clear answers about Bhisi savings, bidding, documents, and membership.', 'Have a question about how Sainand Chits works? Start with the answers below, or contact our team for help with your specific situation.'),
  ('contact-us', 'Contact Sainand Chits India', 'Our team is here to answer your questions about Bhisi savings and membership.', 'Call us at +91 98765 43210 or email info@sainandchitfund.com. Our office is in Nagpur, Maharashtra, and our support team is available Monday to Saturday, 10:00 AM to 7:00 PM IST.'),
  ('support-center', 'Support Center', 'Find the right way to get help with your enquiry, documents, or member support.', 'Choose a support option below and our team will guide you through the next step. For urgent assistance, call us directly during office hours.'),
  ('privacy-policy', 'Privacy Policy', 'How Sainand Chits India handles information shared through this website.', 'We use the information you submit through our enquiry forms to respond to your request, explain relevant Bhisi plans, and provide member support. We do not sell your personal information. You can contact us to ask about information associated with your enquiry or to request an update.'),
  ('authorized-certificates', 'Authorized Certificates', 'Company certificates and documents published by Sainand Chits India.', 'The documents below are shared for transparency and reference. Please contact our office if you need help verifying a document or require a current copy.'),
  ('terms-and-conditions', 'Terms & Conditions', 'The terms that apply when you use this website and submit an enquiry.', 'Information on this website is provided for general guidance and does not replace the written terms of a Bhisi group or a direct confirmation from Sainand Chits India. Plan availability, eligibility, fees, bidding rules, and documentation must be confirmed with our team before joining.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO site_faqs (question, answer, sort_order)
SELECT 'What is a Bhisi?', 'A Bhisi is a group savings arrangement where members contribute a fixed monthly instalment and one member receives the pooled amount each month through the agreed bidding process.', 10
WHERE NOT EXISTS (SELECT 1 FROM site_faqs WHERE question = 'What is a Bhisi?');

INSERT INTO site_faqs (question, answer, sort_order)
SELECT 'How do I choose a plan?', 'Choose a plan based on the amount you need and the monthly instalment you can comfortably manage. Our team can explain current availability and eligibility before you decide.', 20
WHERE NOT EXISTS (SELECT 1 FROM site_faqs WHERE question = 'How do I choose a plan?');

INSERT INTO site_faqs (question, answer, sort_order)
SELECT 'How can I contact the Sainand Chits team?', 'Call +91 98765 43210, email info@sainandchitfund.com, or send an enquiry through the website.', 30
WHERE NOT EXISTS (SELECT 1 FROM site_faqs WHERE question = 'How can I contact the Sainand Chits team?');

INSERT INTO support_items (title, description, link_url, sort_order)
SELECT 'Plan and eligibility help', 'Ask about current Bhisi plans, monthly instalments, eligibility, and required documents.', '/#contact', 10
WHERE NOT EXISTS (SELECT 1 FROM support_items WHERE title = 'Plan and eligibility help');

INSERT INTO support_items (title, description, link_url, sort_order)
SELECT 'Member support', 'Contact our team for help with bidding, statements, account questions, or follow-up.', 'tel:+919876543210', 20
WHERE NOT EXISTS (SELECT 1 FROM support_items WHERE title = 'Member support');

INSERT INTO support_items (title, description, link_url, sort_order)
SELECT 'Office and document verification', 'Reach us directly if you need help verifying a certificate or visiting our Nagpur office.', '/contact-us', 30
WHERE NOT EXISTS (SELECT 1 FROM support_items WHERE title = 'Office and document verification');