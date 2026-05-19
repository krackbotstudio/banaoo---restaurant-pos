import TcpSocket from "react-native-tcp-socket";

export interface NetworkPrintOptions {
  host: string;
  port: number;
  payload: Uint8Array;
  timeoutMs?: number;
}

function toBuffer(data: Uint8Array): Buffer {
  return Buffer.from(data);
}

/** Raw ESC/POS over TCP (port 9100) for Wi‑Fi / LAN thermal printers. */
export async function printViaNetwork(options: NetworkPrintOptions): Promise<void> {
  const host = options.host.trim();
  if (!host) throw new Error("Printer IP address is required");

  const port = options.port > 0 ? options.port : 9100;
  const timeoutMs = options.timeoutMs ?? 12_000;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try {
        client.destroy();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve();
    };

    const client = TcpSocket.createConnection({ host, port }, () => {
      client.write(toBuffer(options.payload), undefined, (writeErr) => {
        setTimeout(() => finish(writeErr ?? undefined), 400);
      });
    });

    client.setTimeout(timeoutMs);
    client.on("error", (err: Error) => finish(err));
    client.on("timeout", () => finish(new Error(`Connection timed out (${host}:${port})`)));
  });
}

export async function testNetworkConnection(host: string, port: number | string = 9100): Promise<void> {
  const trimmed = host.trim();
  if (!trimmed) throw new Error("Printer IP address is required");
  const portNum = typeof port === "number" ? port : Number(port) || 9100;
  const testBytes = new TextEncoder().encode("Banaoo OK\n");
  await printViaNetwork({
    host: trimmed,
    port: portNum,
    payload: new Uint8Array([0x1b, 0x40, ...testBytes, 0x1a]),
    timeoutMs: 8_000,
  });
}
