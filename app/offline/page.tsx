export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          W
        </div>
        <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
        <p className="mt-3 text-sm text-foreground/60">
          WareChat is installed, but this page needs a network connection right now. Reconnect and try again.
        </p>
      </div>
    </div>
  );
}
