/**
 * Comprehensive Test Suite for Razorpay Merchant Verification & 7-Day Trial Locking
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./api/_store');
const paymentHandler = require('./api/payment');

console.log('========================================================');
console.log('🧪 Starting Razorpay Verification & 7-Day Trial Tests...');
console.log('========================================================');

async function runTests() {
  let passed = 0;

  // Helper to make mock requests to payment handler
  function mockPaymentRequest(method, pathname, body = null) {
    return new Promise((resolve) => {
      const req = {
        method,
        url: pathname,
        headers: { host: 'localhost:3000' },
        on: (event, cb) => {
          if (event === 'data' && body) cb(JSON.stringify(body));
          if (event === 'end') cb();
        }
      };
      let statusCode = 200;
      let headers = {};
      let responseData = '';
      const res = {
        setHeader: (k, v) => { headers[k] = v; },
        writeHead: (code, h) => { statusCode = code; if (h) Object.assign(headers, h); },
        status: (code) => { statusCode = code; return res; },
        json: (data) => {
          responseData = JSON.stringify(data);
          resolve({ status: statusCode, data });
        },
        end: (chunk) => {
          if (chunk) responseData = chunk;
          try {
            resolve({ status: statusCode, data: JSON.parse(responseData) });
          } catch (e) {
            resolve({ status: statusCode, data: responseData });
          }
        }
      };
      paymentHandler(req, res);
    });
  }

  // 1. Reset / Check Razorpay test clinic in store
  console.log('1. Checking Razorpay test clinic in store...');
  store.updateSubscription('clinic_razorpay_verification', {
    plan: 'free',
    status: 'expired',
    trialDays: 7,
    trialStartDate: '2026-10-28T00:00:00.000Z',
    billingCycle: 'trial',
    amount: 0
  });
  const testClinic = store.getClinic('clinic_razorpay_verification');
  assert.ok(testClinic, 'clinic_razorpay_verification must exist');
  assert.strictEqual(testClinic.ownerEmail, 'razorpay.test@parchisetu.in');
  assert.strictEqual(testClinic.password, 'Razorpay@2026');
  assert.strictEqual(testClinic.subscription.plan, 'free');
  assert.strictEqual(testClinic.subscription.status, 'expired');
  console.log('✅ PASS: clinic_razorpay_verification exists with dummy credentials and expired 7-day trial');
  passed++;

  // 2. Check alias lookup for razorpay_test
  console.log('2. Checking alias lookup for razorpay_test...');
  const aliasClinic = store.getClinic('razorpay_test');
  assert.ok(aliasClinic, 'Lookup by alias razorpay_test must return verification clinic');
  assert.strictEqual(aliasClinic.id, 'clinic_razorpay_verification');
  console.log('✅ PASS: Alias razorpay_test correctly resolves clinic_razorpay_verification');
  passed++;

  // 3. GET /api/payment/config
  console.log('3. Testing GET /api/payment/config...');
  const configRes = await mockPaymentRequest('GET', '/api/payment/config');
  assert.strictEqual(configRes.status, 200);
  assert.ok(configRes.data.plans.monthly_pro, 'Must have monthly_pro plan');
  assert.strictEqual(configRes.data.plans.monthly_pro.amount, 399);
  assert.ok(configRes.data.plans.annual_pro, 'Must have annual_pro plan');
  assert.strictEqual(configRes.data.plans.annual_pro.amount, 4000);
  console.log('✅ PASS: GET /api/payment/config returns correct pricing (₹399 monthly, ₹4,000 annual)');
  passed++;

  // 4. POST /api/payment/create-order for Monthly
  console.log('4. Testing POST /api/payment/create-order (Monthly)...');
  const orderResMonthly = await mockPaymentRequest('POST', '/api/payment/create-order', {
    clinicId: 'clinic_razorpay_verification',
    plan: 'monthly_pro'
  });
  assert.strictEqual(orderResMonthly.status, 200);
  assert.strictEqual(orderResMonthly.data.amount, 39900); // in paise
  assert.ok(orderResMonthly.data.orderId, 'Order ID must be generated');
  console.log('✅ PASS: Order creation for Monthly returns ₹399 in paise (39900) and orderId');
  passed++;

  // 5. POST /api/payment/create-order for Annual
  console.log('5. Testing POST /api/payment/create-order (Annual)...');
  const orderResAnnual = await mockPaymentRequest('POST', '/api/payment/create-order', {
    clinicId: 'clinic_razorpay_verification',
    plan: 'annual_pro'
  });
  assert.strictEqual(orderResAnnual.status, 200);
  assert.strictEqual(orderResAnnual.data.amount, 400000); // 4000 INR = 400000 paise
  assert.ok(orderResAnnual.data.orderId, 'Order ID must be generated');
  console.log('✅ PASS: Order creation for Annual returns ₹4,000 in paise (400000) and orderId');
  passed++;

  // 6. POST /api/payment/verify - Unlocks clinic and activates subscription
  console.log('6. Testing POST /api/payment/verify...');
  const verifyRes = await mockPaymentRequest('POST', '/api/payment/verify', {
    clinicId: 'clinic_razorpay_verification',
    plan: 'monthly_pro',
    amount: 399,
    razorpay_payment_id: 'pay_test_razorpay_verification_123',
    razorpay_order_id: 'order_test_123',
    razorpay_signature: 'test_signature'
  });
  assert.strictEqual(verifyRes.status, 200);
  assert.strictEqual(verifyRes.data.success, true);
  assert.strictEqual(verifyRes.data.subscription.status, 'active');
  assert.strictEqual(verifyRes.data.subscription.plan, 'monthly_pro');
  assert.strictEqual(verifyRes.data.subscription.amount, 399);

  const updatedClinic = store.getClinic('clinic_razorpay_verification');
  assert.strictEqual(updatedClinic.subscription.status, 'active');
  assert.strictEqual(updatedClinic.subscription.plan, 'monthly_pro');
  console.log('✅ PASS: Payment verification successfully unlocks platform and sets active Pro subscription');
  passed++;

  // 7. Verify index.html contains Razorpay SDK, Dummy Credentials, Auto-Fill, and Paywall
  console.log('7. Testing HTML elements for Razorpay integration...');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  assert.ok(html.includes('https://checkout.razorpay.com/v1/checkout.js'), 'Must load Razorpay SDK');
  assert.ok(html.includes('razorpay.test@parchisetu.in'), 'Must display dummy email');
  assert.ok(html.includes('Razorpay@2026'), 'Must display dummy password');
  assert.ok(html.includes('autoFillRazorpayCredentials'), 'Must have auto-fill button handler');
  assert.ok(html.includes('id="modalTrialLock"'), 'Must define modalTrialLock paywall modal');
  assert.ok(html.includes('id="clinicSubscriptionBanner"'), 'Must define subscription header banner');
  assert.ok(html.includes('initiateRazorpayPayment'), 'Must define initiateRazorpayPayment');
  assert.ok(html.includes('checkClinicTrialAndLock'), 'Must define checkClinicTrialAndLock');
  assert.ok(html.includes('isPlatformLocked'), 'Must define isPlatformLocked guard');
  assert.ok(html.includes('₹399'), 'Must display ₹399 monthly price');
  assert.ok(html.includes('₹4,000'), 'Must display ₹4,000 annual price');
  assert.ok(html.includes('7-Day Free Trial'), 'Must enforce 7-Day Free Trial');
  console.log('✅ PASS: HTML contains all required Razorpay verification UI, checkout scripts & lock guards');
  passed++;

  console.log('========================================================');
  console.log(`🎉 All ${passed} Razorpay verification tests passed cleanly!`);
  console.log('========================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
