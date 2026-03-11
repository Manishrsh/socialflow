# n8n Integration Guide for WareChat Pro

This guide explains how to set up and use n8n with WareChat Pro for WhatsApp automation using the n8n-nodes-warecover-1 package.

## Overview

WareChat Pro integrates with n8n to provide powerful workflow automation capabilities for WhatsApp messaging. The integration allows you to:

- Trigger automated workflows when customers send messages
- Send WhatsApp messages through n8n workflows
- Execute complex business logic and data transformations
- Integrate with 350+ external services
- Store customer data and manage conversations

## Architecture

The integration uses a webhook-based communication model:

```
WhatsApp Message → WareChat → n8n Webhook → Workflow Execution → n8n Webhook Response → WareChat Updates
```

### Data Flow

1. **Incoming Message**: Customer sends WhatsApp message
2. **Webhook Reception**: n8n receives message via n8n-nodes-warecover-1 WhatsApp node
3. **Workflow Processing**: n8n executes the configured workflow
4. **Response Webhook**: Workflow sends results back to WareChat webhook
5. **Database Update**: WareChat updates customer info, saves messages, executes actions

## Setup Instructions

### Step 1: Install n8n

Choose one of these options:

**Option A: n8n Cloud** (Recommended for beginners)
- Visit https://n8n.cloud
- Sign up for a free account
- Your instance URL will be provided

**Option B: Self-hosted**
```bash
npm install -g n8n
n8n start
# Access at http://localhost:5678
```

### Step 2: Install n8n-nodes-warecover-1

In your n8n instance, install the custom node package:

1. Go to Settings → Community Nodes
2. Click "Install a community node"
3. Enter: `n8n-nodes-warecover-1`
4. Click Install

Or via command line:
```bash
npm install n8n-nodes-warecover-1
```

### Step 3: Configure in WareChat

1. Go to Dashboard → Settings → Integrations
2. Click "Configure" on the n8n card
3. Enter your n8n details:
   - **API URL**: Your n8n instance URL (e.g., https://n8n.example.com/api/v1)
   - **API Key**: Your n8n API key
4. Click "Test Connection" to verify

### Step 4: Create n8n Workflow

#### Basic WhatsApp Bot Workflow

1. In n8n, create a new workflow
2. Add a "Webhook" trigger node (set to POST)
3. Add the WareChat Webhook node from n8n-nodes-warecover-1:
   ```
   - Trigger Type: Message Received
   - Configure webhooks to use WareChat webhook URL
   ```
4. Add a "Send WhatsApp Message" node:
   ```
   - Message: {{ $node.["Webhook"].json.body.message }}
   - To: {{ $node.["Webhook"].json.body.customerPhone }}
   ```
5. Add a "Webhook Response" node pointing to WareChat:
   ```
   - URL: Your configured webhook URL
   - Method: POST
   - Body: Results from workflow
   ```

#### Example: Customer Service Bot

```json
{
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-warecover-1.webhookTrigger",
      "parameters": {
        "triggerType": "messageReceived"
      }
    },
    {
      "name": "Process Message",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "return [{json: {message: 'Thanks for contacting us!', action: 'save_contact'}}]"
      }
    },
    {
      "name": "Send Response",
      "type": "n8n-nodes-warecover-1.sendMessage",
      "parameters": {
        "phone": "{{ $node.Trigger.json.customerPhone }}",
        "message": "{{ $node['Process Message'].json.message }}"
      }
    },
    {
      "name": "Update WareChat",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{ env.WARECHAT_WEBHOOK_URL }}",
        "method": "POST",
        "body": {
          "customerId": "{{ $node.Trigger.json.customerId }}",
          "action": "{{ $node['Process Message'].json.action }}",
          "message": "{{ $node['Send Response'].json.messageId }}"
        }
      }
    }
  ]
}
```

## API Reference

### Webhook Payload Structure

**Request to WareChat Webhook**:
```json
{
  "workflowId": "workflow-123",
  "customerId": "customer-456",
  "customerPhone": "+1234567890",
  "message": "User message content",
  "messageType": "text|image|video|document",
  "mediaUrl": "https://...",
  "action": "send_message|save_contact|add_tag|create_order",
  "metadata": {
    "key": "value"
  }
}
```

**Webhook URL**: `{YOUR_WARECHAT_DOMAIN}/api/n8n/webhook`

### Supported Actions

#### 1. Send Message
```json
{
  "action": "send_message",
  "message": "Hello!",
  "customerPhone": "+1234567890"
}
```

#### 2. Save Contact
```json
{
  "action": "save_contact",
  "metadata": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### 3. Add Tag
```json
{
  "action": "add_tag",
  "metadata": {
    "tag": "vip"
  }
}
```

#### 4. Create Order
```json
{
  "action": "create_order",
  "metadata": {
    "orderData": {
      "items": ["diamond-ring-001"],
      "total": 5000,
      "currency": "USD"
    }
  }
}
```

## Advanced Features

### Conditional Routing

Use n8n's "Switch" node to route messages based on content:

```
if message contains "price" → Send product catalog
if message contains "order" → Create order workflow
else → Send to support team
```

### Integration with Google Sheets

Add a Google Sheets node to log all conversations:

```
- Sheet: WareChat Conversations
- Append row with: CustomerName, Phone, Message, Timestamp
```

### Database Sync

Use the Database node to:
- Fetch customer history
- Update inventory
- Track sales metrics

## Troubleshooting

### Webhook Not Receiving Data
- Check firewall/CORS settings
- Verify webhook URL is accessible
- Test with: `curl -X POST https://your-domain.com/api/n8n/webhook -H "Content-Type: application/json" -d '{"test": true}'`

### Authentication Failed
- Verify API key is correct
- Check API key permissions in n8n
- Test connection in WareChat integrations settings

### Messages Not Sending
- Confirm WhatsApp Business Account is configured
- Check n8n-nodes-warecover-1 credentials
- Review n8n execution logs

## Security Considerations

1. **API Key**: Keep your API key secret, never commit to version control
2. **Webhook Verification**: Always verify webhook signatures
3. **Rate Limiting**: n8n has rate limits, implement backoff strategies
4. **Data Privacy**: Ensure compliance with WhatsApp privacy policies

## Support

For issues with:
- **WareChat**: Contact support@warechat.com
- **n8n**: https://community.n8n.io
- **n8n-nodes-warecover-1**: Check package documentation

## Resources

- n8n Documentation: https://docs.n8n.io
- n8n Community: https://community.n8n.io
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp
