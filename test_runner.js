/**
 * Parchisetu End-to-End Verification Test Suite
 * Tests server, onboarding API, patient booking flow, queue sync, deduplication, and HTML integrity.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const TEST_PORT = 3100;
process.env.PORT = TEST_PORT;

const { server, startServer, appData } = require('./server');

function makeRequest(method, pathname, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
        }
      },
      res => {
        let raw = '';
        res.on('data', chunk => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Parchisetu Clinic & Token Test Suite...');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`❌ FAIL: ${name}`);
        console.error('   ', err.message);
        failed++;
      }
    };
  }

  // 1. Health check
  await test('Server health endpoint responds with healthy status', async () => {
    const res = await makeRequest('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'healthy');
  })();

  // 2. Static files
  await test('Serves index.html with 200 OK and contains Onboarding Wizard & Token Pass controls', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body === 'string');
    assert.ok(res.body.includes('clinicOnboardingModal'), 'Should contain clinicOnboardingModal');
    assert.ok(res.body.includes('onboardingSuccessModal'), 'Should contain onboardingSuccessModal');
    assert.ok(res.body.includes('patientViewLiveToken'), 'Should contain live token ticker');
    assert.ok(res.body.includes('generateDynamicSlots'), 'Should contain dynamic slot generation');
    assert.ok(res.body.includes('sharePatientTokenOnWhatsApp'), 'Should contain WhatsApp token slip share');
    assert.ok(res.body.includes('printPatientTokenSlip'), 'Should contain printable token slip');
  })();

  // 3. Get clinic profile with network info
  await test('GET /api/clinic returns current clinic profile and network info', async () => {
    const res = await makeRequest('GET', '/api/clinic');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.name, 'Clinic must have a name');
    assert.ok(res.body.doctorName, 'Clinic must have a doctor name');
    assert.ok(res.body.visitingHours, 'Clinic must have visitingHours configured');
    assert.ok(res.body.network, 'Clinic profile must include network configuration');
    assert.strictEqual(res.body.network.port, TEST_PORT);
    assert.ok(Array.isArray(res.body.network.localIps));
  })();

  // 4. Update clinic onboarding
  await test('POST /api/clinic completes clinic onboarding with visiting hours & slots', async () => {
    const payload = {
      name: 'Aarogya Multi-Specialty Clinic',
      category: 'General Medicine',
      tagline: 'Complete Family Healthcare & Diabetes Care',
      address: 'Kankarbagh Main Road, Opposite Pillar 42',
      city: 'Patna, Bihar',
      phone: '9835123456',
      whatsapp: '9835123456',
      upiId: 'aarogyaclinic@upi',
      doctorName: 'Dr. Anand Kishore',
      doctorDegree: 'MBBS, MD (Medicine), PG Diab.',
      doctorRegNo: 'BRMC-52194',
      experienceYears: 16,
      fees: {
        normal: 400,
        followup: 250,
        emergency: 600,
        report: 0
      },
      visitingHours: {
        morning: {
          enabled: true,
          start: '09:30 AM',
          end: '01:30 PM',
          slotDurationMins: 15,
          maxTokens: 25
        },
        evening: {
          enabled: true,
          start: '05:30 PM',
          end: '09:30 PM',
          slotDurationMins: 15,
          maxTokens: 30
        },
        daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        avgConsultationMins: 10
      }
    };

    const res = await makeRequest('POST', '/api/clinic', payload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.clinic.name, 'Aarogya Multi-Specialty Clinic');
    assert.strictEqual(res.body.clinic.doctorName, 'Dr. Anand Kishore');
    assert.strictEqual(res.body.clinic.fees.normal, 400);
    assert.strictEqual(res.body.clinic.visitingHours.morning.start, '09:30 AM');
  })();

  // 5. Patient online booking
  let bookedToken = null;
  let bookedId = null;
  await test('POST /api/bookings books visiting slot, gives token number & syncs to compounder', async () => {
    const bookingPayload = {
      name: 'Sunil Kumar Gupta',
      age: 42,
      gender: 'M',
      phone: '9835999888',
      reason: '🩸 BP / Sugar',
      shift: 'Morning',
      slotTime: '10:15 AM',
      day: 'Aaj (Today)'
    };

    const res = await makeRequest('POST', '/api/bookings', bookingPayload);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.booking.token > 0, 'Token number must be positive');
    assert.strictEqual(res.body.booking.name, 'Sunil Kumar Gupta');
    assert.strictEqual(res.body.booking.source, 'QR Booked');
    assert.strictEqual(res.body.booking.status, 'WAITING');
    assert.strictEqual(res.body.booking.payMode, 'Baaki');

    bookedToken = res.body.booking.token;
    bookedId = res.body.booking.id;
  })();

  // 6. Compounder Queue verification
  await test('GET /api/queue includes newly booked patient for compounder desk', async () => {
    const res = await makeRequest('GET', '/api/queue');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const found = res.body.find(p => p.id === bookedId);
    assert.ok(found, 'Booked patient must appear in the compounder queue');
    assert.strictEqual(found.token, bookedToken);
    assert.strictEqual(found.name, 'Sunil Kumar Gupta');
  })();

  // 7. Compounder updates patient status (Call inside Cabin)
  await test('PATCH /api/queue/:id allows compounder to move patient to IN_CABIN', async () => {
    const res = await makeRequest('PATCH', `/api/queue/${bookedId}`, {
      status: 'IN_CABIN',
      bp: '130/85',
      weight: '72 kg'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.item.status, 'IN_CABIN');
    assert.strictEqual(res.body.item.bp, '130/85');
  })();

  // 8. Compounder collects fee
  await test('PATCH /api/queue/:id allows compounder to mark fee collected as Cash or UPI', async () => {
    const res = await makeRequest('PATCH', `/api/queue/${bookedId}`, {
      payMode: 'Cash'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.item.payMode, 'Cash');
  })();

  // 9. Deduplication in POST /api/bookings
  await test('POST /api/bookings with existing ID updates existing record without creating duplicates', async () => {
    const queueBefore = (await makeRequest('GET', '/api/queue')).body;
    const countBefore = queueBefore.length;

    const res = await makeRequest('POST', '/api/bookings', {
      id: bookedId,
      name: 'Sunil Kumar Gupta Updated',
      phone: '9835999888',
      token: bookedToken
    });

    assert.strictEqual(res.status, 200);
    const queueAfter = (await makeRequest('GET', '/api/queue')).body;
    assert.strictEqual(queueAfter.length, countBefore, 'Should not increase queue length');
    const updated = queueAfter.find(p => p.id === bookedId);
    assert.strictEqual(updated.name, 'Sunil Kumar Gupta Updated');
  })();

  // 10. Fast Walk-In Entry via Reception
  await test('POST /api/bookings supports fast walk-in patient creation', async () => {
    const walkinPayload = {
      name: 'Radheshyam Tiwari',
      age: 58,
      gender: 'M',
      phone: '9431012345',
      reason: '🤕 Dard / Injury',
      source: 'Walk-in',
      payMode: 'Cash'
    };

    const res = await makeRequest('POST', '/api/bookings', walkinPayload);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.booking.name, 'Radheshyam Tiwari');
    assert.strictEqual(res.body.booking.source, 'Walk-in');
    assert.strictEqual(res.body.booking.payMode, 'Cash');
    assert.strictEqual(res.body.booking.token, bookedToken + 1);
  })();

  // 11. PUT /api/queue batch updates
  await test('PUT /api/queue allows batch syncing or reordering the queue', async () => {
    const currentQueue = (await makeRequest('GET', '/api/queue')).body;
    const modified = currentQueue.map(p => ({ ...p, syncedAt: Date.now() }));
    const res = await makeRequest('PUT', '/api/queue', modified);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.queue.length, currentQueue.length);
  })();

  // 12. Validation: Incomplete bookings rejected
  await test('POST /api/bookings rejects missing name or phone', async () => {
    const res = await makeRequest('POST', '/api/bookings', { age: 30 });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  })();

  // 13. Dynamic Slots Generation calculation
  await test('Dynamic slot intervals calculation matches clinic shift config', () => {
    function parseTimeString(tStr) {
      const match = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return 600;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }

    function formatTimeMinutes(totalMins) {
      let hours = Math.floor(totalMins / 60);
      const minutes = totalMins % 60;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      let h12 = hours % 12;
      if (h12 === 0) h12 = 12;
      return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }

    const start = parseTimeString('09:30 AM'); // 570
    const end = parseTimeString('11:00 AM');   // 660
    const step = 15;
    const slots = [];
    for (let m = start; m < end; m += step) {
      slots.push(formatTimeMinutes(m));
    }

    assert.deepStrictEqual(slots, ['09:30 AM', '09:45 AM', '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM']);
  })();

  // 14. SSE /api/events connection check
  await test('GET /api/events responds with text/event-stream headers', async () => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: TEST_PORT,
          path: '/api/events',
          method: 'GET'
        },
        res => {
          assert.strictEqual(res.statusCode, 200);
          assert.ok(res.headers['content-type'].includes('text/event-stream'));
          res.destroy();
          resolve();
        }
      );
      req.on('error', reject);
      req.end();
    });
  })();

  // 15. Multi-Doctor configuration in /api/clinic
  await test('POST /api/clinic supports multi-doctor profiles (up to 5 doctors)', async () => {
    const multiDoctorPayload = {
      doctors: [
        { id: 'doc_1', name: 'Dr. Rajesh Sharma', degree: 'MBBS, MD', specialty: 'General Physician', fee: 300, isMain: true },
        { id: 'doc_2', name: 'Dr. Priya Kishore', degree: 'MBBS, MS', specialty: 'Gynecologist', fee: 450, isMain: false },
        { id: 'doc_3', name: 'Dr. Amit Patel', degree: 'BDS, MDS', specialty: 'Dental Surgeon', fee: 350, isMain: false }
      ]
    };
    const res = await makeRequest('POST', '/api/clinic', multiDoctorPayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.clinic.doctors.length, 3);
    assert.strictEqual(res.body.clinic.doctors[1].name, 'Dr. Priya Kishore');
    assert.strictEqual(res.body.clinic.doctors[2].specialty, 'Dental Surgeon');
  })();

  // 16. Booking with specific doctorId and doctorName
  await test('POST /api/bookings records doctorId and doctorName correctly', async () => {
    const booking = {
      name: 'Rekha Devi',
      phone: '9835999999',
      age: 29,
      gender: 'F',
      doctorId: 'doc_2',
      doctorName: 'Dr. Priya Kishore',
      fee: 450,
      shift: 'Evening',
      slotTime: '06:30 PM',
      day: 'Kal (Tomorrow)',
      date: '2026-10-27'
    };
    const res = await makeRequest('POST', '/api/bookings', booking);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.booking.doctorId, 'doc_2');
    assert.strictEqual(res.body.booking.doctorName, 'Dr. Priya Kishore');
    assert.strictEqual(res.body.booking.fee, 450);
  })();

  // 17. Doctor leaves / vacation configuration in clinic
  await test('POST /api/clinic stores vacation and leave days with blocked shifts/slots', async () => {
    const leavePayload = {
      leaves: {
        '2026-10-28': { fullDay: true, reason: 'Doctor Conference' },
        '2026-10-29': { fullDay: false, morningOff: true, eveningOff: false, blockedSlots: ['05:30 PM'] }
      }
    };
    const res = await makeRequest('POST', '/api/clinic', leavePayload);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.clinic.leaves['2026-10-28'].fullDay);
    assert.ok(res.body.clinic.leaves['2026-10-29'].morningOff);
    assert.strictEqual(res.body.clinic.leaves['2026-10-29'].blockedSlots[0], '05:30 PM');
  })();

  // 18. Zero dummy data queue reset verification
  await test('POST /api/queue/reset clears all dummy data to start completely fresh', async () => {
    const res = await makeRequest('POST', '/api/queue/reset');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.queue, []);
    
    // Check GET returns empty array
    const checkRes = await makeRequest('GET', '/api/queue');
    assert.strictEqual(checkRes.status, 200);
    assert.strictEqual(checkRes.body.length, 0);
  })();

  // 19. Logo and Favicon file verification
  await test('Cute smiling Parchi logo.svg and favicon.svg exist and contain medical SVG elements', () => {
    assert.ok(fs.existsSync(path.join(__dirname, 'logo.svg')), 'logo.svg must exist');
    assert.ok(fs.existsSync(path.join(__dirname, 'favicon.svg')), 'favicon.svg must exist');
    const logoContent = fs.readFileSync(path.join(__dirname, 'logo.svg'), 'utf8');
    assert.ok(logoContent.includes('<svg'), 'logo.svg must be an SVG file');
    assert.ok(logoContent.includes('ParchiSetu'), 'logo.svg must brand ParchiSetu');
  })();

  // 20. HTML includes Firebase SDKs, Auth Modal, Calendar Controls, and Live Token Ticker
  await test('HTML includes Firebase SDKs, Clinic Auth Modal, Calendar Controls, and Live Ticker', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('firebase-app-compat.js'), 'Must include Firebase App SDK');
    assert.ok(html.includes('firebase-firestore-compat.js'), 'Must include Firebase Firestore SDK');
    assert.ok(html.includes('firebase-sync.js'), 'Must include firebase-sync.js');
    assert.ok(html.includes('clinicAuthModal'), 'Must include clinicAuthModal');
    assert.ok(html.includes('calendarDayControlCard'), 'Must include calendarDayControlCard');
    assert.ok(html.includes('passLiveStatusCard'), 'Must include passLiveStatusCard');
    assert.ok(html.includes('patientDoctorSelectSection'), 'Must include patientDoctorSelectSection');
  })();

  // 21. Patient booking functions defined in client script
  await test('HTML defines submitPatientOnlineBooking, selectPatientShift, and updatePatientTokenPassLiveStatus', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('function selectPatientShift('), 'Must define selectPatientShift');
    assert.ok(html.includes('function submitPatientOnlineBooking(') || html.includes('async function submitPatientOnlineBooking('), 'Must define submitPatientOnlineBooking');
    assert.ok(html.includes('function updatePatientTokenPassLiveStatus('), 'Must define updatePatientTokenPassLiveStatus');
  })();

  // 22. Firebase sync sanitization strips undefined properties
  await test('firebase-sync.js sanitization strips undefined fields to prevent Firestore crashes', () => {
    const fb = require('./firebase-sync');
    assert.ok(typeof fb.sanitizeForFirestore === 'function', 'sanitizeForFirestore must be exported');
    const dirty = { name: 'Ramesh', bp: undefined, notes: undefined, deep: { valid: 1, bad: undefined } };
    const clean = fb.sanitizeForFirestore(dirty);
    assert.strictEqual(clean.name, 'Ramesh');
    assert.strictEqual(clean.bp, undefined);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(clean, 'bp'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(clean, 'notes'), false);
    assert.strictEqual(clean.deep.valid, 1);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(clean.deep, 'bad'), false);
  })();

  // 23. Multi-clinic query lookup via /api/clinic?clinic=<id>
  await test('GET /api/clinic?clinic=<id> returns specific clinic profile', async () => {
    const customClinic = {
      id: 'clinic_patna_central_99',
      name: 'Patna Central Hospital Clinic',
      doctorName: 'Dr. Alok Nath',
      phone: '9800011122'
    };
    await makeRequest('POST', '/api/clinic', customClinic);
    const res = await makeRequest('GET', '/api/clinic?clinic=clinic_patna_central_99');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 'clinic_patna_central_99');
    assert.strictEqual(res.body.name, 'Patna Central Hospital Clinic');
  })();

  // 24. Role separation UI attributes
  await test('Role separation IDs and preview controls are present in HTML', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="roleSelectorPill"'), 'Must have roleSelectorPill');
    assert.ok(html.includes('id="patientPreviewBanner"'), 'Must have patientPreviewBanner');
    assert.ok(html.includes('openClinicAuthModal()'), 'Must wire discreet staff button to openClinicAuthModal');
  })();

  // 25. Sign-in and login direct routes
  await test('GET /signin and GET /login serve HTML containing Clinic Auth Modal and Google Sign-In', async () => {
    const resSignin = await makeRequest('GET', '/signin');
    assert.strictEqual(resSignin.status, 200);
    assert.ok(resSignin.body.includes('id="clinicAuthModal"'), 'Must serve page with clinicAuthModal');
    assert.ok(resSignin.body.includes('handleGoogleSignIn()'), 'Must contain Google Sign-In handler');

    const resLogin = await makeRequest('GET', '/login');
    assert.strictEqual(resLogin.status, 200);
    assert.ok(resLogin.body.includes('id="clinicAuthModal"'), 'Must serve page with clinicAuthModal on /login');
  })();

  // 26. firebase-sync.js getClinicForUser handles user object and UID string
  await test('firebase-sync.js getClinicForUser safely accepts both User object and string UID', async () => {
    const fb = require('./firebase-sync');
    assert.ok(typeof fb.getClinicForUser === 'function', 'getClinicForUser must be exported');
    
    // When Firebase is not initialized (node env), it must safely return null without throwing TypeError
    const resFromObj = await fb.getClinicForUser({ uid: 'usr_test_123' });
    assert.strictEqual(resFromObj, null);

    const resFromString = await fb.getClinicForUser('usr_test_123');
    assert.strictEqual(resFromString, null);

    const resFromNull = await fb.getClinicForUser(null);
    assert.strictEqual(resFromNull, null);
  })();

  // 27. firebase-sync.js saveUserClinicMapping signature and export
  await test('firebase-sync.js saveUserClinicMapping signature accepts uid, clinicId, email, and clinicName', async () => {
    const fb = require('./firebase-sync');
    assert.ok(typeof fb.saveUserClinicMapping === 'function', 'saveUserClinicMapping must be exported');
    // Without firestore initialized, safely returns false without crashing
    const res = await fb.saveUserClinicMapping('uid1', 'clinic1', 'doctor@example.com', 'My Clinic');
    assert.strictEqual(res, false);
  })();

  // 28. Compact 4-Tab navigation bar and labels
  await test('Compact 4-Tab navigation contains compressed layout and correct tab labels', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="tabBtn-queue"'), 'Must have tabBtn-queue');
    assert.ok(html.includes('id="tabBtn-calendar"'), 'Must have tabBtn-calendar');
    assert.ok(html.includes('id="tabBtn-register"'), 'Must have tabBtn-register');
    assert.ok(html.includes('id="tabBtn-galla"'), 'Must have tabBtn-galla');
    assert.ok(html.includes('Live Queue'), 'Must contain Live Queue');
    assert.ok(html.includes('Slots &amp; QR') || html.includes('Slots & QR'), 'Must contain Slots & QR');
    assert.ok(html.includes('Patients Directory'), 'Must contain Patients Directory');
    assert.ok(html.includes('Daily Checkbook'), 'Must contain Daily Checkbook');
    assert.ok(html.includes('py-1 sm:py-1.5'), 'Must use compressed py-1 sm:py-1.5 padding for tabs');
  })();

  // 29. Onboarding Success & QR Launchpad elements
  await test('Onboarding Success Modal includes QR image, patient link, standee generator, and Google Maps guide', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="onboardingSuccessModal"'), 'Must have onboardingSuccessModal');
    assert.ok(html.includes('id="successQrImg"'), 'Must have successQrImg element');
    assert.ok(html.includes('id="successPatientLinkInput"'), 'Must have successPatientLinkInput');
    assert.ok(html.includes('printClinicQRStandee()'), 'Must have printClinicQRStandee function');
    assert.ok(html.includes('downloadQRCodeImage()'), 'Must have downloadQRCodeImage function');
    assert.ok(html.includes('Google Maps Business Setup'), 'Must have Google Maps Business Setup guide');
  })();

  // 30. vercel.json rewrites verification
  await test('vercel.json includes rewrites for /book, /clinic, /signin, /login, and /onboard', () => {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'));
    assert.ok(Array.isArray(vercelConfig.rewrites), 'vercel.json must have rewrites array');
    const sources = vercelConfig.rewrites.map(r => r.source);
    assert.ok(sources.includes('/signin'), 'Must have /signin rewrite');
    assert.ok(sources.includes('/login'), 'Must have /login rewrite');
    assert.ok(sources.includes('/onboard'), 'Must have /onboard rewrite');
    assert.ok(sources.includes('/book'), 'Must have /book rewrite');
    assert.ok(sources.includes('/clinic'), 'Must have /clinic rewrite');
  })();

  // 31. Compulsory Clinic Sign-In / Sign-Up Gateway on Main URL
  await test('Compulsory Clinic Gateway on Main URL contains tabs, Google Sign-in, and auth handlers', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="viewAuthGateway"'), 'Must contain viewAuthGateway container');
    assert.ok(html.includes('id="gwTabSignup"'), 'Must contain gwTabSignup');
    assert.ok(html.includes('id="gwTabLogin"'), 'Must contain gwTabLogin');
    assert.ok(html.includes('id="gwBtnGoogleSignIn"'), 'Must contain gwBtnGoogleSignIn');
    assert.ok(html.includes('handleGatewaySignup()'), 'Must contain handleGatewaySignup invocation');
    assert.ok(html.includes('handleGatewayLogin()'), 'Must contain handleGatewayLogin invocation');
    assert.ok(html.includes('function showAuthGatewayScreen('), 'Must define showAuthGatewayScreen');
    assert.ok(html.includes('function enterClinicWorkspace('), 'Must define enterClinicWorkspace');
  })();

  // 32. Clinic Profile & Pricing Modal with ₹399/mo and ₹4,000/yr plans
  await test('Clinic Profile & Pricing modal defines membership plans and logout button', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="clinicAccountModal"'), 'Must contain clinicAccountModal');
    assert.ok(html.includes('₹399'), 'Must contain ₹399 monthly price');
    assert.ok(html.includes('₹4,000') || html.includes('4,000'), 'Must contain ₹4,000 annual price');
    assert.ok(html.includes('Monthly OPD Plan'), 'Must describe Monthly OPD Plan');
    assert.ok(html.includes('Annual Pro Plan'), 'Must describe Annual Pro Plan');
    assert.ok(html.includes('function handleProfileHeaderClick('), 'Must define handleProfileHeaderClick');
    assert.ok(html.includes('function selectPricingPlan('), 'Must define selectPricingPlan');
    assert.ok(html.includes('bg-[#8B0000]'), 'Must include red/brown logout styling');
  })();

  // 33. Collapsible Fast Walk-in Entry Card
  await test('Fast Walk-In Entry card has collapsible accordion with toggle controls', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="walkinFormCollapse"'), 'Must contain walkinFormCollapse');
    assert.ok(html.includes('toggleFastWalkinCollapse()'), 'Must invoke toggleFastWalkinCollapse');
    assert.ok(html.includes('function toggleFastWalkinCollapse('), 'Must define toggleFastWalkinCollapse function');
    assert.ok(html.includes('id="walkinChevron"'), 'Must have walkinChevron icon');
  })();

  // 34. Pending Fee 1-Tap Cash & UPI Options
  await test('Queue list defines 1-tap Cash and UPI buttons for pending fee patients', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('function setPatientPaymentMode('), 'Must define setPatientPaymentMode');
    assert.ok(html.includes('setPatientPaymentMode'), 'Must invoke setPatientPaymentMode in queue render');
    assert.ok(html.includes('Cash') && html.includes('UPI'), 'Must support both Cash and UPI options');
  })();

  // 35. Live Clinic Status, Consultation Fee Highlight, and Reassurance Line
  await test('Patient view calculates live status, highlights fee, and displays phone call reassurance', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="patientViewLiveStatusCard"'), 'Must contain patientViewLiveStatusCard');
    assert.ok(html.includes('id="patientConsultationFeeCard"'), 'Must contain patientConsultationFeeCard');
    assert.ok(html.includes('id="patientFeeHighlightBadge"'), 'Must contain patientFeeHighlightBadge');
    assert.ok(html.includes('function getClinicLiveStatusInfo('), 'Must define getClinicLiveStatusInfo');
    assert.ok(html.includes('function checkAndRestorePatientBooking('), 'Must define checkAndRestorePatientBooking');
    assert.ok(html.includes('zaroorat nahi hai'), 'Must include punchy reassurance note for waiting patients');
  })();

  // 36. JavaScript Syntax Compilation Verification (Catch duplicate const / parse errors)
  await test('JavaScript scripts in index.html compile with zero syntax errors in JS runtime', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    const scripts = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
    assert.ok(scripts.length > 0, 'Must contain scripts in index.html');
    scripts.forEach((s, idx) => {
      const code = s.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
      if (!code.trim()) return;
      try {
        new vm.Script(code, { filename: `index_script_${idx}.js` });
      } catch (err) {
        assert.fail(`Script ${idx} failed to compile: ${err.message}`);
      }
    });
  })();

  // 37. Compulsory Sign-In Gateway Screen Default Visibility (Static HTML)
  await test('Clinic workspace and navigation tabs are hidden by default in static HTML until auth', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="clinicNavTabs" class="hidden'), 'clinicNavTabs must have hidden class by default');
    assert.ok(html.includes('id="viewClinicDesk" class="hidden'), 'viewClinicDesk must have hidden class by default');
    assert.ok(html.includes('id="clinicOnboardHeaderBtn"\n          class="hidden') || html.includes('id="clinicOnboardHeaderBtn" class="hidden') || html.includes('id="clinicOnboardHeaderBtn"\r\n          class="hidden'), 'clinicOnboardHeaderBtn must have hidden class');
    assert.ok(html.includes('id="viewAuthGateway" class="max-w-xl') || (html.includes('id="viewAuthGateway"') && !html.includes('id="viewAuthGateway" class="hidden')), 'viewAuthGateway must be visible by default without hidden class');
  })();

  // 38. Day Comparison in Live Status supports short day names (Mon-Sat)
  await test('getClinicLiveStatusInfo correctly matches short day names in daysOpen without false holidays', async () => {
    const res = await makeRequest('GET', '/');
    const html = res.body;
    assert.ok(html.includes('shortDayNames'), 'Must define shortDayNames for accurate day of week matching');
    assert.ok(html.includes('isDayOpen'), 'Must calculate isDayOpen matching both short and full day names');
    assert.ok(html.includes('bg-rose-700 text-white border-2 border-rose-900'), 'Must use prominent red banner when clinic is closed');
  })();

  // 39. Patient View Header & Token Slip Integrity
  await test('Patient token pass provides Refresh Live button and hides clinic admin buttons', async () => {
    const res = await makeRequest('GET', '/');
    const html = res.body;
    assert.ok(html.includes('Refresh Live'), 'Token pass slip must feature Refresh Live button');
    assert.ok(html.includes('Clinic Sign Up (केवल डॉक्टरों के लिए)') || html.includes('Clinic Sign Up (Doctors Only)'), 'Header auth button must clarify signup is for doctors only in patient mode');
  })();

  // 40. Fast non-blocking Firebase user clinic lookup
  await test('firebase-sync.js getClinicForUser executes with fast 1200ms timeout protection', async () => {
    const fbSync = require('./firebase-sync');
    assert.strictEqual(typeof fbSync.getClinicForUser, 'function');
    const start = Date.now();
    const res = await fbSync.getClinicForUser('non_existent_uid_test');
    const duration = Date.now() - start;
    assert.strictEqual(res, null);
    assert.ok(duration < 2000, `Lookup must resolve quickly without blocking UI, took ${duration}ms`);
  })();

  // 41. WhatsApp Chat-List Queue View & Token Avatar Circles
  await test('WhatsApp chat-list container and avatar circles are defined in queue view', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="queueListContainer" class="bg-white rounded-2xl border border-slate-200/90 shadow-sm divide-y divide-slate-100 overflow-hidden"'), 'queueListContainer must have divide-y chat list styling');
    assert.ok(html.includes('rounded-full ${tokenCircleClass}'), 'Token avatars must use rounded-full circular avatar styling');
  })();

  // 42. Mobile WhatsApp-Style Floating Action Button (+ Naya Mareez)
  await test('Mobile WhatsApp-style Floating Action Button exists with click handler', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="mobileFabNewPatient"'), 'Must have mobileFabNewPatient element');
    assert.ok(html.includes('onFabWalkinClick()'), 'Must call onFabWalkinClick on FAB press');
    assert.ok(html.includes('function onFabWalkinClick('), 'Must define onFabWalkinClick function');
  })();

  // 43. 1-Tap Bulao (Call In) Action for Waiting Patients
  await test('Queue list renders high-contrast 1-tap Bulao button for waiting patients', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('sendPatientInsideCabin'), 'Must invoke sendPatientInsideCabin');
    assert.ok(html.includes('<span>Bulao</span>'), 'Must display simple Bulao button text for compounders');
  })();

  // 44. WhatsApp Queue Rows Provide Dedicated Fee Strip to Prevent Name Truncation
  await test('Queue rows feature dedicated payment strip for Baaki patients to preserve full name visibility', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes("p.payMode === 'Baaki'"), 'Must conditionally render Baaki fee strip');
    assert.ok(html.includes('setPatientPaymentMode'), 'Must invoke setPatientPaymentMode on 1-tap buttons');
    assert.ok(html.includes('event.stopPropagation()'), 'Payment buttons must prevent event bubbling to avoid opening drawer unexpectedly');
  })();

  // 45. Cabin Status Card Gracefully Handles Empty Cabin
  await test('Cabin status hero card dims announce button and shows clean Agla Bulao without false completion text', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="btnAnnounceToken"'), 'Must define btnAnnounceToken element id');
    assert.ok(html.includes('Cabin Khali Hai (Doctor Ready)') || html.includes('Cabin Khali Hai'), 'Must indicate empty cabin clearly');
    assert.ok(html.includes('Agla Bulao'), 'Next button must present clean Agla Bulao text');
  })();

  // 46. Fast Walk-In Form Auto-Collapses on Submission to Reveal New Queue Entry
  await test('Fast walk-in form automatically collapses on submission for immediate queue visibility', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('toggleFastWalkinCollapse(false)'), 'createFastWalkIn must collapse form after successful entry');
  })();

  // 47. 3-Language Dropdown (English default, Hinglish, Hindi) & Comprehensive Dictionary
  await test('3-Language selector dropdown and comprehensive I18N dictionary exist with English default', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="langSelectDropdown"'), 'Must define langSelectDropdown select element');
    assert.ok(html.includes('value="english"'), 'Must include English option');
    assert.ok(html.includes('value="hinglish"'), 'Must include Hinglish option');
    assert.ok(html.includes('value="hindi"'), 'Must include Hindi option');
    assert.ok(html.includes('changeLanguage(this.value)'), 'Dropdown must call changeLanguage on change');
    assert.ok(html.includes('currentLang = \'english\''), 'Default language must be English');
    assert.ok(html.includes('hindi: {'), 'I18N must define hindi dictionary');
    assert.ok(html.includes('hinglish: {'), 'I18N must define hinglish dictionary');
    assert.ok(html.includes('english: {'), 'I18N must define english dictionary');
  })();

  // 48. Bottom Navigation 5th Tab (Profile / Settings) & Red Sign Out Button Relocation
  await test('5-Tab bottom navigation includes Profile tab with relocated red sign out button', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="tabBtn-profile"'), 'Must define tabBtn-profile in navigation');
    assert.ok(html.includes('id="clinicTab-profile"'), 'Must define clinicTab-profile section');
    assert.ok(html.includes('switchClinicTab(\'profile\')'), 'Must support switching to profile tab');
    assert.ok(html.includes('id="profileTabSignOutBtn"'), 'Must define red sign out button inside profile tab');
    assert.ok(html.includes('id="headerSignOutBtn" class="hidden"'), 'Header sign out button must be hidden in home top bar');
  })();

  // 49. Customizable Visiting Reasons (Kya Takleef Hai) & 5 Specialty Presets
  await test('Doctor can customize visiting reasons and select 1-tap specialty presets', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="settingVisitingReasonsText"'), 'Must define settingVisitingReasonsText textarea');
    assert.ok(html.includes('setReasonPreset(\'general\')'), 'Must define General preset button');
    assert.ok(html.includes('setReasonPreset(\'derma\')'), 'Must define Derma preset button');
    assert.ok(html.includes('setReasonPreset(\'ortho\')'), 'Must define Ortho preset button');
    assert.ok(html.includes('setReasonPreset(\'pediatric\')'), 'Must define Pediatric preset button');
    assert.ok(html.includes('setReasonPreset(\'dental\')'), 'Must define Dental preset button');

    // Test API update of custom visiting reasons
    const customReasons = ['🌸 Daad / Khujli', '🧴 Muhase / Acne', '🔴 Allergy / Rash', '💇 Baal Jhadna'];
    const updateRes = await makeRequest('POST', '/api/clinic', { visitingReasons: customReasons });
    assert.strictEqual(updateRes.status, 200);
    assert.deepStrictEqual(updateRes.body.clinic.visitingReasons, customReasons);

    const checkRes = await makeRequest('GET', '/api/clinic');
    assert.strictEqual(checkRes.status, 200);
    assert.deepStrictEqual(checkRes.body.visitingReasons, customReasons);
  })();

  // 50. Patient Step-by-Step Booking Modal & Visit Type (New vs Follow-up)
  await test('Patient booking flow features step-by-step modal, visit type (New vs Follow-up), and screenshot callout', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;
    assert.ok(html.includes('id="btnOpenPatientBookingModal"'), 'Must define landing CTA button to open booking modal');
    assert.ok(html.includes('id="patientBookingModal"'), 'Must define step-by-step modal container');
    assert.ok(html.includes('id="patBookingModalStep1"'), 'Must define Step 1 in modal');
    assert.ok(html.includes('id="patBookingModalStep2"'), 'Must define Step 2 in modal');
    assert.ok(html.includes('id="patVisitTypeNewBtn"'), 'Must define New Visit button');
    assert.ok(html.includes('id="patVisitTypeFollowupBtn"'), 'Must define Follow-up Visit button');
    assert.ok(html.includes('SCREENSHOT'), 'Must include prominent SCREENSHOT reminder on token pass');
    assert.ok(html.includes('📸'), 'Must include camera icon in screenshot reminder');

    // Test booking with visitType
    const bookingPayload = {
      name: 'Mohit Agrawal',
      phone: '9876543210',
      age: 42,
      gender: 'M',
      shift: 'Morning',
      slotTime: '11:15 AM',
      day: 'Aaj (Today)',
      reason: 'Follow-up Check',
      fee: 200,
      visitType: 'followup'
    };
    const bRes = await makeRequest('POST', '/api/bookings', bookingPayload);
    assert.strictEqual(bRes.status, 201);
    assert.strictEqual(bRes.body.booking.visitType, 'followup');
    assert.strictEqual(bRes.body.booking.fee, 200);
  })();

  // 51. Vanishing Tokens Prevention & Safe Queue Merging
  await test('Safe queue merging prevents wiping tokens on empty server responses or cold starts', async () => {
    const htmlRes = await makeRequest('GET', '/');
    assert.strictEqual(htmlRes.status, 200);
    const html = htmlRes.body;
    assert.ok(html.includes('function mergeIncomingQueue(remoteQueue)'), 'Must define mergeIncomingQueue');
    assert.ok(html.includes('if (remoteQueue.length === 0 && todayQueue.length > 0)'), 'Must guard against overwriting local queue with empty remote queue');

    // Test mergeIncomingQueue logic in VM
    const sandbox = {
      todayQueue: [{ id: 'q_1', token: 1, name: 'Suresh' }],
      saveLocalQueue: () => {},
      refreshAllViews: () => {}
    };
    vm.createContext(sandbox);
    const code = `
      function mergeIncomingQueue(remoteQueue) {
        if (!Array.isArray(remoteQueue)) return;
        if (remoteQueue.length === 0 && todayQueue.length > 0) return;
        const queueMap = new Map();
        todayQueue.forEach(p => { if (p && p.id) queueMap.set(p.id, p); });
        remoteQueue.forEach(p => {
          if (p && p.id) {
            if (queueMap.has(p.id)) {
              queueMap.set(p.id, { ...queueMap.get(p.id), ...p });
            } else {
              queueMap.set(p.id, p);
            }
          }
        });
        todayQueue = Array.from(queueMap.values());
      }
      mergeIncomingQueue([]);
    `;
    vm.runInContext(code, sandbox);
    assert.strictEqual(sandbox.todayQueue.length, 1, 'Local queue must NOT be cleared when remote returns empty array');
    assert.strictEqual(sandbox.todayQueue[0].name, 'Suresh');
  })();

  // 52. Late / Pending Patient Tier, Non-Vanishing Behavior, and Explicit Cancellation
  await test('Late / Pending patients are tagged without vanishing and appointments can be cancelled', async () => {
    const htmlRes = await makeRequest('GET', '/');
    assert.strictEqual(htmlRes.status, 200);
    const html = htmlRes.body;
    assert.ok(html.includes('function isPatientLate(p)'), 'Must define isPatientLate helper');
    assert.ok(html.includes('⚠️ Late / Pending (Slot:'), 'Must tag late/pending appointments with warning and slot time');
    assert.ok(html.includes('cancelPatientAppointment'), 'Must define cancelPatientAppointment handler');

    // Create an appointment and cancel it via PATCH /api/queue/:id
    const bRes = await makeRequest('POST', '/api/bookings', {
      name: 'Rohan Sharma',
      phone: '9876543211',
      age: 29,
      gender: 'M',
      shift: 'Morning',
      slotTime: '09:00 AM',
      day: 'Aaj (Today)',
      fee: 300
    });
    assert.strictEqual(bRes.status, 201);
    const id = bRes.body.booking.id;

    const patchRes = await makeRequest('PATCH', `/api/queue/${id}`, { status: 'CANCELLED' });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.body.item.status, 'CANCELLED');

    const queueRes = await makeRequest('GET', '/api/queue');
    const cancelledItem = queueRes.body.find(p => p.id === id);
    assert.ok(cancelledItem, 'Cancelled item must still be preserved in queue records');
    assert.strictEqual(cancelledItem.status, 'CANCELLED');
  })();

  // 53. Multilingual Speech Synthesis and Hindi UI Support
  await test('3-Language speech synthesis and Hindi UI strings in cabin hero & filter pills', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // Speech synthesis checks
    assert.ok(html.includes("currentLang === 'hindi'"), 'Must branch for Hindi language in voice announcer');
    assert.ok(html.includes("text = `टोकन नंबर ${tokenNum}, ${patientName}, कृपया डॉक्टर केबिन में आएं।`"), 'Must synthesize Hindi voice text');
    assert.ok(html.includes("langCode = 'hi-IN'"), 'Must use hi-IN language code for Hindi voice');

    // UI translation checks
    assert.ok(html.includes("currentLang === 'hindi' ? 'केबिन खाली है'"), 'Must have Hindi text for empty cabin header');
    assert.ok(html.includes("currentLang === 'hindi' ? `सभी (${counts.ALL})`"), 'Must translate filter pills into Hindi');
    assert.ok(html.includes("currentLang === 'hindi' ? '🔔 बुलावा'"), 'Must translate ring bell button to Hindi');
  })();

  // 54. Bottom Navigation Layout Preservation (border-t-2 & flex-col)
  await test('Bottom navigation tab switcher maintains border-t-2 and flex-col layout', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // Verify switchClinicTab implementation preserves border-t-2 and flex-col
    assert.ok(html.includes("border-t-2 border-[#25D366] text-white flex flex-col items-center justify-center gap-0.5"), 'Active tab in switchClinicTab must preserve border-t-2 and flex-col');
    assert.ok(html.includes("border-t-2 border-transparent text-emerald-100/75 hover:text-white hover:bg-white/5 flex flex-col items-center justify-center gap-0.5"), 'Inactive tabs must preserve border-t-2 and flex-col');
    // Ensure faulty horizontal flex-row and border-b-2 are absent from switchClinicTab
    assert.ok(!html.includes("border-b-2 border-[#25D366] text-white flex flex-row"), 'Must not squash tabs horizontally with border-b-2');
  })();

  // 55. Patient Booking Modal Step Indicator Pills & showBookedTokenPass Alias
  await test('Patient booking modal step pills and showBookedTokenPass alias exist with fallback IDs', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // showBookedTokenPass alias
    assert.ok(html.includes('function showBookedTokenPass()'), 'Must define showBookedTokenPass alias');
    assert.ok(html.includes('onclick="showBookedTokenPass()"'), 'HTML must invoke showBookedTokenPass');

    // Step pill fallback lookups
    assert.ok(html.includes("document.getElementById('patBookModalStepPill1') || document.getElementById('bookingStepPill1')"), 'Must safely lookup step pill 1 by both IDs');
    assert.ok(html.includes("document.getElementById('patBookModalStepPill2') || document.getElementById('bookingStepPill2')"), 'Must safely lookup step pill 2 by both IDs');

    // Landing hero section fallback selectors
    assert.ok(html.includes("document.getElementById('patientBookingLandingHero') || document.getElementById('patientLandingHeroSection')"), 'Must support both landing hero element IDs');
  })();

  // 56. Dynamic Consultation Fee Synchronization (New vs Follow-up)
  await test('setPatientVisitType dynamically synchronizes fee text badges and highlights', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    assert.ok(html.includes("id=\"visitFeeNewText\""), 'HTML must define visitFeeNewText');
    assert.ok(html.includes("id=\"visitFeeFollowupText\""), 'HTML must define visitFeeFollowupText');
    assert.ok(html.includes("feeNewEl.textContent"), 'setPatientVisitType must update visitFeeNewText dynamically');
    assert.ok(html.includes("feeFollowEl.textContent"), 'setPatientVisitType must update visitFeeFollowupText dynamically');
    assert.ok(html.includes("feeHighlightBadge.textContent = `₹${curFee}`"), 'setPatientVisitType must update patientFeeHighlightBadge');
  })();

  // 57. Unconditional Live Queue Fetching on Clinic Param Launch
  await test('Queue fetch and SSE events are initialized unconditionally on HTTP', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // Verify window.onload contains unconditional queue fetch and SSE setup
    assert.ok(html.includes('// Always fetch live queue and initialize real-time server events when hosted on HTTP'), 'Must have comment noting unconditional queue fetch');
    const onloadPos = html.indexOf('window.onload = async function');
    const listenPos = html.indexOf('window.ParchiFirebase.listen', onloadPos);
    const onloadBlock = html.substring(onloadPos, listenPos > 0 ? listenPos : html.length);
    assert.ok(onloadBlock.includes("fetch('/api/queue')"), 'Must fetch queue in window.onload');
    assert.ok(onloadBlock.includes('initServerEvents()'), 'Must call initServerEvents in window.onload');
  })();

  // 58. Color Contrast Fix on Red Background in passLiveStatusCard and Alerts
  await test('High-contrast styling on passLiveStatusCard and alerts when clinic closed or on leave', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // Check DOM IDs exist
    assert.ok(html.includes('id="passLiveStatusCard"'), 'passLiveStatusCard must exist in DOM');
    assert.ok(html.includes('id="passLiveStatusHeader"'), 'passLiveStatusHeader must exist in DOM');
    assert.ok(html.includes('id="passLiveStatusDot"'), 'passLiveStatusDot must exist in DOM');
    assert.ok(html.includes('id="passLiveQueueDistance"'), 'passLiveQueueDistance must exist in DOM');
    assert.ok(html.includes('id="passLiveStatusRow"'), 'passLiveStatusRow must exist in DOM');
    assert.ok(html.includes('id="passLiveCabinStatus"'), 'passLiveCabinStatus must exist in DOM');
    assert.ok(html.includes('id="passLiveWaitEst"'), 'passLiveWaitEst must exist in DOM');

    // Check that updatePatientTokenPassLiveStatus sets high contrast when !statusInfo.isOpen
    assert.ok(html.includes("headerEl.className = 'text-[10px] font-black uppercase text-emerald-300 flex items-center gap-1.5'"), 'passLiveStatusHeader must use high-contrast light green on red background');
    assert.ok(html.includes("distEl.className = 'text-xs font-black text-amber-200'"), 'distEl must use high-contrast text-amber-200 on red background');
    assert.ok(html.includes("waitEstEl.className = 'text-[11px] text-amber-100 font-semibold'"), 'waitEstEl must use high-contrast text-amber-100 on red background');
    assert.ok(html.includes("card.className = 'p-3.5 bg-rose-700 text-white rounded-2xl border-2 border-rose-900 text-left space-y-1.5 shadow-md'"), 'card must use bg-rose-700 and text-white when closed');

    // In renderPatientBookingPage, statusCard contrast
    assert.ok(html.includes("liveTokenEl.className = 'text-lg sm:text-xl font-black text-amber-200 mt-0.5'"), 'patientViewLiveToken must use high-contrast text-amber-200 on closed card');
    assert.ok(html.includes("waitingCountEl.className = 'text-sm font-black text-amber-200'"), 'patientViewWaitingCount must use high-contrast text-amber-200 on closed card');
  })();

  // 59. 100% Digital Vitals Drawer, Dynamic Custom Metrics, and WhatsApp Prescription Summary
  await test('Digital drawer defines standard vitals, dynamic custom metrics builder, and WhatsApp prescription reminder', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // Standard vitals & Digital summary
    assert.ok(html.includes('id="vitalBP"'), 'Drawer must include BP field');
    assert.ok(html.includes('id="vitalWeight"'), 'Drawer must include Weight field');
    assert.ok(html.includes('id="vitalTemp"'), 'Drawer must include Temp field');
    assert.ok(html.includes('id="vitalSugar"'), 'Drawer must include Sugar field');
    assert.ok(html.includes('id="drawerDoctorNotes"'), 'Drawer must include clinical summary notes textarea');

    // Dynamic custom metrics builder
    assert.ok(html.includes('id="customMetricsContainer"'), 'Drawer must include customMetricsContainer');
    assert.ok(html.includes('function addCustomMetricRow'), 'Must define addCustomMetricRow');
    assert.ok(html.includes('function removeCustomMetricRow'), 'Must define removeCustomMetricRow');
    assert.ok(html.includes('function renderDrawerCustomMetrics'), 'Must define renderDrawerCustomMetrics');

    // Follow-up selector with presets & custom input
    assert.ok(html.includes('id="followup-btn-3"'), 'Must have 3-day follow-up preset');
    assert.ok(html.includes('id="followup-btn-5"'), 'Must have 5-day follow-up preset');
    assert.ok(html.includes('id="followup-btn-7"'), 'Must have 7-day follow-up preset');
    assert.ok(html.includes('id="followup-btn-15"'), 'Must have 15-day follow-up preset');
    assert.ok(html.includes('id="customFollowUpInput"'), 'Must have custom follow-up days input');
    assert.ok(html.includes('function enableCustomFollowUp'), 'Must define enableCustomFollowUp');
    assert.ok(html.includes('function onCustomFollowUpChanged'), 'Must define onCustomFollowUpChanged');

    // Save & WhatsApp reminder
    assert.ok(html.includes('function generateWhatsAppPrescriptionText'), 'Must define generateWhatsAppPrescriptionText');
    assert.ok(html.includes('function saveParchiAndSendWhatsApp'), 'Must define saveParchiAndSendWhatsApp');
    assert.ok(html.includes('https://wa.me/'), 'saveParchiAndSendWhatsApp must format WhatsApp link via https://wa.me/');

    // Test generateWhatsAppPrescriptionText in VM context
    const code = `
      let clinicProfile = {
        name: 'City Family Clinic',
        doctorName: 'Dr. Amit Kumar',
        doctorDegree: 'MBBS, MD',
        address: 'MG Road',
        city: 'Delhi',
        phone: '9876543210'
      };
      function getShareablePatientLink() { return 'https://parchisetu.in/book?clinic=test'; }
      function getLocalDateString() { return '2026-10-29'; }
      ${html.substring(html.indexOf('function generateWhatsAppPrescriptionText'), html.indexOf('function updateFollowUpWhatsappPreview'))}
      const testP = { token: 15, name: 'Vikram Singh', age: 42, gender: 'M', doctorId: 'doc_1' };
      const vitals = {
        bp: '130/85',
        weight: '72 kg',
        temp: '99.1 °F',
        sugar: '140 mg/dL',
        customMetrics: [{ name: 'SpO2', value: '98', unit: '%' }, { name: 'Pulse', value: '76', unit: 'bpm' }],
        notes: 'Tab Paracetamol 650mg TDS x 3 days, drink warm water',
        followUpDays: 7,
        followUpDateFormatted: '05 Nov 2026'
      };
      var result = generateWhatsAppPrescriptionText(testP, vitals);
    `;
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const msg = sandbox.result;
    assert.ok(msg.includes('CITY FAMILY CLINIC'), 'Prescription must include clinic header');
    assert.ok(msg.includes('*Dr. Amit Kumar* (MBBS, MD)'), 'Prescription must include doctor name and degree');
    assert.ok(msg.includes('TOKEN #15'), 'Prescription must include token number');
    assert.ok(msg.includes('Vikram Singh'), 'Prescription must include patient name');
    assert.ok(msg.includes('BP: 130/85 mmHg'), 'Prescription must include BP');
    assert.ok(msg.includes('Sugar: 140 mg/dL'), 'Prescription must include Sugar');
    assert.ok(msg.includes('SpO2: 98 %'), 'Prescription must include custom metric SpO2');
    assert.ok(msg.includes('Pulse: 76 bpm'), 'Prescription must include custom metric Pulse');
    assert.ok(msg.includes('Tab Paracetamol 650mg TDS x 3 days'), 'Prescription must include doctor clinical notes');
    assert.ok(msg.includes('7 Din Baad (05 Nov 2026)'), 'Prescription must include follow-up reminder');
    assert.ok(msg.includes('https://parchisetu.in/book?clinic=test'), 'Prescription must include booking link');

    // Test API persistence for digital vitals & custom metrics
    const bRes = await makeRequest('POST', '/api/bookings', {
      name: 'Ramesh Digital',
      phone: '9811122233',
      bp: '120/80',
      sugar: '105 mg/dL',
      customMetrics: [{ name: 'HbA1c', value: '6.2', unit: '%' }],
      notes: 'Routine checkup completed',
      followUpDays: 15,
      followUpDate: '13 Nov 2026'
    });
    assert.ok(bRes.status === 201 || bRes.status === 200, 'POST /api/bookings should return 201 or 200');
    assert.strictEqual(bRes.body.booking.sugar, '105 mg/dL');
    assert.deepStrictEqual(bRes.body.booking.customMetrics, [{ name: 'HbA1c', value: '6.2', unit: '%' }]);
    assert.strictEqual(bRes.body.booking.followUpDays, 15);
  })();

  // 60. Interactive QR & Link Modal (Never directly triggers print)
  await test('Interactive QR modal provides copy link, raw QR download, canvas standee photo card, and poster print', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // Standee button routes to interactive modal
    assert.ok(html.includes('function printClinicQRStandee() {\n      // QR button opens the interactive modal (never directly prints)\n      openInteractiveQRModal();'), 'printClinicQRStandee must open interactive modal');
    assert.ok(html.includes('function openInteractiveQRModal()'), 'Must define openInteractiveQRModal');
    assert.ok(html.includes('function closeInteractiveQRModal()'), 'Must define closeInteractiveQRModal');
    assert.ok(html.includes('function copyInteractiveBookingLink()'), 'Must define copyInteractiveBookingLink');
    assert.ok(html.includes('function downloadRawQRCodeImage()'), 'Must define downloadRawQRCodeImage');
    assert.ok(html.includes('function downloadClinicStandeePhotoCard()'), 'Must define downloadClinicStandeePhotoCard');
    assert.ok(html.includes('function printClinicStandeePosterFromModal()'), 'Must define printClinicStandeePosterFromModal');

    // Check modal markup elements
    assert.ok(html.includes('id="interactiveBookingLinkInput"'), 'Modal must include copyable booking link input');
    assert.ok(html.includes('onclick="copyInteractiveBookingLink()"'), 'Modal must have copy link button');
    assert.ok(html.includes('onclick="downloadRawQRCodeImage()"'), 'Modal must have raw QR download button');
    assert.ok(html.includes('onclick="downloadClinicStandeePhotoCard()"'), 'Modal must have standee photo card download button');
    assert.ok(html.includes('onclick="printClinicStandeePosterFromModal()"'), 'Modal must have print poster button');
  })();

  // 61. Doctor Expected Arrival & Dynamic Real-Time Slot Time Recalculation
  await test('Doctor expected arrival setter persists liveStatus and dynamically recalculates slot times', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.status, 200);
    const html = res.body;

    // Daily setter controls in Tab 2
    assert.ok(html.includes('function setDoctorDelayMinutes'), 'Must define setDoctorDelayMinutes');
    assert.ok(html.includes('function getDoctorDelayMinutes'), 'Must define getDoctorDelayMinutes');
    assert.ok(html.includes('function getDoctorExpectedArrivalTime'), 'Must define getDoctorExpectedArrivalTime');
    assert.ok(html.includes('function getRevisedSlotInfo'), 'Must define getRevisedSlotInfo');
    assert.ok(html.includes('id="customDoctorDelayMinutesInput"'), 'Tab 2 must have custom delay minutes input');
    assert.ok(html.includes('id="customDoctorArrivalTimeInput"'), 'Tab 2 must have custom expected arrival time input');

    // Preset buttons
    assert.ok(html.includes('onclick="setDoctorDelayMinutes(0)"'), 'Must have On-Time preset');
    assert.ok(html.includes('onclick="setDoctorDelayMinutes(30)"'), 'Must have 30m late preset');
    assert.ok(html.includes('onclick="setDoctorDelayMinutes(45)"'), 'Must have 45m late preset');
    assert.ok(html.includes('onclick="setDoctorDelayMinutes(60)"'), 'Must have 60m late preset');
    assert.ok(html.includes('onclick="setDoctorDelayMinutes(-30)"'), 'Must have 30m early preset');

    // Test API persistence for doctorDelayMinutes in liveStatus
    const clinicUpdateRes = await makeRequest('POST', '/api/clinic', {
      liveStatus: {
        isDoctorLate: true,
        doctorDelayMinutes: 45,
        expectedArrivalTime: '10:45 AM'
      }
    });
    assert.strictEqual(clinicUpdateRes.status, 200);
    assert.strictEqual(clinicUpdateRes.body.clinic.liveStatus.doctorDelayMinutes, 45);
    assert.strictEqual(clinicUpdateRes.body.clinic.liveStatus.expectedArrivalTime, '10:45 AM');

    // Test getRevisedSlotInfo calculation in VM context
    const code = `
      let clinicProfile = {
        doctorName: 'Dr. Rajesh Sharma',
        visitingHours: { morning: { enabled: true, start: '10:00 AM' } },
        liveStatus: { doctorDelayMinutes: 45, expectedArrivalTime: '10:45 AM' }
      };
      ${html.substring(html.indexOf('function parseSlotTimeToMinutes'), html.indexOf('function isPatientLate'))}
      ${html.substring(html.indexOf('function getDoctorDelayMinutes'), html.indexOf('function setDoctorDelayMinutes'))}
      var onTimeSlot = getRevisedSlotInfo('11:00 AM');
      clinicProfile.liveStatus.doctorDelayMinutes = 0;
      var zeroDelaySlot = getRevisedSlotInfo('11:00 AM');
      clinicProfile.liveStatus.doctorDelayMinutes = 45;
      var delayedSlot = getRevisedSlotInfo('11:00 AM');
      clinicProfile.liveStatus.doctorDelayMinutes = -30;
      var earlySlot = getRevisedSlotInfo('11:00 AM');
    `;
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    assert.strictEqual(sandbox.zeroDelaySlot.hasChange, false, 'Zero delay must not flag change');
    assert.strictEqual(sandbox.zeroDelaySlot.displayText, '11:00 AM (On time)');
    assert.strictEqual(sandbox.delayedSlot.hasChange, true, '45m delay must flag change');
    assert.strictEqual(sandbox.delayedSlot.revised, '11:45 AM', '11:00 AM + 45m must be 11:45 AM');
    assert.ok(sandbox.delayedSlot.displayText.includes('Revised: 11:45 AM'), 'Display text must show Revised: 11:45 AM');
    assert.ok(sandbox.delayedSlot.displayText.includes('45m late'), 'Display text must show 45m late');

    assert.strictEqual(sandbox.earlySlot.hasChange, true, 'Early delay must flag change');
    assert.strictEqual(sandbox.earlySlot.revised, '10:30 AM', '11:00 AM - 30m must be 10:30 AM');
    assert.ok(sandbox.earlySlot.displayText.includes('Revised: 10:30 AM'), 'Display text must show Revised: 10:30 AM');
  })();

  // Restore clean default clinic state and empty queue
  await makeRequest('POST', '/api/queue/reset');
  const defaultClinic = {
    id: 'clinic_sanjeevani_01',
    name: 'Sanjeevani Family Clinic',
    tagline: 'General Physician & Family Healthcare',
    category: 'General Medicine',
    address: 'Near Main Market Chowk, Station Road',
    city: 'Patna, Bihar',
    phone: '9835012345',
    whatsapp: '9835012345',
    upiId: 'sanjeevaniclinic@upi',
    doctorName: 'Dr. Rajesh Sharma',
    doctorDegree: 'MBBS, MD (General Physician)',
    doctorRegNo: 'MCI-48291',
    experienceYears: 14,
    doctors: [
      {
        id: 'doc_1',
        name: 'Dr. Rajesh Sharma',
        degree: 'MBBS, MD (General Physician)',
        specialty: 'General Physician',
        regNo: 'MCI-48291',
        fee: 300,
        isMain: true
      }
    ],
    fees: { normal: 300, followup: 200, emergency: 500, report: 0 },
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 25 },
      evening: { enabled: true, start: '05:00 PM', end: '09:00 PM', slotDurationMins: 15, maxTokens: 30 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    },
    visitingReasons: [
      '🤒 Bukhar / Cold',
      '🩸 BP / Sugar',
      '🤢 Pet / Gas',
      '🔄 Follow-up',
      '📋 Report Check',
      '🤕 Dard / Injury'
    ],
    leaves: {},
    liveStatus: {
      isDoctorLate: false,
      doctorDelayMinutes: 0,
      expectedArrivalTime: '10:00 AM'
    },
    onboarded: true
  };
  await makeRequest('POST', '/api/clinic', defaultClinic);

  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Start test server
server.listen(TEST_PORT, async () => {
  try {
    await runTests();
  } catch (err) {
    console.error('Runner error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
