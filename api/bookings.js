const store = require('./_store');

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

    const { isNew, booking } = store.addOrUpdateBooking(body);
    res.statusCode = isNew ? 201 : 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, booking }));
  }

  if (method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(store.getQueue()));
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
};
