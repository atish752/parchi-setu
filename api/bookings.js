let memoryQueue = [];

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const method = req.method.toUpperCase();

  if (method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.name || (!body.phone && body.source !== 'Walk-in')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Name and phone are required' }));
    }

    const existingIdx = body.id ? memoryQueue.findIndex(p => p.id === body.id) : -1;
    if (existingIdx >= 0) {
      Object.assign(memoryQueue[existingIdx], body);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, booking: memoryQueue[existingIdx] }));
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
      doctorName: body.doctorName || 'Dr. Rajesh Sharma',
      fee: body.fee !== undefined ? body.fee : 300,
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
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, booking: newBooking }));
  }

  if (method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(memoryQueue));
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
};
