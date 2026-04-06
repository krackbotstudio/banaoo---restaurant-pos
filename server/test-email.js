// Test script to verify Brevo email service is working
// Run with: node test-email.js

import 'dotenv/config';
import { sendSubscriptionConfirmation } from './email.js';

async function testEmailService() {
  console.log('\n📧 Testing Brevo Email Service\n');
  console.log('─'.repeat(50));

  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  // Check if API key is configured
  if (!BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY is not configured in .env');
    console.log('\nAdd this to your server/.env file:');
    console.log('BREVO_API_KEY=your_brevo_api_key_here');
    process.exit(1);
  }

  console.log('✅ BREVO_API_KEY is configured');
  console.log(`   Key: ${BREVO_API_KEY.substring(0, 8)}...${BREVO_API_KEY.slice(-4)}`);

  // Test email data
  const testEmail = {
    email: 'weyoudev2026@gmail.com',
    customerName: 'Navya (Test)',
    planType: 'professional',
    periodMonths: 3,
    amount: 7497,
    startDate: new Date(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
  };

  console.log(`\n📬 Sending test email to: ${testEmail.email}`);
  console.log(`   Plan: ${testEmail.planType}`);
  console.log(`   Duration: ${testEmail.periodMonths} months`);
  console.log(`   Amount: ₹${testEmail.amount}`);

  try {
    const result = await sendSubscriptionConfirmation(testEmail);

    if (result.success) {
      console.log('\n' + '─'.repeat(50));
      console.log('✅ Email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`\n📥 Check inbox at: ${testEmail.email}\n`);
    } else {
      console.error('\n❌ Failed to send email:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testEmailService();
