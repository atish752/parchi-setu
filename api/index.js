/**
 * Vercel Serverless Function Handler for ParchiSetu API
 * Supports /api/health, /api/clinic, /api/queue, /api/bookings, /api/clinics, /api/admin
 */

const store = require('./_store');
let paymentHandler = null;
try {
  paymentHandler = require('./payment');
} catch (e) {}

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

  // /api/payment
  if (pathname.startsWith('/api/payment') && paymentHandler) {
    return paymentHandler(req, res);
  }

  // /api/clinics
  if (pathname === '/api/clinics' && method === 'GET') {
    const realOnly = url.searchParams.get('realOnly') === '1' || url.searchParams.get('realOnly') === 'true';
    const clinics = await store.getClinicsAsync(realOnly);
    return res.status(200).json(clinics);
  }

  // /api/clinic
  if (pathname === '/api/clinic') {
    if (method === 'GET') {
      if (url.searchParams.get('list') === '1' || url.searchParams.get('action') === 'list') {
        const realOnly = url.searchParams.get('realOnly') === '1' || url.searchParams.get('realOnly') === 'true';
        const clinics = await store.getClinicsAsync(realOnly);
        return res.status(200).json(clinics);
      }

      // Owner UID / email lookup for multi-device Google signin sync
      const ownerUid = url.searchParams.get('ownerUid') || url.searchParams.get('uid');
      const ownerEmail = url.searchParams.get('email') || url.searchParams.get('ownerEmail');
      if (ownerUid || ownerEmail) {
        const ownerClinic = await store.getClinicByOwnerAsync(ownerUid, ownerEmail);
        if (!ownerClinic) {
          return res.status(404).json({ error: 'Clinic not found for this account' });
        }
        return res.status(200).json({
          ...ownerClinic,
          network: {
            port: 3000,
            localIps: [],
            lanUrl: `https://${req.headers.host || 'parchi-setu.vercel.app'}`
          }
        });
      }

      const clinicId = url.searchParams.get('id') || url.searchParams.get('clinic');
      const targetClinic = clinicId ? await store.getClinicAsync(clinicId) : store.getClinic();
      return res.status(200).json({
        ...targetClinic,
        network: {
          port: 3000,
          localIps: [],
          lanUrl: `https://${req.headers.host || 'parchi-setu.vercel.app'}`
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
      const clinicId = url.searchParams.get('clinic') || url.searchParams.get('clinicId');
      const queue = await store.getQueueAsync(phone, clinicId);
      return res.status(200).json(queue);
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

  // /api/admin/doctors and /api/admin/subscription
  if (pathname === '/api/admin/doctors' || (pathname === '/api/admin' && (!url.searchParams.get('action') || url.searchParams.get('action') === 'doctors'))) {
    if (method === 'GET') {
      const doctors = await store.getAdminDoctorsAsync();
      return res.status(200).json({ success: true, doctors });
    }
  }

  if (pathname === '/api/admin/subscription' || (pathname === '/api/admin' && url.searchParams.get('action') === 'subscription')) {
    if (method === 'POST') {
      const body = await parseReqBody(req);
      if (!body.clinicId) {
        return res.status(400).json({ error: 'Missing clinicId' });
      }
      const updated = store.updateSubscription(body.clinicId, {
        plan: body.plan || 'free',
        status: body.status || 'active',
        billingCycle: body.billingCycle || (body.plan === 'annual_pro' ? 'annual' : (body.plan === 'monthly_pro' ? 'monthly' : 'trial')),
        amount: body.amount !== undefined ? body.amount : (body.plan === 'annual_pro' ? 4000 : (body.plan === 'monthly_pro' ? 399 : 0)),
        renewalDate: body.renewalDate || new Date(Date.now() + 30 * 86400000).toISOString()
      });
      if (!updated) {
        return res.status(404).json({ error: 'Clinic not found' });
      }
      return res.status(200).json({ success: true, clinic: updated });
    }
  }

  return res.status(404).json({ error: 'Not Found' });
};
