const multer = require("multer");

// Store file in memory (buffer), not on disk
// MinIO receives the buffer directly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types — add restrictions here if needed
    cb(null, true);
  },
});

module.exports = upload;
