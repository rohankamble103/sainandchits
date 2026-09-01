/**
 * Sainand Chits enquiry email receiver.
 * Deploy as a Google Apps Script Web App.
 * The script owner authorizes Gmail access during deployment.
 */
const CONFIG = {
  recipientEmail: 'info@sainandchitfund.com',
};

function doPost(event) {
  try {
    const data = JSON.parse(event.postData.contents);

    const subject = `New enquiry from ${data.name || 'Website visitor'}`;
    const body = [
      `Name: ${data.name || ''}`,
      `Phone: ${data.phone || ''}`,
      `Email: ${data.email || ''}`,
      `Interested plan: ${data.plan || ''}`,
      '',
      'Message:',
      data.message || 'No message provided',
    ].join('\n');

    GmailApp.sendEmail(CONFIG.recipientEmail, subject, body, {
      replyTo: data.email || undefined,
      name: 'Sainand Chits Website',
    });

    GmailApp.sendEmail(
      data.email,
      'Thank you for contacting Sainand Chits India',
      [
        `Dear ${data.name || 'Customer'},`,
        '',
        'Thank you for your enquiry. We have received your request and our team will contact you soon.',
        '',
        `Interested plan: ${data.plan || 'Not specified'}`,
        '',
        'Regards,',
        'Sainand Chits India Pvt. Ltd.',
        CONFIG.recipientEmail,
      ].join('\n'),
      { name: 'Sainand Chits India' },
    );

    return jsonResponse_({ success: true });
  } catch (error) {
    return jsonResponse_({ success: false, error: error.message });
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
