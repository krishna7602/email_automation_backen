# 🚀 Business Central Integration - Quick Start

## What This Does

When you receive an email with order information, the system will:

1. ✅ **Parse the email** and extract order details using AI
2. ✅ **Create an order** in your local database
3. ✅ **Automatically sync** the order to Business Central
   - Creates/finds the customer
   - Creates a sales order
   - Adds all line items
4. ✅ **Retry automatically** if sync fails (up to 3 times with exponential backoff)
5. ✅ **Track sync status** for monitoring and debugging

## 🎯 Quick Setup (5 Minutes)

### Step 1: Get Business Central Credentials

1. Log into your Business Central account
2. Go to **Users** → Select your user → **Web Service Access Key**
3. Click **Generate Key** and copy it (this is your `BC_PASSWORD`)
4. Your username is your BC email (e.g., `pradip@careerfy.ai`)

### Step 2: Update .env File

The `.env` file is already configured! Just verify these settings:

```env
# Enable BC Sync
DISABLE_BC_SYNC=false

# Your credentials (already set)
BC_USERNAME=pradip@careerfy.ai
BC_PASSWORD=gothaM#181231

# API URL (already set for sandbox)
BC_API_URL=https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0
```

### Step 3: Test the Connection

Run the test script:

```bash
node scripts/test-bc-integration.js
```

**Expected Output:**
```
✅ Configuration is valid
✅ Connection successful!
🏢 Company ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 4: Test with a Real Email

Send an email with order details to your configured email address. The system will:
- Extract the order details
- Create the order in your database
- Automatically sync it to Business Central

## 📊 Monitoring

### Check Sync Status via API

```bash
# Get sync statistics
GET http://localhost:3000/api/orders/sync-stats

# Test BC connection
GET http://localhost:3000/api/orders/test-bc-connection

# Get all orders with sync status
GET http://localhost:3000/api/orders
```

### Manual Retry

If an order fails to sync, retry it manually:

```bash
POST http://localhost:3000/api/orders/:orderId/sync
```

## 🔧 Configuration Options

All configuration is in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_BC_SYNC` | `false` | Enable/disable BC sync |
| `BC_MAX_RETRIES` | `3` | Number of retry attempts |
| `BC_RETRY_DELAY_MS` | `2000` | Initial retry delay (exponential backoff) |
| `BC_DEFAULT_ITEM_ID` | `1000` | Default item when SKU not found |
| `BC_DEFAULT_GL_ACCOUNT` | `8000` | Fallback G/L account |

## 🎨 How It Works

### Email → Order Flow

```
📧 Email Received
    ↓
🤖 AI Extracts Order Details
    ↓
💾 Order Saved to Database (syncStatus: 'pending')
    ↓
🔄 Automatic BC Sync Attempt
    ↓
    ├─ ✅ Success → syncStatus: 'synced'
    ├─ ❌ Failed → Retry (up to 3 times)
    └─ ⏭️  Disabled → syncStatus: 'skipped'
```

### Item Mapping Strategy

```
📦 Item from Email
    ↓
Has SKU? → Try to find item in BC
    ↓
    ├─ ✅ Found → Add as Item line
    ├─ ❌ Not Found → Use BC_DEFAULT_ITEM_ID
    └─ ❌ Still Fails → Fallback to G/L Account (BC_DEFAULT_GL_ACCOUNT)
```

## 🐛 Troubleshooting

### "BC Connection Failed (401)"
**Problem**: Invalid credentials  
**Solution**: Regenerate Web Service Access Key in BC and update `BC_PASSWORD`

### "BC Connection Failed (404)"
**Problem**: Invalid API URL  
**Solution**: Verify tenant ID in `BC_API_URL`

### "Item not found"
**Problem**: SKU doesn't exist in BC  
**Solution**: System automatically falls back to G/L Account. Check logs for details.

### Orders stuck in "pending"
**Problem**: BC sync might be disabled or failing  
**Solution**: 
1. Check `DISABLE_BC_SYNC=false` in .env
2. Run `node scripts/test-bc-integration.js`
3. Check application logs for errors
4. Manually retry: `POST /api/orders/:id/sync`

## 📖 Detailed Documentation

For comprehensive setup instructions, see:
- **[BUSINESS_CENTRAL_SETUP.md](./BUSINESS_CENTRAL_SETUP.md)** - Complete setup guide

## 🎯 What You Need to Know

### ✅ Already Working
- Email processing and AI extraction
- Order creation in database
- Automatic BC sync with retry logic
- Manual sync/retry capability
- Comprehensive logging and monitoring

### 🔧 What You Need to Do
1. Verify BC credentials in `.env` are correct
2. Run the test script to confirm connection
3. Optionally adjust retry settings and item mapping
4. Monitor sync status via API or logs

### 💡 Pro Tips
1. **Start with sandbox**: Test thoroughly before using production BC
2. **Monitor logs**: Check application logs for detailed sync information
3. **Use manual retry**: For failed orders, use the manual sync endpoint
4. **Adjust retry settings**: Increase `BC_MAX_RETRIES` if you have network issues
5. **Item mapping**: Update `BC_DEFAULT_ITEM_ID` to match your BC setup

## 🚨 Important Notes

- **BC_COMPANY_ID**: Leave empty for auto-detection (recommended)
- **Web Service Key**: Never commit this to version control
- **Sync Status**: Check `/api/orders/sync-stats` regularly
- **Failed Orders**: Can be manually retried anytime

## 🎉 You're All Set!

The integration is now active. When you receive an email:
1. Order is extracted and saved
2. Automatically synced to Business Central
3. Status tracked and logged
4. Can be manually retried if needed

**Need help?** Check the logs or run the test script for diagnostics.
