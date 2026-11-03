/**
 * Comprehensive Verification Test for ParchiSetu
 * Deeply tests all aspects of:
 * 1. Branding (parchi-setu / ParchiSetu)
 * 2. Dummy clinic elimination & Google-only verification in Patient Browsing
 * 3. Top-right Clinic button & Hidden Admin button (/admin route only)
 * 4. Multi-device Google Sign-in, Clinic Data Persistence & Live Queue Sync
 * 5. Supabase CRUD, schema, mapping & Admin Panel View
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const requestHandler = require('./server');
const store = require('./api/_store');
const supabase = require('./api/_supabase');

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
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runVerification() {
  console.log('🧪 Starting ParchiSetu Rigorous Verification...\n');

  // Start temporary test server
  server = http.createServer(requestHandler);
  await new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  let passCount = 0;
  function pass(title) {
    passCount++;
    console.log(`✅ PASS: ${title}`);
  }

  try {
    // 1. BRANDING VERIFICATION
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.name, 'parchi-setu', 'package.json name must be parchi-setu');
    
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const altHtml = fs.readFileSync(path.join(__dirname, 'parchisetu_indian_clinic_management_token_web_app.html'), 'utf8');
    assert.strictEqual(html, altHtml, 'index.html and parchisetu_indian_clinic_management_token_web_app.html must be byte-identical');
    assert.ok(html.includes('<title>ParchiSetu • Smart Clinic & Token App for India</title>'), 'HTML title must brand ParchiSetu');
    assert.ok(html.includes('https://parchi-setu.vercel.app/'), 'Must reference main live domain');
    pass('ParchiSetu Rebranding across package.json, HTML templates, and byte identity');

    // 2. DUMMY CLINICS ELIMINATION & GOOGLE-ONLY FILTERING
    assert.ok(html.includes('let clinicsDirectory = [];'), 'clinicsDirectory must initialize to empty array');
    assert.ok(html.includes('id="discoveryDoctorCountBadge" class="text-[10px] font-extrabold text-[#075E54] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">\n                0 Doctors'), 'Doctor count badge must start at 0 Doctors');
    assert.ok(!html.includes('id="patientViewClinicName" class="text-xl font-black mt-1">Sanjeevani Family Clinic'), 'Static patient view must not show dummy Sanjeevani clinic');
    assert.ok(!html.includes('id="detailDocName" class="text-lg font-black text-white mt-1">Dr. Rajesh Sharma'), 'Doctor detail modal must not show dummy Dr. Rajesh Sharma');
    
    // GET /api/clinics?realOnly=true must filter out all dummy clinics
    const realClinicsRes = await makeRequest('GET', '/api/clinics?realOnly=true');
    assert.strictEqual(realClinicsRes.status, 200);
    assert.ok(Array.isArray(realClinicsRes.body));
    const hasDummyInReal = realClinicsRes.body.some(c => store.isDummyClinicName(c.name));
    assert.strictEqual(hasDummyInReal, false, 'No dummy clinic names should ever appear in realOnly list');
    pass('Dummy clinics eliminated from patient browsing & empty state clean baseline');

    // 3. TOP-RIGHT CLINIC AUTH BUTTON & HIDDEN ADMIN ROUTE
    assert.ok(html.includes('id="discoveryClinicAuthBtn"'), 'Must have discoveryClinicAuthBtn in browsing header');
    assert.ok(html.includes('onclick="showAuthGatewayScreen()" \n                id="discoveryClinicAuthBtn"'), 'discoveryClinicAuthBtn must trigger showAuthGatewayScreen directly without blocking confirm');
    assert.ok(html.includes('id="headerAdminBtn"\n            class="hidden'), 'headerAdminBtn must be hidden in UI');
    assert.ok(html.includes("currentPath.startsWith('/admin') || currentHash === '#admin'"), 'Admin panel must only open via /admin or #admin');
    pass('Clinic Panel button in top-right of patient discovery & Admin button completely hidden');

    // 4. GOOGLE CLINIC REGISTRATION & PERSISTENCE
    const testOwnerUid = 'google_uid_test_' + Date.now();
    const testEmail = 'doctor.verma@example.com';
    const testClinic = {
      id: 'clinic_verma_eye_' + Date.now(),
      name: 'Dr. Verma Eye & Laser Hospital',
      doctorName: 'Dr. Neeraj Verma',
      doctorDegree: 'MBBS, MS (Ophthalmology)',
      specialty: 'Eye Care',
      city: 'Patna, Bihar',
      phone: '9876543210',
      ownerUid: testOwnerUid,
      ownerEmail: testEmail,
      isGoogleAuth: true,
      googleRegistered: true,
      fees: { normal: 500, followup: 300, emergency: 800, report: 0 },
      visitingHours: {
        morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 25 },
        evening: { enabled: true, start: '05:00 PM', end: '09:00 PM', slotDurationMins: 15, maxTokens: 30 },
        daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        avgConsultationMins: 10
      }
    };

    // Save clinic (Simulating Doctor Onboarding)
    const postClinicRes = await makeRequest('POST', '/api/clinic', testClinic);
    assert.strictEqual(postClinicRes.status, 200);
    assert.strictEqual(postClinicRes.body.success, true);
    assert.strictEqual(postClinicRes.body.clinic.name, 'Dr. Verma Eye & Laser Hospital');

    // Verify it now appears in realOnly list for patients
    const updatedClinicsRes = await makeRequest('GET', '/api/clinics?realOnly=true');
    assert.strictEqual(updatedClinicsRes.status, 200);
    const foundClinic = updatedClinicsRes.body.find(c => c.id === testClinic.id);
    assert.ok(foundClinic, 'Newly registered Google clinic must appear in realOnly directory');
    assert.strictEqual(foundClinic.doctorName, 'Dr. Neeraj Verma');
    assert.strictEqual(foundClinic.fees.normal, 500);
    pass('Google Clinic Onboarding immediately saves and appears in Patient Discovery Feed');

    // 5. MULTI-DEVICE SYNC: SIMULATE LOGIN ON DEVICE B (different browser session)
    // Device B queries /api/clinic?ownerUid=...
    const deviceBSyncRes = await makeRequest('GET', `/api/clinic?ownerUid=${encodeURIComponent(testOwnerUid)}`);
    assert.strictEqual(deviceBSyncRes.status, 200);
    assert.strictEqual(deviceBSyncRes.body.id, testClinic.id);
    assert.strictEqual(deviceBSyncRes.body.name, 'Dr. Verma Eye & Laser Hospital');
    assert.strictEqual(deviceBSyncRes.body.doctorName, 'Dr. Neeraj Verma');
    assert.strictEqual(deviceBSyncRes.body.fees.normal, 500);
    pass('Multi-Device Live Sync: Device B restores clinic profile by Google UID without re-onboarding');

    // 6. BOOKING & QUEUE PERSISTENCE
    const bookingPayload = {
      clinicId: testClinic.id,
      name: 'Rameshwar Lal',
      age: 48,
      gender: 'M',
      phone: '9835123456',
      reason: 'Eye Checkup',
      source: 'Online QR',
      shift: 'Morning',
      slotTime: '10:30 AM',
      day: 'Aaj (Today)'
    };
    const bookRes = await makeRequest('POST', '/api/bookings', bookingPayload);
    assert.strictEqual(bookRes.status, 201);
    assert.strictEqual(bookRes.body.success, true);
    const bookedId = bookRes.body.booking.id;
    assert.strictEqual(bookRes.body.booking.clinicId, testClinic.id);
    assert.strictEqual(bookRes.body.booking.name, 'Rameshwar Lal');
    assert.strictEqual(bookRes.body.booking.status, 'WAITING');

    // Compounder desk fetches queue for this specific clinic
    const queueRes = await makeRequest('GET', `/api/queue?clinic=${encodeURIComponent(testClinic.id)}`);
    assert.strictEqual(queueRes.status, 200);
    assert.ok(Array.isArray(queueRes.body));
    const queueItem = queueRes.body.find(b => b.id === bookedId);
    assert.ok(queueItem, 'Booked patient must be present in clinic queue');
    assert.strictEqual(queueItem.name, 'Rameshwar Lal');

    // Compounder updates status to IN_CABIN
    const patchCabinRes = await makeRequest('PATCH', `/api/queue/${bookedId}`, {
      status: 'IN_CABIN',
      bp: '120/80',
      weight: '68 kg'
    });
    assert.strictEqual(patchCabinRes.status, 200);
    assert.strictEqual(patchCabinRes.body.item.status, 'IN_CABIN');

    // Compounder collects payment as UPI
    const patchPayRes = await makeRequest('PATCH', `/api/queue/${bookedId}`, {
      payMode: 'UPI'
    });
    assert.strictEqual(patchPayRes.status, 200);
    assert.strictEqual(patchPayRes.body.item.payMode, 'UPI');
    pass('Booking, Queue filtration, Status transition (IN_CABIN) and Payment (UPI) persist cleanly');

    // 7. MASTER ADMIN ANALYTICS & SUBSCRIPTION MANAGEMENT
    const adminRes = await makeRequest('GET', '/api/admin/doctors');
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.body.success, true);
    assert.ok(Array.isArray(adminRes.body.doctors));
    const adminDoc = adminRes.body.doctors.find(d => d.id === testClinic.id);
    assert.ok(adminDoc, 'Admin must see registered doctor');
    assert.strictEqual(adminDoc.doctorName, 'Dr. Neeraj Verma');

    // Update subscription to annual_pro
    const subRes = await makeRequest('POST', '/api/admin/subscription', {
      clinicId: testClinic.id,
      plan: 'annual_pro',
      status: 'active'
    });
    assert.strictEqual(subRes.status, 200);
    assert.strictEqual(subRes.body.clinic.subscription.plan, 'annual_pro');
    assert.strictEqual(subRes.body.clinic.subscription.amount, 4000);
    pass('Master Admin Doctor accounts directory & Subscription upgrades function flawlessly');

    // 8. SUPABASE CLIENT INTERFACE INTEGRITY
    assert.strictEqual(typeof supabase.isConfigured, 'function');
    assert.strictEqual(typeof supabase.getClinics, 'function');
    assert.strictEqual(typeof supabase.getClinic, 'function');
    assert.strictEqual(typeof supabase.getClinicByOwner, 'function');
    assert.strictEqual(typeof supabase.saveClinic, 'function');
    assert.strictEqual(typeof supabase.getQueue, 'function');
    assert.strictEqual(typeof supabase.saveBooking, 'function');
    assert.strictEqual(typeof supabase.updateBooking, 'function');
    assert.strictEqual(typeof supabase.updateSubscription, 'function');
    assert.strictEqual(typeof supabase.getAdminDoctors, 'function');

    // Format helpers test
    const mockDbRow = {
      id: 'clinic_test_row',
      name: 'Test Supabase Clinic',
      doctor_name: 'Dr. Test Row',
      doctor_degree: 'MS',
      owner_uid: 'uid_test',
      owner_email: 'test@doc.com',
      is_google_auth: true,
      fees: { normal: 450 }
    };
    const formattedClinic = supabase.formatClinic(mockDbRow);
    assert.strictEqual(formattedClinic.doctorName, 'Dr. Test Row', 'Snake_case doctor_name must map to camelCase doctorName');
    assert.strictEqual(formattedClinic.ownerUid, 'uid_test', 'Snake_case owner_uid must map to camelCase ownerUid');
    assert.strictEqual(formattedClinic.fees.normal, 450);

    const mockBookingRow = {
      id: 'b_row_1',
      clinic_id: 'clinic_test_row',
      token: 5,
      patient_name: 'Amitabh',
      cabin_status: 'IN_CABIN',
      payment_mode: 'Cash',
      vitals: { bp: '125/85' }
    };
    const formattedBooking = supabase.formatBooking(mockBookingRow);
    assert.strictEqual(formattedBooking.name, 'Amitabh');
    assert.strictEqual(formattedBooking.status, 'IN_CABIN');
    assert.strictEqual(formattedBooking.payMode, 'Cash');
    assert.strictEqual(formattedBooking.bp, '125/85');
    pass('Supabase PostgreSQL REST Client & snake_case <-> camelCase transformations are verified');

    console.log(`\n====================================================`);
    console.log(`🎉 ALL ${passCount}/${passCount} EXTRA VERIFICATION SUITES PASSED!`);
    console.log(`====================================================\n`);
  } finally {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 200);
  }
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
