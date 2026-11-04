/**
 * ParchiSetu - Shared Data Store for Serverless Lambdas & Local Server
 * Provides atomic persistence across serverless invocations and processes.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let supabase = null;
try {
  supabase = require('./_supabase');
} catch (e) {}

const TMP_FILE = path.join(os.tmpdir(), 'parchisetu_shared_data.json');
const LEGACY_TMP_FILE = path.join(os.tmpdir(), 'klinicq_shared_data.json');

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
  rating: 4.9,
  reviewCount: 148,
  doctorPhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
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
  liveStatus: {
    isDoctorLate: false,
    doctorDelayMinutes: 0,
    expectedArrivalTime: '10:00 AM',
    isQRBookingPaused: false
  },
  doctors: [
    {
      id: 'doc_1',
      name: 'Dr. Rajesh Sharma',
      degree: 'MBBS, MD (General Physician)',
      specialty: 'General Physician',
      regNo: 'MCI-48291',
      fee: 300,
      photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
      isMain: true
    }
  ],
  leaves: {},
  onboarded: true,
  createdAt: new Date().toISOString()
};

const INITIAL_CLINICS = {
  [DEFAULT_CLINIC.id]: { ...DEFAULT_CLINIC },
  clinic_patna_central_99: {
    id: 'clinic_patna_central_99',
    name: 'Patna Central Hospital Clinic',
    tagline: 'Complete Heart & Diabetes Care',
    category: 'Cardiology',
    specialty: 'Heart / Cardiology',
    address: 'Kankarbagh Main Road, Opposite Pillar 42',
    city: 'Patna, Bihar',
    phone: '9800011122',
    whatsapp: '9835123456',
    upiId: 'aarogyaclinic@upi',
    doctorName: 'Dr. Alok Nath',
    doctorDegree: 'MBBS, MD (Medicine), PG Diab.',
    doctorRegNo: 'BRMC-52194',
    experienceYears: 16,
    rating: 4.8,
    reviewCount: 210,
    doctorPhoto: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 400, followup: 250, emergency: 600, report: 0 },
    visitingReasons: ['❤️ Seene Mein Dard', '🩸 High BP / Sugar', '💨 Saans Phoolna', '🔄 Heart Checkup', '📋 ECG / Echo Check'],
    visitingHours: {
      morning: { enabled: true, start: '09:30 AM', end: '01:30 PM', slotDurationMins: 15, maxTokens: 25 },
      evening: { enabled: true, start: '05:30 PM', end: '09:30 PM', slotDurationMins: 15, maxTokens: 30 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '09:30 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Alok Nath', degree: 'MBBS, MD (Medicine)', specialty: 'Heart / Cardiology', fee: 400, isMain: true, photo: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  },
  clinic_delhi_bone_02: {
    id: 'clinic_delhi_bone_02',
    name: 'Apex Orthopedic & Joint Care',
    tagline: 'Bone, Joint & Spine Specialist',
    category: 'Orthopedics',
    specialty: 'Bone / Orthopedic',
    address: 'Ring Road, Lajpat Nagar IV',
    city: 'Delhi',
    phone: '9811098765',
    whatsapp: '9811098765',
    upiId: 'apexortho@upi',
    doctorName: 'Dr. Arvind Kumar',
    doctorDegree: 'MS (Ortho), DNB (Orthopedics)',
    doctorRegNo: 'DMC-39182',
    experienceYears: 18,
    rating: 4.9,
    reviewCount: 320,
    doctorPhoto: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 500, followup: 300, emergency: 700, report: 0 },
    visitingReasons: ['🦴 Jod / Ghutne Ka Dard', '🤕 Fracture / Chot', '🚶 Kamar Dard / Sciatica', '🔄 X-Ray Check'],
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 25 },
      evening: { enabled: true, start: '05:00 PM', end: '08:30 PM', slotDurationMins: 15, maxTokens: 25 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 12
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '10:00 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Arvind Kumar', degree: 'MS (Ortho)', specialty: 'Bone / Orthopedic', fee: 500, isMain: true, photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  },
  clinic_lucknow_derma_03: {
    id: 'clinic_lucknow_derma_03',
    name: 'Kaya Skin, Hair & Laser Clinic',
    tagline: 'Advanced Dermatology & Cosmetic Care',
    category: 'Dermatology',
    specialty: 'Skin / Dermatology',
    address: 'Hazratganj Market, Near Cathedral',
    city: 'Lucknow',
    phone: '9415012345',
    whatsapp: '9415012345',
    upiId: 'kayaskin@upi',
    doctorName: 'Dr. Sunita Mehra',
    doctorDegree: 'MBBS, MD (Dermatology & VD)',
    doctorRegNo: 'UPMC-28491',
    experienceYears: 11,
    rating: 4.7,
    reviewCount: 95,
    doctorPhoto: 'https://images.unsplash.com/photo-1594824813576-0eb0385fc85d?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 400, followup: 250, emergency: 600, report: 0 },
    visitingReasons: ['🌸 Daad / Khujli', '🧴 Muhase / Acne', '🔴 Allergy / Rash', '💇 Baal Jhadna'],
    visitingHours: {
      morning: { enabled: true, start: '10:30 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 20 },
      evening: { enabled: true, start: '05:00 PM', end: '08:30 PM', slotDurationMins: 15, maxTokens: 25 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '10:30 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Sunita Mehra', degree: 'MBBS, MD (Derma)', specialty: 'Skin / Dermatology', fee: 400, isMain: true, photo: 'https://images.unsplash.com/photo-1594824813576-0eb0385fc85d?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  },
  clinic_varanasi_child_04: {
    id: 'clinic_varanasi_child_04',
    name: 'Shishu Bal Chikitsalaya',
    tagline: 'Newborn, Infant & Child Specialist',
    category: 'Pediatrics',
    specialty: 'Child / Pediatric',
    address: 'Godowlia Chowk, Near Dashashwamedh',
    city: 'Varanasi',
    phone: '9450098765',
    whatsapp: '9450098765',
    upiId: 'shishubal@upi',
    doctorName: 'Dr. R. K. Mishra',
    doctorDegree: 'MBBS, DCH, MD (Pediatrics)',
    doctorRegNo: 'UPMC-31849',
    experienceYears: 15,
    rating: 4.9,
    reviewCount: 180,
    doctorPhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 350, followup: 200, emergency: 500, report: 0 },
    visitingReasons: ['👶 Bacche Ka Bukhar', '🤧 Sardi / Khansi', '🤢 Vomiting / Dast', '💉 Vaccination / Teeka'],
    visitingHours: {
      morning: { enabled: true, start: '09:00 AM', end: '01:00 PM', slotDurationMins: 15, maxTokens: 30 },
      evening: { enabled: true, start: '04:30 PM', end: '08:30 PM', slotDurationMins: 15, maxTokens: 30 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '09:00 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. R. K. Mishra', degree: 'MBBS, MD (Pediatrics)', specialty: 'Child / Pediatric', fee: 350, isMain: true, photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  },
  clinic_mumbai_gynae_05: {
    id: 'clinic_mumbai_gynae_05',
    name: 'Matrutva Women & Maternity Clinic',
    tagline: 'Complete Women Health & Maternity Care',
    category: 'Gynecology',
    specialty: 'Gynecologist',
    address: 'SV Road, Andheri West',
    city: 'Mumbai',
    phone: '9820012345',
    whatsapp: '9820012345',
    upiId: 'matrutvacare@upi',
    doctorName: 'Dr. Priya Kishore',
    doctorDegree: 'MBBS, MS, DGO (Gynecologist)',
    doctorRegNo: 'MMC-49102',
    experienceYears: 13,
    rating: 4.9,
    reviewCount: 260,
    doctorPhoto: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 500, followup: 300, emergency: 800, report: 0 },
    visitingReasons: ['🌸 Mahila Swasthya Checkup', '🤰 Pregnancy / Delivery', '🔄 Ultrasound Check', '📋 Hormone / PCOD'],
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '01:30 PM', slotDurationMins: 15, maxTokens: 20 },
      evening: { enabled: true, start: '05:30 PM', end: '09:00 PM', slotDurationMins: 15, maxTokens: 25 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 12
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '10:00 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Priya Kishore', degree: 'MBBS, MS (Gynae)', specialty: 'Gynecologist', fee: 500, isMain: true, photo: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  },
  clinic_jaipur_dental_06: {
    id: 'clinic_jaipur_dental_06',
    name: 'Muskan Dental & Implant Center',
    tagline: 'Painless Root Canal & Dental Implants',
    category: 'Dental',
    specialty: 'Dental',
    address: 'MI Road, Near Panch Batti',
    city: 'Jaipur',
    phone: '9829012345',
    whatsapp: '9829012345',
    upiId: 'muskandental@upi',
    doctorName: 'Dr. Amit Patel',
    doctorDegree: 'BDS, MDS (Dental Surgeon)',
    doctorRegNo: 'RDC-18293',
    experienceYears: 10,
    rating: 4.8,
    reviewCount: 112,
    doctorPhoto: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 300, followup: 200, emergency: 500, report: 0 },
    visitingReasons: ['🦷 Daant Dard / Cavity', '✨ Daant Safai / Scaling', '🦷 RCT / Root Canal', '🔄 Braces / Alignment'],
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 20 },
      evening: { enabled: true, start: '04:30 PM', end: '08:30 PM', slotDurationMins: 15, maxTokens: 20 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 15
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '10:00 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Amit Patel', degree: 'BDS, MDS', specialty: 'Dental', fee: 300, isMain: true, photo: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  },
  clinic_ranchi_general_07: {
    id: 'clinic_ranchi_general_07',
    name: 'Aarogya Family Clinic',
    tagline: 'General Medicine & Diabetes Care',
    category: 'General Medicine',
    specialty: 'General Physician',
    address: 'Main Road, Near Overbridge',
    city: 'Ranchi',
    phone: '9431098765',
    whatsapp: '9431098765',
    upiId: 'aarogyaranchi@upi',
    doctorName: 'Dr. Anand Kishore',
    doctorDegree: 'MBBS, MD (Medicine)',
    doctorRegNo: 'JMC-19284',
    experienceYears: 16,
    rating: 4.9,
    reviewCount: 175,
    doctorPhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 350, followup: 200, emergency: 500, report: 0 },
    visitingReasons: ['🤒 Bukhar / Cold', '🩸 BP / Sugar', '🤢 Pet / Gas', '🔄 Follow-up'],
    visitingHours: {
      morning: { enabled: true, start: '09:30 AM', end: '01:30 PM', slotDurationMins: 15, maxTokens: 25 },
      evening: { enabled: true, start: '05:00 PM', end: '08:30 PM', slotDurationMins: 15, maxTokens: 25 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '09:30 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Anand Kishore', degree: 'MBBS, MD', specialty: 'General Physician', fee: 350, isMain: true, photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  },
  clinic_muzaffarpur_bone_08: {
    id: 'clinic_muzaffarpur_bone_08',
    name: 'Tirhut Bone & Trauma Clinic',
    tagline: 'Fracture, Arthritis & Trauma Care',
    category: 'Orthopedics',
    specialty: 'Bone / Orthopedic',
    address: 'Juran Chhapra Road No. 2',
    city: 'Muzaffarpur',
    phone: '9430012345',
    whatsapp: '9430012345',
    upiId: 'tirhutbone@upi',
    doctorName: 'Dr. Sanjay Gupta',
    doctorDegree: 'MS (Orthopedics)',
    doctorRegNo: 'BRMC-40192',
    experienceYears: 12,
    rating: 4.8,
    reviewCount: 88,
    doctorPhoto: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 350, followup: 200, emergency: 500, report: 0 },
    visitingReasons: ['🦴 Jod / Ghutne Ka Dard', '🤕 Fracture / Chot', '🚶 Kamar Dard', '🔄 Follow-up'],
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 25 },
      evening: { enabled: true, start: '05:00 PM', end: '09:00 PM', slotDurationMins: 15, maxTokens: 30 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '10:00 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Sanjay Gupta', degree: 'MS (Ortho)', specialty: 'Bone / Orthopedic', fee: 350, isMain: true, photo: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80' }
    ],
    leaves: {},
    onboarded: true,
    createdAt: new Date().toISOString()
  }
};

let store = {
  clinic: { ...DEFAULT_CLINIC },
  clinics: { ...INITIAL_CLINICS },
  queue: []
};

function getISTDateString(d = new Date()) {
  const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadStore() {
  try {
    const fileToRead = fs.existsSync(TMP_FILE) ? TMP_FILE : (fs.existsSync(LEGACY_TMP_FILE) ? LEGACY_TMP_FILE : null);
    if (fileToRead) {
      const content = fs.readFileSync(fileToRead, 'utf8');
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          if (parsed.clinic) store.clinic = parsed.clinic;
          if (parsed.clinics) store.clinics = { ...INITIAL_CLINICS, ...parsed.clinics };
          if (Array.isArray(parsed.queue)) store.queue = parsed.queue;
          return;
        }
      }
    }

    // Fallback seed from clinic_data.json if present
    const clinicDataFile = path.join(__dirname, '..', 'clinic_data.json');
    if (fs.existsSync(clinicDataFile)) {
      const cDataRaw = fs.readFileSync(clinicDataFile, 'utf8');
      if (cDataRaw) {
        const parsed = JSON.parse(cDataRaw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.clinic) store.clinic = parsed.clinic;
          if (parsed.clinics) store.clinics = { ...INITIAL_CLINICS, ...parsed.clinics };
          if (Array.isArray(parsed.queue) && parsed.queue.length > 0) store.queue = parsed.queue;
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

const DUMMY_CLINIC_NAMES = [
  'sanjeevani family clinic',
  'patna central hospital clinic',
  'apex orthopedic & joint care',
  'kaya skin, hair & laser clinic',
  'shishu bal chikitsalaya',
  'matrutva women & maternity clinic',
  'aastha women & maternity clinic',
  'muskan dental & implant center',
  '32 pearls dental clinic',
  'aarogya family clinic',
  'ranchi neuro & spine care',
  'tirhut bone & trauma clinic',
  'tirhut ent & allergy care',
  'dummy clinic',
  'parchisetu clinic',
  'klinicq clinic'
];

function isDummyClinicName(name) {
  if (!name) return true;
  const lower = name.trim().toLowerCase();
  return DUMMY_CLINIC_NAMES.some(d => lower === d || lower.includes(d));
}

module.exports = {
  isDummyClinicName,

  getClinic: (id) => {
    loadStore();
    if (id && store.clinics && store.clinics[id]) {
      return store.clinics[id];
    }
    return store.clinic;
  },

  getClinicAsync: async (id) => {
    loadStore();
    if (id && store.clinics && store.clinics[id]) {
      return store.clinics[id];
    }
    if (id && supabase && typeof supabase.isConfigured === 'function' && supabase.isConfigured()) {
      try {
        const sbClinic = await supabase.getClinic(id);
        if (sbClinic && sbClinic.id) {
          store.clinics = store.clinics || {};
          store.clinics[sbClinic.id] = sbClinic;
          persistStore();
          return sbClinic;
        }
      } catch (e) {}
    }
    return store.clinic;
  },

  getClinicByOwner: (uid, email = '') => {
    loadStore();
    const all = Object.values(store.clinics || {});
    if (store.clinic && store.clinic.id) all.push(store.clinic);
    const found = all.find(c => {
      if (uid && c.ownerUid === uid) return true;
      if (email && c.ownerEmail && c.ownerEmail.toLowerCase() === email.toLowerCase()) return true;
      return false;
    });
    return found || null;
  },

  getClinicByOwnerAsync: async (uid, email = '') => {
    loadStore();
    // 1. Check local cache
    const local = module.exports.getClinicByOwner(uid, email);
    if (local) return local;

    // 2. Query Supabase
    if (supabase && typeof supabase.isConfigured === 'function' && supabase.isConfigured()) {
      try {
        const sb = await supabase.getClinicByOwner(uid, email);
        if (sb && sb.id) {
          store.clinics = store.clinics || {};
          store.clinics[sb.id] = sb;
          persistStore();
          return sb;
        }
      } catch (e) {}
    }
    return null;
  },

  getClinics: (realOnly = false) => {
    loadStore();
    const map = { ...INITIAL_CLINICS, ...(store.clinics || {}) };
    if (store.clinic && store.clinic.id) {
      map[store.clinic.id] = { ...map[store.clinic.id], ...store.clinic };
    }
    const all = Object.values(map).map(c => {
      const init = INITIAL_CLINICS[c.id] || DEFAULT_CLINIC;
      return {
        ...init,
        ...c,
        specialty: (INITIAL_CLINICS[c.id] && INITIAL_CLINICS[c.id].specialty) || c.specialty || init.specialty || 'General Physician',
        category: (INITIAL_CLINICS[c.id] && INITIAL_CLINICS[c.id].category) || c.category || init.category || 'General Medicine',
        doctorPhoto: c.doctorPhoto || (c.doctors && c.doctors[0] && c.doctors[0].photo) || init.doctorPhoto || DEFAULT_CLINIC.doctorPhoto,
        rating: c.rating || init.rating || 4.8,
        reviewCount: c.reviewCount || init.reviewCount || 120
      };
    });
    if (realOnly) {
      return all.filter(c => (c.ownerUid || c.isGoogleAuth || c.googleRegistered || c.createdViaClinicPanel || c.ownerEmail) && !isDummyClinicName(c.name));
    }
    return all;
  },

  getClinicsAsync: async (realOnly = false) => {
    loadStore();
    const map = { ...INITIAL_CLINICS, ...(store.clinics || {}) };
    if (store.clinic && store.clinic.id) {
      map[store.clinic.id] = { ...map[store.clinic.id], ...store.clinic };
    }

    if (supabase && typeof supabase.isConfigured === 'function' && supabase.isConfigured()) {
      try {
        const sbClinics = await supabase.getClinics(realOnly);
        if (Array.isArray(sbClinics)) {
          sbClinics.forEach(c => {
            if (c && c.id) {
              map[c.id] = { ...(map[c.id] || {}), ...c };
            }
          });
        }
      } catch (e) {}
    }

    const all = Object.values(map).map(c => {
      const init = INITIAL_CLINICS[c.id] || DEFAULT_CLINIC;
      return {
        ...init,
        ...c,
        specialty: (INITIAL_CLINICS[c.id] && INITIAL_CLINICS[c.id].specialty) || c.specialty || init.specialty || 'General Physician',
        category: (INITIAL_CLINICS[c.id] && INITIAL_CLINICS[c.id].category) || c.category || init.category || 'General Medicine',
        doctorPhoto: c.doctorPhoto || (c.doctors && c.doctors[0] && c.doctors[0].photo) || init.doctorPhoto || DEFAULT_CLINIC.doctorPhoto,
        rating: c.rating || init.rating || 4.8,
        reviewCount: c.reviewCount || init.reviewCount || 120
      };
    });

    if (realOnly) {
      return all.filter(c => (c.ownerUid || c.isGoogleAuth || c.googleRegistered || c.createdViaClinicPanel || c.ownerEmail) && !isDummyClinicName(c.name));
    }
    return all;
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
    if (supabase && typeof supabase.saveClinic === 'function') {
      supabase.saveClinic(store.clinic).catch(() => {});
    }
    return store.clinic;
  },

  getQueue: (phone, clinicId) => {
    loadStore();
    let list = store.queue;
    if (clinicId) {
      list = list.filter(p => !p.clinicId || p.clinicId === clinicId);
    }
    if (phone) {
      const clean = String(phone).replace(/[^0-9]/g, '');
      return list.filter(p => {
        const pPhone = (p.phone || '').replace(/[^0-9]/g, '');
        return pPhone && (pPhone.endsWith(clean) || clean.endsWith(pPhone));
      });
    }
    return list;
  },

  getQueueAsync: async (phone, clinicId) => {
    loadStore();
    if (clinicId && supabase && typeof supabase.isConfigured === 'function' && supabase.isConfigured()) {
      try {
        const sbQueue = await supabase.getQueue(clinicId);
        if (Array.isArray(sbQueue) && sbQueue.length > 0) {
          const map = {};
          store.queue.forEach(item => { if (item && item.id) map[item.id] = item; });
          sbQueue.forEach(item => { if (item && item.id) map[item.id] = { ...(map[item.id] || {}), ...item }; });
          store.queue = Object.values(map).sort((a, b) => (a.token || 0) - (b.token || 0));
          persistStore();
        }
      } catch (e) {}
    }
    return module.exports.getQueue(phone, clinicId);
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
      if (store.queue[existingIdx].status === 'CANCELLED' && booking.status !== 'CANCELLED' && !booking.forceUncancel) {
        booking.status = 'CANCELLED';
        booking.cancelledBy = store.queue[existingIdx].cancelledBy || 'clinic';
        booking.cancelReason = store.queue[existingIdx].cancelReason || 'Cancelled by clinic';
      }
      Object.assign(store.queue[existingIdx], booking);
      persistStore();
      return { isNew: false, booking: store.queue[existingIdx] };
    }

    const targetClinic = (booking.clinicId && store.clinics && store.clinics[booking.clinicId])
      ? store.clinics[booking.clinicId]
      : (INITIAL_CLINICS[booking.clinicId] || store.clinic);

    const clinicBookings = (booking.clinicId && store.queue)
      ? store.queue.filter(p => !p.clinicId || p.clinicId === booking.clinicId)
      : (store.queue || []);
    const maxToken = clinicBookings.reduce((max, p) => Math.max(max, p.token || 0), 0);
    const nextToken = booking.token || (maxToken > 0 ? maxToken + 1 : 1);
    const bookingId = booking.id || ('q_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

    const finalBooking = {
      id: bookingId,
      clinicId: booking.clinicId || (targetClinic ? targetClinic.id : store.clinic.id),
      clinicName: booking.clinicName || (targetClinic ? targetClinic.name : store.clinic.name),
      clinicAddress: booking.clinicAddress || (targetClinic ? targetClinic.address : store.clinic.address),
      clinicPhone: booking.clinicPhone || (targetClinic ? targetClinic.phone : store.clinic.phone),
      token: nextToken,
      name: (booking.name || '').trim(),
      age: parseInt(booking.age, 10) || 30,
      gender: booking.gender || 'M',
      phone: (booking.phone || '').trim(),
      reason: booking.reason || 'General Consultation',
      visitType: booking.visitType || 'new', // 'new' (Pahli Baar) or 'followup' (Dobara)
      doctorId: booking.doctorId || 'doc_1',
      doctorName: booking.doctorName || (targetClinic ? targetClinic.doctorName : store.clinic.doctorName),
      fee: booking.fee !== undefined ? booking.fee : (targetClinic && targetClinic.fees ? targetClinic.fees.normal : (store.clinic.fees ? store.clinic.fees.normal : 300)),
      payMode: booking.payMode || 'Baaki',
      status: booking.status || 'WAITING',
      source: booking.source || 'QR Booked',
      shift: booking.shift || 'Morning',
      slotTime: booking.slotTime || 'Online Booking',
      day: booking.day || 'Aaj (Today)',
      date: booking.date || getISTDateString(),
      bp: booking.bp || '',
      weight: booking.weight || '',
      temp: booking.temp || '',
      sugar: booking.sugar || booking.spo2 || '',
      spo2: booking.spo2 || booking.sugar || '',
      customMetrics: Array.isArray(booking.customMetrics) ? booking.customMetrics : [],
      followUpDays: booking.followUpDays != null ? booking.followUpDays : null,
      followUpDate: booking.followUpDate || '',
      hasParchiPhoto: !!booking.hasParchiPhoto,
      notes: booking.notes || '',
      createdAt: booking.createdAt || new Date().toISOString()
    };

    store.queue.push(finalBooking);
    persistStore();
    if (supabase && typeof supabase.saveBooking === 'function') {
      supabase.saveBooking(finalBooking).catch(() => {});
    }
    return { isNew: true, booking: finalBooking };
  },

  patchQueueItem: (id, updates) => {
    loadStore();
    const item = store.queue.find(p => p.id === id);
    if (!item) return null;
    Object.assign(item, updates);
    persistStore();
    if (supabase && typeof supabase.updateBooking === 'function') {
      supabase.updateBooking(id, updates).catch(() => {});
    }
    return item;
  },

  resetQueue: () => {
    store.queue = [];
    persistStore();
    return [];
  },

  updateSubscription: (clinicId, subscriptionData) => {
    loadStore();
    if (!clinicId) return null;
    store.clinics = store.clinics || {};
    const target = store.clinics[clinicId] || (store.clinic && store.clinic.id === clinicId ? store.clinic : null);
    if (!target) return null;
    target.subscription = {
      ...(target.subscription || {}),
      ...subscriptionData,
      updatedAt: new Date().toISOString()
    };
    store.clinics[clinicId] = target;
    if (store.clinic && store.clinic.id === clinicId) {
      store.clinic.subscription = target.subscription;
    }
    persistStore();
    if (supabase && typeof supabase.updateSubscription === 'function') {
      supabase.updateSubscription(clinicId, target.subscription).catch(() => {});
    }
    return target;
  },

  getAdminDoctors: () => {
    loadStore();
    const map = { ...INITIAL_CLINICS, ...(store.clinics || {}) };
    if (store.clinic && store.clinic.id) {
      map[store.clinic.id] = { ...map[store.clinic.id], ...store.clinic };
    }
    return Object.values(map).map(c => {
      const q = (store.queue || []).filter(b => b.clinicId === c.id);
      return {
        id: c.id,
        doctorName: c.doctorName || (c.doctors && c.doctors[0] ? c.doctors[0].name : 'Doctor'),
        doctorDegree: c.doctorDegree || (c.doctors && c.doctors[0] ? c.doctors[0].degree : 'MBBS'),
        doctorRegNo: c.doctorRegNo || 'MCI-REG',
        experienceYears: c.experienceYears || 10,
        clinicName: c.name || 'ParchiSetu Clinic',
        category: c.category || c.specialty || 'General Medicine',
        specialty: c.specialty || c.category || 'General Physician',
        city: c.city || 'Patna, Bihar',
        address: c.address || '',
        phone: c.phone || '',
        whatsapp: c.whatsapp || c.phone || '',
        ownerEmail: c.ownerEmail || c.email || '',
        ownerUid: c.ownerUid || '',
        doctorPhoto: c.doctorPhoto || (c.doctors && c.doctors[0] ? c.doctors[0].photo : ''),
        fees: c.fees || { normal: 300, followup: 200, emergency: 500, report: 0 },
        visitingHours: c.visitingHours || {},
        subscription: c.subscription || {
          plan: (c.id === 'clinic_sanjeevani_01' || c.id === 'clinic_delhi_bone_02') ? 'monthly_pro' : 'free',
          status: 'active',
          billingCycle: (c.id === 'clinic_sanjeevani_01' || c.id === 'clinic_delhi_bone_02') ? 'monthly' : 'trial',
          amount: (c.id === 'clinic_sanjeevani_01' || c.id === 'clinic_delhi_bone_02') ? 399 : 0,
          startDate: c.createdAt || '2026-10-01T00:00:00.000Z',
          renewalDate: new Date(Date.now() + 25 * 86400000).toISOString()
        },
        stats: {
          totalBookings: q.length,
          todayBookings: q.filter(b => b.date === getISTDateString()).length
        },
        createdAt: c.createdAt || new Date().toISOString()
      };
    });
  },

  getAdminDoctorsAsync: async () => {
    loadStore();
    let doctors = module.exports.getAdminDoctors();
    if (supabase && typeof supabase.isConfigured === 'function' && supabase.isConfigured()) {
      try {
        const sbDoctors = await supabase.getAdminDoctors();
        if (Array.isArray(sbDoctors) && sbDoctors.length > 0) {
          const map = {};
          doctors.forEach(d => { if (d && d.id) map[d.id] = d; });
          sbDoctors.forEach(d => { if (d && d.id) map[d.id] = { ...(map[d.id] || {}), ...d }; });
          doctors = Object.values(map);
        }
      } catch (e) {}
    }
    return doctors;
  }
};
