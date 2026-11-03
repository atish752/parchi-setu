# 🩺 KlinicQ
### Smart Clinic & Token Management Web App for Indian Doctors & Compounders

**KlinicQ** is an ultra-fast, mobile-first clinic token and OPD management web application tailored specifically for the realities of Indian private clinics, family physicians, and compounder desks.

![KlinicQ Logo](logo.svg)

---

## ✨ Key Capabilities

1. **Patient City Doctor Discovery HomeScreen & Live Token Booking**
   - **Default Home View**: Allows patients to browse doctors by Indian cities (Delhi, Mumbai, Patna, Lucknow, Varanasi, etc.) and specialties (General Physician, Cardiology, Orthopedics, Pediatrics, Gynecology, etc.).
   - Clean, authentic clinic listing (no dummy clinic placeholders displayed to patients).
   - Zero-login phone token lookup and live distance ticker (*"2 Mareez Aage Hain"*, *"Aap Agle Hain!"*).
   - Instant digital token pass with live cabin notifications.

2. **Compounder Desk & Clinic Management (`/clinic`)**
   - **Compounder Desk**: Live cabin status, 1-tap "Ho Gaya • Agla Bulao (#X)" button, 3-second fast walk-in parchi entry with voice dictation, cash/UPI daily hisaab (Galla), and patient digital khata.
   - **Multi-Doctor Clinic Support**: Add up to 3–5 doctors per clinic, designate visiting specialists, and manage advance dates and leaves.

3. **Master Owner Admin Portal (`/admin`)**
   - Direct tracking dashboard for all registered doctor accounts across Indian cities.
   - Real-time KPI metrics: Total Doctors, Pro Plan Doctors, Free Trial Doctors, and estimated MRR.
   - Instant subscription manager: Switch doctor accounts between **Free Trial**, **Monthly Pro (₹399/mo)**, and **Annual Pro (₹4,000/yr)**.
   - Filter by subscription plan, search by doctor name, phone, or clinic, and view audit details with direct WhatsApp support button.
   - Secured with master admin PIN verification (`admin123`).

2. **Multi-Doctor Clinic Support**
   - Add up to 3–5 doctors per clinic during onboarding or via the settings wizard.
   - Designates a main doctor while supporting visiting specialists (Gynecologists, Dentists, Pediatricians, etc.).
   - Patients can choose their doctor during self-booking.

3. **Advance Date Selection & Vacation / Leave Management**
   - Patients can book tokens for **Aaj (Today)**, **Kal (Tomorrow)**, **Parson (Day 3)**, or pick any advance date from a calendar picker.
   - Compounder Calendar Tab with full vacation controls:
     - Mark any day as full-day leave (instantly blocking patient bookings for that day).
     - Toggle individual shifts off (Morning OP or Evening OP).
     - Block or unblock individual time slots with 1 tap.
     - Respects weekly open days (e.g., Sunday closed).

4. **Real-time Live Token Status Tracker**
   - Prominently displayed before, during, and after booking.
   - Dynamic distance ticker (*"2 Mareez Aage Hain"*, *"Aap Agle Hain!"*).
   - In-cabin notification with sound when the patient's token is called.

5. **Cloud Synchronization (Firebase + Real-time Local Fallback)**
   - Powered by Google Firebase Firestore for instant real-time synchronization between compounder counter and patient mobile screens across different networks.
   - Built-in multi-tab BroadcastChannel and SSE fallback.

6. **Fresh Start: ZERO Dummy Data**
   - Default initialization starts completely clean with 0 patients, ready for actual clinic use.

7. **Cute & Approachable Medical Branding**
   - Vector logo and favicon featuring a smiling prescription pad with doctor's stethoscope.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (optional, serverless compatible)

### Local Development
```bash
# Clone the repository
git clone https://github.com/atish752/parchi-setu.git
cd parchi-setu

# Run with Node.js built-in HTTP server
npm start
# or
node server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Verification Test Suite
```bash
npm test
# or
node test_runner.js
```

---

## ☁️ Deploy to Vercel

This repository includes native Vercel configuration (`vercel.json` and `api/index.js` serverless handler):

1. Import this repository into [Vercel](https://vercel.com).
2. (Optional) Set the following environment variables in your Vercel project settings:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. Click **Deploy**.

---

## 📄 License
MIT License. Built for doctors, compounders, and patients across India.
