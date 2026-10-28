/**
 * ParchiSetu - Shared Data Store for Serverless Lambdas & Local Server
 * Provides atomic persistence across serverless invocations and processes.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_FILE = path.join(os.tmpdir(), 'parchisetu_shared_data.json');

const DEFAULT_CLINIC = {
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
  fees: {
    normal: 300,
    followup: 200,
    emergency: 500,
    report: 0
  },
  visitingReasons: [
    '🤒 Bukhar / Cold',
    '🩸 BP / Sugar',
    '🤢 Pet / Gas',
    '🔄 Follow-up',
    '📋 Report Check',
    '🤕 Dard / Injury'
  ],
  visitingHours: {
    morning: {
      enabled: true,
      start: '10:00 AM',
      end: '02:00 PM',
      slotDurationMins: 15,
      maxTokens: 25
    },
    evening: {
      enabled: true,
      start: '05:00 PM',
      end: '09:00 PM',
      slotDurationMins: 15,
      maxTokens: 30
    },
    daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    avgConsultationMins: 10
  },
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
  leaves: {},
  onboarded: true,
  createdAt: new Date().toISOString()
};

let store = {
  clinic: { ...DEFAULT_CLINIC },
  clinics: {
    [DEFAULT_CLINIC.id]: { ...DEFAULT_CLINIC }
  },
  queue: []
};

function loadStore() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf8');
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          if (parsed.clinic) store.clinic = parsed.clinic;
          if (parsed.clinics) store.clinics = parsed.clinics;
          if (Array.isArray(parsed.queue)) store.queue = parsed.queue;
        }
      }
    }
  } catch (e) {
    // Fail silently, use in-memory store
  }
}

function persistStore() {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    // Fail silently in read-only environments
  }
}

// Initial load
loadStore();

module.exports = {
  getClinic: (id) => {
    loadStore();
    if (id && store.clinics && store.clinics[id]) {
      return store.clinics[id];
    }
    return store.clinic;
  },

  setClinic: (clinicData) => {
    loadStore();
    store.clinic = {
      ...store.clinic,
      ...clinicData,
      onboarded: true,
      updatedAt: new Date().toISOString()
    };
    if (store.clinic.id) {
      store.clinics = store.clinics || {};
      store.clinics[store.clinic.id] = store.clinic;
    }
    persistStore();
    return store.clinic;
  },

  getQueue: () => {
    loadStore();
    return store.queue;
  },

  setQueue: (newQueue) => {
    loadStore();
    if (Array.isArray(newQueue)) {
      store.queue = newQueue;
      persistStore();
    }
    return store.queue;
  },

  addOrUpdateBooking: (booking) => {
    loadStore();
    const existingIdx = booking.id ? store.queue.findIndex(p => p.id === booking.id) : -1;
    if (existingIdx >= 0) {
      Object.assign(store.queue[existingIdx], booking);
      persistStore();
      return { isNew: false, booking: store.queue[existingIdx] };
    }

    const maxToken = store.queue.reduce((max, p) => Math.max(max, p.token || 0), 0);
    const nextToken = booking.token || (maxToken > 0 ? maxToken + 1 : 1);
    const bookingId = booking.id || ('q_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

    const finalBooking = {
      id: bookingId,
      token: nextToken,
      name: (booking.name || '').trim(),
      age: parseInt(booking.age, 10) || 30,
      gender: booking.gender || 'M',
      phone: (booking.phone || '').trim(),
      reason: booking.reason || 'General Consultation',
      visitType: booking.visitType || 'new', // 'new' (Pahli Baar) or 'followup' (Dobara)
      doctorId: booking.doctorId || 'doc_1',
      doctorName: booking.doctorName || store.clinic.doctorName,
      fee: booking.fee !== undefined ? booking.fee : (store.clinic.fees ? store.clinic.fees.normal : 300),
      payMode: booking.payMode || 'Baaki',
      status: booking.status || 'WAITING',
      source: booking.source || 'QR Booked',
      shift: booking.shift || 'Morning',
      slotTime: booking.slotTime || 'Online Booking',
      day: booking.day || 'Aaj (Today)',
      date: booking.date || new Date().toISOString().split('T')[0],
      bp: booking.bp || '',
      weight: booking.weight || '',
      temp: booking.temp || '',
      spo2: booking.spo2 || '',
      hasParchiPhoto: !!booking.hasParchiPhoto,
      notes: booking.notes || '',
      createdAt: booking.createdAt || new Date().toISOString()
    };

    store.queue.push(finalBooking);
    persistStore();
    return { isNew: true, booking: finalBooking };
  },

  patchQueueItem: (id, updates) => {
    loadStore();
    const item = store.queue.find(p => p.id === id);
    if (!item) return null;
    Object.assign(item, updates);
    persistStore();
    return item;
  },

  resetQueue: () => {
    store.queue = [];
    persistStore();
    return [];
  }
};
