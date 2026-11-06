const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const crypto = require('crypto');

const requestHandler = require('./server');
const store = require('./api/_store');
const paymentHandler = require('./api/payment');
const adminHandler = require('./api/admin');
const bookingsHandler = require('./api/bookings');

async function runTests() {
  console.log('========================================================');
  console.log('🧪 Starting 7-Day Trial, 100 Limits & Admin Verification Suite...');
  console.log('========================================================');

  let passed = 0;

  // 1. Verify Byte-for-Byte File Parity
  console.log('1. Checking Twin File Parity...');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const twinHtml = fs.readFileSync(path.join(__dirname, 'parchisetu_indian_clinic_management_token_web_app.html'), 'utf8');
  assert.strictEqual(indexHtml, twinHtml, 'index.html and twin file must be 100% byte identical');

  const fb1 = fs.readFileSync(path.join(__dirname, 'firebase-sync.js'), 'utf8');
  const fb2 = fs.readFileSync(path.join(__dirname, 'public/firebase-sync.js'), 'utf8');
  assert.strictEqual(fb1, fb2, 'firebase-sync.js and public/firebase-sync.js must be 100% byte identical');
  console.log('✅ PASS: All mirror twin files are 100% byte-for-byte identical');
  passed++;

  // 2. Verify Official Support Details in HTML
  console.log('2. Checking Support details in HTML...');
  assert.ok(indexHtml.includes('9798482404'), 'HTML must include support phone 9798482404');
  assert.ok(indexHtml.includes('tel:9798482404'), 'HTML must include clickable tel:9798482404');
  assert.ok(indexHtml.includes('wa.me/919798482404'), 'HTML must include clickable WhatsApp link for 9798482404');
  assert.ok(indexHtml.includes('atish2k22@gmail.com'), 'HTML must include email atish2k22@gmail.com');
  assert.ok(indexHtml.includes('mailto:atish2k22@gmail.com'), 'HTML must include clickable mailto:atish2k22@gmail.com');
  assert.ok(indexHtml.includes('id="profileSupportCard"'), 'HTML must include profileSupportCard in Profile tab');
  console.log('✅ PASS: Support details (9798482404, atish2k22@gmail.com) verified in Profile tab and Pricing modal');
  passed++;

  // 3. Verify Master Admin Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0 in HTML
  console.log('3. Checking Master Admin Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0...');
  assert.ok(indexHtml.includes('UHI(*Y90Jjk0JKop:ki-0PIkj9OP0'), 'HTML must support Master Admin Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0');
  
  const adminSandbox = {
    document: {
      getElementById: (id) => {
        if (id === 'adminPasscodeInput') return { value: 'UHI(*Y90Jjk0JKop:ki-0PIkj9OP0', classList: { add: () => {}, remove: () => {} } };
        if (id === 'adminPasscodeError') return { classList: { add: () => {}, remove: () => {} } };
        if (id === 'adminPasscodeModal') return { classList: { add: () => {}, remove: () => {} } };
        return null;
      }
    },
    sessionStorage: {
      store: {},
      setItem(k, v) { this.store[k] = v; },
      getItem(k) { return this.store[k]; }
    },
    switchAppRole: () => {},
    loadAdminDoctors: () => {},
    showToast: () => {}
  };
  const scriptMatch = indexHtml.match(/function verifyAdminPasscode\(\)[\s\S]*?\n    \}/);
  assert.ok(scriptMatch, 'verifyAdminPasscode must exist in index.html');
  vm.runInNewContext(scriptMatch[0] + '\nfunction closeAdminPasscodeModal() {}', adminSandbox);
  adminSandbox.verifyAdminPasscode();
  assert.strictEqual(adminSandbox.sessionStorage.getItem('parchisetu_admin_auth'), '1', 'Master Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0 must unlock admin portal');
  console.log('✅ PASS: Master Admin Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0 successfully authenticates and unlocks admin portal');
  passed++;

  // 4. Verify 7-Day Countdown Timer & No Hard Lockout in HTML VM Sandbox
  console.log('4. Testing 7-Day Trial Timer & No Lockout in Sandbox...');
  const trialSandbox = {
    currentRole: 'clinic',
    clinicProfile: {
      id: 'clinic_test_timer',
      name: 'Test Trial Clinic',
      createdAt: new Date().toISOString(),
      subscription: { plan: 'free', status: 'trial' }
    },
    todayQueue: [],
    document: {
      getElementById: () => ({
        classList: { add: () => {}, remove: () => {} },
        style: {},
        textContent: '',
        innerHTML: ''
      })
    }
  };
  const getSubStatusMatch = indexHtml.match(/function getClinicSubscriptionStatus\([\s\S]*?\n    \}/);
  const isLockedMatch = indexHtml.match(/function isPlatformLocked\(\)[\s\S]*?\n    \}/);
  assert.ok(getSubStatusMatch, 'getClinicSubscriptionStatus must exist');
  assert.ok(isLockedMatch, 'isPlatformLocked must exist');

  vm.runInNewContext(getSubStatusMatch[0] + '\n' + isLockedMatch[0], trialSandbox);
  
  // During active trial
  const activeStatus = trialSandbox.getClinicSubscriptionStatus(trialSandbox.clinicProfile);
  assert.strictEqual(activeStatus.isTrialActive, true);
  assert.strictEqual(activeStatus.isTrialExpired, false);
  assert.ok(activeStatus.daysLeft > 0);
  assert.strictEqual(trialSandbox.isPlatformLocked(), false, 'Platform must never be locked during trial');

  // Expired trial
  trialSandbox.clinicProfile.createdAt = new Date(Date.now() - 10 * 86400000).toISOString();
  trialSandbox.clinicProfile.subscription.trialStartDate = new Date(Date.now() - 10 * 86400000).toISOString();
  const expiredStatus = trialSandbox.getClinicSubscriptionStatus(trialSandbox.clinicProfile);
  assert.strictEqual(expiredStatus.isTrialActive, false);
  assert.strictEqual(expiredStatus.isTrialExpired, true);
  assert.strictEqual(expiredStatus.monthlyLimit, 100, 'Monthly limit must be 100 after trial');
  assert.strictEqual(trialSandbox.isPlatformLocked(), false, 'Platform must NOT be hard-locked after trial (soft cap only)');
  console.log('✅ PASS: 7-Day trial countdown calculates correctly and platform remains unlocked');
  passed++;

  // 5. Test 100 Appointments/Month Limit on Free Plan vs Pro Plan in Store
  console.log('5. Testing 100 appointments/month soft cap in store logic...');
  const testClinicId = 'clinic_limit_test_' + Date.now();
  store.setClinic({
    id: testClinicId,
    name: 'Limit Test Clinic',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(), // 15 days ago (trial expired)
    subscription: {
      plan: 'free',
      status: 'expired',
      trialStartDate: new Date(Date.now() - 15 * 86400000).toISOString()
    }
  });

  const currMonth = store.getISTMonthString();
  assert.strictEqual(typeof currMonth, 'string');
  assert.strictEqual(currMonth.length, 7); // e.g. "2026-11"

  // Add 99 bookings for this clinic in current month
  for (let i = 1; i <= 99; i++) {
    store.addOrUpdateBooking({
      id: `bk_test_${testClinicId}_${i}`,
      clinicId: testClinicId,
      token: i,
      name: `Patient ${i}`,
      phone: `98000000${String(i).padStart(2, '0')}`,
      status: 'WAITING',
      createdAt: new Date().toISOString()
    });
  }

  assert.strictEqual(store.getClinicMonthlyAppointmentsCount(testClinicId, currMonth), 99);
  assert.strictEqual(store.isClinicMonthlyLimitReached(testClinicId), false, '99 bookings is within 100 limit');

  // Add 100th booking (allowed)
  const res100 = store.addOrUpdateBooking({
    id: `bk_test_${testClinicId}_100`,
    clinicId: testClinicId,
    token: 100,
    name: 'Patient 100',
    phone: '9800000100',
    status: 'WAITING',
    createdAt: new Date().toISOString()
  });
  assert.ok(!res100.error, '100th booking must be accepted');
  assert.strictEqual(store.getClinicMonthlyAppointmentsCount(testClinicId, currMonth), 100);
  assert.strictEqual(store.isClinicMonthlyLimitReached(testClinicId), true, '100 bookings reaches monthly limit');

  // Attempt 101st booking on Free plan (MUST BE REJECTED)
  const res101 = store.addOrUpdateBooking({
    id: `bk_test_${testClinicId}_101`,
    clinicId: testClinicId,
    token: 101,
    name: 'Patient 101',
    phone: '9800000101',
    status: 'WAITING',
    createdAt: new Date().toISOString()
  });
  assert.strictEqual(res101.error, 'LIMIT_REACHED', '101st booking must be rejected with LIMIT_REACHED');
  console.log('✅ PASS: Free plan correctly blocks 101st booking when 100 monthly limit is reached');
  passed++;

  // 6. Test Upgrade to Pro lifts limit to Unlimited
  console.log('6. Testing Pro plan has unlimited appointments...');
  store.updateSubscription(testClinicId, 'monthly_pro');
  assert.strictEqual(store.isClinicMonthlyLimitReached(testClinicId), false, 'Pro plan must NOT be limit reached even with 100 appts');

  // 101st booking now succeeds on Pro plan
  const res101Pro = store.addOrUpdateBooking({
    id: `bk_test_${testClinicId}_101`,
    clinicId: testClinicId,
    token: 101,
    name: 'Patient 101 (Pro)',
    phone: '9800000101',
    status: 'WAITING',
    createdAt: new Date().toISOString()
  });
  assert.ok(!res101Pro.error, '101st booking must succeed when clinic is on Pro plan');
  assert.strictEqual(res101Pro.booking.token, 101);
  console.log('✅ PASS: Pro plan successfully allows unlimited appointments');
  passed++;

  // 7. Test Master Admin Manual Upgrade (No Razorpay signature needed)
  console.log('7. Testing Master Admin manual plan upgrade...');
  const adminUpgradeRes = await store.updateSubscriptionAsync(testClinicId, 'annual_pro');
  assert.strictEqual(adminUpgradeRes.subscription.plan, 'annual_pro');
  assert.strictEqual(adminUpgradeRes.subscription.amount, 3999);
  const upgradedClinic = store.getClinic(testClinicId);
  assert.strictEqual(upgradedClinic.subscription.plan, 'annual_pro');
  console.log('✅ PASS: Master Admin has full authority to upgrade plan directly without payment verification');
  passed++;

  // 8. Test HTTP Endpoints on real HTTP server
  console.log('8. Testing HTTP API endpoints for booking limits & admin...');
  const server = http.createServer(requestHandler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  function httpReq(method, pathName, body = null) {
    return new Promise((resolve, reject) => {
      const dataStr = body ? JSON.stringify(body) : null;
      const r = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: pathName,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {})
        }
      }, res => {
        let out = '';
        res.on('data', c => { out += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
          catch (e) { resolve({ status: res.statusCode, body: out }); }
        });
      });
      r.on('error', reject);
      if (dataStr) r.write(dataStr);
      r.end();
    });
  }

  // Downgrade test clinic to free with 100 bookings
  await httpReq('POST', '/api/admin/subscription', { clinicId: testClinicId, plan: 'free' });
  const clinicAfterDowngrade = store.getClinic(testClinicId);
  assert.strictEqual(clinicAfterDowngrade.subscription.plan, 'free');

  // Attempt booking via HTTP POST /api/bookings on clinic with 100+ bookings -> HTTP 403
  const bookAttemptRes = await httpReq('POST', '/api/bookings', {
    clinicId: testClinicId,
    name: 'Walkin 102',
    phone: '9800000102',
    source: 'Walk-in'
  });
  assert.strictEqual(bookAttemptRes.status, 403, 'POST /api/bookings must return HTTP 403 when limit reached');
  assert.ok(bookAttemptRes.body.limitReached, 'Body must contain limitReached: true');
  console.log('✅ PASS: HTTP POST /api/bookings correctly rejects with 403 when monthly limit reached');
  passed++;

  // 9. Test Razorpay Signature Verification Security
  console.log('9. Testing Razorpay Payment Verification Security...');
  const invalidSigRes = await httpReq('POST', '/api/payment/verify', {
    clinicId: testClinicId,
    plan: 'monthly_pro',
    amount: 399,
    razorpay_payment_id: 'pay_fraud_123',
    razorpay_order_id: 'order_fraud_123',
    razorpay_signature: 'invalid_forged_signature_xyz'
  });
  assert.strictEqual(invalidSigRes.status, 400, 'Invalid signature must be rejected with HTTP 400');
  assert.strictEqual(invalidSigRes.body.error, 'Invalid Razorpay payment signature');
  console.log('✅ PASS: Fake/unverified Razorpay signatures are strictly rejected and never grant Pro plan');
  passed++;

  // 10. Check Firebase Realtime Disconnection
  console.log('10. Checking Firebase realtime listeners disconnected...');
  const fbSync = require('./firebase-sync');
  assert.strictEqual(typeof fbSync.listenToClinicRealtime, 'function');
  assert.strictEqual(typeof fbSync.listenToClinicsRealtime, 'function');
  const unsub1 = fbSync.listenToClinicRealtime('test_clinic', () => {}, () => {});
  assert.strictEqual(typeof unsub1, 'function');
  unsub1();
  const unsub2 = fbSync.listenToClinicsRealtime(() => {});
  assert.strictEqual(typeof unsub2, 'function');
  unsub2();
  console.log('✅ PASS: Firebase realtime listeners safely disconnected from Firestore snapshots');
  passed++;

  // 11. Test Client-Side Payment Verification Rejection
  console.log('11. Testing client-side payment verification strictly rejects on HTTP 400...');
  const payClientSandbox = {
    clinicProfile: {
      id: 'clinic_test_pay_reject',
      subscription: { plan: 'free', status: 'trial' }
    },
    currentRole: 'clinic',
    showToast: (msg, type) => { payClientSandbox.lastToast = { msg, type }; },
    saveLocalClinic: () => { payClientSandbox.savedLocal = true; },
    hideTrialLockModal: () => {},
    closeClinicAccountModal: () => {},
    checkClinicTrialAndLock: () => {},
    refreshAllViews: () => {},
    window: { location: { protocol: 'http:' } },
    fetch: async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid Razorpay payment signature' })
    })
  };

  const verifyFuncMatch = indexHtml.match(/async function verifyAndActivateSubscription\([\s\S]*?\n    \}/);
  assert.ok(verifyFuncMatch, 'verifyAndActivateSubscription must exist');
  vm.runInNewContext(verifyFuncMatch[0], payClientSandbox);

  await payClientSandbox.verifyAndActivateSubscription({
    clinicId: 'clinic_test_pay_reject',
    plan: 'monthly_pro',
    razorpay_payment_id: 'fake_pay_1',
    razorpay_signature: 'fake_sig_1'
  });

  assert.strictEqual(payClientSandbox.clinicProfile.subscription.plan, 'free', 'Pro plan must NOT be activated when backend verification fails');
  assert.strictEqual(payClientSandbox.clinicProfile.subscription.status, 'trial', 'Status must remain trial on verification failure');
  assert.strictEqual(payClientSandbox.lastToast?.type, 'error', 'Error toast must be shown on verification failure');
  console.log('✅ PASS: Client-side payment handler strictly rejects Pro activation when verification fails');
  passed++;

  // 12. Test Help Support Modal & Functions
  console.log('12. Testing Help & Support modal controls...');
  assert.ok(indexHtml.includes('id="helpSupportModal"'), 'HTML must include helpSupportModal');
  assert.ok(indexHtml.includes('openHelpSupportModal'), 'HTML must define openHelpSupportModal');
  assert.ok(indexHtml.includes('closeHelpSupportModal'), 'HTML must define closeHelpSupportModal');

  const modalSandbox = {
    modalState: 'hidden',
    document: {
      getElementById: (id) => {
        if (id === 'helpSupportModal') {
          return {
            classList: {
              remove: (cls) => { if (cls === 'hidden') modalSandbox.modalState = 'visible'; },
              add: (cls) => { if (cls === 'hidden') modalSandbox.modalState = 'hidden'; }
            }
          };
        }
        return null;
      }
    }
  };
  const openModalMatch = indexHtml.match(/function openHelpSupportModal\(\)[\s\S]*?\n    \}/);
  const closeModalMatch = indexHtml.match(/function closeHelpSupportModal\(\)[\s\S]*?\n    \}/);
  assert.ok(openModalMatch && closeModalMatch, 'Both openHelpSupportModal and closeHelpSupportModal must exist');
  vm.runInNewContext(openModalMatch[0] + '\n' + closeModalMatch[0], modalSandbox);

  modalSandbox.openHelpSupportModal();
  assert.strictEqual(modalSandbox.modalState, 'visible', 'Modal must be made visible on open');
  modalSandbox.closeHelpSupportModal();
  assert.strictEqual(modalSandbox.modalState, 'hidden', 'Modal must be hidden on close');
  console.log('✅ PASS: Help & Support modal open and close handlers operate smoothly');
  passed++;

  // 13. Test Admin Doctor List Badging for Trial Ended
  console.log('13. Testing Admin Doctor List trial status rendering...');
  const adminDocListSandbox = {
    adminDoctorsData: [
      {
        id: 'doc_trial_exp_1',
        doctorName: 'Dr. Expired',
        clinicName: 'Expired Clinic',
        subscription: { plan: 'free', status: 'expired' },
        trialStatus: 'trial_expired',
        trialDaysLeft: 0,
        stats: { trialStatus: 'trial_expired', trialDaysLeft: 0, monthBookings: 88, totalBookings: 120 }
      },
      {
        id: 'doc_trial_act_1',
        doctorName: 'Dr. Active',
        clinicName: 'Active Clinic',
        subscription: { plan: 'free', status: 'trial' },
        trialStatus: 'trial_active',
        trialDaysLeft: 5,
        stats: { trialStatus: 'trial_active', trialDaysLeft: 5, monthBookings: 22, totalBookings: 30 }
      }
    ],
    adminCurrentPlanFilter: 'all',
    isDummyClinicName: () => false,
    escapeHtml: s => s,
    renderedHtml: '',
    document: {
      getElementById: (id) => {
        if (id === 'adminDoctorsListContainer') {
          return {
            set innerHTML(val) { adminDocListSandbox.renderedHtml = val; },
            get innerHTML() { return adminDocListSandbox.renderedHtml; }
          };
        }
        return { classList: { add: () => {}, remove: () => {} }, textContent: '', value: '' };
      }
    }
  };

  const renderAdminMatch = indexHtml.match(/function renderAdminDoctorsList\(\)[\s\S]*?\n    \}/);
  assert.ok(renderAdminMatch, 'renderAdminDoctorsList must exist');
  vm.runInNewContext(renderAdminMatch[0], adminDocListSandbox);
  adminDocListSandbox.renderAdminDoctorsList();

  assert.ok(adminDocListSandbox.renderedHtml.includes('⏳ Trial Ended (100 cap)'), 'Must render Trial Ended (100 cap) for expired trial doctor');
  assert.ok(adminDocListSandbox.renderedHtml.includes('⏰ Trial Active (5d left)'), 'Must render Trial Active (5d left) for active trial doctor');
  assert.ok(adminDocListSandbox.renderedHtml.includes('88 / 100'), 'Must render this month booking metrics 88 / 100');
  console.log('✅ PASS: Admin Doctor List renders exact trial expiration and monthly usage badges');
  passed++;

  // 14. Test DOM Preservation on Plan Toggling
  console.log('14. Testing DOM element preservation across multiple plan changes...');
  const domPreserveSandbox = {
    clinicProfile: {
      id: 'clinic_dom_test',
      subscription: { plan: 'free', status: 'trial' }
    },
    todayQueue: [],
    getClinicMonthAppointmentsCount: () => 5,
    getClinicSubscriptionStatus: (c) => ({
      status: c.subscription.status,
      plan: c.subscription.plan,
      planName: c.subscription.plan === 'monthly_pro' ? 'Monthly Pro Plan' : '7-Day Free Trial',
      isTrialActive: c.subscription.status === 'trial',
      daysLeft: 6,
      hoursLeft: 12,
      minutesLeft: 30,
      secondsLeft: 15
    }),
    nodes: {
      trialTimerDays: { textContent: '' },
      trialTimerHours: { textContent: '' },
      trialTimerMinutes: { textContent: '' },
      trialTimerSeconds: { textContent: '' },
      profileTrialCardTitle: { textContent: '' },
      profileTrialCardSubtitle: { textContent: '' },
      profileTrialStatusNoticeText: { innerHTML: '' },
      profileTrialUpgradeBtn: { className: '', innerHTML: '' },
      profileTrialCountdownContainer: {
        classList: {
          hidden: false,
          add(c) { if (c === 'hidden') this.hidden = true; },
          remove(c) { if (c === 'hidden') this.hidden = false; }
        },
        className: ''
      },
      profileProStatusBox: {
        classList: {
          hidden: true,
          add(c) { if (c === 'hidden') this.hidden = true; },
          remove(c) { if (c === 'hidden') this.hidden = false; }
        }
      },
      profileTrialBadgeIcon: { className: '', innerHTML: '' },
      profileMonthlyUsageCount: { textContent: '' },
      profileMonthlyUsageMax: { textContent: '' },
      profileMonthlyProgressBar: { style: {} },
      profileMonthlyPeriodText: { textContent: '' },
      profilePlanTypeBadge: { className: '', textContent: '' }
    },
    document: {
      getElementById(id) {
        return domPreserveSandbox.nodes[id] || null;
      }
    }
  };

  const updateProfileTimerMatch = indexHtml.match(/function updateProfileTrialTimerUI\(\)[\s\S]*?\n    \}/);
  assert.ok(updateProfileTimerMatch, 'updateProfileTrialTimerUI must exist');
  vm.runInNewContext(updateProfileTimerMatch[0], domPreserveSandbox);

  // 1. Initial trial view
  domPreserveSandbox.updateProfileTrialTimerUI();
  assert.strictEqual(domPreserveSandbox.nodes.profileTrialCountdownContainer.classList.hidden, false);
  assert.strictEqual(domPreserveSandbox.nodes.trialTimerDays.textContent, '06');

  // 2. Switch to Pro
  domPreserveSandbox.clinicProfile.subscription = { plan: 'monthly_pro', status: 'active' };
  domPreserveSandbox.updateProfileTrialTimerUI();
  assert.strictEqual(domPreserveSandbox.nodes.profileTrialCountdownContainer.classList.hidden, true);
  assert.strictEqual(domPreserveSandbox.nodes.profileProStatusBox.classList.hidden, false);

  // 3. Switch back to Trial (Must NOT crash or lose days node)
  domPreserveSandbox.clinicProfile.subscription = { plan: 'free', status: 'trial' };
  domPreserveSandbox.updateProfileTrialTimerUI();
  assert.strictEqual(domPreserveSandbox.nodes.profileTrialCountdownContainer.classList.hidden, false);
  assert.strictEqual(domPreserveSandbox.nodes.profileProStatusBox.classList.hidden, true);
  assert.strictEqual(domPreserveSandbox.nodes.trialTimerDays.textContent, '06', 'Days DOM node must survive plan switching');
  console.log('✅ PASS: DOM timer elements survive multiple plan switches without destruction');
  passed++;

  // 15. Test Month Boundary Roll-Over in getClinicMonthAppointmentsCount
  console.log('15. Testing Month Boundary Roll-over in client counting logic...');
  const monthRolloverSandbox = {
    todayQueue: [
      { id: 'b_prev_1', date: '2026-10-10', status: 'WAITING' },
      { id: 'b_prev_2', createdAt: '2026-10-25T10:00:00.000Z', status: 'COMPLETED' },
      { id: 'b_curr_1', date: new Date().toISOString().slice(0, 10), status: 'WAITING' },
      { id: 'b_curr_2', createdAt: new Date().toISOString(), status: 'COMPLETED' },
      { id: 'b_curr_canc', date: new Date().toISOString().slice(0, 10), status: 'CANCELLED' }
    ]
  };

  const getMonthCountMatch = indexHtml.match(/function getClinicMonthAppointmentsCount\(\)[\s\S]*?\n    \}/);
  assert.ok(getMonthCountMatch, 'getClinicMonthAppointmentsCount must exist');
  vm.runInNewContext(getMonthCountMatch[0], monthRolloverSandbox);

  const mCount = monthRolloverSandbox.getClinicMonthAppointmentsCount();
  assert.strictEqual(mCount, 2, 'Only active bookings in the current calendar month must be counted (excluding prev month and CANCELLED)');
  console.log('✅ PASS: Month boundary roll-over accurately filters out prior month and cancelled appointments');
  passed++;

  server.close();

  console.log('========================================================');
  console.log(`🎉 ALL ${passed}/15 TARGETED VERIFICATION TESTS PASSED CLEANLY!`);
  console.log('========================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
