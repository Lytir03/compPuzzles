import { describe, expect, it, vi } from "vitest";
import { reconnectWithFreshTicket, type ReconnectableSocket } from "./reconnect";

function fakeSocket(connected = false) {
  return { connected, auth: { ticket: "spent" }, connect: vi.fn() } satisfies ReconnectableSocket;
}

describe("reconnectWithFreshTicket", () => {
  it("replaces the spent ticket and explicitly reconnects", async () => {
    const socket = fakeSocket();

    await expect(reconnectWithFreshTicket(socket, async () => "fresh")).resolves.toBe(true);
    expect(socket.auth).toEqual({ ticket: "fresh" });
    expect(socket.connect).toHaveBeenCalledOnce();
  });

  it("does not reconnect after unmount or without a fresh ticket", async () => {
    const stale = fakeSocket();
    const missing = fakeSocket();

    await expect(reconnectWithFreshTicket(stale, async () => "fresh", () => false)).resolves.toBe(false);
    await expect(reconnectWithFreshTicket(missing, async () => null)).resolves.toBe(false);
    expect(stale.connect).not.toHaveBeenCalled();
    expect(missing.connect).not.toHaveBeenCalled();
  });

  it("does not disturb a socket that recovered while the ticket was minted", async () => {
    const socket = fakeSocket();
    const result = reconnectWithFreshTicket(socket, async () => {
      socket.connected = true;
      return "fresh";
    });

    await expect(result).resolves.toBe(false);
    expect(socket.connect).not.toHaveBeenCalled();
  });
});
