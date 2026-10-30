/**
 * Parchisetu - Local Clinic & Token Management Server
 * Built with Node.js built-in modules (http, fs, path, os, url).
 * Zero external dependencies.
 */

const http = require('http');
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
        if (parsed.clinic) appData.clinic = parsed.clinic;
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

  // Get all clinics list for Discovery
  if ((pathname === '/api/clinics' || (pathname === '/api/clinic' && (parsedUrl.searchParams.get('list') === '1' || parsedUrl.searchParams.get('action') === 'list'))) && method === 'GET') {
    const rawList = Object.values(appData.clinics || { [appData.clinic.id]: appData.clinic });
    const list = rawList.map(c => {
      const init = INITIAL_CLINICS[c.id] || DEFAULT_CLINIC;
      return {
        ...init,
        ...c,
        doctorPhoto: c.doctorPhoto || (c.doctors && c.doctors[0] && c.doctors[0].photo) || init.doctorPhoto || DEFAULT_CLINIC.doctorPhoto,
        rating: c.rating || init.rating || 4.8,
        reviewCount: c.reviewCount || init.reviewCount || 120
      };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // Get clinic info
  if (pathname === '/api/clinic' && method === 'GET') {
    const ips = getLocalIpAddresses();
    const clinicId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('clinic');
    const targetClinic = (clinicId && appData.clinics && appData.clinics[clinicId]) ? appData.clinics[clinicId] : appData.clinic;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...targetClinic,
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
      appData.clinic = {
        ...appData.clinic,
        ...body,
        onboarded: true,
        updatedAt: new Date().toISOString()
      };
      appData.clinics = appData.clinics || {};
      if (appData.clinic.id) {
        appData.clinics[appData.clinic.id] = appData.clinic;
      }
      saveData();
      broadcastEvent('CLINIC_UPDATED', appData.clinic);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, clinic: appData.clinic }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Get current queue (with optional phone lookup)
  if (pathname === '/api/queue' && method === 'GET') {
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
        Object.assign(appData.queue[existingIdx], body);
        saveData();
        broadcastEvent('QUEUE_UPDATED', { id: body.id, updated: body, queue: appData.queue });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, booking: appData.queue[existingIdx] }));
        return;
      }

      // Determine next token number
      const maxToken = appData.queue.reduce((max, p) => Math.max(max, p.token || 0), 0);
      const nextToken = body.token || (maxToken > 0 ? maxToken + 1 : 1);
      const bookingId = body.id || ('q_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

function getISTDateString(d = new Date()) {
  const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

      const newBooking = {
        id: bookingId,
        token: nextToken,
        name: body.name.trim(),
        age: parseInt(body.age, 10) || 30,
        gender: body.gender || 'M',
        phone: (body.phone || '').trim(),
        reason: body.reason || 'General Consultation',
        visitType: body.visitType || 'new',
        doctorId: body.doctorId || 'doc_1',
        doctorName: body.doctorName || (appData.clinic.doctorName || 'Dr. Rajesh Sharma'),
        fee: body.fee !== undefined ? body.fee : (appData.clinic.fees ? appData.clinic.fees.normal : 300),
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
    console.log(`🏥 Parchisetu Clinic & Token Web App is RUNNING LOCALLY!`);
    console.log(`=============================================================`);
    console.log(`👉 Local Computer:         http://localhost:${port}`);
    console.log(`👉 Clinic Sign In / Portal:http://localhost:${port}/signin`);
    console.log(`👉 Direct Patient Link:    http://localhost:${port}/?role=patient`);
    console.log(`👉 Compounder Desk Link:   http://localhost:${port}/?role=clinic`);
    if (ips.length > 0) {
      console.log(`-------------------------------------------------------------`);
      console.log(`📱 Connect your Mobile on the same Wi-Fi:`);
      ips.forEach(ip => {
        console.log(`   http://${ip}:${port}`);
        console.log(`   Patient Link: http://${ip}:${port}/?role=patient`);
        console.log(`   Sign In Link: http://${ip}:${port}/signin`);
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
