require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const API_PREFIX = process.env.API_PREFIX || "/api";

app.use(API_PREFIX, routes);

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
