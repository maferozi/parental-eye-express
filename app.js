const express = require("express");
const http = require("http"); // Required for integrating with Socket.IO
const { sequelize } = require("./models");
const router = require("./router/index");
const cors = require("cors");
const logger = require("morgan");
const { connectMqtt } = require("./config/connectMqtt");
const { initializeSocket } = require("./config/socketConfig");
const path = require("path");


const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.IO
const PORT = process.env.PORT || 3000;
const FORNTEND_URL = process.env.FORNTEND_URL || "*";

app.use(express.json());

app.use(cors({ origin: "*" })); 
app.use(logger("dev"));
app.use("/api/", router);
app.use(express.static(path.join(__dirname, "public")));

 
connectMqtt(); 
initializeSocket(server);


sequelize
  .authenticate()
  .then(() => console.log("✅ Database connected..."))
  .catch((err) => console.log("❌ Database Error: " + err));


app.use((error, _req, res, _next) => {
  const statusCode = error.status || 500;
  console.error(error); // Log error details
  res.status(statusCode).json({ message: error.message || "Something went wrong" });
});


server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
