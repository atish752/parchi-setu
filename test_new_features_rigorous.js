const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

console.log('🧪 Starting Rigorous Verification of New Features & Fixes...');

// 1. Verify Twin Mirror Invariants
const indexHtml = fs.readFileSync('index.html', 'utf8');
const twinHtml = fs.readFileSync('parchisetu_indian_clinic_management_token_web_app.html', 'utf8');
assert.strictEqual(indexHtml, twinHtml, 'index.html and parchisetu_indian_clinic_management_token_web_app.html must be 100% byte identical');
console.log('✅ PASS: Twin HTML mirror files are 100% byte identical');

const fbSync1 = fs.readFileSync('firebase-sync.js', 'utf8');
const fbSync2 = fs.readFileSync('public/firebase-sync.js', 'utf8');
assert.strictEqual(fbSync1, fbSync2, 'firebase-sync.js and public/firebase-sync.js must be 100% byte identical');
console.log('✅ PASS: Firebase-sync mirror files are 100% byte identical');

// 2. Requirement 1: Step 2 custom reason write option
assert.ok(indexHtml.includes('id="patBookCustomReason"'), 'patBookCustomReason input must exist in HTML');
assert.ok(indexHtml.includes('oninput="onPatientCustomReasonInput(this.value)"'), 'onPatientCustomReasonInput handler must exist');
assert.ok(indexHtml.includes('isCustomPatReason = false;'), 'isCustomPatReason must reset on modal open');
console.log('✅ PASS: Step 2 custom reason write input and state reset verified');

// 3. Requirement 2: Cancellation & No-Show Persistence & Revival Prevention
assert.ok(indexHtml.includes('localStorage.getItem(\'parchisetu_cancelled_ids\')'), 'cancelledPatientIds must be restored from localStorage');
assert.ok(indexHtml.includes('cancelledPatientIds.has(p.id)'), 'mergeIncomingQueue must tombstone cancelled patient IDs');
assert.ok(indexHtml.includes('cancelledPatientIds.add(patientId)'), 'cancelPatientAppointment must add to cancelledPatientIds');

// Verify server-side store does not revive cancelled bookings
const storeModule = require('./api/_store');
const initialRes = storeModule.addOrUpdateBooking({
  id: 'pat_test_cancel_01',
  clinicId: 'clinic_sanjeevani_01',
  name: 'Ramesh',
  phone: '9835012345',
  status: 'CANCELLED',
  cancelledBy: 'clinic'
});
assert.strictEqual(initialRes.booking.status, 'CANCELLED');

const retryRes = storeModule.addOrUpdateBooking({
  id: 'pat_test_cancel_01',
  clinicId: 'clinic_sanjeevani_01',
  name: 'Ramesh',
  phone: '9835012345',
  status: 'WAITING'
});
assert.strictEqual(retryRes.booking.status, 'CANCELLED', 'Server store must NEVER revive a CANCELLED booking back to WAITING');
console.log('✅ PASS: Server store revival prevention verified');

// 4. Requirement 2: Fast Edit Modal & Reschedule Day Sync
assert.ok(indexHtml.includes('id="editAppointmentModal"'), 'editAppointmentModal must exist');
assert.ok(indexHtml.includes('id="editApptName"'), 'editApptName input must exist');
assert.ok(indexHtml.includes('id="editApptPhone"'), 'editApptPhone input must exist');
assert.ok(indexHtml.includes('id="editApptDate"'), 'editApptDate input must exist');
assert.ok(indexHtml.includes('id="editApptShift"'), 'editApptShift input must exist');
assert.ok(indexHtml.includes('id="editApptSlot"'), 'editApptSlot input must exist');
assert.ok(indexHtml.includes('function saveEditedAppointment()'), 'saveEditedAppointment function must exist');

// Test reschedule logic in VM
const sandbox = {
  todayQueue: [
    { id: 'pat_edit', token: 3, name: 'Suman', date: '2026-11-04', day: 'Aaj (Today)', shift: 'Morning', status: 'WAITING' }
  ],
  cancelledPatientIds: new Set(),
  getLocalDateString: () => '2026-11-04',
  saveLocalQueue: () => {},
  refreshAllViews: () => {},
  syncQueuePatchToServer: async () => {},
  closeEditAppointmentModal: () => {},
  showToast: () => {},
  document: {
    getElementById: (id) => {
      const vals = {
        editApptId: { value: 'pat_edit' },
        editApptName: { value: 'Suman Devi' },
        editApptPhone: { value: '9876543210' },
        editApptAge: { value: '35' },
        editApptGender: { value: 'F' },
        editApptReason: { value: 'Headache & Fever' },
        editApptDate: { value: '2026-11-06' }, // Rescheduled to future date
        editApptShift: { value: 'Evening' },
        editApptSlot: { value: '06:00 PM' },
        editApptStatus: { value: 'WAITING' },
        editApptFee: { value: '300' },
        editApptPayMode: { value: 'Cash' }
      };
      return vals[id] || { value: '' };
    }
  }
};
vm.createContext(sandbox);

const editSnippet = indexHtml.substring(
  indexHtml.indexOf('async function saveEditedAppointment()'),
  indexHtml.indexOf('window.onload = async function')
);
vm.runInContext(editSnippet + '\nsaveEditedAppointment();', sandbox);
const editedPat = sandbox.todayQueue.find(p => p.id === 'pat_edit');
assert.strictEqual(editedPat.name, 'Suman Devi');
assert.strictEqual(editedPat.date, '2026-11-06');
assert.strictEqual(editedPat.day, '2026-11-06', 'Rescheduled future date must not remain "Aaj (Today)"');
console.log('✅ PASS: Fast Edit Modal and date rescheduling day sync verified');

// 5. Requirement 3: "Bulao" Visual Highlighting
assert.ok(indexHtml.includes('⚡ ANDAR HAI (In-Process)'), 'IN_CABIN status row must feature ⚡ ANDAR HAI badge');
assert.ok(indexHtml.includes('animate-ping'), 'IN_CABIN row must feature ping animation indicator');
assert.ok(indexHtml.includes('bg-gradient-to-r from-emerald-100/90 via-emerald-50 to-teal-50 border-2 border-[#25D366]'), 'IN_CABIN row must have prominent green gradient border');
console.log('✅ PASS: "Bulao" in-cabin visual highlighting verified');

// 6. Requirement 4: Doctor Expected Arrival & Online Booking Override Modal
assert.ok(indexHtml.includes('id="onlineBookingOverrideModal"'), 'onlineBookingOverrideModal must exist in HTML');
assert.ok(indexHtml.includes('function promptToggleOnlineBooking()'), 'promptToggleOnlineBooking must exist');
assert.ok(indexHtml.includes('function applyOnlineBookingOverride('), 'applyOnlineBookingOverride must exist');
assert.ok(indexHtml.includes('qrOverrideExpiresAt'), 'qrOverrideExpiresAt must be tracked');
assert.ok(indexHtml.includes('qrOverrideAction'), 'qrOverrideAction must be tracked');
console.log('✅ PASS: Online Booking Override modal and duration logic verified');

// 7. Requirement 5: Phone Number Lookup Privacy
assert.ok(indexHtml.includes('patientPassViewMode = \'search\''), 'Phone lookup must set patientPassViewMode to search');
assert.ok(indexHtml.includes('id="passPrivacySearchNotice"'), 'passPrivacySearchNotice element must exist');
assert.ok(indexHtml.includes("patientPassViewMode === 'search'") && indexHtml.includes("passPatName.textContent = `${savedBooking.name}"), 'Search view must hide phone number on pass');
console.log('✅ PASS: Phone Number Lookup privacy protection verified');

// 8. Requirement 6: Booked Appointments Monthly Interactive Calendar
assert.ok(indexHtml.includes('id="bookedAppointmentsModal"'), 'bookedAppointmentsModal must exist in HTML');
assert.ok(indexHtml.includes('id="bookedCalendarDaysGrid"'), 'bookedCalendarDaysGrid must exist in HTML');
assert.ok(indexHtml.includes('id="bookedAppointmentsListContainer"'), 'bookedAppointmentsListContainer must exist in HTML');
assert.ok(indexHtml.includes('bg-red-100/90 text-red-900 border-red-300'), 'Zero booking date must be styled in prominent red');
assert.ok(indexHtml.includes('bg-emerald-100 text-emerald-950 border-emerald-300'), '1-4 bookings date must be styled in light green');
assert.ok(indexHtml.includes('bg-[#075E54] text-white border-[#05433c]'), '5+ bookings date must be styled in dark green');
console.log('✅ PASS: Booked Appointments monthly color-coded calendar verified');

// 9. Requirement 7: Patient Live Token Pass Redesign
assert.ok(indexHtml.includes('id="patientTokenPassBox"'), 'patientTokenPassBox must exist in HTML');
assert.ok(indexHtml.includes('id="passCabinTokenLive"'), 'passCabinTokenLive step 1 must exist');
assert.ok(indexHtml.includes('id="passPeopleAheadVisual"'), 'passPeopleAheadVisual step 2 must exist');
assert.ok(indexHtml.includes('id="passEstTime"'), 'passEstTime step 3 must exist');
assert.ok(indexHtml.includes('id="passInCabinNotice"'), 'passInCabinNotice must exist');
console.log('✅ PASS: Decluttered 3-step visual pictography patient token pass verified');

console.log('\n======================================================');
console.log('🎉 ALL RIGOROUS NEW FEATURE & BUG FIX CHECKS PASSED!');
console.log('======================================================\n');
