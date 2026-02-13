# Business Central Integration Setup Guide

## Overview
This guide will help you integrate Microsoft Dynamics 365 Business Central with your email automation system to automatically create sales orders from incoming emails.

## Prerequisites
1. **Business Central Account**: You need access to a Business Central environment (sandbox or production)
2. **API Access**: Ensure API access is enabled in your Business Central environment
3. **Web Service Access Key**: You'll need to generate a web service access key for authentication

## Step-by-Step Setup

### 1. Get Your Business Central Credentials

#### A. Find Your API URL
- **Sandbox**: `https://api.businesscentral.dynamics.com/v2.0/<TENANT_ID>/sandbox/api/v2.0`
- **Production**: `https://api.businesscentral.dynamics.com/v2.0/<TENANT_ID>/production/api/v2.0`

Replace `<TENANT_ID>` with your Microsoft tenant ID (usually your domain like `contoso.onmicrosoft.com`)

#### B. Generate Web Service Access Key
1. Log into Business Central
2. Search for "Users" in the search bar
3. Select your user account
4. Click "Web Service Access Key"
5. Click "Generate Key" and copy it immediately (you won't be able to see it again)
6. This key will be your `BC_PASSWORD`

#### C. Get Your Username
- Your username is typically your Business Central user email (e.g., `pradip@careerfy.ai`)

### 2. Configure Environment Variables

Update your `.env` file with the following:

```env
# Business Central Configuration
BC_API_URL=https://api.businesscentral.dynamics.com/v2.0/<YOUR_TENANT>/sandbox/api/v2.0
BC_USERNAME=your-email@domain.com
BC_PASSWORD=your-web-service-access-key
BC_COMPANY_ID=                    # Leave empty for auto-detection
BC_DEFAULT_ITEM_ID=1000           # Default item number if SKU not found
BC_DEFAULT_GL_ACCOUNT=8000        # G/L Account for unmapped items
BC_MAX_RETRIES=3                  # Number of retry attempts for failed syncs
BC_RETRY_DELAY_MS=2000            # Initial delay between retries (exponential backoff)

# Enable/Disable BC Sync
DISABLE_BC_SYNC=false             # Set to 'true' to disable BC sync, 'false' to enable
```

### 3. Test Your Connection

Once configured, test the connection using the API endpoint:

```bash
GET http://localhost:3000/api/orders/test-bc-connection
```

**Expected Response (Success):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "companyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "companies": [
      {
        "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "name": "CRONUS USA, Inc.",
        "displayName": "CRONUS USA, Inc."
      }
    ]
  },
  "message": "Business Central connection successful"
}
```

**Expected Response (Disabled):**
```json
{
  "success": true,
  "data": {
    "disabled": true,
    "message": "Business Central sync is currently disabled (DISABLE_BC_SYNC=true)"
  }
}
```

### 4. Understanding the Sync Flow

When an email is received:

1. **Email Processing**: Email is parsed and stored in the database
2. **AI Extraction**: AI extracts order details (customer, items, quantities, prices)
3. **Order Creation**: Order is created in the local database with `syncStatus: 'pending'`
4. **Automatic BC Sync**: System automatically attempts to sync the order to Business Central
   - Finds or creates customer in BC
   - Creates sales order header
   - Adds line items (with fallback to G/L accounts if item not found)
5. **Status Update**: Order status is updated to `synced`, `failed`, or `skipped`

### 5. Manual Sync/Retry

If an order fails to sync automatically, you can manually retry:

```bash
POST http://localhost:3000/api/orders/:orderId/sync
```

This will force a re-sync even if the order was previously synced.

### 6. Monitor Sync Status

Check sync statistics:

```bash
GET http://localhost:3000/api/orders/sync-stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "synced": 45,
    "pending": 2,
    "failed": 3,
    "skipped": 0,
    "total": 50,
    "bcSyncEnabled": true,
    "companyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

## Item Mapping Strategy

The system uses a two-tier fallback strategy for items:

### Tier 1: Item Mapping (Preferred)
- If the AI extracts a SKU from the email, it will try to match it to an item in Business Central
- If no SKU is found, it uses `BC_DEFAULT_ITEM_ID`

### Tier 2: G/L Account Fallback
- If the item doesn't exist in BC, the system automatically falls back to creating a G/L Account line
- Uses `BC_DEFAULT_GL_ACCOUNT` (default: 8000)
- Description includes the original item name and SKU for reference

## Retry Logic

The system implements exponential backoff for failed syncs:

- **Attempt 1**: Immediate
- **Attempt 2**: Wait 2 seconds (2000ms)
- **Attempt 3**: Wait 4 seconds (4000ms)

After all retries fail, the order is marked as `failed` and can be manually retried.

## Common Issues & Solutions

### Issue 1: "BC Connection Failed (401)"
**Cause**: Invalid credentials
**Solution**: 
- Verify `BC_USERNAME` is correct
- Regenerate your Web Service Access Key and update `BC_PASSWORD`

### Issue 2: "BC Connection Failed (404)"
**Cause**: Invalid API URL or tenant ID
**Solution**: 
- Verify your tenant ID in the `BC_API_URL`
- Ensure you're using the correct environment (sandbox vs production)

### Issue 3: "Item not found" errors
**Cause**: SKU doesn't exist in Business Central
**Solution**: 
- The system will automatically fall back to G/L Account
- Update `BC_DEFAULT_ITEM_ID` to a valid item number in your BC environment
- Or ensure `BC_DEFAULT_GL_ACCOUNT` is a valid G/L account

### Issue 4: Company ID not auto-detected
**Cause**: Multiple companies in BC environment
**Solution**: 
- Check the logs to see available companies
- Manually set `BC_COMPANY_ID` in .env to the desired company GUID

## Security Best Practices

1. **Never commit .env file**: Ensure `.env` is in your `.gitignore`
2. **Use environment-specific keys**: Use different keys for development, staging, and production
3. **Rotate keys regularly**: Regenerate web service access keys periodically
4. **Limit permissions**: Use a BC user with minimum required permissions for API access

## Monitoring & Logging

The system provides detailed logging for debugging:

- ✅ Success operations (green checkmarks)
- ⚠️ Warnings (yellow warnings)
- ❌ Errors (red X marks)
- 🔄 Retry attempts
- 📊 Statistics and summaries

Check your application logs for detailed sync information.

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orders/test-bc-connection` | GET | Test BC connection |
| `/api/orders/sync-stats` | GET | Get sync statistics |
| `/api/orders/:id/sync` | POST | Manually sync/retry an order |
| `/api/orders/stats` | GET | Get general order statistics |
| `/api/orders/:id` | GET | Get order details including BC sync status |

## Next Steps

1. ✅ Configure your `.env` file with BC credentials
2. ✅ Test the connection using `/api/orders/test-bc-connection`
3. ✅ Send a test email to trigger order creation
4. ✅ Monitor the sync status in logs and via `/api/orders/sync-stats`
5. ✅ Verify the order appears in Business Central

## Support

If you encounter issues:
1. Check the application logs for detailed error messages
2. Verify all environment variables are correctly set
3. Test the BC connection endpoint
4. Review the sync stats to identify patterns in failures
