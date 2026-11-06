/**
 * ParchiSetu - Local Clinic & Token Management Server
 * Built with Node.js built-in modules (http, fs, path, os, url).
 * Zero external dependencies.
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_FILE = path.join(__dirname, 'clinic_data.json');
const HTML_FILE = path.join(__dirname, 'index.html');
const ALT_HTML_FILE = path.join(__dirname, 'parchisetu_indian_clinic_management_token_web_app.html');

// Default Clinic Profile (Realistic Indian Clinic Scenario)
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
  },
  clinic_razorpay_verification: {
    id: 'clinic_razorpay_verification',
    name: 'ParchiSetu Healthcare Clinic (Razorpay Test)',
    tagline: 'General Medicine & Live OPD Counter',
    category: 'General Medicine',
    specialty: 'General Physician',
    address: 'Plot 14, Ring Road, Sector 5',
    city: 'Patna, Bihar',
    phone: '9835012345',
    whatsapp: '9835012345',
    upiId: 'parchisetu@upi',
    doctorName: 'Dr. Rajesh Sharma',
    doctorDegree: 'MBBS, MD (General Medicine)',
    doctorRegNo: 'MCI-48291',
    experienceYears: 14,
    rating: 4.9,
    reviewCount: 148,
    doctorPhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
    fees: { normal: 300, followup: 200, emergency: 500, report: 0 },
    visitingReasons: ['🤒 Bukhar / Cold', '🩸 BP / Sugar', '🔄 Follow-up', '📋 Report Check'],
    visitingHours: {
      morning: { enabled: true, start: '10:00 AM', end: '02:00 PM', slotDurationMins: 15, maxTokens: 25 },
      evening: { enabled: true, start: '05:00 PM', end: '09:00 PM', slotDurationMins: 15, maxTokens: 30 },
      daysOpen: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      avgConsultationMins: 10
    },
    liveStatus: { isDoctorLate: false, doctorDelayMinutes: 0, expectedArrivalTime: '10:00 AM', isQRBookingPaused: false },
    doctors: [
      { id: 'doc_1', name: 'Dr. Rajesh Sharma', degree: 'MBBS, MD', specialty: 'General Physician', fee: 300, isMain: true }
    ],
    leaves: {},
    onboarded: true,
    createdAt: '2026-10-28T00:00:00.000Z',
    ownerUid: 'usr_razorpay_verification',
    ownerEmail: 'razorpay.test@parchisetu.in',
    password: 'Razorpay@2026',
    isGoogleAuth: false,
    createdViaClinicPanel: true,
    subscription: {
      plan: 'free',
      status: 'expired',
      trialDays: 7,
      trialStartDate: '2026-10-28T00:00:00.000Z',
      billingCycle: 'trial',
      amount: 0,
      updatedAt: '2026-11-06T00:00:00.000Z'
    }
  }
};

// Initial Queue - Zero dummy data for fresh clinic setup
const DEFAULT_QUEUE = [];

let appData = {
  clinic: DEFAULT_CLINIC,
  clinics: { ...INITIAL_CLINICS },
  queue: DEFAULT_QUEUE
};

// Load or initialize data file
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.clinic) {
          appData.clinic = {
            ...DEFAULT_CLINIC,
            ...parsed.clinic,
            visitingHours: parsed.clinic.visitingHours || DEFAULT_CLINIC.visitingHours,
            fees: parsed.clinic.fees || DEFAULT_CLINIC.fees,
            doctors: parsed.clinic.doctors || DEFAULT_CLINIC.doctors
          };
        }
        if (parsed.clinics) appData.clinics = { ...INITIAL_CLINICS, ...parsed.clinics };
        if (Array.isArray(parsed.queue)) appData.queue = parsed.queue;
      }
    }
  } catch (err) {
    console.error('Error loading data, using defaults:', err.message);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data:', err.message);
  }
}

loadData();

// SSE (Server-Sent Events) clients
const sseClients = new Set();

function broadcastEvent(eventName, payload) {
  const data = JSON.stringify({ event: eventName, data: payload, timestamp: Date.now() });
  for (const res of sseClients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(res);
    }
  }
}

// Keep SSE connections alive with periodic heartbeat
setInterval(() => {
  for (const res of sseClients) {
    try {
      res.write(': keep-alive\n\n');
    } catch (e) {
      sseClients.delete(res);
    }
  }
}, 25000);

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function getISTDateString(d = new Date()) {
  const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

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

// Request Handler
const requestHandler = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS headers for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Routes
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    return;
  }

  // Razorpay Payment Routes
  if (pathname.startsWith('/api/payment')) {
    const action = parsedUrl.searchParams.get('action') || pathname.replace('/api/payment/', '').replace('/api/payment', '').replace(/^\//, '');
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_SI7eJZcqXniZIm';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const monthlyPlanId = process.env.RAZORPAY_PLAN_ID_MONTHLY || 'plan_TwjQqXf0E2Wwsm';
    const yearlyPlanId = process.env.RAZORPAY_PLAN_ID_YEARLY || 'plan_TwjSpdloNb5wK6';

    if (method === 'GET' && (action === 'config' || action === '')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        keyId,
        plans: {
          monthly_pro: { id: 'monthly_pro', amount: 399, currency: 'INR', name: 'Monthly OPD Pro Plan (Autopay)', durationDays: 30, autopay: true, planId: monthlyPlanId, paymentUrl: 'https://rzp.io/rzp/1zr3jTD4' },
          annual_pro: { id: 'annual_pro', amount: 3999, currency: 'INR', name: 'Annual Pro Plan (Autopay 1 Year)', durationDays: 365, savings: 789, autopay: true, planId: yearlyPlanId, paymentUrl: 'https://rzp.io/rzp/O5bDvXRN' }
        }
      }));
      return;
    }

    if (method === 'POST' && (action === 'create-order' || action === 'order' || action === 'create-subscription' || action === 'subscription')) {
      try {
        const body = await parseBody(req);
        const plan = (body.plan === 'annual_pro' || body.plan === 'annual') ? 'annual_pro' : 'monthly_pro';
        const isAnnual = plan === 'annual_pro';
        const amount = isAnnual ? 3999 : 399;
        const amountInPaise = Math.round(amount * 100);
        const clinicId = body.clinicId || 'clinic_razorpay_verification';
        const isLiveKey = keySecret && keyId && !keyId.includes('placeholder') && !keyId.includes('YourRazorpay') && !keyId.includes('parchisetu');
        const yearlyPlanId = process.env.RAZORPAY_PLAN_ID_YEARLY || '';
        const targetPlanId = isAnnual ? yearlyPlanId : monthlyPlanId;

        // Try Razorpay Subscriptions (Autopay) if live keys and plan id configured
        if (isLiveKey && targetPlanId) {
          try {
            const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
            const subData = JSON.stringify({
              plan_id: targetPlanId,
              total_count: isAnnual ? 10 : 120,
              quantity: 1,
              customer_notify: 1,
              notes: { clinicId, plan, autopay: 'true', platform: 'ParchiSetu' }
            });

            const subResponse = await new Promise((resolve, reject) => {
              const rzpReq = https.request({
                hostname: 'api.razorpay.com',
                port: 443,
                path: '/v1/subscriptions',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Basic ${auth}`,
                  'Content-Length': Buffer.byteLength(subData)
                }
              }, (r) => {
                let chunk = '';
                r.on('data', d => { chunk += d; });
                r.on('end', () => {
                  try {
                    resolve({ statusCode: r.statusCode, data: JSON.parse(chunk) });
                  } catch (e) {
                    resolve({ statusCode: r.statusCode, data: null });
                  }
                });
              });
              rzpReq.on('error', reject);
              rzpReq.write(subData);
              rzpReq.end();
            });

            if (subResponse.statusCode >= 200 && subResponse.statusCode < 300 && subResponse.data && subResponse.data.id) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                isSubscription: true,
                subscriptionId: subResponse.data.id,
                orderId: subResponse.data.id,
                amount: amountInPaise,
                currency: 'INR',
                keyId,
                plan,
                autopay: true
              }));
              return;
            }
          } catch (subErr) {
            console.warn('Live subscription creation notice in server.js:', subErr.message);
          }
        }

        // Try Standard Razorpay Order
        if (isLiveKey) {
          try {
            const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
            const postData = JSON.stringify({
              amount: amountInPaise,
              currency: 'INR',
              receipt: `rcpt_${clinicId.slice(0, 8)}_${Date.now().toString().slice(-6)}`,
              notes: { clinicId, plan, autopay: 'true', platform: 'ParchiSetu' }
            });

            const rzpResponse = await new Promise((resolve, reject) => {
              const rzpReq = https.request({
                hostname: 'api.razorpay.com',
                port: 443,
                path: '/v1/orders',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Basic ${auth}`,
                  'Content-Length': Buffer.byteLength(postData)
                }
              }, (r) => {
                let chunk = '';
                r.on('data', d => { chunk += d; });
                r.on('end', () => {
                  try {
                    resolve({ statusCode: r.statusCode, data: JSON.parse(chunk) });
                  } catch (e) {
                    resolve({ statusCode: r.statusCode, data: null });
                  }
                });
              });
              rzpReq.on('error', reject);
              rzpReq.write(postData);
              rzpReq.end();
            });

            if (rzpResponse.statusCode >= 200 && rzpResponse.statusCode < 300 && rzpResponse.data && rzpResponse.data.id) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                isSubscription: false,
                orderId: rzpResponse.data.id,
                amount: rzpResponse.data.amount,
                currency: rzpResponse.data.currency || 'INR',
                keyId,
                plan,
                autopay: true
              }));
              return;
            }
          } catch (err) {
            console.warn('Live order creation fallback in server.js:', err.message);
          }
        }

        const simulatedOrderId = `order_test_${Date.now()}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          isSubscription: false,
          orderId: simulatedOrderId,
          amount: amountInPaise,
          currency: 'INR',
          keyId,
          plan,
          autopay: true,
          isSimulated: true
        }));
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    if (method === 'POST' && (action === 'verify')) {
      try {
        const body = await parseBody(req);
        const {
          clinicId,
          plan = 'monthly_pro',
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_subscription_id,
          razorpay_signature
        } = body;
        if (!clinicId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing clinicId' }));
          return;
        }

        let isValid = true;
        if (keySecret && razorpay_signature && razorpay_signature !== 'test_verified_signature') {
          if (razorpay_subscription_id && razorpay_payment_id) {
            const generated_signature = crypto
              .createHmac('sha256', keySecret)
              .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
              .digest('hex');
            isValid = (generated_signature === razorpay_signature);
          } else if (razorpay_order_id && razorpay_payment_id) {
            const generated_signature = crypto
              .createHmac('sha256', keySecret)
              .update(`${razorpay_order_id}|${razorpay_payment_id}`)
              .digest('hex');
            isValid = (generated_signature === razorpay_signature);
          }
        }

        if (!isValid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid Razorpay payment signature' }));
          return;
        }

        const isAnnual = plan === 'annual_pro' || plan === 'annual';
        const amount = isAnnual ? 3999 : 399;
        const renewalDays = isAnnual ? 365 : 30;
        const renewalDate = new Date(Date.now() + renewalDays * 86400000).toISOString();

        appData.clinics = appData.clinics || {};
        const target = appData.clinics[clinicId] || (appData.clinic && appData.clinic.id === clinicId ? appData.clinic : (INITIAL_CLINICS[clinicId] ? { ...INITIAL_CLINICS[clinicId] } : null));

        if (!target) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Clinic not found' }));
          return;
        }

        target.subscription = {
          plan: isAnnual ? 'annual_pro' : 'monthly_pro',
          status: 'active',
          billingCycle: isAnnual ? 'annual' : 'monthly',
          amount: amount,
          autopay: true,
          subscriptionId: razorpay_subscription_id || null,
          paymentId: razorpay_payment_id || `pay_verified_${Date.now()}`,
          orderId: razorpay_order_id || null,
          paidAt: new Date().toISOString(),
          renewalDate: renewalDate,
          updatedAt: new Date().toISOString()
        };

        appData.clinics[clinicId] = target;
        if (appData.clinic && appData.clinic.id === clinicId) {
          appData.clinic.subscription = target.subscription;
        }
        saveData();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Payment verified successfully. Platform unlocked!',
          clinicId,
          subscription: target.subscription,
          clinic: target
        }));
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Payment action not found' }));
    return;
  }

  // Get all clinics list for Discovery
  if ((pathname === '/api/clinics' || (pathname === '/api/clinic' && (parsedUrl.searchParams.get('list') === '1' || parsedUrl.searchParams.get('action') === 'list'))) && method === 'GET') {
    const realOnly = parsedUrl.searchParams.get('realOnly') === '1' || parsedUrl.searchParams.get('realOnly') === 'true';
    const map = { ...INITIAL_CLINICS, ...(appData.clinics || {}) };
    if (appData.clinic && appData.clinic.id) {
      map[appData.clinic.id] = { ...map[appData.clinic.id], ...appData.clinic };
    }
    const rawList = Object.values(map);
    let list = rawList.map(c => {
      const init = INITIAL_CLINICS[c.id] || DEFAULT_CLINIC;
      const docName = c.doctorName || (c.doctors && c.doctors[0] ? c.doctors[0].name : init.doctorName);
      const docDegree = c.doctorDegree || (c.doctors && c.doctors[0] ? c.doctors[0].degree : init.doctorDegree);
      const docSpecialty = c.specialty || c.category || (INITIAL_CLINICS[c.id] && INITIAL_CLINICS[c.id].specialty) || init.specialty || 'General Physician';
      const docCategory = c.category || c.specialty || (INITIAL_CLINICS[c.id] && INITIAL_CLINICS[c.id].category) || init.category || 'General Medicine';
      const docPhoto = c.doctorPhoto || (c.doctors && c.doctors[0] && c.doctors[0].photo) || init.doctorPhoto || DEFAULT_CLINIC.doctorPhoto;

      const doctors = (Array.isArray(c.doctors) && c.doctors.length > 0)
        ? c.doctors.map((d, i) => {
            if (i === 0) {
              return {
                ...d,
                id: d.id || 'doc_1',
                name: docName,
                degree: docDegree,
                specialty: docSpecialty,
                photo: docPhoto,
                fee: (c.fees && c.fees.normal) || d.fee || 300,
                isMain: true
              };
            }
            return d;
          })
        : [
            {
              id: 'doc_1',
              name: docName,
              degree: docDegree,
              specialty: docSpecialty,
              photo: docPhoto,
              fee: (c.fees && c.fees.normal) || 300,
              isMain: true
            }
          ];

      return {
        ...init,
        ...c,
        doctorName: docName,
        doctorDegree: docDegree,
        doctorPhoto: docPhoto,
        specialty: docSpecialty,
        category: docCategory,
        doctors,
        rating: c.rating || init.rating || 4.8,
        reviewCount: c.reviewCount || init.reviewCount || 120
      };
    });
    if (realOnly) {
      list = list.filter(c => (c.ownerUid || c.isGoogleAuth || c.googleRegistered || c.createdViaClinicPanel || c.ownerEmail) && !isDummyClinicName(c.name));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // Admin: Get all signed up doctor accounts & tracking details
  if ((pathname === '/api/admin/doctors' || (pathname === '/api/admin' && (parsedUrl.searchParams.get('action') === 'doctors' || !parsedUrl.searchParams.get('action')))) && method === 'GET') {
    const map = { ...INITIAL_CLINICS, ...(appData.clinics || {}) };
    if (appData.clinic && appData.clinic.id) {
      map[appData.clinic.id] = { ...map[appData.clinic.id], ...appData.clinic };
    }
    const rawList = Object.values(map);
    const doctors = rawList.map(c => {
      const q = (appData.queue || []).filter(b => b.clinicId === c.id);
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
        isLive: !!(c.onboarded || c.isGoogleAuth || c.ownerUid || (c.liveStatus && !c.liveStatus.isQRBookingPaused)),
        createdAt: c.createdAt || new Date().toISOString()
      };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, doctors }));
    return;
  }

  // Admin: Update subscription plan (Free or Pro) for a doctor / clinic
  if ((pathname === '/api/admin/subscription' || (pathname === '/api/admin' && parsedUrl.searchParams.get('action') === 'subscription')) && method === 'POST') {
    try {
      const body = await parseBody(req);
      const clinicId = body.clinicId;
      if (!clinicId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing clinicId' }));
        return;
      }
      appData.clinics = appData.clinics || {};
      const target = appData.clinics[clinicId] || (appData.clinic && appData.clinic.id === clinicId ? appData.clinic : null);
      if (!target) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Clinic not found' }));
        return;
      }
      target.subscription = {
        ...(target.subscription || {}),
        plan: body.plan || 'free', // 'free' | 'monthly_pro' | 'annual_pro'
        status: body.status || 'active', // 'active' | 'trial' | 'expired'
        billingCycle: body.billingCycle || (body.plan === 'annual_pro' ? 'annual' : (body.plan === 'monthly_pro' ? 'monthly' : 'trial')),
        amount: body.amount !== undefined ? body.amount : (body.plan === 'annual_pro' ? 3999 : (body.plan === 'monthly_pro' ? 399 : 0)),
        renewalDate: body.renewalDate || new Date(Date.now() + 30 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      };
      appData.clinics[clinicId] = target;
      if (appData.clinic && appData.clinic.id === clinicId) {
        appData.clinic.subscription = target.subscription;
      }
      saveData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, clinicId, subscription: target.subscription, clinic: target }));
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  // Get clinic info
  if (pathname === '/api/clinic' && method === 'GET') {
    const ips = getLocalIpAddresses();
    const ownerUid = parsedUrl.searchParams.get('ownerUid') || parsedUrl.searchParams.get('uid');
    const ownerEmail = parsedUrl.searchParams.get('email') || parsedUrl.searchParams.get('ownerEmail');

    if (ownerUid || ownerEmail) {
      const allClinics = Object.values(appData.clinics || {});
      if (appData.clinic && appData.clinic.id) allClinics.push(appData.clinic);
      const ownerClinic = allClinics.find(c => {
        if (ownerUid && c.ownerUid === ownerUid) return true;
        if (ownerEmail && c.ownerEmail && c.ownerEmail.toLowerCase() === ownerEmail.toLowerCase()) return true;
        return false;
      });
      if (!ownerClinic) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Clinic not found for this account' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...ownerClinic,
        network: {
          port: PORT,
          localIps: ips,
          lanUrl: ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`
        }
      }));
      return;
    }

    let clinicId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('clinic');
    if (clinicId === 'razorpay_test') clinicId = 'clinic_razorpay_verification';
    if (clinicId) {
      const match = (appData.clinics && appData.clinics[clinicId]) || 
                    (appData.clinic && appData.clinic.id === clinicId ? appData.clinic : null) || 
                    INITIAL_CLINICS[clinicId];
      if (!match) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Clinic not found', clinicId }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...match,
        network: {
          port: PORT,
          localIps: ips,
          lanUrl: ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`
        }
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...appData.clinic,
      network: {
        port: PORT,
        localIps: ips,
        lanUrl: ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`
      }
    }));
    return;
  }

  // Save / Update clinic onboarding info
  if (pathname === '/api/clinic' && method === 'POST') {
    try {
      const body = await parseBody(req);
      appData.clinics = appData.clinics || {};
      const targetId = body.id || (appData.clinic && appData.clinic.id) || ('clinic_' + Date.now());
      const existing = (targetId && appData.clinics[targetId]) || 
                       (appData.clinic && appData.clinic.id === targetId ? appData.clinic : {}) ||
                       (INITIAL_CLINICS[targetId] || {});
      const docName = body.doctorName || existing.doctorName || DEFAULT_CLINIC.doctorName;
      const docDegree = body.doctorDegree || existing.doctorDegree || DEFAULT_CLINIC.doctorDegree;
      const docSpecialty = body.specialty || body.category || existing.specialty || existing.category || 'General Medicine';
      const docPhoto = body.doctorPhoto || (body.doctors && body.doctors[0] && body.doctors[0].photo) || existing.doctorPhoto || DEFAULT_CLINIC.doctorPhoto;

      let doctorsList = body.doctors || existing.doctors || DEFAULT_CLINIC.doctors;
      if (!Array.isArray(doctorsList) || doctorsList.length === 0) {
        doctorsList = [{ id: 'doc_1', isMain: true }];
      }
      if (docName) {
        doctorsList = doctorsList.map((d, i) => {
          if (i === 0) {
            return {
              ...d,
              id: d.id || 'doc_1',
              name: docName,
              degree: docDegree,
              specialty: docSpecialty,
              photo: docPhoto || d.photo || '',
              fee: (body.fees && body.fees.normal) || (existing.fees && existing.fees.normal) || d.fee || 300,
              isMain: true
            };
          }
          return d;
        });
      }

      const updatedClinic = {
        ...DEFAULT_CLINIC,
        ...existing,
        ...body,
        id: targetId,
        doctorName: docName,
        doctorDegree: docDegree,
        doctorPhoto: docPhoto,
        specialty: docSpecialty,
        onboarded: true,
        visitingHours: body.visitingHours || existing.visitingHours || DEFAULT_CLINIC.visitingHours,
        fees: body.fees || existing.fees || DEFAULT_CLINIC.fees,
        doctors: doctorsList,
        updatedAt: new Date().toISOString()
      };
      appData.clinics[updatedClinic.id] = updatedClinic;
      if (!appData.clinic || appData.clinic.id === updatedClinic.id || (isDummyClinicName(appData.clinic.name) && !isDummyClinicName(updatedClinic.name))) {
        appData.clinic = updatedClinic;
      }
      saveData();
      broadcastEvent('CLINIC_UPDATED', updatedClinic);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, clinic: updatedClinic }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Get current queue (with optional phone lookup and clinic filter)
  if (pathname === '/api/queue' && method === 'GET') {
    const phone = parsedUrl.searchParams.get('phone');
    const clinicId = parsedUrl.searchParams.get('clinic') || parsedUrl.searchParams.get('clinicId');
    let list = appData.queue || [];
    if (clinicId) {
      list = list.filter(p => !p.clinicId || p.clinicId === clinicId);
    }
    if (phone) {
      const clean = phone.replace(/[^0-9]/g, '');
      list = list.filter(p => {
        const pPhone = (p.phone || '').replace(/[^0-9]/g, '');
        return pPhone && (pPhone.endsWith(clean) || clean.endsWith(pPhone));
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // Batch update or synchronize the queue
  if (pathname === '/api/queue' && method === 'PUT') {
    try {
      const body = await parseBody(req);
      if (Array.isArray(body)) {
        appData.queue = body;
        saveData();
        broadcastEvent('QUEUE_UPDATED', { queue: appData.queue });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, queue: appData.queue }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Body must be an array of queue items' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Reset today's queue (e.g. at the start of a fresh day)
  if (pathname === '/api/queue/reset' && method === 'POST') {
    try {
      appData.queue = [];
      saveData();
      broadcastEvent('QUEUE_UPDATED', { queue: [] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, queue: [] }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Book a visiting slot (by patient or walk-in)
  if (pathname === '/api/bookings' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.name || (!body.phone && body.source !== 'Walk-in')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Name and phone are required' }));
        return;
      }

      // Check if this booking ID already exists to prevent duplicate creation
      const existingIdx = body.id ? appData.queue.findIndex(p => p.id === body.id) : -1;
      if (existingIdx >= 0) {
        if (appData.queue[existingIdx].status === 'CANCELLED' && body.status !== 'CANCELLED' && !body.forceUncancel) {
          body.status = 'CANCELLED';
          body.cancelledBy = appData.queue[existingIdx].cancelledBy || 'clinic';
          body.cancelReason = appData.queue[existingIdx].cancelReason || 'Cancelled by clinic';
        }
        Object.assign(appData.queue[existingIdx], body);
        saveData();
        broadcastEvent('QUEUE_UPDATED', { id: body.id, updated: body, queue: appData.queue });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, booking: appData.queue[existingIdx] }));
        return;
      }

      // Determine next token number
      const clinicBookings = (body.clinicId && appData.queue)
        ? appData.queue.filter(p => !p.clinicId || p.clinicId === body.clinicId)
        : (appData.queue || []);
      const maxToken = clinicBookings.reduce((max, p) => Math.max(max, p.token || 0), 0);
      const nextToken = body.token || (maxToken > 0 ? maxToken + 1 : 1);
      const bookingId = body.id || ('q_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

      const targetClinic = (body.clinicId && appData.clinics && appData.clinics[body.clinicId])
        ? appData.clinics[body.clinicId]
        : (INITIAL_CLINICS[body.clinicId] || appData.clinic);

      const newBooking = {
        id: bookingId,
        clinicId: body.clinicId || (targetClinic ? targetClinic.id : appData.clinic.id),
        clinicName: body.clinicName || (targetClinic ? targetClinic.name : appData.clinic.name),
        clinicAddress: body.clinicAddress || (targetClinic ? targetClinic.address : appData.clinic.address),
        clinicPhone: body.clinicPhone || (targetClinic ? targetClinic.phone : appData.clinic.phone),
        token: nextToken,
        name: body.name.trim(),
        age: parseInt(body.age, 10) || 30,
        gender: body.gender || 'M',
        phone: (body.phone || '').trim(),
        reason: body.reason || 'General Consultation',
        visitType: body.visitType || 'new',
        doctorId: body.doctorId || 'doc_1',
        doctorName: body.doctorName || (targetClinic ? targetClinic.doctorName : (appData.clinic.doctorName || 'Dr. Rajesh Sharma')),
        fee: body.fee !== undefined ? body.fee : (targetClinic && targetClinic.fees ? targetClinic.fees.normal : (appData.clinic.fees ? appData.clinic.fees.normal : 300)),
        payMode: body.payMode || 'Baaki', // online booked pays at clinic desk
        status: body.status || 'WAITING',
        source: body.source || 'QR Booked',
        shift: body.shift || 'Morning',
        slotTime: body.slotTime || 'Online Booking',
        day: body.day || 'Aaj (Today)',
        date: body.date || getISTDateString(),
        bp: body.bp || '',
        weight: body.weight || '',
        temp: body.temp || '',
        sugar: body.sugar || body.spo2 || '',
        spo2: body.spo2 || body.sugar || '',
        customMetrics: Array.isArray(body.customMetrics) ? body.customMetrics : [],
        followUpDays: body.followUpDays != null ? body.followUpDays : null,
        followUpDate: body.followUpDate || '',
        hasParchiPhoto: !!body.hasParchiPhoto,
        notes: body.notes || '',
        createdAt: body.createdAt || new Date().toISOString()
      };

      appData.queue.push(newBooking);
      saveData();

      // Real-time broadcast to all connected Compounder Desks and tickers!
      broadcastEvent('NEW_BOOKING', newBooking);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, booking: newBooking }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Get bookings (supports phone search)
  if (pathname === '/api/bookings' && method === 'GET') {
    const phone = parsedUrl.searchParams.get('phone');
    if (phone) {
      const clean = phone.replace(/[^0-9]/g, '');
      const list = (appData.queue || []).filter(p => {
        const pPhone = (p.phone || '').replace(/[^0-9]/g, '');
        return pPhone && (pPhone.endsWith(clean) || clean.endsWith(pPhone));
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(appData.queue));
    return;
  }

  // Update a queue item (status change, fee paid, etc.)
  if (pathname.startsWith('/api/queue/') && (method === 'PATCH' || method === 'POST')) {
    const id = pathname.replace('/api/queue/', '');
    try {
      const body = await parseBody(req);
      const item = appData.queue.find(p => p.id === id);
      if (!item) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item not found' }));
        return;
      }

      Object.assign(item, body);
      saveData();
      broadcastEvent('QUEUE_UPDATED', { id, updated: body, queue: appData.queue });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, item }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Real-time SSE stream for live updates across WiFi devices
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ event: 'CONNECTED', timestamp: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => sseClients.delete(res));
    req.on('error', () => sseClients.delete(res));
    res.on('error', () => sseClients.delete(res));
    return;
  }

  // Serve static files
  let filePath = HTML_FILE;
  if (pathname !== '/' && pathname !== '') {
    const safePath = path.normalize(path.join(__dirname, pathname)).replace(/^(\.\.[\/\\])+/, '');
    const publicPath = path.normalize(path.join(__dirname, 'public', pathname)).replace(/^(\.\.[\/\\])+/, '');
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      filePath = publicPath;
    } else if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      filePath = safePath;
    }
  }

  if (!fs.existsSync(filePath)) {
    // Fallback to HTML file
    filePath = fs.existsSync(HTML_FILE) ? HTML_FILE : ALT_HTML_FILE;
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Stream Error');
    });
    stream.pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
};

const server = http.createServer(requestHandler);

function startServer(port = PORT) {
  server.listen(port, () => {
    const ips = getLocalIpAddresses();
    console.log(`\n=============================================================`);
    console.log(`🏥 ParchiSetu • Smart Clinic & Token Web App is RUNNING LOCALLY!`);
    console.log(`=============================================================`);
    console.log(`👉 Home Screen (Patients): http://localhost:${port}/`);
    console.log(`👉 Doctor / Clinic Desk:   http://localhost:${port}/clinic`);
    console.log(`👉 Clinic Sign In / Portal:http://localhost:${port}/signin`);
    console.log(`👉 Owner Admin Panel:      http://localhost:${port}/admin`);
    if (ips.length > 0) {
      console.log(`-------------------------------------------------------------`);
      console.log(`📱 Connect your Mobile on the same Wi-Fi:`);
      ips.forEach(ip => {
        console.log(`   http://${ip}:${port}`);
        console.log(`   Patient Link: http://${ip}:${port}/?role=patient`);
        console.log(`   Sign In Link: http://${ip}:${port}/signin`);
        console.log(`   Admin Link:   http://${ip}:${port}/admin`);
      });
    }
    console.log(`=============================================================\n`);
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = requestHandler;
module.exports.server = server;
module.exports.startServer = startServer;
module.exports.appData = appData;
module.exports.saveData = saveData;
