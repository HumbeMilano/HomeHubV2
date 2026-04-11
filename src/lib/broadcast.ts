/**
 * BroadcastChannel wrapper for instant same-browser cross-tab sync.
 * Used alongside Supabase Realtime: BroadcastChannel handles tabs in the
 * same browser (no round-trip), Supabase Realtime handles other devices.
 */

export type BroadcastMessage<T = unknown> = {
  type: string;
  payload: T;
};

type MessageHandler<T> = (msg: BroadcastMessage<T>) => void;

export function createBroadcastChannel<T = unknown>(channelName: string) {
  const channel = new BroadcastChannel(`homehub:${channelName}`);

  function post(type: string, payload: T) {
    const msg: BroadcastMessage<T> = { type, payload };
    channel.postMessage(msg);
  }

  function listen(handler: MessageHandler<T>) {
    const listener = (e: MessageEvent<BroadcastMessage<T>>) => handler(e.data);
    channel.addEventListener('message', listener);
    return () => channel.removeEventListener('message', listener);
  }

  function close() {
    channel.close();
  }

  return { post, listen, close };
}
