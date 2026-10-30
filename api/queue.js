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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = req.method.toUpperCase();

  // Check if an id is passed in pathname or query (e.g. /api/queue/:id or ?id=)
  let itemId = url.searchParams.get('id');
  if (!itemId && url.pathname.startsWith('/api/queue/')) {
    itemId = url.pathname.replace('/api/queue/', '').split('?')[0];
  }

  if (method === 'PATCH' && itemId) {
    const body = await parseBody(req);
    const updated = store.patchQueueItem(itemId, body);
    if (!updated) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Item not found' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, item: updated }));
  }

  if (method === 'GET') {
    const phone = url.searchParams.get('phone');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(store.getQueue(phone)));
  }

  if (method === 'PUT') {
    const body = await parseBody(req);
    if (Array.isArray(body)) {
      store.setQueue(body);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, queue: store.getQueue() }));
  }

  if (method === 'POST') {
    // Check if it's a reset action
    if (url.pathname.includes('reset') || url.searchParams.get('action') === 'reset') {
      store.resetQueue();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, message: 'Queue reset to 0', queue: [] }));
    }

    if (itemId) {
      const body = await parseBody(req);
      const updated = store.patchQueueItem(itemId, body);
      if (!updated) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Item not found' }));
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, item: updated }));
    }
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
};
