const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// .env ফাইল লোড করা
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;


// মিডলওয়্যার
app.use(cors());
app.use(express.json()); // JSON body পার্স করার জন্য