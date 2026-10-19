export interface ReconnectableSocket {
  connected: boolean;
  auth: object | ((callback: (data: object) => void) => void);
  connect: () => unknown;
}

/**
 * Socket.IO destroys a Socket after a middleware CONNECT_ERROR, so changing
 * `socket.auth` alone is not enough. Re-open it explicitly with a newly
 * minted, one-use admission ticket.
 */
export async function reconnectWithFreshTicket(
  socket: ReconnectableSocket,
  mintTicket: () => Promise<string | null>,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  const ticket = await mintTicket();
  if (!ticket || socket.connected || !isCurrent()) return false;

  socket.auth = { ticket };
  socket.connect();
  return true;
}
