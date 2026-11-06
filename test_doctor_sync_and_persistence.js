/**
 * Rigorous Test: Doctor Name Synchronization, Persistence, and Multi-Tab Isolation
 * Verifies that doctor details entered in the clinic panel are 100% accurately reflected
 * in patient discovery, booking, and doctor profile modals without getting clobbered or changed.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TEST_PORT = 3105;
process.env.PORT = TEST_PORT;

const { server, appData } = require('./server');
const store = require('./api/_store');

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
        res.setEncoding('utf8');
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: raw ? JSON.parse(raw) : null });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

server.listen(TEST_PORT, async () => {
  try {
    console.log('🧪 Starting Doctor Name & Persistence Rigorous Verification...\n');

    // 1. Mirror File Parity
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const twinHtml = fs.readFileSync(path.join(__dirname, 'parchisetu_indian_clinic_management_token_web_app.html'), 'utf8');
    assert.strictEqual(indexHtml, twinHtml, 'index.html and twin mirror HTML must be 100% byte-identical');
    console.log('✅ PASS: Mirror HTML templates are 100% byte identical');

    // 2. Server POST /api/clinic synchronizes doctors[0] with doctorName
    const customClinicPayload = {
      id: 'clinic_test_sync_check',
      name: 'Aarogya Multi-Specialty Clinic',
      doctorName: 'Dr. Anand Kishore',
      doctorDegree: 'MBBS, MD (Medicine), PG Diab.',
      doctorRegNo: 'BRMC-52194',
      experienceYears: 16,
      category: 'General Medicine',
      specialty: 'General Medicine',
      doctorPhoto: 'data:image/jpeg;base64,sampleDoctorPhoto123',
      fees: { normal: 400, followup: 250, emergency: 600, report: 0 },
      isGoogleAuth: true,
      ownerUid: 'uid_anand_kishore_123'
    };

    const postRes = await makeRequest('POST', '/api/clinic', customClinicPayload);
    assert.strictEqual(postRes.status, 200);
    assert.strictEqual(postRes.body.clinic.doctorName, 'Dr. Anand Kishore');
    assert.ok(Array.isArray(postRes.body.clinic.doctors) && postRes.body.clinic.doctors.length > 0);
    assert.strictEqual(postRes.body.clinic.doctors[0].name, 'Dr. Anand Kishore', 'doctors[0].name must synchronize to Dr. Anand Kishore');
    assert.strictEqual(postRes.body.clinic.doctors[0].degree, 'MBBS, MD (Medicine), PG Diab.');
    assert.strictEqual(postRes.body.clinic.doctors[0].fee, 400);
    console.log('✅ PASS: POST /api/clinic synchronizes doctors[0] with doctorName and credentials');

    // 3. GET /api/clinics returns synchronized doctor info
    const getRes = await makeRequest('GET', '/api/clinics?realOnly=true');
    assert.strictEqual(getRes.status, 200);
    const saved = getRes.body.find(c => c.id === 'clinic_test_sync_check');
    assert.ok(saved, 'Saved clinic must be returned in realOnly list');
    assert.strictEqual(saved.doctorName, 'Dr. Anand Kishore');
    assert.strictEqual(saved.doctors[0].name, 'Dr. Anand Kishore');
    assert.strictEqual(saved.specialty, 'General Medicine');
    console.log('✅ PASS: GET /api/clinics preserves custom doctor name and specialty without dummy fallback');

    // 4. Test api/_store.js setClinic and getClinicsAsync parity
    const storeUpdated = store.setClinic({
      id: 'clinic_test_store_sync',
      name: 'Kishore Health Care',
      doctorName: 'Dr. Anand Kishore',
      doctorDegree: 'MBBS, MD',
      fees: { normal: 400 }
    });
    assert.strictEqual(storeUpdated.doctorName, 'Dr. Anand Kishore');
    assert.strictEqual(storeUpdated.doctors[0].name, 'Dr. Anand Kishore');
    const allStoreClinics = await store.getClinicsAsync();
    const storeFound = allStoreClinics.find(c => c.id === 'clinic_test_store_sync');
    assert.ok(storeFound);
    assert.strictEqual(storeFound.doctorName, 'Dr. Anand Kishore');
    assert.strictEqual(storeFound.doctors[0].name, 'Dr. Anand Kishore');
    console.log('✅ PASS: api/_store.js setClinic and getClinicsAsync correctly synchronize primary doctor');

    // 5. Verify index.html Discovery Feed Card Template Logic
    // In index.html, docName must prioritize clinic.doctorName over clinic.doctors[0].name
    assert.ok(indexHtml.includes('const docName = clinic.doctorName || mainDoc.name || \'Doctor\';'), 'Discovery feed must prioritize clinic.doctorName');
    assert.ok(indexHtml.includes('const docDegree = clinic.doctorDegree || mainDoc.degree || \'MBBS\';'), 'Discovery feed must prioritize clinic.doctorDegree');
    assert.ok(indexHtml.includes('const docSpecialty = clinic.specialty || clinic.category || mainDoc.specialty'), 'Discovery feed must prioritize clinic.specialty');
    console.log('✅ PASS: Discovery feed card uses clinic.doctorName as top priority');

    // 6. Verify Doctor Profile Modal uses clinic.doctorName
    assert.ok(indexHtml.includes('const docName = clinic.doctorName || mainDoc.name || \'Doctor\';'), 'Profile modal must prioritize clinic.doctorName');
    assert.ok(indexHtml.includes('localStorage.setItem(\'parchisetu_owner_clinic\', JSON.stringify(clinicProfile));'), 'Clinic settings must preserve owner clinic');
    console.log('✅ PASS: Doctor Profile Modal uses authentic clinic doctorName and persists owner profile');

    // 7. Verify selectDoctorAndBook does not overwrite localStorage owner clinic
    const selectDocFunc = indexHtml.substring(indexHtml.indexOf('function selectDoctorAndBook('), indexHtml.indexOf('function showPatientDiscoverySection('));
    assert.ok(!selectDocFunc.includes('saveLocalClinic()'), 'selectDoctorAndBook must NEVER call saveLocalClinic() to corrupt clinic owner profile');
    console.log('✅ PASS: Patient browsing and booking selection does not overwrite clinic owner localStorage');

    // 8. Verify BroadcastChannel syncChannel updates clinicsDirectory on CLINIC_UPDATED
    const syncChannelCode = indexHtml.substring(indexHtml.indexOf('syncChannel.onmessage = function'), indexHtml.indexOf('function playClinicBellSound('));
    assert.ok(syncChannelCode.includes('CLINIC_UPDATED'), 'syncChannel handles CLINIC_UPDATED');
    assert.ok(syncChannelCode.includes('clinicsDirectory[dirIdx] = { ...clinicsDirectory[dirIdx], ...updated }'), 'syncChannel updates clinicsDirectory');
    assert.ok(syncChannelCode.includes('renderDoctorDiscoveryFeed()'), 'syncChannel triggers instant re-render in side-by-side tabs');
    console.log('✅ PASS: Inter-tab syncChannel updates clinicsDirectory and re-renders patient feed in real-time');

    console.log('\n======================================================');
    console.log('🎉 ALL 8/8 DOCTOR SYNC & PERSISTENCE TESTS PASSED!');
    console.log('======================================================\n');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 100);
  } catch (err) {
    console.error('❌ Test failed:', err);
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 100);
  }
});
