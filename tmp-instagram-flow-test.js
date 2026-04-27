const https = require('https');
const fs = require('fs');

// Load .env
const envFile = '.env';
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!key) continue;
    const value = rest.join('=').trim();
    if (value && !process.env[key]) {
      process.env[key] = value.replace(/^['\"]|['\"]$/g, '');
    }
  }
}

const BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v19.0';

if (!ACCESS_TOKEN || !BUSINESS_ACCOUNT_ID) {
  console.error('Missing credentials');
  process.exit(1);
}

console.log(`\n📸 Instagram API Test Flow\n`);
console.log(`Account ID: ${BUSINESS_ACCOUNT_ID}`);
console.log(`API Version: ${API_VERSION}`);
console.log(`Token: ${ACCESS_TOKEN.substring(0, 20)}...${ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 10)}`);

// Use a simple publicly accessible image
const imageUrl = 'https://scontent.cdninstagram.com/v/t51.29350-15/267761866_371725811348208_6879226863152651892_n.jpg?stp=dst-jpg_e35_s1080x1080&_nc_ht=scontent.cdninstagram.com&_nc_cat=1&_nc_ohc=N3F_jIIHgAOdL_5KKJHs4pTlVnAT6TbqKnvnYHg-QXE&_nc_gid=AdRhyYQJVbI&edm=ALQROFkBAAAA&ccb=7-5&oh=00_AYALwYpJKLhYnx2UBYZoJzNjVzNjVnAT6TbqKnvnYHg-QXE&oe=67B5E5F0&_nc_sid=8ae9d6';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://graph.instagram.com${path}`);
    url.searchParams.append('access_token', ACCESS_TOKEN);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // First, let's test the token by getting account info
    console.log(`\n🔍 Verifying access token...`);
    const meRes = await makeRequest('GET', `/${API_VERSION}/${BUSINESS_ACCOUNT_ID}?fields=id,name,username`);
    console.log(`Status: ${meRes.status}`);
    if (meRes.status === 200) {
      console.log(`✅ Token is valid - Account: ${meRes.data.username || meRes.data.name}`);
    } else {
      console.log(`❌ Token validation failed:`, meRes.data.error?.message);
      process.exit(1);
    }

    // Step 1: Create media container
    console.log(`\n📤 Step 1: Create media container...`);
    const createRes = await makeRequest('POST', `/${API_VERSION}/${BUSINESS_ACCOUNT_ID}/media`, {
      image_url: imageUrl,
      caption: '1st Anniversary\nCelebrating with Test Business'
    });
    
    console.log(`Status: ${createRes.status}`);
    console.log(`Response:`, JSON.stringify(createRes.data, null, 2));

    if (createRes.status !== 200 || !createRes.data.id) {
      console.error('❌ Failed to create media container');
      if (createRes.data.error) {
        console.error('Error:', createRes.data.error.message);
      }
      process.exit(1);
    }

    const creationId = createRes.data.id;
    console.log(`✅ Container ID: ${creationId}`);

    // Step 2: Publish media
    console.log(`\n📤 Step 2: Publish media...`);
    const publishRes = await makeRequest('POST', `/${API_VERSION}/${BUSINESS_ACCOUNT_ID}/media_publish`, {
      creation_id: creationId
    });

    console.log(`Status: ${publishRes.status}`);
    console.log(`Response:`, JSON.stringify(publishRes.data, null, 2));

    if (publishRes.status !== 200 || !publishRes.data.id) {
      console.error('❌ Failed to publish media');
      if (publishRes.data.error) {
        console.error('Error:', publishRes.data.error.message);
      }
      process.exit(1);
    }

    console.log(`✅ Post ID: ${publishRes.data.id}`);
    console.log(`\n✅ SUCCESS - Full flow completed!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
