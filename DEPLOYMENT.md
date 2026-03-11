# WareChat Pro - Production Deployment Guide

This guide covers deploying WareChat Pro to production on Vercel with Neon PostgreSQL.

## Prerequisites

- Vercel account (vercel.com)
- Neon PostgreSQL account (neon.tech)
- n8n instance or n8n Cloud account
- GitHub repository connected to Vercel
- WhatsApp Business Account (for full functionality)

## Architecture Overview

```
Frontend (Next.js 16)
    ↓
Vercel (Deployment)
    ↓
API Routes (Next.js)
    ↓
Neon PostgreSQL (Database)
    ↓
n8n Webhooks (Workflow Execution)
    ↓
WhatsApp Business API
```

## Step-by-Step Deployment

### 1. Database Setup (Neon PostgreSQL)

1. Sign up at neon.tech
2. Create a new project
3. Create a new database
4. Copy the connection string: `postgresql://user:password@host/database`
5. Keep this safe - you'll need it for environment variables

### 2. Environment Variables Setup

Add these environment variables to your Vercel project:

**Database**
```
DATABASE_URL=postgresql://user:password@host/database
```

**Authentication** (keep these secret)
```
STACK_SECRET_SERVER_KEY=your-secret-key-here
```

**n8n Integration**
```
N8N_API_URL=https://your-n8n-instance.com/api/v1
N8N_API_KEY=your-n8n-api-key
N8N_WEBHOOK_URL=https://your-domain.com/api/n8n/webhook
```

**Application**
```
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NODE_ENV=production
```

### 3. Vercel Deployment

**Option A: Git-based Deployment (Recommended)**

1. Push code to GitHub
2. Go to vercel.com and connect your repository
3. Configure environment variables in Vercel dashboard
4. Vercel will automatically deploy on push

**Option B: Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Add environment variables
vercel env add DATABASE_URL
vercel env add N8N_API_KEY
# ... etc
```

### 4. Database Migration

After deployment, run the database initialization:

```bash
# Using Vercel CLI
vercel env pull  # Get environment variables locally

# Run migration
node scripts/init-db.js

# Or use psql directly
psql $DATABASE_URL < scripts/01-create-schema.sql
```

### 5. Configure n8n Webhooks

1. Get your webhook URL from WareChat: `https://your-domain.com/api/n8n/webhook`
2. In n8n, configure webhook nodes with this URL
3. Add custom headers if needed for authentication
4. Test webhook connection in WareChat Settings → Integrations

### 6. WhatsApp Business Setup

1. Create WhatsApp Business Account at facebook.com/business
2. Get your Phone Number ID and Business Account ID
3. Configure in WareChat Settings
4. Set webhook URL in WhatsApp Admin Console to: `https://your-domain.com/api/n8n/webhook`
5. Subscribe to message_status and messages webhooks

## Security Checklist

- [ ] Enable HTTPS (Vercel does this automatically)
- [ ] Store API keys in environment variables only
- [ ] Enable database SSL connections
- [ ] Set up firewall rules for database access
- [ ] Configure CORS properly for your domain
- [ ] Enable rate limiting on API endpoints
- [ ] Implement request validation
- [ ] Use parameterized queries (already done)
- [ ] Enable audit logging in production

## Performance Optimization

### Database
- Enable connection pooling (Neon does this automatically)
- Create indexes on frequently queried columns
- Monitor slow queries
- Archive old messages monthly

### Application
- Enable caching headers
- Compress responses (gzip)
- Optimize images and media
- Use CDN for static assets
- Implement pagination for large datasets

### n8n
- Use execution memory optimization
- Implement workflow timeouts
- Cache API responses
- Monitor webhook response times

## Monitoring & Logging

### Vercel Analytics
- Go to Vercel dashboard → Analytics
- Monitor Core Web Vitals
- Check error rates

### Database Monitoring
```sql
-- Check slow queries
SELECT query, calls, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables ORDER BY pg_total_relation_size DESC;

-- Monitor connections
SELECT datname, count(*) as connections 
FROM pg_stat_activity GROUP BY datname;
```

### Error Tracking
- Set up Sentry or similar error tracking service
- Monitor application logs
- Set up alerts for critical errors

## Scaling Considerations

### Database Scaling
- Increase compute power as needed
- Monitor query performance
- Consider read replicas for analytics
- Implement caching layer (Redis)

### Application Scaling
- Vercel automatically scales with traffic
- Monitor API response times
- Consider API rate limiting
- Implement request queuing for heavy loads

### n8n Scaling
- Use n8n Cloud for automatic scaling
- Implement queue-based message processing
- Monitor workflow execution times

## Maintenance

### Regular Tasks
- **Daily**: Monitor error logs and performance
- **Weekly**: Review analytics and database health
- **Monthly**: Archive old messages, analyze trends
- **Quarterly**: Security audit, dependency updates

### Backup Strategy
```sql
-- Create automated backups (Neon handles this)
-- Restore from backup if needed:
pg_restore --clean --if-exists -d target_db backup.dump
```

### Updates & Upgrades
1. Test updates in development first
2. Use feature flags for gradual rollouts
3. Monitor for regressions
4. Keep dependencies up-to-date

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check environment variable
echo $DATABASE_URL
```

### n8n Webhook Not Receiving Data
- Verify webhook URL is publicly accessible
- Check firewall/CORS settings
- Test webhook with curl:
  ```bash
  curl -X POST https://your-domain.com/api/n8n/webhook \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```

### Authentication Issues
- Verify JWT secret in environment
- Check cookie settings in browser dev tools
- Review auth logs

## Support & Resources

- **WareChat Docs**: https://docs.warechat.com
- **Vercel Docs**: https://vercel.com/docs
- **Neon Docs**: https://neon.tech/docs
- **n8n Docs**: https://docs.n8n.io
- **Next.js Docs**: https://nextjs.org/docs

## Post-Deployment Checklist

- [ ] Verify all environment variables are set
- [ ] Test authentication (login/register)
- [ ] Test workflow creation and execution
- [ ] Test WhatsApp message sending via n8n
- [ ] Verify analytics data collection
- [ ] Test customer management features
- [ ] Check media upload functionality
- [ ] Verify email notifications (if enabled)
- [ ] Test webhook endpoints
- [ ] Monitor error logs for 24 hours
- [ ] Set up monitoring alerts
- [ ] Configure backup schedule
- [ ] Document any custom configurations
