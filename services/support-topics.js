/** Topics in the "What do you need help with?" list on the Support Center page.
 *  enquiry: true  -> also added to Enquiries (tagged "Support request") for the sales team.
 *  priority: true -> highlighted on the admin Support page and emailed to the admins.
 *  withdraw: true -> the matching customer is marked "Consent withdrawn – do not contact" straight away. */
const SUPPORT_TOPICS = [
  { id: 'plan', label: 'Plan details / choosing a plan', enquiry: true },
  { id: 'joining', label: 'Joining and documents', enquiry: true },
  { id: 'payment', label: 'Monthly payment' },
  { id: 'bidding', label: 'Bidding (Boli)' },
  { id: 'payout', label: 'Receiving my Bhisi' },
  { id: 'statement', label: 'Statement or account details' },
  { id: 'update_details', label: 'Update my details (phone, address, nominee)' },
  { id: 'complaint', label: 'Complaint', priority: true },
  { id: 'privacy', label: 'Withdraw my consent / stop contacting me', priority: true, withdraw: true },
  { id: 'other', label: 'Other' },
];

module.exports = { SUPPORT_TOPICS };
