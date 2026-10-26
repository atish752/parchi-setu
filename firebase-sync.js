/**
 * ParchiSetu - Firebase Cloud & Real-time Synchronization Module
 * Powered by Firebase Firestore & Authentication
 * Provides instant real-time sync across Indian Clinics, Compounder Desks and Patient Mobile QR Links.
 */

const FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
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
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [ParchiSetu] Firebase initialization notice (falling back to local API):', err.message);
  }
  return false;
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
    await fbDb.collection('clinics').doc(clinic.id).set({
      ...clinic,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
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
    await fbDb.collection('clinics').doc(clinicId).collection('bookings').doc(docId).set({
      ...booking,
      id: docId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Also update clinic's latest live token info
    await fbDb.collection('clinics').doc(clinicId).set({
      lastTokenAssigned: booking.token,
      lastBookingAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return true;
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
    await fbDb.collection('clinics').doc(clinicId).collection('bookings').doc(bookingId).set({
      ...updates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
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
    await fbDb.collection('clinics').doc(clinicId).set({
      liveCabinStatus: statusData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Error updating live status in Firestore:', err.message);
    return false;
  }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.ParchiFirebase = {
    config: FIREBASE_CONFIG,
    init: initFirebase,
    listen: listenToClinicRealtime,
    syncClinic: syncClinicToFirestore,
    saveBooking: saveBookingToFirestore,
    updateBooking: updateBookingInFirestore,
    updateLiveStatus: updateLiveStatusInFirestore
  };
}
