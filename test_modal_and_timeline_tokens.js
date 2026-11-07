/**
 * test_modal_and_timeline_tokens.js
 * Verification of:
 * 1. Patient booking modal visibility, container classes, and openPatientBookingModal() behavior.
 * 2. 1-Patient per slot absolute enforcement (HTTP 409 conflict & disabled frontend pills).
 * 3. Timeline-based chronological token numbering (earliest slot time gets #1 regardless of booking order).
 * 4. Twin HTML file 100% byte-for-byte identity.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const { server, appData, reassignTimelineTokens } = require('./server');

const TEST_PORT = 3195;

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
        res.setEncoding('utf8');
        let raw = '';
        res.on('data', chunk => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runRegressionSuite() {
  console.log('======================================================================');
  console.log('🧪 Starting Modal Visibility, Slot Uniqueness & Timeline Tokens Suite...');
  console.log('======================================================================\n');

  // 1. Twin HTML Parity
  console.log('1. Checking Twin HTML Byte-for-Byte Identity...');
  const indexHtml = fs.readFileSync('index.html');
  const twinHtml = fs.readFileSync('parchisetu_indian_clinic_management_token_web_app.html');
  assert.strictEqual(indexHtml.length, twinHtml.length, 'Twin files must have exact same byte length');
  assert.ok(indexHtml.equals(twinHtml), 'Twin files must be 100% byte-for-byte identical');
  console.log('✅ PASS: Twin HTML files are 100% byte-for-byte identical');

  const htmlStr = indexHtml.toString('utf8');

  // 2. Patient Booking Modal Layout & Mobile Viewport Protection
  console.log('2. Verifying Patient Booking Modal DOM Structure & Viewport Classes...');
  assert.ok(htmlStr.includes('id="patientBookingModal"'), 'Must have #patientBookingModal');
  assert.ok(htmlStr.includes('id="patientBookingModalContent"'), 'Must have #patientBookingModalContent');
  assert.ok(htmlStr.includes('id="patientBookingFormContainer"'), 'Must have #patientBookingFormContainer');
  assert.ok(htmlStr.includes('id="patBookingModalStep1"'), 'Must have #patBookingModalStep1');
  assert.ok(htmlStr.includes('id="patBookingModalStep2"'), 'Must have #patBookingModalStep2');

  // Check flex-col, max-h-[92dvh] / max-h-[92vh], min-h-0, shrink-0
  assert.ok(htmlStr.includes('max-h-[92dvh]'), 'Modal content must use dynamic viewport max-h-[92dvh]');
  assert.ok(htmlStr.includes('flex flex-col'), 'Modal content must use flex flex-col layout');
  assert.ok(htmlStr.includes('min-h-0'), 'Modal form container must use min-h-0 to allow scrolling');
  assert.ok(htmlStr.includes('overflow-y-auto'), 'Modal form container must be overflow-y-auto');

  // 3. openPatientBookingModal() removes hidden on patientBookingFormContainer
  console.log('3. Verifying openPatientBookingModal() un-hiding logic...');
  const openFnIdx = htmlStr.indexOf('function openPatientBookingModal()');
  assert.ok(openFnIdx > 0, 'openPatientBookingModal must be defined');
  const nextFnIdx = htmlStr.indexOf('function closePatientBookingModal()', openFnIdx);
  const openFnSnippet = htmlStr.slice(openFnIdx, nextFnIdx > openFnIdx ? nextFnIdx : openFnIdx + 4000);
  assert.ok(openFnSnippet.includes("formContainer.classList.remove('hidden')"), 'Must explicitly un-hide patientBookingFormContainer');
  assert.ok(openFnSnippet.includes("step1.classList.remove('hidden')"), 'Must explicitly show step 1');
  assert.ok(openFnSnippet.includes("refreshPatientBookingSlotsFromServer()"), 'Must refresh slots from server on modal open');
  console.log('✅ PASS: openPatientBookingModal() properly unhides form container and step 1');

  // 4. Server-Side 1-Patient Per Slot Enforcement (HTTP 409 Conflict)
  console.log('4. Verifying Server-Side 1-Patient Per Slot Enforcement...');
  appData.queue = [];
  const testClinicId = 'clinic_slot_test_' + Date.now();
  const testDate = '2026-11-07';

  // Book first appointment at 05:30 PM
  const book1 = await makeRequest('POST', '/api/bookings', {
    clinicId: testClinicId,
    name: 'Atish',
    phone: '9835012345',
    shift: 'Evening',
    slotTime: '05:30 PM',
    date: testDate,
    day: 'Aaj (Today)'
  });
  assert.strictEqual(book1.status, 201, 'First booking at 05:30 PM must succeed');
  assert.strictEqual(book1.body.booking.slotTime, '05:30 PM');

  // Attempt duplicate booking at 05:30 PM on the same date and clinic
  const dupBooking = await makeRequest('POST', '/api/bookings', {
    clinicId: testClinicId,
    name: 'test',
    phone: '9835099999',
    shift: 'Evening',
    slotTime: '05:30 PM',
    date: testDate,
    day: 'Aaj (Today)'
  });
  assert.strictEqual(dupBooking.status, 409, 'Duplicate booking for same slot must return HTTP 409 Conflict');
  assert.ok(dupBooking.body.slotAlreadyBooked || dupBooking.body.error, 'Must indicate slot double-booking error');
  console.log('✅ PASS: Duplicate 05:30 PM booking strictly rejected with HTTP 409 Conflict');

  // Also test duplicate booking with revised text format like '05:30 PM (Revised: 3:35 PM)'
  const dupRevised = await makeRequest('POST', '/api/bookings', {
    clinicId: testClinicId,
    name: 'third patient',
    phone: '9835088888',
    shift: 'Evening',
    slotTime: '05:30 PM (Revised: 3:35 PM • Dr. atish is 115m early)',
    date: testDate,
    day: 'Aaj (Today)'
  });
  assert.strictEqual(dupRevised.status, 409, 'Revised slot text must normalize and return 409 Conflict');
  console.log('✅ PASS: Revised format duplicate also strictly rejected with HTTP 409');

  // 5. Timeline-Based Chronological Token Numbering
  console.log('5. Verifying Timeline-Based Chronological Token Numbering...');
  // Patient 1 (Atish) already booked 05:30 PM (Evening).
  // Now Patient 2 books 10:00 AM (Morning) - booked AFTER Patient 1, but for an EARLIER slot!
  const book2 = await makeRequest('POST', '/api/bookings', {
    clinicId: testClinicId,
    name: 'Morning Patient',
    phone: '9835077777',
    shift: 'Morning',
    slotTime: '10:00 AM',
    date: testDate,
    day: 'Aaj (Today)'
  });
  assert.strictEqual(book2.status, 201, 'Booking 10:00 AM must succeed');

  // Now Patient 3 books 10:15 AM (Morning)
  const book3 = await makeRequest('POST', '/api/bookings', {
    clinicId: testClinicId,
    name: 'Morning Patient Two',
    phone: '9835066666',
    shift: 'Morning',
    slotTime: '10:15 AM',
    date: testDate,
    day: 'Aaj (Today)'
  });
  assert.strictEqual(book3.status, 201, 'Booking 10:15 AM must succeed');

  // Fetch the queue from GET /api/queue?clinic=testClinicId
  const qRes = await makeRequest('GET', `/api/queue?clinic=${encodeURIComponent(testClinicId)}`);
  assert.strictEqual(qRes.status, 200);
  const queue = qRes.body;
  assert.strictEqual(queue.length, 3, 'Must have exactly 3 patients in queue');

  const p1000 = queue.find(p => p.name === 'Morning Patient');
  const p1015 = queue.find(p => p.name === 'Morning Patient Two');
  const p0530 = queue.find(p => p.name === 'Atish');

  assert.ok(p1000, 'Morning Patient (10:00 AM) must exist');
  assert.ok(p1015, 'Morning Patient Two (10:15 AM) must exist');
  assert.ok(p0530, 'Atish (05:30 PM) must exist');

  // Check timeline token numbers:
  // 10:00 AM must be Token #1
  // 10:15 AM must be Token #2
  // 05:30 PM must be Token #3
  assert.strictEqual(p1000.token, 1, '10:00 AM slot must be Token #1');
  assert.strictEqual(p1015.token, 2, '10:15 AM slot must be Token #2');
  assert.strictEqual(p0530.token, 3, '05:30 PM slot must be Token #3');
  console.log('✅ PASS: Tokens assigned strictly chronologically by slot time (10:00 AM -> #1, 10:15 AM -> #2, 05:30 PM -> #3)');

  // 6. Frontend Slot Pill Rendering Verification
  console.log('6. Verifying Frontend Slot Pill Rendering & Booked Badge in Sandbox...');
  let capturedHtml = '';
  const slotPillsEl = {
    set innerHTML(html) { capturedHtml = html; },
    get innerHTML() { return capturedHtml; }
  };
  const sandbox = {
    selectedPatShift: 'Morning',
    selectedPatCustomDate: testDate,
    selectedPatSlot: '',
    todayQueue: [
      { id: 'p1', name: 'Booked Morning', slotTime: '10:00 AM', date: testDate, status: 'WAITING', clinicId: testClinicId },
      { id: 'p2', name: 'Cancelled Morning', slotTime: '10:15 AM', date: testDate, status: 'CANCELLED', clinicId: testClinicId }
    ],
    clinicProfile: {
      id: testClinicId,
      visitingHours: {
        morning: { enabled: true, start: '10:00 AM', end: '11:00 AM', slotDurationMins: 15, maxTokens: 25 },
        evening: { enabled: true, start: '05:00 PM', end: '07:00 PM', slotDurationMins: 15, maxTokens: 25 },
        daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      },
      leaves: {}
    },
    document: {
      getElementById: (id) => (id === 'patientTimeSlotPills' ? slotPillsEl : null)
    }
  };
  vm.createContext(sandbox);

  // Extract relevant helper functions dynamically from index.html
  const parseTimeIdx = htmlStr.indexOf('function parseTimeString');
  const genSlotsEndIdx = htmlStr.indexOf('let lastPatientBooking = null;');
  const helper1 = htmlStr.substring(parseTimeIdx, genSlotsEndIdx);

  const renderSlotPillsIdx = htmlStr.indexOf('function renderSlotPills()');
  const renderSlotPillsEndIdx = htmlStr.indexOf('function renderVisitingReasons()');
  const helper2 = htmlStr.substring(renderSlotPillsIdx, renderSlotPillsEndIdx);

  const helperCode = helper1 + '\n' + helper2;
  vm.runInContext(helperCode, sandbox);

  // Run renderSlotPills() in sandbox
  vm.runInContext('renderSlotPills();', sandbox);
  const pillHtml = sandbox.document.getElementById('patientTimeSlotPills').innerHTML;

  // 10:00 AM is booked -> must have disabled, opacity-40, line-through, and Booked
  assert.ok(pillHtml.includes('disabled'), 'Booked slot button must be disabled');
  assert.ok(pillHtml.includes('opacity-40'), 'Booked slot button must have opacity-40');
  assert.ok(pillHtml.includes('line-through'), 'Booked slot button must have line-through');
  assert.ok(pillHtml.includes('Booked'), 'Booked slot button must have Booked label');

  // 10:15 AM was CANCELLED -> must NOT be disabled
  assert.ok(pillHtml.includes("selectedPatSlot='10:15 AM'"), 'Cancelled slot 10:15 AM must be available for re-booking');
  console.log('✅ PASS: Frontend slot pills render booked slots with disabled, opacity-40, line-through, and Booked badge');

  console.log('\n======================================================================');
  console.log('🎉 ALL MODAL, SLOT UNIQUENESS & TIMELINE TOKEN TESTS PASSED 100%!');
  console.log('======================================================================\n');
}

server.listen(TEST_PORT, async () => {
  try {
    await runRegressionSuite();
  } catch (err) {
    console.error('Regression suite failed:', err);
    process.exit(1);
  } finally {
    server.close();
    try {
      appData.queue = [];
      const cleanData = {
        clinic: null,
        clinics: {},
        queue: [],
        patientRegister: [],
        prescriptions: [],
        bills: [],
        analytics: {
          totalRevenue: 0,
          completedCount: 0,
          cancelledCount: 0,
          peakHour: '11:00 AM'
        }
      };
      fs.writeFileSync(path.join(__dirname, 'clinic_data.json'), JSON.stringify(cleanData, null, 2), 'utf8');
      const os = require('os');
      const f1 = path.join(os.tmpdir(), 'parchisetu_shared_data.json');
      const f2 = path.join(os.tmpdir(), 'klinicq_shared_data.json');
      if (fs.existsSync(f1)) fs.unlinkSync(f1);
      if (fs.existsSync(f2)) fs.unlinkSync(f2);
    } catch (e) {}
    process.exit(0);
  }
});
