// Quick script to check database counts
const mongoose = require('mongoose');
require('dotenv').config();

async function checkCounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const emailsCount = await db.collection('emails').countDocuments();
    const ordersCount = await db.collection('orders').countDocuments();
    
    console.log('Emails:', emailsCount);
    console.log('Orders:', ordersCount);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCounts();
