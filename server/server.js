require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const passport = require("./config/passport");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const donorRoutes = require("./routes/donor.routes");
const patientRoutes = require("./routes/patient.routes");
const requestRoutes = require("./routes/request.routes");
const adminRoutes = require("./routes/admin.routes");
const hospitalRoutes = require("./routes/hospital.routes");

connectDB();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(passport.initialize());

app.get("/api/health", (req, res) => res.json({ success: true, message: "OK" }));

app.use("/api/auth", authRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hospitals", hospitalRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
