/**
 * Parchisetu End-to-End Verification Test Suite
 * Tests server, onboarding API, patient booking flow, queue sync, deduplication, and HTML integrity.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

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
    leaves: {},
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
