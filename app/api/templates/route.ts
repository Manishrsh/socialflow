import { NextResponse } from 'next/server';
import { ensureCoreSchema, sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');

        if (!workspaceId) {
            return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
        }

        await ensureCoreSchema();

        // Verify workspace access (simplified check, usually we'd verify owner/member)
        const workspaces = await sql`
      SELECT id FROM workspaces 
      WHERE id = ${workspaceId} AND owner_id = ${session.userId}
    `;

        if (workspaces.length === 0) {
            return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 });
        }

        const templates = await sql`
      SELECT id, name, language, category, components, status, created_at, updated_at
      FROM whatsapp_templates
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
    `;

        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('Error fetching templates:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { workspaceId, name, language, category, components } = body;

        if (!workspaceId || !name || !language || !components) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await ensureCoreSchema();

        // Verify workspace access
        const workspaces = await sql`
      SELECT id FROM workspaces 
      WHERE id = ${workspaceId} AND owner_id = ${session.userId}
    `;

        if (workspaces.length === 0) {
            return NextResponse.json({ error: 'Workspace not found or unauthorized' }, { status: 404 });
        }

        // Fetch user's Meta App to get WABA ID and Access Token
        const metaApps = await sql`
            SELECT business_id, whatsapp_access_token 
            FROM meta_apps 
            WHERE workspace_id = ${workspaceId} AND is_default = true
            LIMIT 1
        `;

        let wabaId = null;
        let token = null;

        if (metaApps.length > 0 && metaApps[0].business_id && metaApps[0].whatsapp_access_token) {
            wabaId = metaApps[0].business_id;
            token = metaApps[0].whatsapp_access_token;
        } else if (process.env.META_WHATSAPP_WABA_ID && process.env.META_WHATSAPP_ACCESS_TOKEN) {
             wabaId = process.env.META_WHATSAPP_WABA_ID;
             token = process.env.META_WHATSAPP_ACCESS_TOKEN;
             console.log('Using Meta credentials from environment variables as fallback.');
        }

        let initialStatus = 'PENDING';

        if (wabaId && token) {
            // Format components for Meta API
            const metaComponents = components.map((comp: any) => {
                const formattedComp: any = { type: comp.type };
                if (comp.format) formattedComp.format = comp.format;
                if (comp.text) formattedComp.text = comp.text;
                if (comp.buttons) formattedComp.buttons = comp.buttons;
                return formattedComp;
            });

            // Send to Meta Graph API
            const graphRes = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/message_templates`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    language,
                    category: category || 'MARKETING',
                    components: metaComponents
                })
            });

            const graphData = await graphRes.json();

            if (!graphRes.ok) {
                console.error('Meta API Error:', graphData);
                return NextResponse.json({ error: graphData.error?.message || 'Failed to sync template to Meta' }, { status: 400 });
            }
            
            initialStatus = graphData.status || 'PENDING';
        } else {
             return NextResponse.json({ error: 'No Meta App configured. Please connect your WhatsApp Business Account first.' }, { status: 400 });
        }

        const newTemplate = await sql`
      INSERT INTO whatsapp_templates (
        workspace_id, name, language, category, components, status
      ) VALUES (
        ${workspaceId}, ${name}, ${language}, ${category || 'MARKETING'}, ${JSON.stringify(components)}::jsonb, ${initialStatus}
      )
      RETURNING id, name, language, category, components, status, created_at, updated_at
    `;

        return NextResponse.json({ template: newTemplate[0] }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating template:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
