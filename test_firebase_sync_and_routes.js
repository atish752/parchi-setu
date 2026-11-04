const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

const requestHandler = require('./server');
const store = require('./api/_store');
const fb = require('./firebase-sync');

async function runTests() {
  console.log('🔬 Running targeted verification for Firestore sync, live rules, and route separation...\n');

  // 1. Verify firestore.rules file existence and rules structure
  assert.ok(fs.existsSync(path.join(__dirname, 'firestore.rules')), 'firestore.rules file must exist');
  const rulesContent = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
  assert.ok(rulesContent.includes('match /clinics/{clinicId}'), 'Rules must match clinics collection');
  assert.ok(rulesContent.includes('match /bookings/{bookingId}'), 'Rules must match bookings subcollection');
  assert.ok(rulesContent.includes('match /users/{userId}'), 'Rules must match users collection');
  assert.ok(rulesContent.includes('allow read: if true'), 'Rules must allow public reading of clinics and bookings');
  assert.ok(rulesContent.includes('allow create, update, delete: if true') || rulesContent.includes('allow write: if true'), 'Rules must allow writes to bookings');
  console.log('✅ PASS: firestore.rules exists and provides bulletproof permissions');

  // 2. Verify firebase.json
  assert.ok(fs.existsSync(path.join(__dirname, 'firebase.json')), 'firebase.json must exist');
  const fbJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase.json'), 'utf8'));
  assert.strictEqual(fbJson.firestore.rules, 'firestore.rules');
  console.log('✅ PASS: firebase.json configured correctly');

  // 3. Verify Admin Master Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0 in HTML
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.ok(html.includes('UHI(*Y90Jjk0JKop:ki-0PIkj9OP0'), 'HTML must contain Master Admin Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0');
  
  // Test verifyAdminPasscode in sandbox
  const sandbox = {
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
  const scriptMatch = html.match(/function verifyAdminPasscode\(\)[\s\S]*?\n    \}/);
  assert.ok(scriptMatch, 'verifyAdminPasscode must be present in index.html');
  vm.runInNewContext(scriptMatch[0] + '\nfunction closeAdminPasscodeModal() {}', sandbox);
  sandbox.verifyAdminPasscode();
  assert.strictEqual(sandbox.sessionStorage.getItem('parchisetu_admin_auth'), '1', 'Master Password must unlock admin session');
  console.log('✅ PASS: Master Password UHI(*Y90Jjk0JKop:ki-0PIkj9OP0 unlocks admin portal successfully');

  // 4. Verify isDummyClinicName does NOT reject real clinics
  assert.strictEqual(store.isDummyClinicName('Sharma Dental Clinic'), false);
  assert.strictEqual(store.isDummyClinicName('Patna Heart Care Hospital'), false);
  assert.strictEqual(store.isDummyClinicName('Apex Joint Clinic & Surgery'), false);
  assert.strictEqual(store.isDummyClinicName('Gupta Family Clinic'), false);
  assert.strictEqual(store.isDummyClinicName('Sanjeevani Family Clinic'), true); // Seed dummy clinic
  assert.strictEqual(store.isDummyClinicName('Apex Orthopedic & Joint Care'), true); // Seed dummy clinic
  console.log('✅ PASS: isDummyClinicName correctly distinguishes authentic clinics from seed mock clinics');

  // 5. Verify listenToClinics export in firebase-sync.js
  assert.strictEqual(typeof fb.listenToClinics, 'function', 'listenToClinics must be exported from firebase-sync.js');
  console.log('✅ PASS: listenToClinics is exported for live patient discovery feed');

  // 6. Verify server endpoints with a real HTTP server
  const server = http.createServer(requestHandler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  function req(method, p, body = null) {
    return new Promise((resolve, reject) => {
      const dataStr = body ? JSON.stringify(body) : null;
      const r = http.request(
        {
          hostname: '127.0.0.1',
          port: port,
          path: p,
          method: method,
          headers: {
            'Content-Type': 'application/json',
            ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {})
          }
        },
        res => {
          let out = '';
          res.on('data', c => { out += c; });
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
            catch (e) { resolve({ status: res.statusCode, body: out }); }
          });
        }
      );
      r.on('error', reject);
      if (dataStr) r.write(dataStr);
      r.end();
    });
  }

  // 7. Route check: GET / (Patient Homescreen)
  const homeRes = await req('GET', '/');
  assert.strictEqual(homeRes.status, 200);
  assert.ok(homeRes.body.includes('patientDiscoverySection'), 'Home screen must include patientDiscoverySection');

  // 8. Route check: GET /clinic (Clinic Desk / Gateway)
  const clinicRes = await req('GET', '/clinic');
  assert.strictEqual(clinicRes.status, 200);
  assert.ok(clinicRes.body.includes('viewAuthGateway'), 'Clinic route must include viewAuthGateway');

  // 9. Route check: GET /admin (Admin Portal)
  const adminRes = await req('GET', '/admin');
  assert.strictEqual(adminRes.status, 200);
  assert.ok(adminRes.body.includes('adminPasscodeModal'), 'Admin route must include adminPasscodeModal');

  // 10. Register an authentic clinic from clinic panel with custom name and check it appears in patient feed
  const newDoctorClinic = {
    id: 'clinic_new_doctor_' + Date.now(),
    name: 'Dr. R. K. Verma Child Care Clinic',
    doctorName: 'Dr. R. K. Verma',
    specialty: 'Child / Pediatric',
    city: 'Patna, Bihar',
    ownerUid: 'uid_dr_verma_123',
    ownerEmail: 'verma@clinic.com',
    createdViaClinicPanel: true,
    fees: { normal: 400, followup: 250, emergency: 600, report: 0 },
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 25 },
      evening: { enabled: true, start: '05:00 PM', end: '09:00 PM', slotDurationMins: 15, maxTokens: 30 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    }
  };

  const createRes = await req('POST', '/api/clinic', newDoctorClinic);
  assert.strictEqual(createRes.status, 200);
  assert.strictEqual(createRes.body.success, true);

  // Check it appears in realOnly clinics list for patient discovery
  const discRes = await req('GET', '/api/clinics?realOnly=true');
  assert.strictEqual(discRes.status, 200);
  assert.ok(Array.isArray(discRes.body));
  const found = discRes.body.find(c => c.id === newDoctorClinic.id);
  assert.ok(found, 'Newly registered doctor clinic must appear in patient discovery feed');
  assert.strictEqual(found.doctorName, 'Dr. R. K. Verma');

  // 11. Book appointment at this specific clinic
  const bookingPayload = {
    clinicId: newDoctorClinic.id,
    name: 'Aman Deep',
    phone: '9835001122',
    age: 8,
    gender: 'M',
    reason: 'Sardi / Bukhar',
    source: 'QR Booked',
    shift: 'Morning',
    slotTime: '10:30 AM',
    day: 'Aaj (Today)'
  };
  const bookRes = await req('POST', '/api/bookings', bookingPayload);
  assert.strictEqual(bookRes.status, 201);
  assert.strictEqual(bookRes.body.booking.name, 'Aman Deep');
  assert.strictEqual(bookRes.body.booking.clinicId, newDoctorClinic.id);

  // 12. Check queue for this specific clinic
  const qRes = await req('GET', `/api/queue?clinic=${encodeURIComponent(newDoctorClinic.id)}`);
  assert.strictEqual(qRes.status, 200);
  assert.ok(Array.isArray(qRes.body));
  const qItem = qRes.body.find(b => b.id === bookRes.body.booking.id);
  assert.ok(qItem, 'Booked patient must be present in specific clinic queue');

  // Close server
  await new Promise(resolve => server.close(resolve));
  console.log('✅ PASS: Real HTTP server routes, authentic clinic registration, and clinic queue verified');

  console.log('\n======================================================');
  console.log('🎉 ALL TARGETED TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
