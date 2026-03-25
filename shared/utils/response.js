module.exports = {
  success: (res, data, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, data });
  },

  created: (res, data) => {
    return res.status(201).json({ success: true, data });
  },

  error: (res, message, statusCode = 500) => {
    return res.status(statusCode).json({ success: false, error: message });
  },

  notFound: (res, message = "Resource not found") => {
    return res.status(404).json({ success: false, error: message });
  },

  unauthorized: (res, message = "Unauthorized") => {
    return res.status(401).json({ success: false, error: message });
  },

  forbidden: (res, message = "Access denied") => {
    return res.status(403).json({ success: false, error: message });
  },

  badRequest: (res, message) => {
    return res.status(400).json({ success: false, error: message });
  },
};
