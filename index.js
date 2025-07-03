// express, cors, dotenv প্যাকেজগুলো ইমপোর্ট করছি
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require('mongodb');
// .env ফাইল থেকে কনফিগারেশন লোড করছি
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware: অন্য জায়গা থেকে অনুরোধ আসতে দিলে (CORS) এবং JSON ডেটা রিড করতে পারি
app.use(cors());
app.use(express.json()); // JSON body পার্স করার middleware


// ✅ MongoDB connection setup
const uri = process.env.MONGODB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Async function: MongoDB connect ও route setup
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Database এবং collection reference নিচ্ছি
    const db = client.db(process.env.DB_NAME);
    const parcelCollection = db.collection("parcels");

    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


// GET route: root path
app.get("/", (req, res) => {
  res.send("Parcel Delivery Server Running!");
});


// Server চালু করছি
app.listen(port, () => {
  console.log(`🚀 Server Running: http://localhost:${port}`);
});
