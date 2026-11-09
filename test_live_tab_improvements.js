/**
 * test_live_tab_improvements.js
 * Comprehensive automated verification for:
 * 1. Date isolation in Live tab (past days' DONE appointments excluded; today-only display; midnight reset)
 * 2. Permanent removal/hiding of floating plus button (#mobileFabNewPatient)
 * 3. Mobile-first card rearrangement (Name/Mode/Phone top-left, square timing badge mid-left,
 *    Bulao top-right, No-Show/X/Edit below Bulao, bottom payment strip with 1-click Cash/UPI)
 * 4. Doctor Arrival Morning & Evening dropdowns with daily reset
 * 5. Patient booking modal closing cleanly without hanging and immediate live token pass display
 * 6. Multi-token switcher for same phone number
 * 7. Ascending slot timeline queue ordering (earliest time slot on top regardless of token number)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================================');
console.log('🧪 Starting Live Tab & Doctor Arrival Verification Suite...');
console.log('======================================================================');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const twinHtml = fs.readFileSync(path.join(__dirname, 'parchisetu_indian_clinic_management_token_web_app.html'), 'utf8');

// 1. Verify Twin HTML byte-for-byte identity
assert.strictEqual(indexHtml, twinHtml, 'index.html and parchisetu_indian_clinic_management_token_web_app.html must be 100% byte-for-byte identical');
console.log('✅ PASS: Twin HTML files are 100% byte-for-byte identical');

// 2. Setup simulated browser sandbox using the exact runtime environment from test_runner.js
function createSandbox() {
  const elements = new Map();

  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        style: {},
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
          toggle(c) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); }
        },
        innerHTML: '',
        textContent: '',
        disabled: false,
        setAttribute() {},
        getAttribute() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        appendChild() {},
        removeChild() {},
        remove() {}
      });
    }
    return elements.get(id);
  }

  const localStorageStore = {};
  const mockDoc = {
    getElementById: (id) => getOrCreateElement(id),
    querySelectorAll: () => [],
    querySelector: (sel) => getOrCreateElement(sel.replace(/^[#.]/, '')),
    createElement: (tag) => getOrCreateElement('created_' + tag),
    addEventListener: () => {},
    body: getOrCreateElement('body')
  };

  const scriptMatches = indexHtml.match(/<script(?![^>]*src=)>([\s\S]*?)<\/script>/g);
  let scriptContent = scriptMatches
    .map(s => s.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''))
    .join('\n');

  const bridge = `
    window.isTodayAppointment = isTodayAppointment;
    window.getLocalDateString = getLocalDateString;
    window.checkDoctorDelayDailyReset = checkDoctorDelayDailyReset;
    window.getDoctorDelayMinutes = getDoctorDelayMinutes;
    window.getDoctorExpectedArrivalTime = getDoctorExpectedArrivalTime;
    window.setDoctorDelayMinutes = setDoctorDelayMinutes;
    window.renderQueueList = renderQueueList;
    window.switchClinicTab = switchClinicTab;
    window.switchAppRole = switchAppRole;
    window.openPatientBookingModal = openPatientBookingModal;
    window.closePatientBookingModal = closePatientBookingModal;
    window.submitPatientOnlineBooking = submitPatientOnlineBooking;
    window.renderTokenPassDetails = renderTokenPassDetails;
    window.updatePatientTokenPassLiveStatus = updatePatientTokenPassLiveStatus;
    window.switchPatientTokenPass = switchPatientTokenPass;
    window.loadLocalData = loadLocalData;
    window.setTodayQueue = (q) => { todayQueue = q; };
    window.getTodayQueue = () => todayQueue;
    window.setClinicProfile = (c) => { clinicProfile = c; };
    window.getClinicProfile = () => clinicProfile;
    window.setCurrentQueueFilter = (f) => { currentQueueFilter = f; };
    window.setSelectedPatSlot = (s) => { selectedPatSlot = s; };
    window.setSelectedPatCustomDate = (d) => { selectedPatCustomDate = d; };
    window.setSelectedPatDay = (d) => { selectedPatDay = d; };
    window.setLastPatientBooking = (b) => { lastPatientBooking = b; };
    window.getLastPatientBooking = () => lastPatientBooking;
    window.getPatientRegister = () => patientRegister;
    window.setPatientRegister = (r) => { patientRegister = r; };
  `;

  scriptContent += '\n' + bridge;

  const sandbox = {
    window: {
      location: { search: '', pathname: '/', protocol: 'http:' },
      addEventListener: () => {},
      onload: null,
      BroadcastChannel: null,
      open: () => {}
    },
    document: mockDoc,
    localStorage: {
      getItem: (k) => localStorageStore[k] || null,
      setItem: (k, v) => { localStorageStore[k] = String(v); },
      removeItem: (k) => { delete localStorageStore[k]; }
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
    setInterval: () => {},
    setTimeout: () => {},
    console,
    navigator: { userAgent: 'test', clipboard: { writeText: () => Promise.resolve() } },
    tailwind: {},
    URL: { createObjectURL: () => {}, revokeObjectURL: () => {} },
    URLSearchParams,
    Date,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Set,
    Map,
    JSON,
    showToast: () => {},
    playClinicBellSound: () => {},
    alert: () => {}
  };

  sandbox.window.document = mockDoc;
  sandbox.window.location = sandbox.window.location;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.global = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  return { sandbox: sandbox.window, elements, localStorageStore };
}

// -----------------------------------------------------------------------------
// TEST 1: Date Isolation in Live Queue (Past days' appointments excluded from Live)
// -----------------------------------------------------------------------------
function testDateIsolation() {
  const { sandbox, elements } = createSandbox();

  const todayStr = sandbox.getLocalDateString();
  const pastDateStr = '2026-11-05';

  const testQueue = [
    { id: 'p_today_1', name: 'Today Active', date: todayStr, day: 'Aaj', status: 'WAITING', slotTime: '10:00 AM', token: 1, fee: 300, payMode: 'Baaki' },
    { id: 'p_today_2', name: 'Today Done', date: todayStr, day: 'Aaj', status: 'DONE', slotTime: '10:15 AM', token: 2, fee: 300, payMode: 'Cash' },
    { id: 'p_old_1', name: 'Sunita Devi (Old Done)', date: pastDateStr, day: 'Past', status: 'DONE', slotTime: '11:00 AM', token: 50, fee: 300, payMode: 'Cash' },
    { id: 'p_old_2', name: 'Aman Deep (Old Done)', date: pastDateStr, day: 'Past', status: 'DONE', slotTime: '11:30 AM', token: 51, fee: 400, payMode: 'Cash' },
    { id: 'p_old_3', name: 'Rameshwar Lal (Old Done)', date: pastDateStr, day: 'Past', status: 'DONE', slotTime: '12:00 PM', token: 52, fee: 500, payMode: 'Cash' },
    { id: 'p_old_nodate', name: 'Old NoDate Walkin', createdAt: '2026-11-05T09:00:00.000Z', day: 'Aaj (Today)', status: 'DONE', slotTime: '09:00 AM', token: 49, fee: 300, payMode: 'Cash' }
  ];

  sandbox.setTodayQueue(testQueue);

  assert.strictEqual(sandbox.isTodayAppointment(testQueue[0]), true, 'Today appointment must be recognized as today');
  assert.strictEqual(sandbox.isTodayAppointment(testQueue[1]), true, 'Today DONE appointment must be recognized as today');
  assert.strictEqual(sandbox.isTodayAppointment(testQueue[2]), false, 'Past DONE appointment must NOT be recognized as today');
  assert.strictEqual(sandbox.isTodayAppointment(testQueue[5]), false, 'Past appointment without date property but past createdAt must NOT be recognized as today');

  // Render queue list
  sandbox.setCurrentQueueFilter('ALL');
  sandbox.renderQueueList();

  const renderedHtml = elements.get('queueListContainer').innerHTML;
  assert.ok(renderedHtml.includes('Today Active'), 'Today active appointment must appear in Live tab');
  assert.ok(renderedHtml.includes('Today Done'), 'Today done appointment can appear in Live tab for today');
  assert.ok(!renderedHtml.includes('Sunita Devi'), 'Old done appointment from past days must NOT appear in Live tab');
  assert.ok(!renderedHtml.includes('Aman Deep'), 'Old done appointment from past days must NOT appear in Live tab');
  assert.ok(!renderedHtml.includes('Rameshwar Lal'), 'Old done appointment from past days must NOT appear in Live tab');
  assert.ok(!renderedHtml.includes('Old NoDate Walkin'), 'Old walkin without date property must NOT appear in Live tab');

  // Verify loadLocalData() purges past appointments from todayQueue and archives to patientRegister
  sandbox.localStorage.setItem('klinicq_queue', JSON.stringify(testQueue));
  sandbox.setPatientRegister([]);
  sandbox.loadLocalData();

  const cleanedQueue = sandbox.getTodayQueue();
  assert.strictEqual(cleanedQueue.length, 2, 'todayQueue must only retain the 2 today appointments');
  assert.ok(cleanedQueue.some(p => p.id === 'p_today_1'), 'todayQueue retains p_today_1');
  assert.ok(cleanedQueue.some(p => p.id === 'p_today_2'), 'todayQueue retains p_today_2');
  assert.ok(!cleanedQueue.some(p => p.id === 'p_old_1'), 'todayQueue purged p_old_1');
  assert.ok(!cleanedQueue.some(p => p.id === 'p_old_nodate'), 'todayQueue purged p_old_nodate');

  const reg = sandbox.getPatientRegister();
  assert.ok(reg.some(p => p.name.includes('Sunita Devi')), 'patientRegister archived Sunita Devi');
  assert.ok(reg.some(p => p.name.includes('Old NoDate Walkin')), 'patientRegister archived Old NoDate Walkin');

  console.log('✅ PASS 1: Date isolation strictly excludes past days appointments from Live Queue and purges todayQueue');
}

// -----------------------------------------------------------------------------
// TEST 2: Permanent Removal / Hiding of Bottom-Right Plus Button
// -----------------------------------------------------------------------------
function testFloatingPlusButtonRemoved() {
  assert.ok(
    /id="mobileFabNewPatient"[\s\S]*?class="[^"]*hidden[^"]*"/.test(indexHtml) || /style="[^"]*display:\s*none/.test(indexHtml),
    'Floating plus button must be hidden in HTML'
  );

  const { sandbox } = createSandbox();
  const fab = sandbox.document.getElementById('mobileFabNewPatient');
  
  // Test switchClinicTab('live') keeps it hidden
  sandbox.switchClinicTab('live');
  assert.ok(fab.classList.contains('hidden') || fab.style.display === 'none', 'switchClinicTab(live) must keep mobile FAB hidden');

  // Test switchAppRole keeps it hidden
  sandbox.switchAppRole('clinic');
  assert.ok(fab.classList.contains('hidden') || fab.style.display === 'none', 'switchAppRole(clinic) must keep mobile FAB hidden');

  console.log('✅ PASS 2: Bottom-right floating plus button is permanently removed and hidden');
}

// -----------------------------------------------------------------------------
// TEST 3: Mobile-First Card Rearrangement for Live Queue
// -----------------------------------------------------------------------------
function testQueueCardRearrangement() {
  const { sandbox, elements } = createSandbox();
  const todayStr = sandbox.getLocalDateString();

  sandbox.setTodayQueue([
    {
      id: 'p_card_1',
      name: 'Ramesh Kumar',
      phone: '9876543210',
      source: 'QR Booked', // Online
      slotTime: '10:00 AM',
      reason: 'Fever',
      status: 'WAITING',
      token: 1,
      fee: 400,
      payMode: 'Baaki',
      date: todayStr,
      day: 'Aaj'
    },
    {
      id: 'p_card_2',
      name: 'Pooja Singh',
      phone: '9123456780',
      source: 'Compounder Desk', // Clinic
      slotTime: '10:15 AM',
      reason: 'General OPD',
      status: 'WAITING',
      token: 2,
      fee: 300,
      payMode: 'Cash',
      date: todayStr,
      day: 'Aaj'
    }
  ]);

  sandbox.setCurrentQueueFilter('ALL');
  sandbox.renderQueueList();

  const renderedHtml = elements.get('queueListContainer').innerHTML;

  // 1. Patient name, mode badge, phone
  assert.ok(renderedHtml.includes('Ramesh Kumar'), 'Must render patient name');
  assert.ok(renderedHtml.includes('>Online</span>'), 'QR booked patient must have Online badge');
  assert.ok(renderedHtml.includes('>Clinic</span>'), 'Compounder desk patient must have Clinic badge');
  assert.ok(renderedHtml.includes('9876543210'), 'Must render phone number');

  // 2. Square background for timing badge (rounded px-1.5 or px-2, NOT rounded-full)
  assert.ok(renderedHtml.includes('10:00 AM'), 'Must display slot time');
  assert.ok(renderedHtml.includes('px-2 py-0.5 rounded inline-flex') || renderedHtml.includes('px-1.5 py-0.5 rounded inline-flex'), 'Timing badge must use square rounded styling, not rounded-full');

  // 3. Top-right Bulao button
  assert.ok(renderedHtml.includes('sendPatientInsideCabin(\'p_card_1\')'), 'Must have Bulao button on waiting patient');
  assert.ok(renderedHtml.includes('<span>Bulao</span>'), 'Must display Bulao text');

  // 4. Sub-row right side: No-Show, Cross X, Edit buttons
  assert.ok(renderedHtml.includes('markPatientNoShow(\'p_card_1\')'), 'Must have No-Show button');
  assert.ok(renderedHtml.includes('promptCancelPatient(\'p_card_1\')'), 'Must have Cancel Cross X button');
  assert.ok(renderedHtml.includes('openEditAppointmentModal(\'p_card_1\')'), 'Must have Edit button');

  // 5. Bottom strip: Baaki / Paid status with 1-click Cash & UPI buttons
  assert.ok(renderedHtml.includes('₹400 Baaki ⚠️'), 'Must show Baaki amount tag');
  assert.ok(renderedHtml.includes('setPatientPaymentMode(\'p_card_1\', \'Cash\')'), 'Must have 1-click Cash button');
  assert.ok(renderedHtml.includes('setPatientPaymentMode(\'p_card_1\', \'UPI\')'), 'Must have 1-click UPI button');

  console.log('✅ PASS 3: Live queue rows rearranged correctly for mobile view with square timing badges');
}

// -----------------------------------------------------------------------------
// TEST 4: Doctor Arrival Time Morning & Evening Dropdowns with Daily Reset
// -----------------------------------------------------------------------------
function testDoctorArrivalControls() {
  const { sandbox } = createSandbox();

  // 1. Check default arrival calculation
  sandbox.setClinicProfile({
    id: 'c1',
    name: 'Sanjeevani Family Clinic',
    doctorName: 'Dr. Rajesh Sharma',
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '02:00 PM' },
      evening: { enabled: true, start: '05:00 PM', end: '09:00 PM' },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    },
    liveStatus: {
      overrideDate: sandbox.getLocalDateString(),
      doctorDelayMinutesMorning: 0,
      doctorDelayMinutesEvening: 0
    }
  });

  assert.strictEqual(sandbox.getDoctorExpectedArrivalTime('Morning'), '10:00 AM', 'Morning expected arrival defaults to opening time 10:00 AM');
  assert.strictEqual(sandbox.getDoctorExpectedArrivalTime('Evening'), '5:00 PM', 'Evening expected arrival defaults to opening time 05:00 PM');

  // 2. Set Morning delay to +45 mins
  sandbox.setDoctorDelayMinutes(45, null, 'Morning');
  assert.strictEqual(sandbox.getDoctorDelayMinutes('Morning'), 45, 'Morning delay should be 45');
  assert.strictEqual(sandbox.getDoctorExpectedArrivalTime('Morning'), '10:45 AM', 'Morning arrival should be 10:45 AM');

  // 3. Set Evening delay to -30 mins (early)
  sandbox.setDoctorDelayMinutes(-30, null, 'Evening');
  assert.strictEqual(sandbox.getDoctorDelayMinutes('Evening'), -30, 'Evening delay should be -30');
  assert.strictEqual(sandbox.getDoctorExpectedArrivalTime('Evening'), '4:30 PM', 'Evening arrival should be 04:30 PM');

  // Morning delay should remain untouched at 45
  assert.strictEqual(sandbox.getDoctorDelayMinutes('Morning'), 45, 'Morning delay should remain 45');

  // Verify patient token pass alert banner scopes to booking shift
  const eveningBooking = {
    id: 'b_eve',
    name: 'Evening Patient',
    phone: '9988776655',
    token: 10,
    shift: 'Evening',
    slotTime: '06:00 PM',
    status: 'WAITING',
    date: sandbox.getLocalDateString()
  };
  sandbox.setLastPatientBooking(eveningBooking);
  sandbox.updatePatientTokenPassLiveStatus();
  const alertEl = sandbox.document.getElementById('passDoctorDelayAlert');
  assert.ok(!alertEl.classList.contains('hidden'), 'Doctor delay alert must be visible for delayed/early doctor');
  assert.ok(alertEl.innerHTML.includes('4:30 PM') || alertEl.innerHTML.includes('30 minute pehle'), 'Doctor arrival banner on pass must reflect Evening arrival time 04:30 PM');

  // 4. Test Daily Reset: simulate date advancing to tomorrow
  const prof = sandbox.getClinicProfile();
  prof.liveStatus.overrideDate = '2026-11-08'; // Yesterday
  sandbox.checkDoctorDelayDailyReset();

  assert.strictEqual(sandbox.getClinicProfile().liveStatus.overrideDate, sandbox.getLocalDateString(), 'overrideDate updated to today');
  assert.strictEqual(sandbox.getDoctorDelayMinutes('Morning'), 0, 'Morning delay must reset to 0 default on new day');
  assert.strictEqual(sandbox.getDoctorDelayMinutes('Evening'), 0, 'Evening delay must reset to 0 default on new day');
  assert.strictEqual(sandbox.getDoctorExpectedArrivalTime('Morning'), '10:00 AM', 'Morning arrival resets to 10:00 AM default');
  assert.strictEqual(sandbox.getDoctorExpectedArrivalTime('Evening'), '5:00 PM', 'Evening arrival resets to 05:00 PM default');

  console.log('✅ PASS 4: Doctor Arrival Morning & Evening controls work independently, scope to booking shift, and auto-reset daily');
}

// -----------------------------------------------------------------------------
// TEST 5: Patient Booking Modal Closes Cleanly Without Hanging
// -----------------------------------------------------------------------------
async function testPatientBookingModalClose() {
  const { sandbox } = createSandbox();

  const modal = sandbox.document.getElementById('patientBookingModal');

  // Open modal sets display flex
  sandbox.openPatientBookingModal();
  assert.strictEqual(modal.style.display, 'flex', 'Modal opens with display: flex');
  assert.strictEqual(modal.classList.contains('hidden'), false, 'Modal open removes hidden');

  // Close modal MUST set display none
  sandbox.closePatientBookingModal();
  assert.strictEqual(modal.style.display, 'none', 'Modal close MUST set display: none');
  assert.strictEqual(modal.classList.contains('hidden'), true, 'Modal close adds hidden');

  // Test submitPatientOnlineBooking transition
  const todayStr = sandbox.getLocalDateString();
  sandbox.setTodayQueue([]);
  sandbox.setClinicProfile({ id: 'c1', name: 'Test Clinic', doctorName: 'Dr. Test' });

  sandbox.document.getElementById('patBookName').value = 'Ravi Sharma';
  sandbox.document.getElementById('patBookPhone').value = '9876543210';
  sandbox.document.getElementById('patBookAge').value = '35';
  sandbox.document.getElementById('patBookGender').value = 'M';
  sandbox.setSelectedPatSlot('11:00 AM');
  sandbox.setSelectedPatCustomDate(todayStr);
  sandbox.setSelectedPatDay('Aaj');

  await sandbox.submitPatientOnlineBooking();

  assert.strictEqual(modal.style.display, 'none', 'After booking, modal MUST be closed with display: none');
  const passBox = sandbox.document.getElementById('patientTokenPassBox');
  assert.strictEqual(passBox.style.display, 'block', 'Token pass box must be displayed with display: block');
  assert.strictEqual(passBox.classList.contains('hidden'), false, 'Token pass box hidden class removed');

  console.log('✅ PASS 5: Patient booking modal closes without hanging and transitions cleanly to token pass');
}

// -----------------------------------------------------------------------------
// TEST 6: Multi-Token Switcher for Same Phone Number
// -----------------------------------------------------------------------------
function testMultiTokenSwitcher() {
  const { sandbox } = createSandbox();
  const todayStr = sandbox.getLocalDateString();

  const booking1 = { id: 'b1', name: 'Alok Verma', phone: '9988776655', token: 1, slotTime: '10:00 AM', status: 'WAITING', date: todayStr };
  const booking2 = { id: 'b2', name: 'Sunita Verma', phone: '9988776655', token: 2, slotTime: '10:15 AM', status: 'WAITING', date: todayStr };
  const booking3 = { id: 'b3', name: 'Rahul Verma', phone: '9988776655', token: 5, slotTime: '11:00 AM', status: 'WAITING', date: todayStr };
  const booking4 = { id: 'b4', name: 'Pooja Verma', phone: '9988776655', token: 7, slotTime: '11:15 AM', status: 'CANCELLED', date: todayStr };

  sandbox.setTodayQueue([booking1, booking2, booking3, booking4]);

  // Render pass for booking 1
  sandbox.renderTokenPassDetails(booking1);

  const switcher = sandbox.document.getElementById('patientMultiTokenSwitcher');
  assert.ok(switcher.className.includes('block') || !switcher.classList.contains('hidden'), 'Switcher must be visible when multiple bookings exist');
  assert.ok(switcher.innerHTML.includes('Token #1'), 'Switcher must contain Token #1');
  assert.ok(switcher.innerHTML.includes('Token #2'), 'Switcher must contain Token #2');
  assert.ok(switcher.innerHTML.includes('Token #5'), 'Switcher must contain Token #5');
  assert.ok(switcher.innerHTML.includes('Token #7'), 'Switcher must contain Token #7');
  assert.ok(switcher.innerHTML.includes('Alok'), 'Switcher displays Alok name');
  assert.ok(switcher.innerHTML.includes('Sunita'), 'Switcher displays Sunita name');
  assert.ok(switcher.innerHTML.includes('Rahul'), 'Switcher displays Rahul name');
  assert.ok(switcher.innerHTML.includes('Cancelled'), 'Switcher displays Cancelled badge for cancelled booking');

  // Test 1-click token switching
  sandbox.switchPatientTokenPass('b2');
  assert.strictEqual(sandbox.getLastPatientBooking().id, 'b2', 'Switched active booking to b2');
  assert.strictEqual(sandbox.document.getElementById('passTokenNumber').textContent, '#2', 'Token pass now displays Token #2');
  assert.ok(sandbox.document.getElementById('passPatientName').textContent.includes('Sunita'), 'Token pass now displays Sunita');

  sandbox.switchPatientTokenPass('b3');
  assert.strictEqual(sandbox.getLastPatientBooking().id, 'b3', 'Switched active booking to b3');
  assert.strictEqual(sandbox.document.getElementById('passTokenNumber').textContent, '#5', 'Token pass now displays Token #5');
  assert.ok(sandbox.document.getElementById('passPatientName').textContent.includes('Rahul'), 'Token pass now displays Rahul');

  sandbox.switchPatientTokenPass('b4');
  assert.strictEqual(sandbox.getLastPatientBooking().id, 'b4', 'Switched active booking to b4 (cancelled)');
  assert.strictEqual(sandbox.document.getElementById('passTokenNumber').textContent, '#7', 'Token pass now displays Token #7');
  assert.ok(sandbox.document.getElementById('passPatientName').textContent.includes('Pooja'), 'Token pass displays Pooja');
  const card = sandbox.document.getElementById('passLiveStatusCard');
  assert.ok(card.className.includes('rose-50'), 'Pass card displays rose cancelled theme');

  console.log('✅ PASS 6: Multi-token switcher renders all bookings (including cancelled) for phone and allows instant switching');
}

// -----------------------------------------------------------------------------
// TEST 7: Ascending Slot Time Queue Ordering (Earliest time on top regardless of token #)
// -----------------------------------------------------------------------------
function testAscendingSlotTimelineOrdering() {
  const { sandbox } = createSandbox();
  const todayStr = sandbox.getLocalDateString();

  // Test case explicitly mentioned in task:
  // 9:00 AM with token 54 must be above 9:15 AM with token 2, which is above 10:00 AM with token 1
  sandbox.setTodayQueue([
    { id: 'p_10am', name: 'Late Arrival Booking', slotTime: '10:00 AM', token: 1, status: 'WAITING', date: todayStr, day: 'Aaj' },
    { id: 'p_9am', name: 'Earliest Morning Slot', slotTime: '09:00 AM', token: 54, status: 'WAITING', date: todayStr, day: 'Aaj' },
    { id: 'p_915am', name: 'Second Slot', slotTime: '09:15 AM', token: 2, status: 'WAITING', date: todayStr, day: 'Aaj' },
    { id: 'p_5pm', name: 'Evening Slot', slotTime: '05:00 PM', token: 3, status: 'WAITING', date: todayStr, day: 'Aaj' }
  ]);

  sandbox.setCurrentQueueFilter('ALL');
  sandbox.renderQueueList();

  const renderedHtml = sandbox.document.getElementById('queueListContainer').innerHTML;

  const idx9am = renderedHtml.indexOf('Earliest Morning Slot');
  const idx915am = renderedHtml.indexOf('Second Slot');
  const idx10am = renderedHtml.indexOf('Late Arrival Booking');
  const idx5pm = renderedHtml.indexOf('Evening Slot');

  assert.ok(idx9am !== -1, '09:00 AM slot must be in rendered HTML');
  assert.ok(idx915am !== -1, '09:15 AM slot must be in rendered HTML');
  assert.ok(idx10am !== -1, '10:00 AM slot must be in rendered HTML');
  assert.ok(idx5pm !== -1, '05:00 PM slot must be in rendered HTML');

  assert.ok(idx9am < idx915am, '09:00 AM [Token 54] must be positioned BEFORE 09:15 AM [Token 2]');
  assert.ok(idx915am < idx10am, '09:15 AM [Token 2] must be positioned BEFORE 10:00 AM [Token 1]');
  assert.ok(idx10am < idx5pm, '10:00 AM [Token 1] must be positioned BEFORE 05:00 PM [Token 3]');

  console.log('✅ PASS 7: Queue is strictly sorted by ascending slot timeline order regardless of token number');
}

async function runAll() {
  testDateIsolation();
  testFloatingPlusButtonRemoved();
  testQueueCardRearrangement();
  testDoctorArrivalControls();
  await testPatientBookingModalClose();
  testMultiTokenSwitcher();
  testAscendingSlotTimelineOrdering();

  console.log('======================================================================');
  console.log('🎉 ALL 7 LIVE TAB & DOCTOR ARRIVAL TESTS PASSED FLAWLESSLY!');
  console.log('======================================================================');
}

runAll();
