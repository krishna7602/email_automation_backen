# ✅ Business Central Integration - Setup Checklist

## 🎯 Quick Setup Checklist (Follow in Order)

### Phase 1: Verify Configuration ✅

- [x] **Business Central service enhanced** with retry logic and error handling
- [x] **Order model updated** with sync tracking fields
- [x] **API endpoints added** for testing and monitoring
- [x] **.env file configured** with BC credentials
- [x] **Documentation created** (3 comprehensive guides)
- [x] **Test script created** for validation

### Phase 2: Your Action Items 🔧

#### ☐ Step 1: Verify Your Credentials (2 minutes)

Open `.env` file and verify:
```env
BC_USERNAME=pradip@careerfy.ai          # ← Your BC email
BC_PASSWORD=gothaM#181231               # ← Your Web Service Access Key
BC_API_URL=https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0
DISABLE_BC_SYNC=false                   # ← MUST be 'false' to enable sync
```

**Action Required:**
- [ ] Verify `BC_USERNAME` is correct
- [ ] Verify `BC_PASSWORD` is your current Web Service Access Key
- [ ] Ensure `DISABLE_BC_SYNC=false` (sync is enabled)

#### ☐ Step 2: Restart Your Server (1 minute)

The server needs to reload the new configuration:

```bash
# Stop the current server (Ctrl+C in the terminal running npm run dev)
# Then restart:
cd d:\emai_automation_system\email_automation
npm run dev
```

**Expected Output:**
```
✅ Business Central sync is ENABLED
🏢 Company ID: AUTO-DETECT
```

#### ☐ Step 3: Test the Connection (2 minutes)

**Option A: Using Test Script (Recommended)**
```bash
cd d:\emai_automation_system\email_automation
node scripts\test-bc-integration.js
```

**Expected Output:**
```
✅ Configuration is valid
✅ Connection successful!
🏢 Company ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Option B: Using API Endpoint**
```bash
GET http://localhost:3000/api/orders/test-bc-connection
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "companyId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "companies": [...]
  }
}
```

**Action Required:**
- [ ] Run test script OR call API endpoint
- [ ] Verify connection is successful
- [ ] Note the Company ID (will be auto-used)

#### ☐ Step 4: Test with Real Email (5 minutes)

Send a test email with order information to your configured email address.

**What Should Happen:**
1. Email is received and parsed
2. AI extracts order details
3. Order is created in database
4. **Automatic BC sync starts** (check logs)
5. Order appears in Business Central

**Check Logs For:**
```
✅ Business Central sync is ENABLED
🔄 Sync attempt 1/3
✅ Found existing customer: [Customer Name]
📝 Creating sales order header...
✅ Sales order header created
📦 Adding line item 1/X
✅ Line item 1 added successfully
✅ Order successfully synced to Business Central
```

**Action Required:**
- [ ] Send test email
- [ ] Check application logs
- [ ] Verify order in Business Central
- [ ] Check sync status via API

#### ☐ Step 5: Monitor Sync Status (Ongoing)

Use these endpoints to monitor:

```bash
# Get sync statistics
GET http://localhost:3000/api/orders/sync-stats

# Get all orders
GET http://localhost:3000/api/orders

# Get specific order
GET http://localhost:3000/api/orders/:orderId
```

**Action Required:**
- [ ] Check sync stats regularly
- [ ] Monitor for failed orders
- [ ] Retry failed orders if needed

### Phase 3: Troubleshooting (If Needed) 🔧

#### Issue: Connection Test Fails

**Symptoms:**
- Test script shows "❌ Connection failed"
- API returns 401 or 404 error

**Solutions:**
1. [ ] Verify `BC_USERNAME` is correct
2. [ ] Regenerate Web Service Access Key in BC
3. [ ] Update `BC_PASSWORD` in .env
4. [ ] Verify `BC_API_URL` matches your environment
5. [ ] Restart server after changes

#### Issue: Orders Not Syncing

**Symptoms:**
- Orders stuck in "pending" status
- No BC sync logs appearing

**Solutions:**
1. [ ] Check `DISABLE_BC_SYNC=false` in .env
2. [ ] Restart server
3. [ ] Check application logs for errors
4. [ ] Run test script to verify connection
5. [ ] Manually retry: `POST /api/orders/:id/sync`

#### Issue: "Item not found" Errors

**Symptoms:**
- Logs show "⚠️ Item line failed"
- Some items not appearing in BC order

**Solutions:**
1. [ ] System automatically falls back to G/L Account
2. [ ] Update `BC_DEFAULT_ITEM_ID` to valid item in your BC
3. [ ] Verify `BC_DEFAULT_GL_ACCOUNT` is valid
4. [ ] Check BC logs for specific item errors

### Phase 4: Optimization (Optional) ⚙️

#### Adjust Retry Settings

If you experience network issues or timeouts:

```env
BC_MAX_RETRIES=5              # Increase retry attempts
BC_RETRY_DELAY_MS=3000        # Increase initial delay
```

#### Customize Item Mapping

Update these to match your BC setup:

```env
BC_DEFAULT_ITEM_ID=1000       # Your default item number
BC_DEFAULT_GL_ACCOUNT=8000    # Your default G/L account
```

#### Production Deployment

When ready for production:

```env
BC_API_URL=https://api.businesscentral.dynamics.com/v2.0/YOUR_TENANT/production/api/v2.0
```

**Action Required:**
- [ ] Update API URL to production
- [ ] Use production credentials
- [ ] Test thoroughly in production
- [ ] Monitor sync stats closely

## 📊 Success Criteria

You'll know everything is working when:

- ✅ Test script shows "✅ Connection successful!"
- ✅ Test email creates order in database
- ✅ Order automatically syncs to BC
- ✅ Logs show "✅ Order successfully synced"
- ✅ Order appears in Business Central
- ✅ Sync stats show orders as "synced"

## 📖 Documentation Reference

| Document | Purpose |
|----------|---------|
| `BC_INTEGRATION_SUMMARY.md` | Complete implementation details |
| `BC_INTEGRATION_README.md` | Quick start guide (5 min) |
| `BUSINESS_CENTRAL_SETUP.md` | Detailed setup instructions |
| `scripts/test-bc-integration.js` | Test script |

## 🆘 Need Help?

### Check These First:
1. Application logs (detailed error messages)
2. Test script output (diagnostic information)
3. Sync stats API (current status)
4. Documentation files (troubleshooting guides)

### Common Commands:
```bash
# Test connection
node scripts\test-bc-integration.js

# Check sync stats
GET http://localhost:3000/api/orders/sync-stats

# Manually retry order
POST http://localhost:3000/api/orders/:orderId/sync

# View order details
GET http://localhost:3000/api/orders/:orderId
```

## 🎉 Final Checklist

Before marking this as complete:

- [ ] Verified BC credentials in .env
- [ ] Restarted server with new configuration
- [ ] Ran test script successfully
- [ ] Sent test email
- [ ] Verified order synced to BC
- [ ] Checked sync statistics
- [ ] Reviewed documentation
- [ ] Know how to monitor and retry

## 🚀 You're Ready!

Once all checkboxes are marked, your Business Central integration is **fully operational** and ready for production use!

**Questions or issues?** Check the documentation or review the application logs for detailed information.
