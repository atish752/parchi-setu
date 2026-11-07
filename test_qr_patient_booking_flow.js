/**
 * ParchiSetu - QR Code & Direct Patient Booking End-to-End Verification
 * Verifies that scanning a doctor's QR code on a second (non-authenticated) device
 * NEVER opens the Doctor Auth Gateway and always opens the specific clinic booking page.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

const PORT = 3120;
process.env.PORT = PORT;

const { server, appData } = require('./server');
const store = require('./api/_store');

function makeRequest(method, pathname, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
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

async function run() {
  console.log('========================================================');
  console.log('🧪 Starting QR Code & Patient Booking Deep Verification...');
  console.log('========================================================\n');

  await new Promise(resolve => server.listen(PORT, resolve));

  try {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    // 1. Verify getShareablePatientLink produces clean /book URL
    console.log('1. Testing getShareablePatientLink URL generation...');
    // Extract inline script content
    const scriptContent = html.match(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/g)
      .map(s => s.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''))
      .join('\n');

    // Create a DOM-like sandbox to test getShareablePatientLink under different window locations
    function createMockDOM(locationObj, localStorageData = {}) {
      const elements = {};
      function getOrCreateEl(id) {
        if (!elements[id]) {
          elements[id] = {
            id,
            classList: {
              classes: new Set(),
              add(c) { this.classes.add(c); },
              remove(c) { this.classes.delete(c); },
              contains(c) { return this.classes.has(c); }
            },
            textContent: '',
            value: '',
            style: {},
            innerHTML: '',
            setAttribute() {},
            getAttribute() { return null; },
            addEventListener() {},
            querySelectorAll() { return []; },
            querySelector() { return null; },
            focus() {}
          };
        }
        return elements[id];
      }

      const storage = { ...localStorageData };
      const sandbox = {
        console,
        window: {
          location: locationObj,
          history: {
            pushState(state, title, url) {
              locationObj.pathname = url.split('?')[0];
              locationObj.search = url.includes('?') ? '?' + url.split('?')[1] : '';
            }
          },
          addEventListener() {},
          innerWidth: 1024,
          setInterval() { return 1; },
          clearInterval() {},
          setTimeout(fn) { fn(); return 1; },
          clearTimeout() {}
        },
        document: {
          getElementById: getOrCreateEl,
          querySelectorAll() { return []; },
          querySelector() { return null; },
          createElement(tag) { return getOrCreateEl('dynamic_' + tag); },
          addEventListener() {},
          removeEventListener() {},
          body: { appendChild() {}, removeChild() {} },
          title: ''
        },
        localStorage: {
          getItem(k) { return storage[k] || null; },
          setItem(k, v) { storage[k] = String(v); },
          removeItem(k) { delete storage[k]; }
        },
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; },
        clearTimeout: () => {},
        tailwind: { config: {} },
        lucide: { createIcons: () => {} },
        QRCode: class { constructor() {} makeCode() {} },
        confetti: () => {},
        Razorpay: function() { return { open: () => {} }; },
        supabase: null,
        firebase: null,
        navigator: { clipboard: { writeText: async () => {} } },
        URLSearchParams: require('url').URLSearchParams,
        URL: require('url').URL,
        fetch: async (url, opts) => {
          const u = new (require('url').URL)(url, 'http://127.0.0.1:' + PORT);
          const method = (opts && opts.method) || 'GET';
          const body = opts && opts.body ? JSON.parse(opts.body) : null;
          const res = await makeRequest(method, u.pathname + u.search, body);
          return {
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            json: async () => res.body,
            text: async () => JSON.stringify(res.body)
          };
        }
      };
      sandbox.window.window = sandbox.window;
      sandbox.window.document = sandbox.document;
      sandbox.window.localStorage = sandbox.localStorage;
      sandbox.window.tailwind = sandbox.tailwind;
      sandbox.window.lucide = sandbox.lucide;
      sandbox.window.setInterval = sandbox.setInterval;
      sandbox.window.clearInterval = sandbox.clearInterval;
      sandbox.window.setTimeout = sandbox.setTimeout;
      sandbox.window.clearTimeout = sandbox.clearTimeout;
      return { sandbox, elements };
    }

    // 2. Doctor Dashboard QR Generation Test
    // Even when Doctor is on /clinic, getShareablePatientLink must generate /book URL
    {
      const { sandbox } = createMockDOM({
        protocol: 'https:',
        origin: 'https://parchi-setu.vercel.app',
        pathname: '/clinic',
        search: '',
        hash: '',
        hostname: 'parchi-setu.vercel.app'
      });

      vm.createContext(sandbox);
      vm.runInContext(scriptContent, sandbox);

      vm.runInContext(`
        clinicProfile = {
          id: 'clinic_new_dr_sharma_789',
          name: 'Dr. Sharma Super Specialty Clinic',
          doctorName: 'Dr. Ramesh Sharma'
        };
      `, sandbox);

      const link = vm.runInContext('getShareablePatientLink(false)', sandbox);
      assert.strictEqual(
        link,
        'https://parchi-setu.vercel.app/book?clinic=clinic_new_dr_sharma_789',
        'Booking link must be /book?clinic=... and must NEVER contain /clinic'
      );
      assert.ok(!link.includes('/clinic?'), 'Link must not have /clinic?');
      assert.ok(!link.includes('/onboard?'), 'Link must not have /onboard?');
      assert.ok(!link.includes('/signin?'), 'Link must not have /signin?');
      console.log('✅ PASS: Doctor on /clinic generates clean /book?clinic=... patient link');
    }

    // 3. Simulated Scanning on Phone 2 (Clean /book URL)
    console.log('2. Testing Phone 2 scanning clean /book?clinic=clinic_new_dr_sharma_789...');
    {
      const { sandbox, elements } = createMockDOM({
        protocol: 'https:',
        origin: 'https://parchi-setu.vercel.app',
        pathname: '/book',
        search: '?clinic=clinic_new_dr_sharma_789',
        hash: '',
        hostname: 'parchi-setu.vercel.app'
      });

      vm.createContext(sandbox);
      vm.runInContext(scriptContent, sandbox);

      // Trigger window.onload
      await sandbox.window.onload();

      assert.strictEqual(vm.runInContext('currentRole', sandbox), 'patient', 'Must switch to patient role');
      const gatewayEl = elements['viewAuthGateway'];
      assert.ok(gatewayEl.classList.contains('hidden'), 'viewAuthGateway MUST be hidden when patient scans QR');

      const clinicEl = elements['viewClinicDesk'];
      assert.ok(clinicEl.classList.contains('hidden'), 'viewClinicDesk MUST be hidden for patient');

      const patientEl = elements['viewPatientBooking'];
      assert.ok(!patientEl.classList.contains('hidden'), 'viewPatientBooking MUST be visible for patient');

      const directSection = elements['patientDirectClinicSection'];
      assert.ok(!directSection.classList.contains('hidden'), 'patientDirectClinicSection MUST be visible');

      const discoverySection = elements['patientDiscoverySection'];
      assert.ok(discoverySection.classList.contains('hidden'), 'patientDiscoverySection must be hidden');
      console.log('✅ PASS: Scanning /book?clinic=... shows patient booking view, gateway is completely hidden');
    }

    // 4. Simulated Scanning on Phone 2 with Legacy URL (/clinic?role=patient&clinic=...)
    console.log('3. Testing Phone 2 scanning legacy URL (/clinic?role=patient&clinic=clinic_new_dr_sharma_789)...');
    {
      const { sandbox, elements } = createMockDOM({
        protocol: 'https:',
        origin: 'https://parchi-setu.vercel.app',
        pathname: '/clinic',
        search: '?role=patient&clinic=clinic_new_dr_sharma_789',
        hash: '',
        hostname: 'parchi-setu.vercel.app'
      });

      vm.createContext(sandbox);
      vm.runInContext(scriptContent, sandbox);

      await sandbox.window.onload();

      assert.strictEqual(vm.runInContext('currentRole', sandbox), 'patient', 'Must switch to patient role even on /clinic path with clinic param');
      const gatewayEl = elements['viewAuthGateway'];
      assert.ok(gatewayEl.classList.contains('hidden'), 'viewAuthGateway MUST be hidden on legacy QR URL');
      assert.ok(!elements['viewPatientBooking'].classList.contains('hidden'), 'viewPatientBooking MUST be visible');
      assert.ok(!elements['patientDirectClinicSection'].classList.contains('hidden'), 'patientDirectClinicSection MUST be visible');
      console.log('✅ PASS: Legacy QR URL /clinic?role=patient&clinic=... correctly routes to patient booking');
    }

    // 5. Simulated Scanning on Phone 2 with /clinic?clinic=... (no role specified)
    console.log('4. Testing Phone 2 scanning /clinic?clinic=clinic_new_dr_sharma_789...');
    {
      const { sandbox, elements } = createMockDOM({
        protocol: 'https:',
        origin: 'https://parchi-setu.vercel.app',
        pathname: '/clinic',
        search: '?clinic=clinic_new_dr_sharma_789',
        hash: '',
        hostname: 'parchi-setu.vercel.app'
      });

      vm.createContext(sandbox);
      vm.runInContext(scriptContent, sandbox);

      await sandbox.window.onload();

      assert.strictEqual(vm.runInContext('currentRole', sandbox), 'patient', 'Must resolve as patient route when clinic is in search');
      assert.ok(elements['viewAuthGateway'].classList.contains('hidden'), 'viewAuthGateway MUST be hidden');
      assert.ok(!elements['viewPatientBooking'].classList.contains('hidden'), 'viewPatientBooking MUST be visible');
      assert.ok(!elements['patientDirectClinicSection'].classList.contains('hidden'), 'patientDirectClinicSection MUST be visible');
      console.log('✅ PASS: /clinic?clinic=... correctly routes to patient booking');
    }

    // 6. Doctor Login to /clinic without session must STILL show Auth Gateway
    console.log('5. Testing Doctor visiting /clinic without auth session...');
    {
      const { sandbox, elements } = createMockDOM({
        protocol: 'https:',
        origin: 'https://parchi-setu.vercel.app',
        pathname: '/clinic',
        search: '',
        hash: '',
        hostname: 'parchi-setu.vercel.app'
      });

      vm.createContext(sandbox);
      vm.runInContext(scriptContent, sandbox);

      await sandbox.window.onload();

      assert.ok(!elements['viewAuthGateway'].classList.contains('hidden'), 'Doctor visiting /clinic without auth MUST see viewAuthGateway');
      assert.ok(elements['viewClinicDesk'].classList.contains('hidden'), 'viewClinicDesk must be hidden until login');
      assert.ok(elements['viewPatientBooking'].classList.contains('hidden'), 'viewPatientBooking must be hidden');
      console.log('✅ PASS: Doctor visiting /clinic without auth still correctly sees Auth Gateway');
    }

    // 7. Full multi-device flow: Doctor registers on Server -> Patient on Device 2 fetches and books
    console.log('6. Testing End-to-End Clinic Registration & Patient Booking via API...');
    const newClinic = {
      id: 'clinic_e2e_verified_' + Date.now(),
      name: 'Verma Ortho & Polyclinic',
      category: 'Orthopedics',
      specialty: 'Orthopedic Surgeon',
      address: 'Near Gandhi Chowk',
      city: 'Ranchi, Jharkhand',
      phone: '9812345678',
      doctorName: 'Dr. Sudhir Verma',
      doctorDegree: 'MBBS, MS (Ortho)',
      doctorPhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300',
      fees: { normal: 500, followup: 300, emergency: 700, report: 0 },
      visitingHours: {
        morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 25 },
        evening: { enabled: true, start: '05:00 PM', end: '09:00 PM', slotDurationMins: 15, maxTokens: 30 },
        daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        avgConsultationMins: 10
      }
    };

    // Doctor registers clinic
    const regRes = await makeRequest('POST', '/api/clinic', newClinic);
    assert.strictEqual(regRes.status, 200);
    assert.strictEqual(regRes.body.success, true);
    assert.strictEqual(regRes.body.clinic.id, newClinic.id);

    // Patient on Device 2 fetches clinic by query param
    const fetchClinicRes = await makeRequest('GET', `/api/clinic?clinic=${encodeURIComponent(newClinic.id)}`);
    assert.strictEqual(fetchClinicRes.status, 200);
    assert.strictEqual(fetchClinicRes.body.id, newClinic.id);
    assert.strictEqual(fetchClinicRes.body.doctorName, 'Dr. Sudhir Verma');
    assert.strictEqual(fetchClinicRes.body.fees.normal, 500);

    // Patient books appointment for this clinic
    const bookingPayload = {
      clinicId: newClinic.id,
      clinicName: newClinic.name,
      clinicAddress: newClinic.address,
      name: 'Pooja Devi',
      phone: '9988776655',
      age: 32,
      gender: 'F',
      reason: 'Ghutne Ka Dard (Knee Pain)',
      visitType: 'new',
      doctorId: 'doc_1',
      doctorName: 'Dr. Sudhir Verma',
      shift: 'Morning',
      slotTime: '10:30 AM',
      day: 'Aaj (Today)'
    };
    const bookRes = await makeRequest('POST', '/api/bookings', bookingPayload);
    assert.strictEqual(bookRes.status, 201);
    assert.strictEqual(bookRes.body.success, true);
    assert.strictEqual(bookRes.body.booking.clinicId, newClinic.id);
    assert.strictEqual(bookRes.body.booking.token, 1);
    assert.strictEqual(bookRes.body.booking.name, 'Pooja Devi');
    assert.strictEqual(bookRes.body.booking.status, 'WAITING');

    // Doctor checks queue for this clinic
    const queueRes = await makeRequest('GET', `/api/queue?clinic=${encodeURIComponent(newClinic.id)}`);
    assert.strictEqual(queueRes.status, 200);
    const inQueue = queueRes.body.find(b => b.id === bookRes.body.booking.id);
    assert.ok(inQueue, 'Booking must appear on doctor clinic queue');
    assert.strictEqual(inQueue.token, 1);
    assert.strictEqual(inQueue.name, 'Pooja Devi');
    console.log('✅ PASS: End-to-end multi-device booking flow succeeded flawlessly!');

    console.log('\n========================================================');
    console.log('🎉 ALL 6 TARGETED QR & PATIENT BOOKING TESTS PASSED!');
    console.log('========================================================\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

run().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
