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

function withTimeout(promise, ms = 2500, fallback = null) {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve(fallback);
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      if (!firebase.apps.length) {
        fbApp = firebase.initializeApp(FIREBASE_CONFIG);
      } else {
        fbApp = firebase.app();
      }
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
      isFirebaseAvailable = true;
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
 * Fetch clinic by clinic ID once from Firestore
 */
async function getClinicFromFirestore(clinicId) {
  if (!isFirebaseAvailable || !fbDb || !clinicId) return null;
  try {
    const doc = await fbDb.collection('clinics').doc(clinicId).get();
    if (doc.exists) {
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
  if (!isFirebaseAvailable || !fbDb || !clinicId) return [];
  try {
    const snapshot = await fbDb.collection('clinics').doc(clinicId).collection('bookings')
      .orderBy('token', 'asc')
      .get();
    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });
    return bookings;
  } catch (err) {
    console.warn('Firebase getQueue warning:', err.message);
    return [];
  }
}

/**
 * Start listening in real-time to clinic data and bookings
 */
function listenToClinicRealtime(clinicId, onClinicChange, onQueueChange) {
  if (!isFirebaseAvailable || !fbDb || !clinicId) return;

  try {
    // 1. Listen to Clinic Profile & Live Status
    if (clinicUnsubscribe) clinicUnsubscribe();
    clinicUnsubscribe = fbDb.collection('clinics').doc(clinicId).onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (typeof onClinicChange === 'function') {
          onClinicChange(data);
        }
      }
    }, err => {
      console.warn('Firebase clinic snapshot warning:', err.message);
    });

    // 2. Listen to Bookings Subcollection
    if (queueUnsubscribe) queueUnsubscribe();
    queueUnsubscribe = fbDb.collection('clinics').doc(clinicId).collection('bookings')
      .orderBy('token', 'asc')
      .onSnapshot(snapshot => {
        const bookings = [];
        snapshot.forEach(doc => {
          bookings.push({ id: doc.id, ...doc.data() });
        });
        if (typeof onQueueChange === 'function') {
          onQueueChange(bookings);
        }
      }, err => {
        console.warn('Firebase bookings snapshot warning:', err.message);
      });
  } catch (err) {
    console.warn('Error starting Firebase listeners:', err.message);
  }
}

/**
 * Save / Update Clinic Profile in Firestore
 */
async function syncClinicToFirestore(clinic) {
  if (!isFirebaseAvailable || !fbDb || !clinic || !clinic.id) return false;
  try {
    const cleanData = sanitizeForFirestore(clinic);
    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinic.id).set({
        ...cleanData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }),
      2500,
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
  if (!isFirebaseAvailable || !fbDb || !clinicId || !booking) return false;
  try {
    const docId = booking.id || ('bk_' + Date.now());
    const cleanBooking = sanitizeForFirestore(booking);
    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinicId).collection('bookings').doc(docId).set({
        ...cleanBooking,
        id: docId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }),
      2500,
      false
    );

    // Also update clinic's latest live token info in background
    if (res !== false) {
      withTimeout(
        fbDb.collection('clinics').doc(clinicId).set({
          lastTokenAssigned: booking.token,
          lastBookingAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }),
        2000,
        null
      ).catch(() => {});
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
  if (!isFirebaseAvailable || !fbDb || !clinicId || !bookingId) return false;
  try {
    const cleanUpdates = sanitizeForFirestore(updates);
    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinicId).collection('bookings').doc(bookingId).set({
        ...cleanUpdates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }),
      2500,
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
  if (!isFirebaseAvailable || !fbDb || !clinicId) return false;
  try {
    const cleanStatus = sanitizeForFirestore(statusData);
    const res = await withTimeout(
      fbDb.collection('clinics').doc(clinicId).set({
        liveCabinStatus: cleanStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }),
      2500,
      false
    );
    return res !== false;
  } catch (err) {
    console.warn('Error updating live status in Firestore:', err.message);
    return false;
  }
}

/**
 * Sign in with Google Popup (Firebase Auth)
 */
async function signInWithGoogle() {
  if (!initFirebase() || !fbAuth) {
    throw new Error('Firebase Auth is not available. Check your internet connection or Firebase setup.');
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
  if (!initFirebase() || !fbAuth) {
    throw new Error('Firebase Auth is not available. Check your internet connection or Firebase setup.');
  }
  const result = await fbAuth.createUserWithEmailAndPassword(email.trim(), password);
  if (result.user && displayName && displayName.trim()) {
    try {
      await result.user.updateProfile({ displayName: displayName.trim() });
    } catch (e) {
      console.warn('Failed to update displayName on user profile:', e.message);
    }
  }
  return result.user;
}

/**
 * Sign in with Email and Password
 */
async function signInWithEmail(email, password) {
  if (!initFirebase() || !fbAuth) {
    throw new Error('Firebase Auth is not available. Check your internet connection or Firebase setup.');
  }
  const result = await fbAuth.signInWithEmailAndPassword(email.trim(), password);
  return result.user;
}

/**
 * Send Password Reset Email
 */
async function sendPasswordReset(email) {
  if (!initFirebase() || !fbAuth) {
    throw new Error('Firebase Auth is not available. Check your internet connection or Firebase setup.');
  }
  await fbAuth.sendPasswordResetEmail(email.trim());
}

/**
 * Sign out current user
 */
async function signOutUser() {
  if (fbAuth) {
    await fbAuth.signOut();
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
  if (!isFirebaseAvailable || !fbDb || !user) return null;
  const uid = typeof user === 'string' ? user : (user && user.uid ? user.uid : '');
  if (!uid) return null;

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
  if (!isFirebaseAvailable || !fbDb || !uid) return false;
  try {
    const data = {
      clinicId,
      email: email || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (clinicName) data.clinicName = clinicName;
    const res = await withTimeout(fbDb.collection('users').doc(uid).set(data, { merge: true }), 2500, false);
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
    getClinic: getClinicFromFirestore,
    getQueue: getQueueFromFirestore,
    listen: listenToClinicRealtime,
    syncClinic: syncClinicToFirestore,
    saveBooking: saveBookingToFirestore,
    updateBooking: updateBookingInFirestore,
    updateLiveStatus: updateLiveStatusInFirestore,
    signInWithGoogle: signInWithGoogle,
    signUpWithEmail: signUpWithEmail,
    signInWithEmail: signInWithEmail,
    sendPasswordReset: sendPasswordReset,
    signOutUser: signOutUser,
    onAuthStateChanged: onAuthStateChanged,
    getCurrentUser: getCurrentUser,
    getClinicForUser: getClinicForUser,
    saveUserClinicMapping: saveUserClinicMapping
  };

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
    getClinicFromFirestore,
    getQueueFromFirestore,
    listenToClinicRealtime,
    syncClinicToFirestore,
    saveBookingToFirestore,
    updateBookingInFirestore,
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

