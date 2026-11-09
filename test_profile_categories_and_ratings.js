/**
 * test_profile_categories_and_ratings.js
 * Comprehensive Verification Suite for 7 New Requirements:
 * 1. Profile Tab Category-by-Category Grid & Sub-sections
 * 2. Live Tab Booked Appointments Button & Pulsating Plus Highlight
 * 3. Removal of "Patient Home" Button from Quick Nav Header
 * 4. PWA Manifest, Service Worker & Header Download/Install Button
 * 5. Removal of Clinic Sign Up / Login Button from Patient Discovery Bar
 * 6. Genuine Live Star Ratings (Verification, No Duplicates, No Fake Stars)
 * 7. High-Contrast Dark Mode for Patient Views & Modals
 * 8. Twin File Byte-for-Byte Identity & Admin Passcode Invariant
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { server } = require('./server');

const PORT = 4055;
let httpServer = null;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const dataString = postData ? (typeof postData === 'object' ? JSON.stringify(postData) : String(postData)) : null;
    const opts = { ...options };
    opts.headers = {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });
    req.on('error', reject);
    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 Starting Profile Categories & Genuine Ratings Test Suite...');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Twin Files Identity & Admin PIN Invariant
  // -------------------------------------------------------------------------
  console.log('1. Checking Twin HTML Byte-for-Byte Identity & Master Admin PIN...');
  const html1 = fs.readFileSync(path.join(__dirname, 'index.html'));
  const html2 = fs.readFileSync(path.join(__dirname, 'parchisetu_indian_clinic_management_token_web_app.html'));
  assert.strictEqual(html1.equals(html2), true, 'index.html and parchisetu_indian_clinic_management_token_web_app.html must be 100% byte identical');
  const htmlStr = html1.toString('utf8');
  assert.ok(htmlStr.includes('UHI(*Y90Jjk0JKop:ki-0PIkj9OP0'), 'Master Admin passcode must remain strictly intact');
  console.log('✅ PASS: Twin HTML files are 100% byte-for-byte identical and Master Admin PIN is intact\n');

  // -------------------------------------------------------------------------
  // TEST 2: Profile Tab Category Hub & Sub-sections
  // -------------------------------------------------------------------------
  console.log('2. Verifying Profile Tab Category-by-Category Arrangement...');
  assert.ok(htmlStr.includes('id="profileCategoryHubCard"'), 'Must contain profileCategoryHubCard');
  assert.ok(htmlStr.includes('grid grid-cols-2 sm:grid-cols-3'), 'Must arrange buttons in 2 to 3 per horizontal row grid');
  assert.ok(htmlStr.includes('onclick="openClinicOnboardingModal()"'), 'Main button must open clinic onboarding / details editor');
  assert.ok(htmlStr.includes('Edit Clinic Detail'), 'Must have prominent Edit Clinic Detail button');
  assert.ok(htmlStr.includes("openProfileSubSection('photo')"), 'Must have Doctor Photo category button');
  assert.ok(htmlStr.includes("openProfileSubSection('pricing')"), 'Must have Pro Plan & Pricing category button');
  assert.ok(htmlStr.includes("openProfileSubSection('fees')"), 'Must have Consultation Fees category button');
  assert.ok(htmlStr.includes("openProfileSubSection('reasons')"), 'Must have Visiting Reasons category button');
  assert.ok(htmlStr.includes("openProfileSubSection('qr')"), 'Must have QR & Standee category button');
  assert.ok(htmlStr.includes("openProfileSubSection('support')"), 'Must have Help & Support category button');
  assert.ok(htmlStr.includes("toggleClinicDarkMode()"), 'Must have Display Theme category button');
  assert.ok(htmlStr.includes("openProfileSubSection('account')"), 'Must have Account & Sign Out category button');

  // Check sub-sections container and sub-sections
  assert.ok(htmlStr.includes('id="profileSubSectionsContainer"'), 'Must contain profileSubSectionsContainer');
  assert.ok(htmlStr.includes('id="profileSubSection-photo"'), 'Must contain profileSubSection-photo');
  assert.ok(htmlStr.includes('id="profileSubSection-pricing"'), 'Must contain profileSubSection-pricing');
  assert.ok(htmlStr.includes('id="profileSubSection-fees"'), 'Must contain profileSubSection-fees');
  assert.ok(htmlStr.includes('id="profileSubSection-reasons"'), 'Must contain profileSubSection-reasons');
  assert.ok(htmlStr.includes('id="profileSubSection-qr"'), 'Must contain profileSubSection-qr');
  assert.ok(htmlStr.includes('id="profileSubSection-support"'), 'Must contain profileSubSection-support');
  assert.ok(htmlStr.includes('id="profileSubSection-account"'), 'Must contain profileSubSection-account');
  assert.ok(htmlStr.includes('closeProfileSubSection()'), 'Sub-sections must include close / back buttons');

  // Help & Support must contain WhatsApp, phone and email info
  assert.ok(htmlStr.includes('9798482404') || htmlStr.includes('wa.me'), 'Help & Support must provide WhatsApp/Phone channel');
  assert.ok(htmlStr.includes('atish2k22@gmail.com') || htmlStr.includes('mailto:'), 'Help & Support must provide official support email');
  console.log('✅ PASS: Profile tab organized in 2-3 button grid with dedicated sub-sections and navigation\n');

  // -------------------------------------------------------------------------
  // TEST 3: Live Tab Customization
  // -------------------------------------------------------------------------
  console.log('3. Verifying Live Tab Customization (Booked Appointments button & highlighted plus)...');
  assert.ok(htmlStr.includes('id="btnLiveTabBookedAppointments"'), 'Must contain btnLiveTabBookedAppointments in Live Tab');
  assert.ok(htmlStr.includes('onclick="openBookedAppointmentsModal()"'), 'Booked appointments button must trigger openBookedAppointmentsModal()');
  assert.ok(htmlStr.includes('live-plus-highlight'), 'Plus button must have live-plus-highlight blinking animation class');
  assert.ok(htmlStr.includes('@keyframes livePlusBlink'), 'Must define livePlusBlink animation in stylesheet');
  assert.ok(htmlStr.includes('id="walkinToggleBtn"'), 'Must retain walkinToggleBtn for backwards compatibility');
  console.log('✅ PASS: Live tab features Booked Appointments button and pulsating highlighted plus button\n');

  // -------------------------------------------------------------------------
  // TEST 4: Removal of "Patient Home" Button from Quick Nav
  // -------------------------------------------------------------------------
  console.log('4. Verifying Removal of "Patient Home" Button from Quick Nav Header...');
  const quickNavRegex = /<div id="clinicDeskQuickNavHeader"[\s\S]*?<\/div>/;
  const quickNavMatch = htmlStr.match(quickNavRegex);
  assert.ok(quickNavMatch, 'Must find clinicDeskQuickNavHeader');
  assert.ok(!quickNavMatch[0].includes('Patient Home'), 'clinicDeskQuickNavHeader must NOT contain Patient Home button');
  console.log('✅ PASS: "Patient Home" button permanently removed from clinicDeskQuickNavHeader\n');

  // -------------------------------------------------------------------------
  // TEST 5: PWA Manifest, Service Worker & Install Button
  // -------------------------------------------------------------------------
  console.log('5. Verifying PWA Manifest, Service Worker, and Install Button in Clinic Header...');
  assert.ok(fs.existsSync(path.join(__dirname, 'manifest.json')), 'manifest.json must exist in root');
  assert.ok(fs.existsSync(path.join(__dirname, 'public/manifest.json')), 'manifest.json must exist in public/');
  assert.ok(fs.existsSync(path.join(__dirname, 'sw.js')), 'sw.js must exist in root');
  assert.ok(fs.existsSync(path.join(__dirname, 'public/sw.js')), 'sw.js must exist in public/');

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.name, 'ParchiSetu - Clinic Management & Live Token Web App');
  assert.strictEqual(manifest.display, 'standalone');
  assert.strictEqual(manifest.theme_color, '#075E54');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Manifest must declare PWA icons');

  assert.ok(htmlStr.includes('id="pwaInstallHeaderBtn"'), 'Must contain pwaInstallHeaderBtn in top clinic brand header');
  assert.ok(htmlStr.includes('onclick="installPWAApp(event)"'), 'Install button must trigger installPWAApp()');
  assert.ok(htmlStr.includes('id="pwaInstallGuideModal"'), 'Must define pwaInstallGuideModal for browsers without beforeinstallprompt');
  console.log('✅ PASS: Complete PWA installation pipeline, manifest, service worker, and header button verified\n');

  // -------------------------------------------------------------------------
  // TEST 6: Removal of Clinic Sign In / Register from Discovery Feed Bar
  // -------------------------------------------------------------------------
  console.log('6. Verifying Patient Discovery Bar & Stethoscope Header Login...');
  const discoveryBarRegex = /id="btnNavMeraToken"[\s\S]*?<\/div>/;
  const discoveryBarMatch = htmlStr.match(discoveryBarRegex);
  assert.ok(discoveryBarMatch, 'Must find btnNavMeraToken');
  assert.ok(!discoveryBarMatch[0].includes('Clinic Sign In') && !discoveryBarMatch[0].includes('Clinic Sign Up'), 'Discovery bar beside Mera Token must not show visible clinic sign in button');
  assert.ok(htmlStr.includes('id="headerClinicDeskBtn"'), 'Header must contain top-right stethoscope button for clinic login');
  assert.ok(htmlStr.includes('fa-stethoscope'), 'Stethoscope icon must be present');
  console.log('✅ PASS: Discovery bar cleaned of clinic sign up button; top stethoscope header handles clinic login\n');

  // -------------------------------------------------------------------------
  // TEST 7: Genuine Live Star Ratings & Server Endpoint
  // -------------------------------------------------------------------------
  console.log('7. Verifying Genuine Live Star Ratings API & Client Duplicate Prevention...');

  // Start HTTP server on PORT 4055
  httpServer = server.listen(PORT);
  await new Promise(res => setTimeout(res, 250));

  // A. Reset queue for clean baseline
  await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/queue/reset',
    method: 'POST'
  });

  // B. Register a genuine appointment for phone '9876543210'
  const bookingRes = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    clinicId: 'clinic_sanjeevani_01',
    name: 'Verified Patient Ramesh',
    phone: '9876543210',
    day: 'Aaj (Today)',
    shift: 'Morning',
    slotTime: '10:00 AM',
    fee: 300
  });
  assert.ok(bookingRes.statusCode === 200 || bookingRes.statusCode === 201, 'Appointment booking must succeed');

  // C. Unverified phone '9999999999' tries to rate -> MUST BE REJECTED (HTTP 403)
  const unverifiedRatingRes = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/rate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    clinicId: 'clinic_sanjeevani_01',
    phone: '9999999999',
    rating: 5,
    comment: 'Fake rating without booking'
  });
  assert.strictEqual(unverifiedRatingRes.statusCode, 403, 'Rating from unverified patient without booking must be rejected with HTTP 403');

  // D. Verified patient '9876543210' submits rating 5 -> MUST SUCCEED (HTTP 200)
  const firstRatingRes = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/rate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    clinicId: 'clinic_sanjeevani_01',
    phone: '9876543210',
    rating: 5,
    comment: 'Very professional clinic and accurate tokens!'
  });
  assert.strictEqual(firstRatingRes.statusCode, 200, 'First genuine rating must succeed');
  assert.strictEqual(firstRatingRes.json.success, true);
  assert.strictEqual(firstRatingRes.json.reviewCount, 1);
  assert.strictEqual(firstRatingRes.json.rating, 5);

  // E. Patient '9876543210' tries to rate AGAIN -> MUST BE REJECTED AS DUPLICATE (HTTP 409)
  const duplicateRatingRes = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/rate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    clinicId: 'clinic_sanjeevani_01',
    phone: '9876543210',
    rating: 4,
    comment: 'Trying to vote twice'
  });
  assert.strictEqual(duplicateRatingRes.statusCode, 409, 'Duplicate rating from same phone must be rejected with HTTP 409 Conflict');

  // F. GET /api/rate check rating status
  const checkRatingRes = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/rate?clinic=clinic_sanjeevani_01&phone=9876543210',
    method: 'GET'
  });
  assert.strictEqual(checkRatingRes.statusCode, 200);
  assert.strictEqual(checkRatingRes.json.hasRated, true);
  assert.strictEqual(checkRatingRes.json.rating, 5);

  // G. Register a 2nd patient and rate 4 -> Check average calculation
  await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    clinicId: 'clinic_sanjeevani_01',
    name: 'Verified Patient Sunita',
    phone: '9876543211',
    day: 'Aaj (Today)',
    shift: 'Morning',
    slotTime: '10:15 AM',
    fee: 300
  });

  const secondRatingRes = await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/rate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    clinicId: 'clinic_sanjeevani_01',
    phone: '9876543211',
    rating: 4,
    comment: 'Good experience'
  });
  assert.strictEqual(secondRatingRes.statusCode, 200);
  assert.strictEqual(secondRatingRes.json.reviewCount, 2);
  assert.strictEqual(secondRatingRes.json.rating, 4.5, 'Average of 5 and 4 must be exactly 4.5');

  // H. Reset queue and clinic data to leave completely clean production state
  await request({
    host: '127.0.0.1',
    port: PORT,
    path: '/api/queue/reset',
    method: 'POST'
  });
  console.log('✅ PASS: Genuine rating system enforces booking verification, duplicate rejection (409), and authentic averages\n');

  // -------------------------------------------------------------------------
  // TEST 8: High-Contrast Dark Mode for Patient Views & Modals
  // -------------------------------------------------------------------------
  console.log('8. Verifying High-Contrast Dark Mode CSS for Patient Discovery, Modals & Token Pass...');
  assert.ok(htmlStr.includes('body.clinic-dark-mode #viewPatientBooking'), 'Must apply dark mode to viewPatientBooking');
  assert.ok(htmlStr.includes('body.clinic-dark-mode #patientDiscoverySection'), 'Must apply dark mode to patientDiscoverySection');
  assert.ok(htmlStr.includes('body.clinic-dark-mode #doctorProfileModal'), 'Must apply dark mode to doctorProfileModal');
  assert.ok(htmlStr.includes('body.clinic-dark-mode #patientBookingModal'), 'Must apply dark mode to patientBookingModal');
  assert.ok(htmlStr.includes('body.clinic-dark-mode #viewPatientTokenPass'), 'Must apply dark mode to viewPatientTokenPass');
  assert.ok(htmlStr.includes('body.clinic-dark-mode #clinicRatingModal'), 'Must apply dark mode to clinicRatingModal');
  assert.ok(htmlStr.includes('body.clinic-dark-mode #pwaInstallGuideModal'), 'Must apply dark mode to pwaInstallGuideModal');
  assert.ok(htmlStr.includes('background-color: #111b21 !important'), 'Must use WhatsApp dark background #111b21 for patient cards');
  console.log('✅ PASS: Patient view and all patient modals have complete high-contrast dark theme support\n');

  // Cleanup HTTP server
  if (httpServer) {
    httpServer.close();
  }

  // -------------------------------------------------------------------------
  // Clean Data Invariant: clinic_data.json must be clean
  // -------------------------------------------------------------------------
  const clinicDataPath = path.join(__dirname, 'clinic_data.json');
  const cleanData = {
    clinic: null,
    clinics: {},
    queue: []
  };
  fs.writeFileSync(clinicDataPath, JSON.stringify(cleanData, null, 2), 'utf8');
  console.log('✅ PASS: clinic_data.json restored to pristine clean 0-data baseline\n');

  console.log('======================================================================');
  console.log('🎉 ALL 8 TESTS IN PROFILE CATEGORIES & RATINGS SUITE PASSED 100%!');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  if (httpServer) httpServer.close();
  process.exit(1);
});
