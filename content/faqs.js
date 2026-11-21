/**
 * Website FAQs. Each answer starts with a short, direct answer (shown in bold on the FAQ page),
 * then a blank line, then the detail. Google and AI assistants quote the short answer.
 * These are added once to the database; after that, staff edit them in Admin → Website → FAQs.
 */
module.exports = [
  {
    key: 'what-is',
    sort: 10,
    replaces: { question: 'What is a Bhisi?', answer: 'A Bhisi is a group savings arrangement where members contribute a fixed monthly instalment and one member receives the pooled amount each month through the agreed bidding process.' },
    question: 'What is a chit fund (Bhisi)?',
    answer: `A chit fund, called a Bhisi in Maharashtra, is a group savings scheme: a fixed group of members pays an equal amount every month, and each month one member receives the collected amount.

It combines saving and borrowing in one plan. Every member receives the pooled amount once during the group's term, and who receives it in a given month is decided by open bidding (Boli) among the members who need the money that month. By the end of the term, every member has both paid in and received the Bhisi.

At Sainand Chits India, our team runs each group, keeps the records, and explains every step to members before they join.`,
  },
  {
    key: 'safe-legal',
    sort: 12,
    question: 'Is a chit fund safe and legal in India?',
    answer: `Yes. Chit funds are legal in India when they are run by a registered company under the Chit Funds Act, 1982, and supervised by the state's Registrar of Chits.

Under the Act, a chit company must get approval for each group before it starts, and must keep a security deposit for the group, which protects members' money. Informal Bhisis run among friends or neighbours do not have this protection.

Before joining any chit fund, check three things: the company's registration, a written agreement for your group, and a receipt for every payment you make.

Sainand Chits India Pvt. Ltd. runs its groups under the Chit Funds Act, 1982. You can see our certificates on the Certificates page, and our team will gladly show you the registration details for your group.`,
  },
  {
    key: 'auction',
    sort: 14,
    question: 'How does the monthly auction (Boli) work?',
    answer: `Each month, the members who need money bid for that month's Bhisi. It goes to the member who agrees to take it at the lowest amount, and that difference lowers every member's instalment for the month.

1. Everyone pays the same: each month, every member pays an equal instalment into the pool.
2. Bidding decides who takes it: members who need the money that month bid for the Bhisi through open bidding (Boli). A member who has already received the Bhisi does not bid again.
3. A lower bid means everyone pays less: when the Bhisi is taken at a lower amount, every member's instalment for that month comes down.
4. Members who take it later, when fewer people are bidding, usually receive closer to the full plan amount.

Our team explains the exact monthly amount for your plan on a free call before you decide.`,
  },
  {
    key: 'nagpur',
    sort: 16,
    question: 'Where can I join a chit fund (Bhisi) in Nagpur?',
    answer: `You can join a Bhisi group with Sainand Chits India, a Nagpur-based chit fund company that has helped families save for over 10 years.

We run Bhisi plans from ₹5 Lakh to ₹1 Crore for families and businesses in and around Nagpur. To join or ask a question:
• Call or WhatsApp +91 92724 60719 (Monday to Saturday, 10 AM to 7 PM)
• Visit our office (the address and map are on the Contact page)
• Send an enquiry on this website, and our team will call you back`,
  },
  {
    key: 'choose-plan',
    sort: 20,
    question: 'How do I choose a plan?',
    answer: 'Choose a plan based on the amount you need and the monthly instalment you can comfortably manage. Our team can explain current availability and eligibility before you decide.',
  },
  {
    key: 'contact',
    sort: 30,
    question: 'How can I contact the Sainand Chits team?',
    answer: 'Call +91 92724 60719, email support@sainandchits.com, or send an enquiry through the website.',
  },
];
