export default function TestPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">WhatsApp SaaS Platform</h1>
        <p className="text-xl text-foreground/60">Successfully Deployed!</p>
        
        <div className="mt-8 space-y-2">
          <p className="text-sm text-foreground/50">Available Pages:</p>
          <ul className="text-left inline-block space-y-1 text-sm">
            <li>• <a href="/" className="text-primary hover:underline">/</a> - Home</li>
            <li>• <a href="/login" className="text-primary hover:underline">/login</a> - Login</li>
            <li>• <a href="/register" className="text-primary hover:underline">/register</a> - Register</li>
            <li>• <a href="/dashboard" className="text-primary hover:underline">/dashboard</a> - Dashboard (requires auth)</li>
            <li>• <a href="/welcome" className="text-primary hover:underline">/welcome</a> - Welcome</li>
            <li>• <a href="/status" className="text-primary hover:underline">/status</a> - Status</li>
          </ul>
        </div>

        <div className="mt-12 p-4 bg-primary/10 rounded-lg max-w-md">
          <h2 className="font-semibold mb-2">Platform Features:</h2>
          <ul className="text-sm text-left space-y-1">
            <li>✓ WhatsApp Automation</li>
            <li>✓ Visual Workflow Builder</li>
            <li>✓ Customer Management</li>
            <li>✓ Message Broadcasting</li>
            <li>✓ Real-time Analytics</li>
            <li>✓ n8n Integration</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
