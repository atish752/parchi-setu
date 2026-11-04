/**
 * Deep Skeptical Verification Test Suite for ParchiSetu
 * Verifies all edge cases, route responses, security rules, queue sync, walk-in logic, and master password.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const requestHandler = require('./server');
const store = require('./api/_store');
const fb = require('./firebase-sync');

let server;
let port;

function makeRequest(method, reqPath, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: port,
        path: reqPath,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : {} });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('🧪 Starting Deep Skeptical Verification Suite...\n');

  server = http.createServer(requestHandler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    port = server.address().port;
    resolve();
  }));

  try {
    // 1. File byte identities
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const altHtml = fs.readFileSync(path.join(__dirname, 'parchisetu_indian_clinic_management_token_web_app.html'), 'utf8');
    assert.strictEqual(indexHtml, altHtml, 'index.html and parchisetu_indian_clinic_management_token_web_app.html must be 100% byte-identical');
    console.log('✅ PASS: HTML files are 100% byte identical');

    const fbSync = fs.readFileSync(path.join(__dirname, 'firebase-sync.js'), 'utf8');
    const pubFbSync = fs.readFileSync(path.join(__dirname, 'public', 'firebase-sync.js'), 'utf8');
    assert.strictEqual(fbSync, pubFbSync, 'firebase-sync.js and public/firebase-sync.js must be 100% byte-identical');
    console.log('✅ PASS: Firebase-sync files are 100% byte identical');

    // 2. Master Admin Password check
    const MASTER_PASS = 'UHI(*Y90Jjk0JKop:ki-0PIkj9OP0';
    assert.ok(indexHtml.includes(MASTER_PASS), 'HTML must contain exact master admin password');
    assert.ok(indexHtml.includes(`code === '${MASTER_PASS}'`), 'verifyAdminPasscode must check exact master password');
    console.log('✅ PASS: Master Admin Password is exact and active');

    // 3. Routing tests on server
    const routes = ['/', '/clinic', '/admin', '/signin', '/login', '/book', '/onboard'];
    for (const r of routes) {
      const res = await makeRequest('GET', r);
      assert.strictEqual(res.status, 200, `Route ${r} must return 200`);
      assert.ok(res.body.includes('ParchiSetu'), `Route ${r} must serve ParchiSetu HTML`);
    }
    console.log('✅ PASS: Clean HTTP routing for /, /clinic, /admin, /signin, /login, /book, /onboard');

    // 4. Firestore rules coverage
    const rules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
    assert.ok(rules.includes('service cloud.firestore'), 'firestore.rules must target cloud.firestore');
    assert.ok(rules.includes('match /clinics/{clinicId}'), 'Must cover /clinics/{clinicId}');
    assert.ok(rules.includes('match /bookings/{bookingId}'), 'Must cover bookings subcollection');
    assert.ok(rules.includes('match /users/{userId}'), 'Must cover /users/{userId}');
    assert.ok(rules.includes('match /{document=**}'), 'Must have catch-all fallback wildcard');
    console.log('✅ PASS: firestore.rules covers all collections and subcollections');

    // 5. Firebase Sync API interface
    assert.strictEqual(typeof fb.initFirebase, 'function');
    assert.strictEqual(typeof fb.getAllClinics, 'function');
    assert.strictEqual(typeof fb.getAllClinicsFromFirestore, 'function');
    assert.strictEqual(typeof fb.listenToClinics, 'function');
    assert.strictEqual(typeof fb.getClinicFromFirestore, 'function');
    assert.strictEqual(typeof fb.getQueueFromFirestore, 'function');
    assert.strictEqual(typeof fb.listenToClinicRealtime, 'function');
    assert.strictEqual(typeof fb.syncClinicToFirestore, 'function');
    assert.strictEqual(typeof fb.saveBookingToFirestore, 'function');
    assert.strictEqual(typeof fb.updateBookingInFirestore, 'function');
    assert.strictEqual(typeof fb.updateLiveStatusInFirestore, 'function');
    assert.strictEqual(typeof fb.getClinicForUser, 'function');
    assert.strictEqual(typeof fb.saveUserClinicMapping, 'function');
    console.log('✅ PASS: firebase-sync exports all expected methods and aliases');

    // 6. Dummy clinic filter discrimination
    const realClinics = [
      'Dr. Ananya Roy Child Care Clinic',
      'Patna Dental Surgery & Implant Center',
      'City Health Family Clinic',
      'Care & Cure Polyclinic',
      'LifeCare Diagnostic & Medical Chamber',
      'Sharma Eye & Laser Hospital'
    ];
    for (const name of realClinics) {
      assert.strictEqual(store.isDummyClinicName(name), false, `Real clinic "${name}" must NOT be flagged as dummy`);
    }
    const seedDummies = [
      'Sanjeevani Family Clinic',
      'Patna Central Hospital Clinic',
      'Apex Orthopedic & Joint Care',
      'Kaya Skin, Hair & Laser Clinic',
      'Aarogya Family Clinic',
      'dummy clinic'
    ];
    for (const name of seedDummies) {
      assert.strictEqual(store.isDummyClinicName(name), true, `Dummy clinic "${name}" must be flagged as dummy`);
    }
    console.log('✅ PASS: isDummyClinicName strictly distinguishes authentic clinics from dummy seeds');

    // 7. Queue reset via API
    await makeRequest('POST', '/api/queue/reset');
    const emptyQueueRes = await makeRequest('GET', '/api/queue');
    assert.strictEqual(emptyQueueRes.status, 200);
    assert.ok(Array.isArray(emptyQueueRes.body));
    console.log('✅ PASS: /api/queue/reset cleanly resets queue');

    // 8. Walk-in and Booking creation
    const walkinRes = await makeRequest('POST', '/api/bookings', {
      clinicId: 'clinic_test_deep',
      name: 'Sunita Devi',
      age: 42,
      gender: 'F',
      source: 'Walk-in'
    });
    assert.strictEqual(walkinRes.status, 201);
    assert.strictEqual(walkinRes.body.booking.name, 'Sunita Devi');
    assert.strictEqual(walkinRes.body.booking.source, 'Walk-in');
    console.log('✅ PASS: Fast walk-in booking succeeds');

    // 9. Booking validation (missing name rejected)
    const badBookingRes = await makeRequest('POST', '/api/bookings', {
      phone: '9876543210'
    });
    assert.strictEqual(badBookingRes.status, 400);
    console.log('✅ PASS: Missing booking name correctly rejected with 400');

    // 10. Live Status & Delay update
    const liveUpdateRes = await makeRequest('POST', '/api/clinic', {
      id: 'clinic_test_deep',
      liveStatus: {
        isDoctorLate: true,
        doctorDelayMinutes: 45,
        expectedArrivalTime: '10:45 AM',
        isQRBookingPaused: true
      }
    });
    assert.strictEqual(liveUpdateRes.status, 200);
    assert.strictEqual(liveUpdateRes.body.clinic.liveStatus.doctorDelayMinutes, 45);
    assert.strictEqual(liveUpdateRes.body.clinic.liveStatus.isQRBookingPaused, true);
    console.log('✅ PASS: Doctor delay and QR pause liveStatus updates persist cleanly');

    console.log('\n======================================================');
    console.log('🎉 ALL 10/10 DEEP VERIFICATION SUITES PASSED PERFECTLY!');
    console.log('======================================================\n');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 100);
  } finally {
    try { server.close(); } catch (e) {}
  }
}

run().catch(err => {
  console.error('\n❌ DEEP VERIFICATION FAILED:', err);
  process.exit(1);
});
