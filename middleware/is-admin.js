const crypto = require('crypto');
const SECRET = "onecommerce_secret_session_key_987";

function verifyToken(token) {
  try {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [data, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    if (signature === expectedSig) {
      const payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
      if (payload.exp > Date.now()) {
        return payload;
      }
    }
  } catch (err) {
    return false;
  }
  return false;
}

module.exports = (req, res, next) => {
  let loggedIn = false;

  if (req.session && req.session.isAdminLoggedIn) {
    loggedIn = true;
  } else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      })
    );
    const rawToken = cookies.admin_auth ? decodeURIComponent(cookies.admin_auth) : '';
    if (rawToken && verifyToken(rawToken)) {
      loggedIn = true;
      if (req.session) {
        req.session.isAdminLoggedIn = true;
      }
    }
  }

  if (!loggedIn) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json')) || (req.headers['content-type'] && req.headers['content-type'].includes('json'))) {
      return res.status(401).json({ status: 'failed', message: 'Admin authentication required.' });
    }
    return res.redirect('/admin/login');
  }

  next();
};
