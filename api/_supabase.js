/**
 * ParchiSetu - Supabase PostgreSQL Database Client
 * High-performance, zero-dependency REST integration for PostgreSQL on Supabase.
 * Optimized for multi-device clinic owner Google Auth persistence, live token queue sync,
 * patient discovery feeds, and owner admin metrics.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Auto-load local .env file if running in Node.js without pre-loaded environment
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key] && val) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || 
         process.env.SUPABASE_ANON_KEY || 
         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

function isSupabaseConfigured() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  return Boolean(url && key && url.startsWith('http'));
}

function request(method, pathStr, body = null, headers = {}) {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const baseUrl = getSupabaseUrl();
      const apiKey = getSupabaseKey();
      const fullUrl = new URL(pathStr, baseUrl);
      const isHttps = fullUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const postData = body ? JSON.stringify(body) : null;
      const options = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        method: method.toUpperCase(),
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        },
        timeout: 3000
      };

      if (postData) {
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data ? JSON.parse(data) : true);
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

function formatClinic(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    name: row.name,
    ownerUid: row.owner_uid || null,
    ownerEmail: row.owner_email || null,
    tagline: row.tagline || '',
    category: row.category || 'General Medicine',
    specialty: row.specialty || row.category || 'General Physician',
    address: row.address || '',
    city: row.city || 'Patna, Bihar',
    phone: row.phone || '',
    whatsapp: row.whatsapp || row.phone || '',
    upiId: row.upi_id || '',
    mapUrl: row.map_url || '',
    doctorName: row.doctor_name || '',
    doctorDegree: row.doctor_degree || 'MBBS',
    doctorRegNo: row.doctor_reg_no || '',
    experienceYears: row.experience_years !== undefined ? row.experience_years : 10,
    rating: typeof row.rating === 'number' ? row.rating : (parseFloat(row.rating) || 4.8),
    reviewCount: row.review_count || 0,
    doctorPhoto: row.doctor_photo || '',
    fees: row.fees || { normal: 300, followup: 200, emergency: 500, report: 0 },
    visitingReasons: Array.isArray(row.visiting_reasons) ? row.visiting_reasons : [],
    visitingHours: row.visiting_hours || {},
    liveStatus: row.live_status || {},
    doctors: Array.isArray(row.doctors) ? row.doctors : [],
    leaves: row.leaves || {},
    subscription: row.subscription || { plan: 'free', status: 'active' },
    onboarded: row.onboarded !== false,
    isGoogleAuth: Boolean(row.is_google_auth || row.owner_uid),
    googleRegistered: Boolean(row.is_google_auth || row.owner_uid),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

function formatBooking(row) {
  if (!row || typeof row !== 'object') return null;
  const v = row.vitals || {};
  return {
    id: row.id,
    clinicId: row.clinic_id,
    doctorId: row.doctor_id || 'doc_1',
    doctorName: row.doctor_name || '',
    token: row.token,
    name: row.patient_name || '',
    phone: row.phone || '',
    age: row.age || 30,
    gender: row.gender || 'M',
    visitType: row.visit_type || 'New',
    reason: row.reason || '',
    fee: typeof row.fee === 'number' ? row.fee : (parseFloat(row.fee) || 0),
    paymentStatus: row.payment_status || 'Pending',
    payMode: row.payment_mode || 'Cash',
    status: row.cabin_status || 'WAITING',
    cabinStatus: row.cabin_status || 'WAITING',
    date: row.appointment_date || new Date().toISOString().slice(0, 10),
    slotTime: row.slot_time || 'Online Booking',
    shift: row.shift || 'Morning',
    vitals: v,
    bp: v.bp || '',
    weight: v.weight || '',
    temp: v.temp || '',
    spo2: v.spo2 || '',
    source: row.source || 'Online QR',
    createdAt: row.created_at || new Date().toISOString()
  };
}

module.exports = {
  isConfigured: isSupabaseConfigured,
  formatClinic,
  formatBooking,

  // Fetch all onboarded clinics (with optional filter for authentic Google Sign-In clinics)
  getClinics: async (realOnly = false) => {
    let pathQuery = '/rest/v1/clinics?select=*&onboarded=eq.true&order=created_at.desc';
    if (realOnly) {
      pathQuery = '/rest/v1/clinics?select=*&onboarded=eq.true&is_google_auth=eq.true&order=created_at.desc';
    }
    const res = await request('GET', pathQuery);
    if (!Array.isArray(res)) return [];
    return res.map(formatClinic).filter(Boolean);
  },

  // Fetch clinic by ID
  getClinic: async (id) => {
    if (!id) return null;
    const res = await request('GET', `/rest/v1/clinics?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    if (Array.isArray(res) && res.length > 0) {
      return formatClinic(res[0]);
    }
    return null;
  },

  // Fetch clinic by Owner UID or Google Email (multi-device restore)
  getClinicByOwner: async (uid, email = '') => {
    if (!uid && !email) return null;
    let query = '';
    if (uid && email) {
      query = `or=(owner_uid.eq.${encodeURIComponent(uid)},owner_email.eq.${encodeURIComponent(email)})`;
    } else if (uid) {
      query = `owner_uid=eq.${encodeURIComponent(uid)}`;
    } else {
      query = `owner_email=eq.${encodeURIComponent(email)}`;
    }

    const res = await request('GET', `/rest/v1/clinics?${query}&select=*&order=created_at.desc&limit=1`);
    if (Array.isArray(res) && res.length > 0) {
      return formatClinic(res[0]);
    }

    // Secondary check: look up user mapping table
    if (uid) {
      const uRes = await request('GET', `/rest/v1/users?uid=eq.${encodeURIComponent(uid)}&select=*&limit=1`);
      if (Array.isArray(uRes) && uRes.length > 0 && uRes[0].clinic_id) {
        return module.exports.getClinic(uRes[0].clinic_id);
      }
    }
    return null;
  },

  // Upsert clinic record & sync doctor user mapping in Supabase
  saveClinic: async (clinic) => {
    if (!clinic || !clinic.id) return null;
    const payload = {
      id: clinic.id,
      name: clinic.name,
      owner_uid: clinic.ownerUid || null,
      owner_email: clinic.ownerEmail || null,
      tagline: clinic.tagline || null,
      category: clinic.category || 'General Medicine',
      specialty: clinic.specialty || clinic.category || 'General Physician',
      address: clinic.address || null,
      city: clinic.city || 'Patna, Bihar',
      phone: clinic.phone || null,
      whatsapp: clinic.whatsapp || clinic.phone || null,
      upi_id: clinic.upiId || null,
      map_url: clinic.mapUrl || null,
      doctor_name: clinic.doctorName || null,
      doctor_degree: clinic.doctorDegree || 'MBBS',
      doctor_reg_no: clinic.doctorRegNo || null,
      experience_years: clinic.experienceYears !== undefined ? clinic.experienceYears : 10,
      rating: clinic.rating || 4.8,
      review_count: clinic.reviewCount || 0,
      doctor_photo: clinic.doctorPhoto || null,
      fees: clinic.fees || {},
      visiting_reasons: clinic.visitingReasons || [],
      visiting_hours: clinic.visitingHours || {},
      live_status: clinic.liveStatus || {},
      doctors: clinic.doctors || [],
      leaves: clinic.leaves || {},
      subscription: clinic.subscription || { plan: 'free', status: 'active' },
      onboarded: clinic.onboarded !== false,
      is_google_auth: Boolean(clinic.ownerUid || clinic.isGoogleAuth || clinic.googleRegistered)
    };

    const res = await request('POST', '/rest/v1/clinics', payload, {
      'Prefer': 'resolution=merge-duplicates,return=representation'
    });

    // Also sync user mapping if owner UID is present
    if (clinic.ownerUid) {
      module.exports.saveUserMapping(
        clinic.ownerUid,
        clinic.id,
        clinic.ownerEmail || '',
        clinic.name || ''
      ).catch(() => {});
    }

    return Array.isArray(res) && res.length > 0 ? formatClinic(res[0]) : clinic;
  },

  // Save User to Clinic mapping in Supabase
  saveUserMapping: async (uid, clinicId, email = '', clinicName = '') => {
    if (!uid || !clinicId) return null;
    const payload = {
      uid,
      clinic_id: clinicId,
      email: email || null,
      clinic_name: clinicName || null,
      role: 'doctor'
    };
    return request('POST', '/rest/v1/users', payload, {
      'Prefer': 'resolution=merge-duplicates,return=representation'
    });
  },

  // Fetch queue bookings for clinic
  getQueue: async (clinicId, date = null) => {
    if (!clinicId) return [];
    let pathStr = `/rest/v1/bookings?clinic_id=eq.${encodeURIComponent(clinicId)}&order=token.asc`;
    if (date) {
      pathStr += `&appointment_date=eq.${encodeURIComponent(date)}`;
    }
    const res = await request('GET', pathStr);
    if (!Array.isArray(res)) return [];
    return res.map(formatBooking).filter(Boolean);
  },

  // Save booking
  saveBooking: async (booking) => {
    if (!booking || !booking.id) return null;
    const vitalsObj = booking.vitals || {};
    if (booking.bp) vitalsObj.bp = booking.bp;
    if (booking.weight) vitalsObj.weight = booking.weight;
    if (booking.temp) vitalsObj.temp = booking.temp;
    if (booking.spo2) vitalsObj.spo2 = booking.spo2;

    const cabinStatus = booking.status || booking.cabinStatus || 'WAITING';
    const payMode = booking.payMode || booking.paymentMode || 'Cash';
    const paymentStatus = booking.paymentStatus || (payMode === 'Baaki' ? 'Pending' : 'Collected');

    const payload = {
      id: booking.id,
      clinic_id: booking.clinicId,
      doctor_id: booking.doctorId || 'doc_1',
      doctor_name: booking.doctorName || null,
      token: booking.token,
      patient_name: booking.name,
      phone: booking.phone,
      age: booking.age ? parseInt(booking.age, 10) : null,
      gender: booking.gender || null,
      visit_type: booking.visitType || 'New',
      reason: booking.reason || null,
      fee: booking.fee || 0,
      payment_status: paymentStatus,
      payment_mode: payMode,
      cabin_status: cabinStatus,
      appointment_date: booking.date || new Date().toISOString().slice(0, 10),
      slot_time: booking.slotTime || null,
      shift: booking.shift || null,
      vitals: vitalsObj,
      source: booking.source || 'Online QR'
    };

    const res = await request('POST', '/rest/v1/bookings', payload, {
      'Prefer': 'resolution=merge-duplicates,return=representation'
    });
    return Array.isArray(res) && res.length > 0 ? formatBooking(res[0]) : booking;
  },

  // Patch booking status / payment mode / vitals
  updateBooking: async (bookingId, updates) => {
    if (!bookingId || !updates) return null;
    const payload = {};

    if (updates.cabinStatus !== undefined || updates.status !== undefined) {
      payload.cabin_status = updates.cabinStatus || updates.status;
    }
    if (updates.paymentMode !== undefined || updates.payMode !== undefined) {
      payload.payment_mode = updates.paymentMode || updates.payMode;
    }
    if (updates.paymentStatus !== undefined) {
      payload.payment_status = updates.paymentStatus;
    } else if (updates.payMode && updates.payMode !== 'Baaki') {
      payload.payment_status = 'Collected';
    }
    if (updates.fee !== undefined) {
      payload.fee = updates.fee;
    }
    if (updates.vitals !== undefined) {
      payload.vitals = updates.vitals;
    } else if (updates.bp || updates.weight || updates.temp || updates.spo2) {
      payload.vitals = {
        bp: updates.bp || '',
        weight: updates.weight || '',
        temp: updates.temp || '',
        spo2: updates.spo2 || ''
      };
    }

    const res = await request('PATCH', `/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, payload, {
      'Prefer': 'return=representation'
    });
    return Array.isArray(res) && res.length > 0 ? formatBooking(res[0]) : updates;
  },

  // Update subscription
  updateSubscription: async (clinicId, subData) => {
    if (!clinicId || !subData) return null;
    // 1. Update clinic subscription JSON
    const res = await request('PATCH', `/rest/v1/clinics?id=eq.${encodeURIComponent(clinicId)}`, {
      subscription: subData
    }, {
      'Prefer': 'return=representation'
    });

    // 2. Also upsert subscriptions table for admin tracking
    const subPayload = {
      id: 'sub_' + clinicId,
      clinic_id: clinicId,
      plan: subData.plan || 'free',
      status: subData.status || 'active',
      billing_cycle: subData.billingCycle || 'trial',
      amount: subData.amount !== undefined ? subData.amount : 0,
      renewal_date: subData.renewalDate || null
    };
    request('POST', '/rest/v1/subscriptions', subPayload, {
      'Prefer': 'resolution=merge-duplicates,return=representation'
    }).catch(() => {});

    return Array.isArray(res) && res.length > 0 ? formatClinic(res[0]) : null;
  },

  // Fetch admin doctors list with real aggregated booking stats
  getAdminDoctors: async () => {
    // 1. Try querying high-performance admin_doctors_view
    const viewRes = await request('GET', '/rest/v1/admin_doctors_view?select=*');
    if (Array.isArray(viewRes) && viewRes.length > 0) {
      return viewRes.map(row => {
        const sub = row.subscription || { plan: 'free', status: 'active' };
        const plan = sub.plan || 'free';
        const trialStart = sub.trialStartDate || row.createdAt || new Date().toISOString();
        const daysElapsed = trialStart ? (Date.now() - new Date(trialStart).getTime()) / 86400000 : 0;
        const isTrialActive = daysElapsed <= 7;
        const trialDaysLeft = Math.max(0, Math.ceil(7 - daysElapsed));
        const trialStatus = (plan === 'monthly_pro' || plan === 'annual_pro') ? 'pro_active' : (isTrialActive ? 'trial_active' : 'trial_expired');
        const totalBookings = parseInt(row.totalBookings, 10) || 0;
        const todayBookings = parseInt(row.todayBookings, 10) || 0;
        const monthBookings = parseInt(row.monthBookings, 10) || totalBookings;

        return {
          id: row.id,
          doctorName: row.doctorName || 'Doctor',
          doctorDegree: row.doctorDegree || 'MBBS',
          doctorRegNo: row.doctorRegNo || 'MCI-REG',
          experienceYears: row.experienceYears || 10,
          clinicName: row.clinicName || 'ParchiSetu Clinic',
          category: row.category || 'General Medicine',
          specialty: row.specialty || 'General Physician',
          city: row.city || 'India',
          address: row.address || '',
          phone: row.phone || '',
          whatsapp: row.whatsapp || row.phone || '',
          ownerEmail: row.ownerEmail || '',
          ownerUid: row.ownerUid || '',
          doctorPhoto: row.doctorPhoto || '',
          fees: row.fees || { normal: 300, followup: 200, emergency: 500, report: 0 },
          visitingHours: row.visitingHours || {},
          subscription: sub,
          trialStatus,
          trialDaysLeft,
          stats: {
            totalBookings,
            todayBookings,
            monthBookings,
            trialStatus,
            trialDaysLeft
          },
          createdAt: row.createdAt || new Date().toISOString()
        };
      });
    }

    // 2. Fallback to clinics table
    const clinics = await module.exports.getClinics(false);
    return clinics.map(c => {
      const sub = c.subscription || { plan: 'free', status: 'active' };
      const plan = sub.plan || 'free';
      const trialStart = sub.trialStartDate || c.createdAt || new Date().toISOString();
      const daysElapsed = trialStart ? (Date.now() - new Date(trialStart).getTime()) / 86400000 : 0;
      const isTrialActive = daysElapsed <= 7;
      const trialDaysLeft = Math.max(0, Math.ceil(7 - daysElapsed));
      const trialStatus = (plan === 'monthly_pro' || plan === 'annual_pro') ? 'pro_active' : (isTrialActive ? 'trial_active' : 'trial_expired');

      return {
        id: c.id,
        doctorName: c.doctorName || 'Doctor',
        doctorDegree: c.doctorDegree || 'MBBS',
        doctorRegNo: c.doctorRegNo || 'MCI-REG',
        experienceYears: c.experienceYears || 10,
        clinicName: c.name || 'ParchiSetu Clinic',
        category: c.category || 'General Medicine',
        specialty: c.specialty || 'General Physician',
        city: c.city || 'India',
        address: c.address || '',
        phone: c.phone || '',
        whatsapp: c.whatsapp || c.phone || '',
        ownerEmail: c.ownerEmail || '',
        ownerUid: c.ownerUid || '',
        doctorPhoto: c.doctorPhoto || '',
        fees: c.fees || { normal: 300, followup: 200, emergency: 500, report: 0 },
        visitingHours: c.visitingHours || {},
        subscription: sub,
        trialStatus,
        trialDaysLeft,
        stats: { totalBookings: 0, todayBookings: 0, monthBookings: 0, trialStatus, trialDaysLeft },
        createdAt: c.createdAt || new Date().toISOString()
      };
    });
  }
};
