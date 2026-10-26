/**
 * Vercel Serverless Function Handler for ParchiSetu API
 * Supports /api/health, /api/clinic, /api/queue, /api/bookings
 */

let memoryClinic = {
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
  doctors: [
    {
      id: 'doc_1',
      name: 'Dr. Rajesh Sharma',
      degree: 'MBBS, MD (General Physician)',
      specialty: 'General Physician',
      regNo: 'MCI-48291',
      fee: 300,
      isMain: true
    }
  ],
  fees: {
    normal: 300,
    followup: 200,
    emergency: 500,
    report: 0
  },
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
  leaves: {},
  onboarded: true,
  createdAt: new Date().toISOString()
};

let memoryQueue = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // /api/health
  if (pathname === '/api/health') {
    return res.status(200).json({ status: 'healthy', uptime: process.uptime() });
  }

  // /api/clinic
  if (pathname === '/api/clinic') {
    if (method === 'GET') {
      return res.status(200).json({
        ...memoryClinic,
        network: {
          port: 3000,
          localIps: [],
          lanUrl: `https://${req.headers.host || 'parchisetu.vercel.app'}`
        }
      });
    }
    if (method === 'POST') {
      const body = req.body || {};
      memoryClinic = {
        ...memoryClinic,
        ...body,
        onboarded: true,
        updatedAt: new Date().toISOString()
      };
      return res.status(200).json({ success: true, clinic: memoryClinic });
    }
  }

  // /api/queue
  if (pathname === '/api/queue') {
    if (method === 'GET') {
      return res.status(200).json(memoryQueue);
    }
    if (method === 'PUT') {
      if (Array.isArray(req.body)) {
        memoryQueue = req.body;
        return res.status(200).json({ success: true, queue: memoryQueue });
      }
      return res.status(400).json({ error: 'Body must be an array of queue items' });
    }
  }

  if (pathname === '/api/queue/reset' && method === 'POST') {
    memoryQueue = [];
    return res.status(200).json({ success: true, queue: [] });
  }

  // /api/queue/:id
  if (pathname.startsWith('/api/queue/') && (method === 'PATCH' || method === 'POST')) {
    const id = pathname.replace('/api/queue/', '');
    const item = memoryQueue.find(p => p.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    Object.assign(item, req.body || {});
    return res.status(200).json({ success: true, item });
  }

  // /api/bookings
  if (pathname === '/api/bookings' && method === 'POST') {
    const body = req.body || {};
    if (!body.name || (!body.phone && body.source !== 'Walk-in')) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const existingIdx = body.id ? memoryQueue.findIndex(p => p.id === body.id) : -1;
    if (existingIdx >= 0) {
      Object.assign(memoryQueue[existingIdx], body);
      return res.status(200).json({ success: true, booking: memoryQueue[existingIdx] });
    }

    const maxToken = memoryQueue.reduce((max, p) => Math.max(max, p.token || 0), 0);
    const nextToken = body.token || (maxToken > 0 ? maxToken + 1 : 1);
    const bookingId = body.id || ('q_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

    const newBooking = {
      id: bookingId,
      token: nextToken,
      name: body.name.trim(),
      age: parseInt(body.age, 10) || 30,
      gender: body.gender || 'M',
      phone: (body.phone || '').trim(),
      reason: body.reason || 'General Consultation',
      doctorId: body.doctorId || 'doc_1',
      doctorName: body.doctorName || (memoryClinic.doctorName || 'Dr. Rajesh Sharma'),
      fee: body.fee !== undefined ? body.fee : (memoryClinic.fees ? memoryClinic.fees.normal : 300),
      payMode: body.payMode || 'Baaki',
      status: body.status || 'WAITING',
      source: body.source || 'QR Booked',
      shift: body.shift || 'Morning',
      slotTime: body.slotTime || 'Online Booking',
      day: body.day || 'Aaj (Today)',
      date: body.date || new Date().toISOString().split('T')[0],
      bp: body.bp || '',
      weight: body.weight || '',
      temp: body.temp || '',
      spo2: body.spo2 || '',
      hasParchiPhoto: !!body.hasParchiPhoto,
      notes: body.notes || '',
      createdAt: body.createdAt || new Date().toISOString()
    };

    memoryQueue.push(newBooking);
    return res.status(201).json({ success: true, booking: newBooking });
  }

  return res.status(404).json({ error: 'Not Found' });
};
