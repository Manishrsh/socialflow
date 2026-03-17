import PusherClient from 'pusher-js';

// Cache the connection to avoid multiple instances during hot reloading in dev
let pusherClientInstance: PusherClient | null = null;

export const getPusherClient = () => {
  if (pusherClientInstance) {
    return pusherClientInstance;
  }

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY || '';
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '';

  if (!key || !cluster) {
    console.warn('Pusher client key or cluster missing in environment variables');
    return null;
  }

  pusherClientInstance = new PusherClient(key, {
    cluster,
  });

  return pusherClientInstance;
};
