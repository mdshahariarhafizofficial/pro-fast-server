// express, cors, dotenv প্যাকেজগুলো ইমপোর্ট করছি
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion } = require('mongodb');
// .env ফাইল থেকে কনফিগারেশন লোড করছি
dotenv.config();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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
    const paymentsCollection = db.collection("payments");

// ✅ POST API: নতুন পার্সেল সংরক্ষণ
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;

      const result = await parcelCollection.insertOne(parcel);
      res.send({
        message: "Parcel saved successfully!",
        insertedId: result.insertedId,
      });
    });    

    //GET: Retrieve all parcels or filter by email (matched with 'created_by' in DB)
    app.get("/parcels", async (req, res) => {
    const email = req?.query?.email;

    let query = {};
    if (email) {
        query = { created_by: email }; // Database field
    }

    const parcels = await parcelCollection
        .find(query)
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order
        .toArray();

    res.send(parcels);
    });

const { ObjectId } = require("mongodb");

  // DELETE: Delete a parcel by ID
  app.delete("/parcels/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await parcelCollection.deleteOne(query);
    res.send(result);
  });


  // GET: Get a single parcel by MongoDB _id
  app.get("/parcels/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const parcel = await parcelCollection.findOne(query);
    res.send(parcel);

  });

  // Payment API
  app.post("/create-payment-intent", async (req, res) => {
    const { amount } = req.body;

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // টাকাকে পয়সায় রূপান্তর
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (err) {
      res.status(500).send({ error: err.message });
    }
  });  

  // Payment History
  app.post("/payments", async (req, res) => {
  const payment = req.body;

  // Add timestamp as "paidAt"
  payment.paidAt = new Date();
  payment.status = "paid";

  const paymentResult = await paymentsCollection.insertOne(payment);

  // Update parcel payment status
  const parcelId = payment.parcelId;
  const filter = { _id: new ObjectId(parcelId) };
  const update = { $set: { paymentStatus: "paid" } };
  const parcelResult = await db.collection("parcels").updateOne(filter, update);

  res.send({
    message: "Payment saved and parcel updated",
    paymentInsertedId: paymentResult.insertedId,
    parcelModified: parcelResult.modifiedCount
    });
  });


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
  console.log(`🚀 Server is running on: http://localhost:${port}`);
});
