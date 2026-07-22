// Brevo Email Service using REST API

const PLAN_DETAILS = {
  starter: {
    name: 'Launcher',
    features: ['1 outlet', '1 staff account', 'Order, menu, kitchen & table management', 'Analytics & reports', 'Email support'],
  },
  professional: {
    name: 'Growth',
    features: ['1 outlet', '2 staff accounts', 'All Launcher features', 'Mobile app access', 'Priority support'],
  },
  enterprise: {
    name: 'Expand',
    features: ['Unlimited outlets', 'Flexible staff scaling', 'Custom integrations', 'Dedicated support'],
  },
};

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function generateEmailHtml({ customerName, planType, periodMonths, amount, startDate, expiresAt }) {
  const plan = PLAN_DETAILS[planType] || PLAN_DETAILS.starter;
  const featuresHtml = plan.features.map(f => `<li style="margin: 8px 0; color: #4a5568;">${f}</li>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Confirmation - Flaze</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">🎉 Welcome to Flaze!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Your subscription is now active</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hi <strong>${customerName || 'there'}</strong>,
              </p>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                Thank you for choosing Flaze! Your payment has been successfully processed and your subscription is now active.
              </p>
              
              <!-- Plan Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="color: #2d3748; margin: 0 0 20px; font-size: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                      📋 Subscription Details
                    </h2>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #718096; font-size: 14px;">Plan</td>
                        <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600; text-align: right;">
                          ${plan.name}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #718096; font-size: 14px;">Duration</td>
                        <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600; text-align: right;">
                          ${periodMonths} ${periodMonths === 1 ? 'Month' : 'Months'}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #718096; font-size: 14px;">Amount Paid</td>
                        <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600; text-align: right;">
                          ${formatCurrency(amount)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #718096; font-size: 14px;">Start Date</td>
                        <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 600; text-align: right;">
                          ${formatDate(startDate)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #718096; font-size: 14px;">Valid Until</td>
                        <td style="padding: 8px 0; color: #48bb78; font-size: 14px; font-weight: 600; text-align: right;">
                          ${formatDate(expiresAt)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Features -->
              <h3 style="color: #2d3748; margin: 0 0 15px; font-size: 16px;">✨ Your Plan Includes:</h3>
              <ul style="margin: 0 0 30px; padding-left: 20px;">
                ${featuresHtml}
              </ul>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="https://flazee.com/dashboard" style="display: inline-block; background: linear-gradient(135deg, #FF4500 0%, #E80808 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 30px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 0 0 10px; text-align: center;">
                Need help? Contact us at <a href="mailto:connect@flazee.com" style="color: #FF4500; text-decoration: none;">connect@flazee.com</a>
              </p>
              <p style="color: #a0aec0; font-size: 12px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} Flaze - Restaurant Management Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendSubscriptionConfirmation({
  email,
  customerName,
  planType,
  periodMonths,
  amount,
  startDate,
  expiresAt,
}) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn('BREVO_API_KEY not configured, skipping subscription confirmation email');
    return { success: false, error: 'BREVO_API_KEY not configured' };
  }

  const plan = PLAN_DETAILS[planType] || PLAN_DETAILS.starter;

  const payload = {
    sender: { name: 'Flaze', email: 'connect@flazee.com' },
    to: [{ email, name: customerName || email }],
    replyTo: { email: 'connect@flazee.com', name: 'Flaze Support' },
    subject: `🎉 Welcome to Flaze ${plan.name} Plan!`,
    htmlContent: generateEmailHtml({
      customerName,
      planType,
      periodMonths,
      amount,
      startDate,
      expiresAt,
    }),
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    console.log('Subscription confirmation email sent:', email, data.messageId);
    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error('Failed to send subscription confirmation email:', err.message);
    return { success: false, error: err.message };
  }
}
