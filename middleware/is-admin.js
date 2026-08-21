module.exports = (req, res, next) => {
    if (!req.session || !req.session.isAdminLoggedIn) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json')) || (req.headers['content-type'] && req.headers['content-type'].includes('json'))) {
            return res.status(401).json({ status: 'failed', message: 'Admin authentication required.' });
        }
        return res.redirect('/admin/login');
    }
    next();
};
