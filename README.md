# WareChat Pro - WhatsApp Automation for Jewelry Shops

Professional WhatsApp automation platform built for jewelry businesses. Automate customer engagement, manage orders, and grow your business with powerful WhatsApp workflows powered by n8n integration.

## Features

### 🤖 Intelligent Automation
- **Visual Workflow Builder**: Drag-and-drop interface with 18+ node types
- **n8n Integration**: Connect with 350+ apps and services
- **Smart Triggers**: Message triggers, keywords, webhooks, and schedules
- **Advanced Logic**: Conditions, delays, splits, and loops
- **Auto-responses**: Intelligent message handling and routing

### 👥 Customer Management
- **Customer Database**: Organize contacts with tags and metadata
- **Contact Segmentation**: Target specific customer groups
- **Conversation History**: Full message history and interaction tracking
- **Customer Profiles**: Detailed information and engagement metrics
- **Tag-based Filtering**: Easy customer organization and search

### 📊 Analytics & Insights
- **Real-time Dashboard**: Track key performance metrics
- **Message Analytics**: Monitor message types and trends
- **Engagement Metrics**: Measure customer interaction rates
- **Performance Reports**: Daily, weekly, and monthly analytics
- **Smart Recommendations**: AI-powered insights for optimization

### 💬 Communication
- **WhatsApp Messaging**: Direct integration with WhatsApp Business API
- **Broadcast Campaigns**: Send messages to multiple customers
- **Rich Media Support**: Images, videos, documents, and more
- **Message Scheduling**: Schedule broadcasts for optimal engagement
- **Message Templates**: Pre-built templates for common scenarios

### 🔐 Security & Reliability
- **Enterprise Authentication**: Secure JWT-based auth with bcrypt hashing
- **Database Security**: Parameterized queries and RLS policies
- **HTTPS Encryption**: All data in transit is encrypted
- **Backup & Recovery**: Automated database backups
- **Audit Logging**: Track all important actions

### 🎨 Modern UI/UX
- **Responsive Design**: Works perfectly on desktop and mobile
- **Dark Mode Support**: Easy on the eyes in any lighting
- **Intuitive Navigation**: Clean, organized dashboard
- **Real-time Updates**: Live data without page refreshes
- **Beautiful Charts**: Interactive data visualization

## Tech Stack

### Frontend
- **Next.js 16**: React framework with App Router
- **React 19**: Modern UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first styling
- **React Flow**: Visual workflow builder
- **Recharts**: Data visualization
- **shadcn/ui**: Accessible UI components
- **SWR**: Data fetching and caching

### Backend
- **Next.js API Routes**: Serverless functions
- **Node.js**: JavaScript runtime
- **Express.js**: API routing (optional for standalone)
- **JWT**: Token-based authentication
- **bcrypt**: Password hashing

### Database
- **PostgreSQL**: Relational database
- **Neon**: Serverless PostgreSQL provider
- **SQL**: Parameterized queries for security

### Integrations
- **n8n**: Workflow automation platform
- **n8n-nodes-warecover-1**: Custom WhatsApp nodes
- **WhatsApp Business API**: Official messaging platform
- **Google Sheets API**: Data integration
- **Webhooks**: Custom integrations

## Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm or pnpm
- PostgreSQL database (local or cloud)
- n8n instance or n8n Cloud account

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/warechat-pro.git
   cd warechat-pro
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Initialize database**
   ```bash
   npm run db:migrate
   # or manually
   node scripts/init-db.js
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   - Navigate to http://localhost:3000
   - Default credentials: test@example.com / password123

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/warechat

# Authentication
STACK_SECRET_SERVER_KEY=your-secret-key-minimum-32-characters

# n8n Integration
N8N_API_URL=http://localhost:5678/api/v1
N8N_API_KEY=your-n8n-api-key
N8N_WEBHOOK_URL=http://localhost:3000/api/n8n/webhook

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

## Project Structure

```
warechat-pro/
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── customers/       # Customer management
│   │   ├── workflows/       # Workflow operations
│   │   ├── messages/        # Message handling
│   │   ├── media/           # Media upload/storage
│   │   ├── analytics/       # Analytics endpoints
│   │   ├── integrations/    # Third-party integrations
│   │   └── n8n/             # n8n webhook receiver
│   ├── dashboard/           # Dashboard pages
│   │   ├── page.tsx         # Dashboard home
│   │   ├── automation/      # Automation builder
│   │   ├── customers/       # Customer management
│   │   ├── messages/        # Message inbox
│   │   ├── broadcasts/      # Broadcast campaigns
│   │   ├── media/           # Media library
│   │   ├── analytics/       # Analytics dashboard
│   │   ├── integrations/    # Integration settings
│   │   └── settings/        # User settings
│   ├── login/               # Login page
│   ├── register/            # Registration page
│   ├── page.tsx             # Landing page
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── workflow-nodes.tsx   # React Flow node types
│   └── workflow-builder.tsx # Main builder component
├── lib/
│   ├── db.ts                # Database utilities
│   ├── auth.ts              # Authentication utilities
│   ├── auth-context.tsx     # Auth context provider
│   ├── workflow-nodes.ts    # Workflow node definitions
│   └── n8n-service.ts       # n8n integration service
├── scripts/
│   ├── init-db.js           # Database initialization
│   └── 01-create-schema.sql # Database schema
├── docs/
│   ├── N8N_INTEGRATION.md   # n8n setup guide
│   └── API.md               # API documentation
├── public/                  # Static assets
├── DEPLOYMENT.md            # Production deployment guide
├── README.md                # This file
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.example             # Environment variables template
```

## Database Schema

### Main Tables
- **users**: User accounts and profiles
- **workspaces**: User workspaces
- **customers**: Customer contact database
- **messages**: All incoming and outgoing messages
- **workflows**: Automation workflows
- **media**: Uploaded media files
- **orders**: Customer orders (optional)

### Key Relationships
```
Users
  ↓ (owns)
Workspaces
  ↓ (contains)
├─ Customers
├─ Workflows
├─ Messages
└─ Media
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user info

### Workflows
- `GET /api/workflows/list` - List workflows
- `POST /api/workflows/create` - Create workflow
- `GET /api/workflows/[id]` - Get workflow details
- `PUT /api/workflows/[id]` - Update workflow
- `DELETE /api/workflows/[id]` - Delete workflow
- `GET /api/workflows/templates` - Workflow templates

### Customers
- `GET /api/customers/list` - List customers
- `POST /api/customers/create` - Add customer
- `GET /api/customers/[id]` - Customer details

### Messages
- `GET /api/messages/list` - Message history
- `POST /api/messages/send` - Send message

### Media
- `GET /api/media/list` - List media
- `POST /api/media/upload` - Upload file

### Analytics
- `GET /api/analytics/summary` - Analytics overview

### n8n Integration
- `POST /api/n8n/webhook` - Webhook receiver
- `POST /api/integrations/n8n/test` - Test connection

## Usage Guide

### Creating Your First Automation

1. Go to Dashboard → Automation Builder
2. Click "New Workflow"
3. Drag and drop nodes to create workflow
4. Connect nodes with edges
5. Configure each node settings
6. Click "Save Workflow"
7. Enable workflow to start using it

### Adding Customers

1. Go to Dashboard → Customers
2. Click "Add Customer"
3. Enter customer name and phone number
4. Add optional tags for segmentation
5. Click "Add Customer"

### Sending Broadcasts

1. Go to Dashboard → Broadcasts
2. Click "New Broadcast"
3. Enter message content
4. Select target audience by tag
5. Schedule or send immediately
6. Monitor delivery in analytics

### Managing Media

1. Go to Dashboard → Media Library
2. Click "Upload Media"
3. Select file from your computer
4. Add title and description
5. Use media in messages and broadcasts

## Best Practices

### Workflow Design
- Start with a clear trigger event
- Use delays to avoid overwhelming customers
- Implement conditional logic for personalization
- Test workflows before going live
- Monitor workflow performance

### Customer Management
- Keep customer data clean and updated
- Use tags for better segmentation
- Regular cleanup of inactive contacts
- Implement privacy best practices

### Message Strategy
- Use personalization with customer names
- Send messages during business hours
- Avoid overloading with too many messages
- Test message variations
- Monitor engagement metrics

### Security
- Never share API keys
- Keep database credentials secret
- Use HTTPS in production
- Implement rate limiting
- Regular security audits

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Check DATABASE_URL is correct
- Verify database is running
- Check firewall rules

**Authentication Issues**
- Clear browser cookies
- Check STACK_SECRET_SERVER_KEY is set
- Verify JWT token expiration

**Workflow Not Triggering**
- Check workflow is enabled
- Verify trigger configuration
- Check n8n webhook URL is accessible

**Messages Not Sending**
- Verify WhatsApp credentials
- Check n8n-nodes-warecover-1 installation
- Review n8n execution logs

## Performance Optimization

- Database queries optimized with indexes
- API responses cached with SWR
- Images optimized with Next.js Image
- Code splitting for faster page loads
- Database connection pooling
- Workflow execution caching

## Support & Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [n8n Integration Guide](./docs/N8N_INTEGRATION.md)
- [API Documentation](./docs/API.md)
- [n8n Documentation](https://docs.n8n.io)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

## Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

## License

MIT License - See LICENSE file for details

## Roadmap

- [ ] SMS support in addition to WhatsApp
- [ ] AI-powered message recommendations
- [ ] Advanced customer segmentation
- [ ] Integration with CRM systems
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Advanced reporting and BI tools
- [ ] Predictive analytics
- [ ] API rate limiting improvements
- [ ] Team collaboration features

## Contact & Support

- **Email**: support@warechat.com
- **Website**: https://warechat.com
- **GitHub**: https://github.com/your-org/warechat-pro
- **Issues**: GitHub Issues for bug reports

## Acknowledgments

Built with Next.js, React, Neon, and n8n. Special thanks to all contributors and the open-source community.
