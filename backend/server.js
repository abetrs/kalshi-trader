// Import necessary packages
require("dotenv").config(); // Loads environment variables from .env file
const express = require("express");

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000; // Use port from .env or default to 3000

// Middleware to parse JSON bodies
app.use(express.json());

// --- API Routes Will Go Here ---

// A simple test route
app.get("/api/status", (req, res) => {
  res.json({ status: "Backend is running", timestamp: new Date() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
