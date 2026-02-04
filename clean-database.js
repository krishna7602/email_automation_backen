// Script to clean all data from the database
// This will delete all emails and orders to allow fresh extraction

const mongoose = require('mongoose');
require('dotenv').config();

async function cleanDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Found collections:', collections.map(c => c.name).join(', '));

    // Clean emails collection
    const emailsCollection = db.collection('emails');
    const emailsCount = await emailsCollection.countDocuments();
    if (emailsCount > 0) {
      await emailsCollection.deleteMany({});
      console.log(`\n🗑️  Deleted ${emailsCount} emails`);
    } else {
      console.log('\n✓ Emails collection already empty');
    }

    // Clean orders collection
    const ordersCollection = db.collection('orders');
    const ordersCount = await ordersCollection.countDocuments();
    if (ordersCount > 0) {
      await ordersCollection.deleteMany({});
      console.log(`🗑️  Deleted ${ordersCount} orders`);
    } else {
      console.log('✓ Orders collection already empty');
    }

    // Verify cleanup
    const finalEmailCount = await emailsCollection.countDocuments();
    const finalOrderCount = await ordersCollection.countDocuments();
    
    console.log('\n📊 Final counts:');
    console.log(`   Emails: ${finalEmailCount}`);
    console.log(`   Orders: ${finalOrderCount}`);

    if (finalEmailCount === 0 && finalOrderCount === 0) {
      console.log('\n✅ Database cleaned successfully!');
      console.log('📧 You can now sync emails again to test the new AI extraction.');
    } else {
      console.log('\n⚠️  Warning: Some documents may still exist');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

cleanDatabase();
