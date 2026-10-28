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
  leaves: {},
  onboarded: true,
  createdAt: new Date().toISOString()
};

// Initial Queue - Zero dummy data for fresh clinic setup
const DEFAULT_QUEUE = [];

let appData = {
  clinic: DEFAULT_CLINIC,
  queue: DEFAULT_QUEUE
};

// Load or initialize data file
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      appData = JSON.parse(raw);
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

  // Get current queue
  if (pathname === '/api/queue' && method === 'GET') {
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
        date: body.date || new Date().toISOString().split('T')[0],
        bp: body.bp || '',
        weight: body.weight || '',
        temp: body.temp || '',
        spo2: body.spo2 || '',
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
