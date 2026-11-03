# 🩺 ParchiSetu
### Smart Clinic & Token Management Web App for Indian Doctors & Compounders

**ParchiSetu** (live at [https://parchi-setu.vercel.app/](https://parchi-setu.vercel.app/)) is an ultra-fast, mobile-first clinic token and OPD management web application tailored specifically for the realities of Indian private clinics, family physicians, and compounder desks.

![ParchiSetu Logo](logo.svg)

---

## ✨ Key Capabilities

1. **Patient City Doctor Discovery HomeScreen & Live Token Booking**
   - **Default Home View (`/`)**: Allows patients to browse doctors by Indian cities (Delhi, Mumbai, Patna, Lucknow, Varanasi, etc.) and specialties (General Physician, Cardiology, Orthopedics, Pediatrics, Gynecology, etc.).
   - Clean, authentic clinic listing: Only authentic clinics created via Google Sign-In are shown (all mock/dummy clinic names removed).
   - Zero-login phone token lookup and live distance ticker (*"2 Mareez Aage Hain"*, *"Aap Agle Hain!"*).
   - Instant digital token pass with live cabin notifications.

2. **Compounder Desk & Clinic Management (`/clinic`)**
   - **Compounder Desk**: Live cabin status, 1-tap "Ho Gaya • Agla Bulao (#X)" button, 3-second fast walk-in parchi entry with voice dictation, cash/UPI daily hisaab (Galla), and patient digital khata.
   - **Multi-Doctor Clinic Support**: Add up to 3–5 doctors per clinic, designate visiting specialists, and manage advance dates and leaves.

3. **Master Owner Admin Portal (`/admin`)**
   - Dedicated direct URL: [https://parchi-setu.vercel.app/admin](https://parchi-setu.vercel.app/admin).
   - Hidden from public patient discovery and clinic UI.
   - Real-time KPI metrics: Total Doctors, Pro Plan Doctors, Free Trial Doctors, and estimated MRR.
   - Instant subscription manager: Switch doctor accounts between **Free Trial**, **Monthly Pro (₹399/mo)**, and **Annual Pro (₹4,000/yr)**.
   - Filter by subscription plan, search by doctor name, phone, or clinic, and view audit details with direct WhatsApp support button.
   - Secured with master admin PIN verification (`admin123` / `parchisetu2026`).

4. **Production Database & Multi-Device Sync (Supabase PostgreSQL + Firebase)**
   - **Supabase Cloud SQL Backend**: Full production schema defined in `supabase_schema.sql` with tables for `clinics`, `bookings`, `users`, and `subscriptions`.
   - **Google Sign-In Account Mapping**: Doctor Google accounts are mapped to their clinic profile so that when logging in from any device or after logging out, all clinic settings, fees, hours, and bookings restore automatically.
   - **Live Real-time Sync**: Firebase Firestore real-time listeners keep compounder desk and patient mobile screens synchronized instantly.

---

## 🚀 Quick Start

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

Live production deployment: [https://parchi-setu.vercel.app/](https://parchi-setu.vercel.app/)

1. Import this repository into [Vercel](https://vercel.com).
2. Set environment variables (from `.env.example`) in your Vercel project settings:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
3. Deploy!

---

## 📄 License
MIT License. Built for doctors, compounders, and patients across India.
