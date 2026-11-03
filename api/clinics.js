const store = require('./_store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method.toUpperCase() === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const realOnly = url.searchParams.get('realOnly') === '1' || url.searchParams.get('realOnly') === 'true';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const clinics = await store.getClinicsAsync(realOnly);
    return res.end(JSON.stringify(clinics));
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
};
