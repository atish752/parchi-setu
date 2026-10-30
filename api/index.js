/**
 * Vercel Serverless Function Handler for ParchiSetu API
 * Supports /api/health, /api/clinic, /api/queue, /api/bookings
 */

const store = require('./_store');

async function parseReqBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  // Ensure standard helper methods exist across all serverless runtimes
  if (!res.status) {
    res.status = function(code) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
  }

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

  // /api/clinics
  if (pathname === '/api/clinics' && method === 'GET') {
    return res.status(200).json(store.getClinics());
  }

  // /api/clinic
  if (pathname === '/api/clinic') {
    if (method === 'GET') {
      if (url.searchParams.get('list') === '1' || url.searchParams.get('action') === 'list') {
        return res.status(200).json(store.getClinics());
      }
      const clinicId = url.searchParams.get('id') || url.searchParams.get('clinic');
      const targetClinic = store.getClinic(clinicId);
      return res.status(200).json({
        ...targetClinic,
        network: {
          port: 3000,
          localIps: [],
          lanUrl: `https://${req.headers.host || 'parchisetu.vercel.app'}`
        }
      });
    }
    if (method === 'POST') {
      const body = await parseReqBody(req);
      const updated = store.setClinic(body);
      return res.status(200).json({ success: true, clinic: updated });
    }
  }

  // /api/queue
  if (pathname === '/api/queue') {
    if (method === 'GET') {
      const phone = url.searchParams.get('phone');
      return res.status(200).json(store.getQueue(phone));
    }
    if (method === 'PUT') {
      const body = await parseReqBody(req);
      if (Array.isArray(body)) {
        store.setQueue(body);
        return res.status(200).json({ success: true, queue: store.getQueue() });
      }
      return res.status(400).json({ error: 'Body must be an array of queue items' });
    }
  }

  if (pathname === '/api/queue/reset' && method === 'POST') {
    store.resetQueue();
    return res.status(200).json({ success: true, queue: [] });
  }

  // /api/queue/:id
  if (pathname.startsWith('/api/queue/') && (method === 'PATCH' || method === 'POST')) {
    const id = pathname.replace('/api/queue/', '').split('?')[0];
    const body = await parseReqBody(req);
    const updated = store.patchQueueItem(id, body);
    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }
    return res.status(200).json({ success: true, item: updated });
  }

  // /api/bookings
  if (pathname === '/api/bookings' && method === 'POST') {
    const body = await parseReqBody(req);
    if (!body.name || (!body.phone && body.source !== 'Walk-in')) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const { isNew, booking } = store.addOrUpdateBooking(body);
    return res.status(isNew ? 201 : 200).json({ success: true, booking });
  }

  return res.status(404).json({ error: 'Not Found' });
};
