-- ============================================================================
-- ParchiSetu - Production PostgreSQL / Supabase Database Schema
-- Smart Indian Clinic & Live Token Management Web Application
-- ============================================================================
-- Designed for high concurrency, real-time live token synchronization,
-- multi-device clinic owner Google Auth persistence, and master admin analytics.
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: clinics
-- Stores registered clinics onboarded by doctors via Google Sign-In.
-- Persists across logout, login, and multi-device sessions.
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  owner_uid TEXT,                          -- Firebase / Supabase Auth UID of doctor
  owner_email TEXT,                        -- Google Account Email of clinic owner
  name TEXT NOT NULL,                      -- Clinic Display Name
  tagline TEXT,                            -- e.g. 'General Physician & Family Healthcare'
  category TEXT DEFAULT 'General Medicine',
  specialty TEXT DEFAULT 'General Physician',
  address TEXT,                            -- Physical Clinic Address
  city TEXT DEFAULT 'Patna, Bihar',        -- City / Town for Patient Discovery
  phone TEXT,                              -- 10-digit Indian Mobile Number
  whatsapp TEXT,                           -- WhatsApp Number for digital prescription & tokens
  upi_id TEXT,                             -- Doctor UPI VPA (e.g. clinic@upi)
  map_url TEXT,                            -- Google Maps / Business location link
  doctor_name TEXT,                        -- Primary Attending Doctor
  doctor_degree TEXT DEFAULT 'MBBS',       -- Medical Qualification
  doctor_reg_no TEXT,                      -- State / MCI / NMC Registration Number
  experience_years INT DEFAULT 10,
  rating NUMERIC(3, 2) DEFAULT 4.80,
  review_count INT DEFAULT 0,
  doctor_photo TEXT,                       -- Photo URL or data URI
  fees JSONB DEFAULT '{"normal": 300, "followup": 200, "emergency": 500, "report": 0}'::jsonb,
  visiting_reasons JSONB DEFAULT '["🤒 Bukhar / Cold", "🩸 BP / Sugar", "🤢 Pet / Gas", "🔄 Follow-up"]'::jsonb,
  visiting_hours JSONB DEFAULT '{
    "morning": {"enabled": true, "start": "10:00 AM", "end": "02:00 PM", "slotDurationMins": 15, "maxTokens": 25},
    "evening": {"enabled": true, "start": "05:00 PM", "end": "09:00 PM", "slotDurationMins": 15, "maxTokens": 30},
    "daysOpen": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    "avgConsultationMins": 10
  }'::jsonb,
  live_status JSONB DEFAULT '{
    "isDoctorLate": false,
    "doctorDelayMinutes": 0,
    "expectedArrivalTime": "10:00 AM",
    "isQRBookingPaused": false
  }'::jsonb,
  doctors JSONB DEFAULT '[]'::jsonb,       -- Multi-doctor support array (up to 5 doctors)
  leaves JSONB DEFAULT '{}'::jsonb,        -- Vacation / leave dates dictionary
  subscription JSONB DEFAULT '{
    "plan": "free",
    "status": "active",
    "billingCycle": "trial",
    "amount": 0,
    "startDate": "2026-11-01T00:00:00.000Z"
  }'::jsonb,
  onboarded BOOLEAN DEFAULT true,
  is_google_auth BOOLEAN DEFAULT true,     -- True if created via Google Sign-In
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- TABLE: users
-- Maps Google Auth UIDs to Clinic Profiles for instant cross-device restoration.
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  clinic_id TEXT,                          -- Associated Clinic ID
  clinic_name TEXT,
  role TEXT DEFAULT 'doctor',              -- 'doctor' | 'compounder' | 'admin'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- TABLE: bookings
-- Real-time patient OPD token appointments for each clinic.
-- Supports Walk-In entries, QR Bookings, Fee status, and Live Cabin status.
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  doctor_id TEXT DEFAULT 'doc_1',
  doctor_name TEXT,
  token INT NOT NULL,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INT,
  gender TEXT,
  visit_type TEXT DEFAULT 'New',           -- 'New' | 'Follow-up' | 'Report' | 'Emergency'
  reason TEXT,
  fee NUMERIC(10, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'Pending',   -- 'Collected' | 'Pending'
  payment_mode TEXT DEFAULT 'Cash',        -- 'Cash' | 'UPI'
  cabin_status TEXT DEFAULT 'WAITING',     -- 'WAITING' | 'IN_CABIN' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED'
  appointment_date DATE DEFAULT (timezone('Asia/Kolkata'::text, now()))::date NOT NULL,
  slot_time TEXT,
  shift TEXT,                              -- 'Morning' | 'Evening'
  vitals JSONB DEFAULT '{}'::jsonb,        -- BP, Pulse, Weight, Sugar, SpO2, Lab Rx
  source TEXT DEFAULT 'Online QR',         -- 'Online QR' | 'Walk-in'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- TABLE: subscriptions
-- Clinic SaaS subscriptions managed via Master Admin panel.
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  plan TEXT DEFAULT 'free',                -- 'free' | 'monthly_pro' | 'annual_pro'
  status TEXT DEFAULT 'active',            -- 'active' | 'expired' | 'cancelled'
  billing_cycle TEXT DEFAULT 'trial',      -- 'trial' | 'monthly' | 'annual'
  amount NUMERIC(10, 2) DEFAULT 0,
  start_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  renewal_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- PERFORMANCE & LOOKUP INDEXES
-- Optimized for instant queries across Indian cities, phones & auth UIDs
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clinics_owner_uid ON clinics(owner_uid);
CREATE INDEX IF NOT EXISTS idx_clinics_owner_email ON clinics(owner_email);
CREATE INDEX IF NOT EXISTS idx_clinics_city ON clinics(city);
CREATE INDEX IF NOT EXISTS idx_clinics_specialty ON clinics(specialty);
CREATE INDEX IF NOT EXISTS idx_clinics_google_auth ON clinics(is_google_auth) WHERE is_google_auth = true;

CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_bookings_clinic_date ON bookings(clinic_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_cabin_status ON bookings(clinic_id, cabin_status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic ON subscriptions(clinic_id);

-- ============================================================================
-- AUTOMATIC updated_at TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clinics_updated_at ON clinics;
CREATE TRIGGER trg_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Clinics Policies:
DROP POLICY IF EXISTS "Public clinics discovery read" ON clinics;
DROP POLICY IF EXISTS "Clinic onboarding insert" ON clinics;
DROP POLICY IF EXISTS "Clinic owner update" ON clinics;

CREATE POLICY "Public clinics discovery read"
  ON clinics FOR SELECT
  USING (true);

CREATE POLICY "Clinic onboarding insert"
  ON clinics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Clinic owner update"
  ON clinics FOR UPDATE
  USING (true);

-- Users Policies:
DROP POLICY IF EXISTS "Users read all" ON users;
DROP POLICY IF EXISTS "Users insert/update mapping" ON users;

CREATE POLICY "Users read all"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users insert/update mapping"
  ON users FOR ALL
  USING (true);

-- Bookings Policies:
DROP POLICY IF EXISTS "Bookings public read" ON bookings;
DROP POLICY IF EXISTS "Bookings public insert" ON bookings;
DROP POLICY IF EXISTS "Bookings staff update" ON bookings;

CREATE POLICY "Bookings public read"
  ON bookings FOR SELECT
  USING (true);

CREATE POLICY "Bookings public insert"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Bookings staff update"
  ON bookings FOR UPDATE
  USING (true);

-- Subscriptions Policies:
DROP POLICY IF EXISTS "Subscriptions read" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions update" ON subscriptions;

CREATE POLICY "Subscriptions read"
  ON subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Subscriptions update"
  ON subscriptions FOR ALL
  USING (true);

-- ============================================================================
-- MASTER ADMIN VIEW: Doctors Directory with Real Aggregated Metrics
-- ============================================================================
CREATE OR REPLACE VIEW admin_doctors_view AS
SELECT
  c.id,
  c.doctor_name AS "doctorName",
  c.doctor_degree AS "doctorDegree",
  c.doctor_reg_no AS "doctorRegNo",
  c.experience_years AS "experienceYears",
  c.name AS "clinicName",
  c.category,
  c.specialty,
  c.city,
  c.address,
  c.phone,
  c.whatsapp,
  c.owner_email AS "ownerEmail",
  c.owner_uid AS "ownerUid",
  c.doctor_photo AS "doctorPhoto",
  c.fees,
  c.visiting_hours AS "visitingHours",
  c.subscription,
  c.is_google_auth AS "isGoogleAuth",
  c.created_at AS "createdAt",
  COALESCE(b_stats.total_bookings, 0) AS "totalBookings",
  COALESCE(b_stats.today_bookings, 0) AS "todayBookings"
FROM clinics c
LEFT JOIN (
  SELECT
    clinic_id,
    COUNT(*) AS total_bookings,
    COUNT(*) FILTER (WHERE appointment_date = (timezone('Asia/Kolkata'::text, now()))::date) AS today_bookings
  FROM bookings
  GROUP BY clinic_id
) b_stats ON b_stats.clinic_id = c.id
ORDER BY c.created_at DESC;
