// express, cors, dotenv
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe = require("stripe");
const admin = require("firebase-admin");
const { initializeApp } = require('firebase-admin/app');
const { MongoClient, ServerApiVersion } = require('mongodb');
const serviceAccount = require("./pro-fast-firebase-adminsdk-key.json");
// .env
dotenv.config();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware
app.use(cors());
app.use(express.json());

// Verify FB Token
const verifyFBToken = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).send({message: 'unauthorized Access!'})
  }
  try{
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next()
  }
  catch (error) {
    return res.status(403).send({ message: 'forbidden access' })
  }
} 


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

    const usersCollection = db.collection("users");
    const parcelCollection = db.collection("parcels");
    const ridersCollection = db.collection("riders");
    const paymentsCollection = db.collection("payments");

// Post User
    app.post('/users', async (req, res) => {
      const user = req.body;
      const email = user.email;
      const existingUser = await usersCollection.findOne({email});

      if (existingUser) {
        return res.send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

// Get User Search Query
app.get("/users/search", async (req, res) => {
  const queryText = req.query.query;

  const searchRegex = new RegExp(queryText, "i"); // case-insensitive
  const query = {
    role: { $ne: "admin" }, // exclude admins
    $or: [
      { name: { $regex: searchRegex } },
      { email: { $regex: searchRegex } }
    ]
  };

  const users = await db.collection("users").find(query).toArray();
  res.send(users);
});
    
// Make Admin role
app.patch("/users/:id/make-admin", async (req, res) => {
  const id = req.params.id;

  const filter = { _id: new ObjectId(id) };
  const update = {
    $set: { role: "admin" },
  };

  const result = await db.collection("users").updateOne(filter, update);
  res.send({
    message: "User role updated to admin",
    modifiedCount: result.modifiedCount,
  });
});



// Post Rider
app.post('/riders', async (req, res) => {
  const riderInfo = req.body;
  const result = await ridersCollection.insertOne(riderInfo);
  res.send(result)
})

// GET: Get all riders or filter by status query param
app.get("/riders", async (req, res) => {
  const status = req.query.status;

  let query = {};
  if (status) {
    query.status = status;  // filter by status if provided
  }

  const riders = await ridersCollection.find(query).toArray();
  res.send(riders);
});


// PATCH: Update rider status by ID
app.patch("/riders/:id", async (req, res) => {
  const id = req.params.id;
  const {status, email} = req.body;

  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      status,
    },
  };


  const result = await ridersCollection.updateOne(filter, updateDoc);

  // Update User Role
  if (status === 'approve') {
    const userQuery = {email};
    const updatedRole = {
      $set: {
        role: 'rider',
      }
    };
    const roleResult = await usersCollection.updateOne(userQuery, updatedRole);
  };

  res.send(result);
});



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
    app.get("/parcels", verifyFBToken, async (req, res) => {
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

  // Get Payment
  app.get("/payments", async (req, res) => {
  const email = req.query.email;
  
  let query = {};

  if (email) {
    query = { email: email };
  }

  const payments = await paymentsCollection
    .find(query)
    .sort({ paidAt: -1 })
    .toArray();

  res.send(payments);
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
