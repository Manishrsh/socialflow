# WareChat Pro - Quick Start Guide

## Getting Started

Welcome to WareChat Pro! Here's how to get up and running:

### 1. Access the Application

The app is deployed and accessible at your Vercel URL. Visit the landing page to explore features.

### 2. Create an Account

1. Click "Get Started" button on the homepage
2. Fill in your details (email, password, name, company)
3. Click "Register" to create your account
4. You'll be automatically logged in and redirected to the dashboard

### 3. Login

1. Go to `/login` page
2. Enter your email and password
3. Click "Sign In"
4. You'll be taken to your dashboard

### 4. Explore the Dashboard

Once logged in, you can:

- **Dashboard**: View key metrics and recent activity
- **Automation Builder**: Create WhatsApp workflows (Visual flow with drag-and-drop)
- **Customers**: Manage your customer database
- **Messages**: View conversation history
- **Media Library**: Upload and organize images, videos, documents
- **Broadcasts**: Send campaigns to customer groups
- **Analytics**: Track engagement and performance metrics
- **Settings**: Configure your workspace and integrations

### 5. Create Your First Workflow

1. Navigate to **Automation Builder**
2. Click "Create New Workflow"
3. Add trigger nodes (e.g., "New Message", "Keyword Match")
4. Add action nodes (e.g., "Send Message", "Save Contact")
5. Connect nodes by dragging connectors
6. Click "Save Workflow"

### 6. Set Up WhatsApp Integration (Optional)

1. Go to **Settings > Integrations**
2. Configure your n8n webhook URL
3. Provide your n8n API credentials
4. Test the connection
5. Your workflows will now trigger WhatsApp messages automatically

## Key Features to Try

### Customer Management
- Add customers manually or import from CSV
- Organize customers with tags
- View conversation history for each customer

### Automation Examples
- Auto-reply to incoming messages
- Send product catalogs on keyword match
- Collect customer information via forms
- Route messages based on content
- Send promotional broadcasts

### Analytics
- View message trends and patterns
- Track engagement rates
- Monitor top activities
- Get AI-powered recommendations

## Database Setup (For Full Functionality)

The app uses **Neon PostgreSQL** for data storage. To enable full functionality:

1. Set `DATABASE_URL` environment variable with your Neon connection string
2. Run the database initialization script:
   ```bash
   node scripts/init-db.js
   ```
3. All features will now have full persistence

## Authentication

- Secure JWT-based authentication with HTTP-only cookies
- Passwords are hashed with bcrypt
- Sessions expire after 7 days
- Auto-logout on browser close

## Support

For detailed documentation, see:
- `README.md` - Full feature documentation
- `DEPLOYMENT.md` - Production deployment guide
- `docs/N8N_INTEGRATION.md` - n8n integration setup
- `DEPLOYMENT_CHECKLIST.md` - Pre-deployment checklist

## Troubleshooting

### "Database not configured" message
The app can still be used without a database. User accounts won't persist across restarts.

### Workflows not triggering
Make sure your n8n webhook URL is configured in Settings > Integrations.

### Can't login
Check that you registered an account first at `/register`.

---

Enjoy using WareChat Pro!
