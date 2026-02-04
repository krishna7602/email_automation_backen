// Script to drop the unique index on emailId in orders collection
// This allows multiple orders to be created from the same email

const mongoose = require('mongoose');
require('dotenv').config();

async function fixOrderIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');

    // Get all indexes
    const indexes = await ordersCollection.indexes();
    console.log('\n📋 Current indexes on orders collection:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop the unique emailId index if it exists
    try {
      await ordersCollection.dropIndex('emailId_1');
      console.log('\n✅ Dropped unique index on emailId_1');
    } catch (err) {
      if (err.code === 27) {
        console.log('\n⚠️  Index emailId_1 does not exist (already dropped or never existed)');
      } else {
        throw err;
      }
    }

    // Verify indexes after drop
    const newIndexes = await ordersCollection.indexes();
    console.log('\n📋 Indexes after cleanup:');
    newIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Database indexes fixed! You can now have multiple orders per email.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixOrderIndexes();
