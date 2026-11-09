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

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = req.method.toUpperCase();

  if (method === 'GET') {
    const clinicId = url.searchParams.get('clinicId') || url.searchParams.get('clinic') || 'clinic_sanjeevani_01';
    const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '').slice(-10);
    const clinic = await store.getClinicAsync(clinicId);
    if (!clinic) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Clinic not found' }));
    }
    const hasRated = Boolean(phone && clinic.ratingsByPhone && clinic.ratingsByPhone[phone]);
    const userRating = hasRated ? (typeof clinic.ratingsByPhone[phone] === 'object' ? clinic.ratingsByPhone[phone].rating : clinic.ratingsByPhone[phone]) : null;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      clinicId,
      rating: clinic.rating || 0,
      reviewCount: clinic.reviewCount || 0,
      hasRated,
      rating: clinic.rating || 0,
      userRating
  }

  if (method === 'POST') {
    const body = await parseBody(req);
    const clinicId = body.clinicId || 'clinic_sanjeevani_01';
    const rawPhone = String(body.phone || '').trim();
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    const rating = parseInt(body.rating, 10);
    const comment = String(body.comment || '').trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Valid 10-digit phone number is required to submit a rating.' }));
    }

    if (isNaN(rating) || rating < 1 || rating > 5) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Rating must be an integer between 1 and 5 stars.' }));
    }

    // Verify booking
    const queue = await store.getQueueAsync(clinicId);
    const hasBooking = queue.some(q => {
      const qPhone = String(q.phone || '').replace(/\D/g, '').slice(-10);
      return qPhone === cleanPhone;
    }) || Boolean(body.bookingId);

    if (!hasBooking) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Only patients who have booked an appointment can rate this clinic.' }));
    }

    const clinic = await store.getClinicAsync(clinicId);
    if (!clinic) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Clinic not found' }));
    }

    clinic.ratingsByPhone = clinic.ratingsByPhone || {};
    if (clinic.ratingsByPhone[cleanPhone]) {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Aap pehle hi is clinic ko rate kar chuke hain. Only one rating per patient allowed.' }));
    }

    clinic.ratingsByPhone[cleanPhone] = {
      rating,
      comment,
      ratedAt: new Date().toISOString()
    };

    const allRatings = Object.values(clinic.ratingsByPhone).map(r => r.rating);
    clinic.reviewCount = allRatings.length;
    clinic.rating = +(allRatings.reduce((sum, v) => sum + v, 0) / allRatings.length).toFixed(1);

    await store.setClinicAsync(clinic);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      clinicId: clinic.id,
      rating: clinic.rating,
      reviewCount: clinic.reviewCount,
      message: 'Rating submitted successfully!'
    }));
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
};
