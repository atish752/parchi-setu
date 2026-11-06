/**
 * ParchiSetu - Firebase Cloud & Real-time Synchronization Module
 * Powered by Firebase Firestore & Authentication
 * Provides instant real-time sync across Indian Clinics, Compounder Desks and Patient Mobile QR Links.
 */

const FIREBASE_CONFIG = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || {
  apiKey: "AIzaSyDuKEZoXCa0Yx1Y2OIOCvJ6BSz0rQhH31o",
  authDomain: "parchi-setu.firebaseapp.com",
  projectId: "parchi-setu",
  storageBucket: "parchi-setu.firebasestorage.app",
  messagingSenderId: "25140806834",
  appId: "1:25140806834:web:6d1aaa7786c5f17da8b5ab"
};

let fbApp = null;
let fbAuth = null;
let fbDb = null;
let isFirebaseAvailable = false;
let clinicUnsubscribe = null;
let queueUnsubscribe = null;
let allClinicsUnsubscribe = null;

function sanitizeForFirestore(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean;
}

function withTimeout(promise, ms = 5000, fallback = null) {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve(fallback);
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

function ensureFirebaseInitialized() {
  if (!isFirebaseAvailable || !fbDb) {
    initFirebase();
  }
  return isFirebaseAvailable && !!fbDb;
}

function initFirebase() {
  try {
    const fb = (typeof firebase !== 'undefined') ? firebase : ((typeof window !== 'undefined' && window.firebase) ? window.firebase : null);
    if (fb && fb.initializeApp) {
      if (!fb.apps || !fb.apps.length) {
        fbApp = fb.initializeApp(FIREBASE_CONFIG);
      } else {
        fbApp = fb.app();
      }
      fbAuth = fb.auth ? fb.auth() : null;
      fbDb = fb.firestore ? fb.firestore() : null;
      isFirebaseAvailable = !!fbDb;
      console.log('🔥 [ParchiSetu] Firebase connected successfully to project:', FIREBASE_CONFIG.projectId);

      // Handle redirect sign-in result (essential for mobile Chrome / Safari)
      if (fbAuth && typeof fbAuth.getRedirectResult === 'function') {
        fbAuth.getRedirectResult().then(result => {
          if (result && result.user) {
            console.log('Firebase Redirect Sign-in completed:', result.user.email);
            if (typeof window !== 'undefined' && typeof window.handleAuthSuccess === 'function') {
              window.handleAuthSuccess(result.user);
            }
          }
        }).catch(err => {
          if (err && err.code !== 'auth/null-user') {
            console.warn('Redirect sign-in notice:', err.message);
          }
        });
      }

      return true;
    }
  } catch (err) {
    console.warn('⚠️ [ParchiSetu] Firebase initialization notice (falling back to local API):', err.message);
  }
  return false;
}

/**
 * Fetch all registered clinics from Firestore
 */
async function getAllClinicsFromFirestore() {
  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb) return [];
  try {
    const snapshot = await withTimeout(fbDb.collection('clinics').get(), 8000, null);
    if (!snapshot) return [];
    const clinics = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data) {
        clinics.push({ id: doc.id, ...data });
      }
    });
    return clinics;
  } catch (err) {
    console.warn('Firebase getAllClinics warning:', err.message);
    return [];
  }
}

/**
 * Start listening in real-time to all registered clinics for patient discovery feed
 * Firebase Firestore snapshot listener is safely disconnected to prevent stale data from overwriting Supabase / local clinic data
 */
function listenToClinicsRealtime(onClinicsChange) {
  if (allClinicsUnsubscribe) {
    try { allClinicsUnsubscribe(); } catch (e) {}
    allClinicsUnsubscribe = null;
  }
  return () => {
    if (allClinicsUnsubscribe) { try { allClinicsUnsubscribe(); } catch (e) {} }
  };
}

/**
 * Fetch clinic by clinic ID once from Firestore
 */
async function getClinicFromFirestore(clinicId) {
  if (!clinicId) return null;
  const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (sb) {
    try {
      const { data, error } = await withTimeout(sb.from('clinics').select('*').eq('id', clinicId).limit(1), 1500, { data: null });
      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        return {
          id: row.id,
          name: row.name,
          doctorName: row.doctor_name || row.doctorName,
          doctorDegree: row.doctor_degree || row.doctorDegree || 'MBBS',
          doctorPhoto: row.doctor_photo || row.doctorPhoto || '',
          specialty: row.specialty || row.category || 'General Physician',
          phone: row.phone || '',
          whatsapp: row.whatsapp || row.phone || '',
          address: row.address || '',
          city: row.city || '',
          visitingHours: row.visiting_hours || row.visitingHours || {},
          liveStatus: row.live_status || row.liveStatus || {},
          fees: row.fees || {},
          subscription: row.subscription || { plan: 'free', status: 'trial' },
          createdAt: row.created_at || row.createdAt || new Date().toISOString()
        };
      }
    } catch (e) {}
  }

  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb) return null;
  try {
    const doc = await withTimeout(fbDb.collection('clinics').doc(clinicId).get(), 6000, null);
    if (doc && doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
  } catch (err) {
    console.warn('Firebase getClinic warning:', err.message);
  }
  return null;
}

/**
 * Fetch queue bookings once from Firestore
 */
async function getQueueFromFirestore(clinicId) {
  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb || !clinicId) return [];
  try {
    const bookings = [];
    try {
      const snapshot = await withTimeout(
        fbDb.collection('clinics').doc(clinicId).collection('bookings').orderBy('token', 'asc').get(),
        6000,
        null
      );
      if (snapshot) {
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data) bookings.push({ id: doc.id, ...data });
        });
        return bookings;
      }
    } catch (orderErr) {
      // Fallback without orderBy
      const fallbackSnap = await withTimeout(
        fbDb.collection('clinics').doc(clinicId).collection('bookings').get(),
        6000,
        null
      );
      if (fallbackSnap) {
        fallbackSnap.forEach(doc => {
          const data = doc.data();
          if (data) bookings.push({ id: doc.id, ...data });
        });
        bookings.sort((a, b) => (a.token || 0) - (b.token || 0));
        return bookings;
      }
    }
    return bookings;
  } catch (err) {
    console.warn('Firebase getQueue warning:', err.message);
    return [];
  }
}

/**
 * Start listening in real-time to clinic data and bookings
 * Firebase Firestore snapshot listeners are safely disconnected to prevent stale data from overwriting Supabase / local clinic data
 */
function listenToClinicRealtime(clinicId, onClinicChange, onQueueChange) {
  if (clinicUnsubscribe) {
    try { clinicUnsubscribe(); } catch (e) {}
    clinicUnsubscribe = null;
  }
  if (queueUnsubscribe) {
    try { queueUnsubscribe(); } catch (e) {}
    queueUnsubscribe = null;
  }
  return () => {
    if (clinicUnsubscribe) { try { clinicUnsubscribe(); } catch (e) {} }
    if (queueUnsubscribe) { try { queueUnsubscribe(); } catch (e) {} }
  };
}

/**
 * Save / Update Clinic Profile in Firestore
 */
async function syncClinicToFirestore(clinicOrId, optionalClinic = null) {
  const clinic = (optionalClinic && typeof optionalClinic === 'object') ? optionalClinic : clinicOrId;
  const clinicId = (clinic && clinic.id) || (typeof clinicOrId === 'string' ? clinicOrId : null);
  if (!clinic || !clinicId) return false;

  const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (sb) {
    try {
      await withTimeout(sb.from('clinics').upsert({
        id: clinicId,
        name: clinic.name || null,
        owner_uid: clinic.ownerUid || null,
        owner_email: clinic.ownerEmail || null,
        doctor_name: clinic.doctorName || null,
        doctor_degree: clinic.doctorDegree || 'MBBS',
        doctor_photo: clinic.doctorPhoto || null,
        specialty: clinic.specialty || clinic.category || 'General Physician',
        phone: clinic.phone || null,
        whatsapp: clinic.whatsapp || clinic.phone || null,
        address: clinic.address || null,
        city: clinic.city || null,
        fees: clinic.fees || {},
        visiting_hours: clinic.visitingHours || {},
        live_status: clinic.liveStatus || {},
        doctors: clinic.doctors || [],
        leaves: clinic.leaves || {},
        subscription: clinic.subscription || { plan: 'free', status: 'trial' },
        onboarded: clinic.onboarded !== false
      }), 2000, null);
    } catch (e) {}
  }

  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb) return true;
  try {
    const cleanData = sanitizeForFirestore({ ...clinic, id: clinicId });
    const payload = { ...cleanData };
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinicId).set(payload, { merge: true }),
      6000,
      false
    );
    return res !== false;
  } catch (err) {
    console.warn('Error saving clinic to Firestore:', err.message);
    return false;
  }
}

/**
 * Save a new patient booking to Firestore
 */
async function saveBookingToFirestore(clinicId, booking) {
  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb || !clinicId || !booking) return false;
  try {
    const docId = booking.id || ('bk_' + Date.now());
    const cleanBooking = sanitizeForFirestore(booking);
    const bookingPayload = {
      ...cleanBooking,
      id: docId
    };
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
      bookingPayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinicId).collection('bookings').doc(docId).set(bookingPayload, { merge: true }),
      6000,
      false
    );

    // Also update clinic's latest live token info in background without undefined values
    if (res !== false) {
      const tokenPayload = {};
      if (booking.token !== undefined && booking.token !== null) {
        tokenPayload.lastTokenAssigned = booking.token;
      }
      if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
        tokenPayload.lastBookingAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      if (Object.keys(tokenPayload).length > 0) {
        withTimeout(
          fbDb.collection('clinics').doc(clinicId).set(tokenPayload, { merge: true }),
          3000,
          null
        ).catch(() => {});
      }
    }

    return res !== false;
  } catch (err) {
    console.warn('Error saving booking to Firestore:', err.message);
    return false;
  }
}

/**
 * Update an existing booking in Firestore
 */
async function updateBookingInFirestore(clinicId, bookingId, updates) {
  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb || !clinicId || !bookingId) return false;
  try {
    const cleanUpdates = sanitizeForFirestore(updates);
    const updatePayload = { ...cleanUpdates };
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
      updatePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinicId).collection('bookings').doc(bookingId).set(updatePayload, { merge: true }),
      6000,
      false
    );
    return res !== false;
  } catch (err) {
    console.warn('Error updating booking in Firestore:', err.message);
    return false;
  }
}

/**
 * Update live cabin status in Firestore (called when token moves to cabin)
 */
async function updateLiveStatusInFirestore(clinicId, statusData) {
  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb || !clinicId) return false;
  try {
    const cleanStatus = sanitizeForFirestore(statusData);
    const payload = { liveCabinStatus: cleanStatus };
    if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinicId).set(payload, { merge: true }),
      6000,
      false
    );
    return res !== false;
  } catch (err) {
    console.warn('Error updating live status in Firestore:', err.message);
    return false;
  }
}

/**
 * Supabase & Firebase Configuration
 */
const SUPABASE_CONFIG = {
  url: "https://ceffurkydnvhwtmniffy.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZmZ1cmt5ZG52aHd0bW5pZmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5Mjc5MDYsImV4cCI6MjEwOTUwMzkwNn0.qSai_DMkH_4GiWsx4B9GfK7TGpwXJGzihOUARD256fs"
};

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    window.supabaseClient = supabaseClient;
  }
  return supabaseClient;
}

/**
 * Sign in with Google (Supabase OAuth with Firebase fallback)
 */
async function signInWithGoogle() {
  const sb = getSupabaseClient();
  if (sb && sb.auth) {
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://parchi-setu.vercel.app';
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: origin + '/clinic'
      }
    });
    if (error) throw error;
    return data;
  }
  if (!initFirebase() || !fbAuth) {
    throw new Error('Auth service is not available. Check your internet connection.');
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await fbAuth.signInWithPopup(provider);
    return result.user;
  } catch (err) {
    if (err.code === 'auth/popup-blocked') {
      console.warn('Google popup blocked, trying redirect...');
      await fbAuth.signInWithRedirect(provider);
      return null;
    }
    throw err;
  }
}

/**
 * Sign up with Email and Password
 */
async function signUpWithEmail(email, password, displayName = '') {
  const sb = getSupabaseClient();
  if (sb && sb.auth) {
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: displayName.trim() || undefined
        }
      }
    });
    if (error) throw error;
    if (data && data.user) {
      return {
        uid: data.user.id,
        email: data.user.email,
        displayName: displayName || (data.user.email ? data.user.email.split('@')[0] : 'Doctor')
      };
    }
  }
  if (!initFirebase() || !fbAuth) {
    throw new Error('Auth service is not available.');
  }
  const result = await fbAuth.createUserWithEmailAndPassword(email.trim(), password);
  if (result.user && displayName && displayName.trim()) {
    try {
      await result.user.updateProfile({ displayName: displayName.trim() });
    } catch (e) {}
  }
  return result.user;
}

/**
 * Sign in with Email and Password
 */
async function signInWithEmail(email, password) {
  const sb = getSupabaseClient();
  if (sb && sb.auth) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });
    if (error) throw error;
    if (data && data.user) {
      return {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.full_name || (data.user.email ? data.user.email.split('@')[0] : 'Doctor')
      };
    }
  }
  if (!initFirebase() || !fbAuth) {
    throw new Error('Auth service is not available.');
  }
  const result = await fbAuth.signInWithEmailAndPassword(email.trim(), password);
  return result.user;
}

/**
 * Send Password Reset Email
 */
async function sendPasswordReset(email) {
  const sb = getSupabaseClient();
  if (sb && sb.auth) {
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://parchi-setu.vercel.app';
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: origin + '/login'
    });
    if (error) throw error;
    return true;
  }
  if (!initFirebase() || !fbAuth) {
    throw new Error('Auth service is not available.');
  }
  await fbAuth.sendPasswordResetEmail(email.trim());
}

/**
 * Sign out current user
 */
async function signOutUser() {
  const sb = getSupabaseClient();
  if (sb && sb.auth) {
    try { await sb.auth.signOut(); } catch (e) {}
  }
  if (fbAuth) {
    try { await fbAuth.signOut(); } catch (e) {}
  }
}

/**
 * Listen to Auth State Changes
 */
function onAuthStateChanged(callback) {
  if (!initFirebase() || !fbAuth) return () => {};
  return fbAuth.onAuthStateChanged(callback);
}

/**
 * Get current signed-in user
 */
function getCurrentUser() {
  return fbAuth ? fbAuth.currentUser : null;
}

/**
 * Find clinic profile associated with a Firebase user (accepts user object or uid string)
 * Fast non-blocking lookup with strict 1200ms overall timeout
 */
async function getClinicForUser(user) {
  const uid = typeof user === 'string' ? user : (user && (user.uid || user.id) ? (user.uid || user.id) : '');
  const email = (user && typeof user === 'object' && user.email) ? user.email : '';
  if (!uid && !email) return null;

  const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (sb) {
    try {
      let query = sb.from('clinics').select('*');
      if (uid && email) {
        query = query.or(`owner_uid.eq.${uid},owner_email.eq.${email}`);
      } else if (uid) {
        query = query.eq('owner_uid', uid);
      } else {
        query = query.eq('owner_email', email);
      }
      const { data, error } = await withTimeout(query.order('created_at', { ascending: false }).limit(1), 1200, { data: null });
      if (!error && Array.isArray(data) && data.length > 0 && data[0].name) {
        const row = data[0];
        return {
          id: row.id,
          name: row.name,
          doctorName: row.doctor_name || row.doctorName,
          doctorDegree: row.doctor_degree || row.doctorDegree || 'MBBS',
          doctorPhoto: row.doctor_photo || row.doctorPhoto || '',
          specialty: row.specialty || row.category || 'General Physician',
          phone: row.phone || '',
          whatsapp: row.whatsapp || row.phone || '',
          address: row.address || '',
          city: row.city || '',
          visitingHours: row.visiting_hours || row.visitingHours || {},
          liveStatus: row.live_status || row.liveStatus || {},
          fees: row.fees || {},
          subscription: row.subscription || { plan: 'free', status: 'trial' },
          createdAt: row.created_at || row.createdAt || new Date().toISOString()
        };
      }
    } catch (e) {}
  }

  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb) return null;

  return withTimeout(
    (async () => {
      try {
        // Fast parallel check: user mapping doc + direct clinic doc
        const [userDoc, directDoc] = await Promise.all([
          fbDb.collection('users').doc(uid).get().catch(() => null),
          fbDb.collection('clinics').doc(uid).get().catch(() => null)
        ]);

        if (userDoc && userDoc.exists && userDoc.data().clinicId) {
          const cDoc = await fbDb.collection('clinics').doc(userDoc.data().clinicId).get().catch(() => null);
          if (cDoc && cDoc.exists) return { id: cDoc.id, ...cDoc.data() };
        }

        if (directDoc && directDoc.exists) {
          return { id: directDoc.id, ...directDoc.data() };
        }

        // Secondary check: query by ownerUid
        const qSnap = await fbDb.collection('clinics').where('ownerUid', '==', uid).limit(1).get().catch(() => null);
        if (qSnap && !qSnap.empty) {
          const doc = qSnap.docs[0];
          return { id: doc.id, ...doc.data() };
        }
      } catch (err) {
        console.warn('Firebase getClinicForUser warning:', err.message);
      }
      return null;
    })(),
    1200,
    null
  );
}

/**
 * Save user to clinic mapping in Firestore
 */
async function saveUserClinicMapping(uid, clinicId, email = '', clinicName = '') {
  const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (sb && uid && clinicId) {
    try {
      await withTimeout(sb.from('users').upsert({
        uid,
        clinic_id: clinicId,
        email: email || null,
        clinic_name: clinicName || null,
        role: 'doctor'
      }), 1200, null);
    } catch (e) {}
  }

  ensureFirebaseInitialized();
  if (!isFirebaseAvailable || !fbDb || !uid) return false;
  try {
    const data = {
      clinicId,
      email: email || '',
      updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString()
    };
    if (clinicName) data.clinicName = clinicName;
    const res = await withTimeout(fbDb.collection('users').doc(uid).set(data, { merge: true }), 3000, false);
    return res !== false;
  } catch (err) {
    console.warn('Firebase saveUserClinicMapping error:', err.message);
    return false;
  }
}

// Auto-initialize when script loads

if (typeof window !== 'undefined') {
  window.ParchiFirebase = {
    config: FIREBASE_CONFIG,
    init: initFirebase,
    initFirebase: initFirebase,
    getClinic: getClinicFromFirestore,
    getClinicFromFirestore: getClinicFromFirestore,
    getAllClinics: getAllClinicsFromFirestore,
    getAllClinicsFromFirestore: getAllClinicsFromFirestore,
    listenToClinics: listenToClinicsRealtime,
    listenToClinicsRealtime: listenToClinicsRealtime,
    getQueue: getQueueFromFirestore,
    getQueueFromFirestore: getQueueFromFirestore,
    listen: listenToClinicRealtime,
    listenToClinicRealtime: listenToClinicRealtime,
    syncClinic: syncClinicToFirestore,
    syncClinicToFirestore: syncClinicToFirestore,
    saveClinic: syncClinicToFirestore,
    saveBooking: saveBookingToFirestore,
    saveBookingToFirestore: saveBookingToFirestore,
    updateBooking: updateBookingInFirestore,
    updateBookingInFirestore: updateBookingInFirestore,
    updateLiveStatus: updateLiveStatusInFirestore,
    updateLiveStatusInFirestore: updateLiveStatusInFirestore,
    signInWithGoogle: signInWithGoogle,
    signUpWithEmail: signUpWithEmail,
    signInWithEmail: signInWithEmail,
    sendPasswordReset: sendPasswordReset,
    signOutUser: signOutUser,
    onAuthStateChanged: onAuthStateChanged,
    getCurrentUser: getCurrentUser,
    getClinicForUser: getClinicForUser,
    saveUserClinicMapping: saveUserClinicMapping,
    getSupabaseClient: getSupabaseClient
  };

  window.ParchiSupabase = window.ParchiFirebase;

  // Supabase Auth session & OAuth listener
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const sb = getSupabaseClient();
      if (sb && sb.auth) {
        sb.auth.getSession().then(({ data: { session } }) => {
          if (session && session.user) {
            const user = {
              uid: session.user.id,
              email: session.user.email,
              displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : 'Doctor')
            };
            if (typeof window.handleAuthSuccess === 'function') {
              window.handleAuthSuccess(user);
            }
          }
        }).catch(() => {});

        sb.auth.onAuthStateChange((event, session) => {
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session && session.user) {
            const user = {
              uid: session.user.id,
              email: session.user.email,
              displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : 'Doctor')
            };
            if (typeof window.handleAuthSuccess === 'function') {
              window.handleAuthSuccess(user);
            }
          }
        });
      }
    }, 150);
  }

  try {
    initFirebase();
  } catch (e) {
    console.warn('ParchiFirebase auto-init notice:', e);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FIREBASE_CONFIG,
    initFirebase,
    sanitizeForFirestore,
    getClinic: getClinicFromFirestore,
    getClinicFromFirestore,
    getAllClinics: getAllClinicsFromFirestore,
    getAllClinicsFromFirestore,
    listenToClinics: listenToClinicsRealtime,
    listenToClinicsRealtime,
    getQueue: getQueueFromFirestore,
    getQueueFromFirestore,
    listen: listenToClinicRealtime,
    listenToClinicRealtime,
    syncClinic: syncClinicToFirestore,
    syncClinicToFirestore,
    saveClinic: syncClinicToFirestore,
    saveBooking: saveBookingToFirestore,
    saveBookingToFirestore,
    updateBooking: updateBookingInFirestore,
    updateBookingInFirestore,
    updateLiveStatus: updateLiveStatusInFirestore,
    updateLiveStatusInFirestore,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    signOutUser,
    onAuthStateChanged,
    getCurrentUser,
    getClinicForUser,
    saveUserClinicMapping
  };
}
