# WareChat Pro - Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment (1-2 weeks before)

### Planning & Architecture
- [ ] Define deployment strategy (blue-green, rolling, etc.)
- [ ] Plan database migration schedule
- [ ] Review security requirements
- [ ] Plan rollback strategy
- [ ] Document all custom configurations
- [ ] Schedule deployment window (off-peak hours)

### Testing
- [ ] Run full test suite locally: `npm run test`
- [ ] Test authentication flow (login, register, logout)
- [ ] Test all API endpoints
- [ ] Test workflow creation and execution
- [ ] Test n8n webhook integration
- [ ] Test customer management features
- [ ] Test media upload functionality
- [ ] Test analytics data collection
- [ ] Test error handling and edge cases
- [ ] Load test with expected traffic volume
- [ ] Security audit and penetration testing

### Documentation
- [ ] Update README.md with latest info
- [ ] Document environment variables
- [ ] Create runbooks for common issues
- [ ] Document backup/restore procedures
- [ ] Create monitoring dashboards
- [ ] Document support process

## Infrastructure Setup (1 week before)

### Vercel Account Setup
- [ ] Create production Vercel project
- [ ] Configure domain name and SSL
- [ ] Set up Git integration
- [ ] Enable auto-deployments on main branch
- [ ] Configure environment variables
- [ ] Set up Vercel monitoring
- [ ] Enable security headers

### Database Setup
- [ ] Create Neon PostgreSQL project
- [ ] Configure connection pooling
- [ ] Set up automated backups
- [ ] Configure security groups
- [ ] Create read-only user for analytics
- [ ] Test connection from Vercel
- [ ] Document backup retention policy

### n8n Setup
- [ ] Deploy n8n (Cloud or self-hosted)
- [ ] Configure n8n API key
- [ ] Install n8n-nodes-warecover-1 package
- [ ] Create test workflows
- [ ] Configure webhook endpoints
- [ ] Test webhook connections
- [ ] Set up n8n monitoring

### WhatsApp Business Account
- [ ] Register WhatsApp Business Account
- [ ] Verify phone number
- [ ] Get Phone Number ID and Business Account ID
- [ ] Configure webhook settings
- [ ] Test message sending
- [ ] Set up phone number restrictions
- [ ] Plan message template strategy

## Final Verification (1 day before)

### Code & Dependencies
- [ ] All code committed to main branch
- [ ] No console.log statements left (except errors)
- [ ] No sensitive data in code
- [ ] Dependencies up-to-date
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

### Configuration
- [ ] All environment variables set in Vercel
- [ ] DATABASE_URL correctly configured
- [ ] N8N_API_KEY securely stored
- [ ] STACK_SECRET_SERVER_KEY is strong (32+ chars)
- [ ] NEXT_PUBLIC_BASE_URL set to production domain
- [ ] NODE_ENV set to "production"
- [ ] All secret keys are different from development

### Database
- [ ] Database backed up
- [ ] All migrations tested locally
- [ ] Schema verified
- [ ] Indexes created
- [ ] Connection pooling configured
- [ ] Backup retention policy set
- [ ] Restore procedure tested

### Monitoring & Logging
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Logging aggregation configured
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring configured
- [ ] Alert thresholds set
- [ ] On-call rotation configured
- [ ] Incident response plan ready

### Security
- [ ] SSL certificate valid
- [ ] CORS properly configured
- [ ] API rate limiting enabled
- [ ] Input validation tested
- [ ] SQL injection protection verified
- [ ] XSS protection enabled
- [ ] CSRF tokens configured
- [ ] Security headers set

## Deployment Day

### Pre-Deployment
- [ ] All team members notified
- [ ] Incident commander assigned
- [ ] War room setup (Slack channel, Zoom)
- [ ] Rollback plan reviewed
- [ ] Current production state documented
- [ ] Database backup taken
- [ ] Deployment script tested in staging

### Deployment Steps
1. [ ] Merge code to main branch
2. [ ] Monitor Vercel build progress
3. [ ] Wait for build to complete successfully
4. [ ] Run database migrations if needed
5. [ ] Monitor error logs for first 5 minutes
6. [ ] Run smoke tests:
   - [ ] Login/register works
   - [ ] Dashboard loads
   - [ ] API endpoints responding
   - [ ] Database queries working
   - [ ] n8n webhooks accessible
7. [ ] Test core user flows
8. [ ] Monitor analytics for anomalies
9. [ ] Verify all services healthy

### Post-Deployment (immediate)
- [ ] Check Vercel deployment status
- [ ] Monitor error rates
- [ ] Check database performance
- [ ] Verify n8n connections
- [ ] Test customer-facing features
- [ ] Monitor user reports
- [ ] Check payment systems (if any)
- [ ] Verify email notifications
- [ ] Confirm no critical errors

## Post-Deployment (First 24 Hours)

### Monitoring
- [ ] Monitor error logs continuously
- [ ] Check performance metrics
- [ ] Verify analytics data collection
- [ ] Monitor database performance
- [ ] Check n8n execution logs
- [ ] Monitor API response times
- [ ] Check for security issues

### User Communication
- [ ] Send deployment notification to users
- [ ] Monitor support channels
- [ ] Be ready for issues/bugs
- [ ] Gather user feedback
- [ ] Update status page
- [ ] Create incident reports if needed

### Verification Tasks
- [ ] Test all major features
- [ ] Verify analytics data
- [ ] Check customer management
- [ ] Test workflow execution
- [ ] Verify media uploads
- [ ] Test broadcasts
- [ ] Check message delivery

### Performance Validation
- [ ] API response times acceptable
- [ ] Database performance good
- [ ] No memory leaks
- [ ] No unexpected errors
- [ ] Server load normal
- [ ] Webhook processing on time

## Post-Deployment (After 24 Hours)

### Analysis
- [ ] Review deployment metrics
- [ ] Analyze user behavior changes
- [ ] Check for any performance degradation
- [ ] Review error logs for patterns
- [ ] Analyze cost implications
- [ ] Document lessons learned

### Optimization
- [ ] Optimize slow queries if found
- [ ] Adjust caching strategies if needed
- [ ] Fine-tune database indexes
- [ ] Optimize API performance
- [ ] Review and adjust monitoring alerts

### Documentation
- [ ] Update deployment documentation
- [ ] Document any issues encountered
- [ ] Create post-mortem if issues occurred
- [ ] Update runbooks with new learnings
- [ ] Archive deployment notes

## Rollback Procedures

### If Critical Issues Arise
1. [ ] Declare incident
2. [ ] Notify all stakeholders
3. [ ] Stop accepting new traffic (if needed)
4. [ ] Restore from last good database backup
5. [ ] Revert code to previous version
6. [ ] Test rolled-back version
7. [ ] Monitor for issues

### Rollback Steps
```bash
# If using Vercel Git integration
git revert <commit-hash>
git push origin main

# Or redeploy previous version from Vercel dashboard
# Go to Deployments → Select previous deployment → Promote to Production
```

### Post-Rollback
- [ ] Verify all systems working
- [ ] Communicate with users
- [ ] Review what went wrong
- [ ] Plan fixes
- [ ] Schedule re-deployment

## Ongoing Maintenance

### Daily
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Review user reports

### Weekly
- [ ] Analyze analytics trends
- [ ] Review security logs
- [ ] Check database health
- [ ] Verify backups completed

### Monthly
- [ ] Security audit
- [ ] Dependency updates
- [ ] Database maintenance
- [ ] Cost analysis
- [ ] Capacity planning

### Quarterly
- [ ] Full security review
- [ ] Load testing
- [ ] Disaster recovery drill
- [ ] Architecture review
- [ ] Update runbooks

## Emergency Contacts

- **Tech Lead**: 
- **Database Admin**: 
- **DevOps Engineer**: 
- **Security Officer**: 
- **Incident Commander**: 
- **Support Lead**: 

## Useful Commands

```bash
# Build locally
npm run build

# Run tests
npm run test

# Type check
npm run type-check

# Lint code
npm run lint

# Check for vulnerabilities
npm audit

# Database operations
node scripts/init-db.js
psql $DATABASE_URL

# Check deployment logs (Vercel)
vercel logs --prod

# Monitor real-time
vercel deploy --prod
```

## Support Links

- Vercel Dashboard: https://vercel.com/dashboard
- Neon Console: https://console.neon.tech
- n8n Dashboard: https://your-n8n-instance.com
- GitHub Repository: https://github.com/your-org/warechat-pro
- Documentation: https://docs.warechat.com

---

**Last Updated**: March 2026
**Next Deployment**: [Date]
**Deployment Owner**: [Name]
