import Peer, { type DataConnection } from 'peerjs';
import type { NetMessage } from './types';

export const PEER_PREFIX = 'iqheist-';

export type NetworkStatus =
  | 'idle'
  | 'creating'
  | 'waiting_for_guest'
  | 'joining'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface NetworkCallbacks {
  onStatusChange: (status: NetworkStatus, detail?: string) => void;
  onMessage: (msg: NetMessage) => void;
}

export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

/**
 * PeerJS WebRTC manager for direct phone-to-phone room-code multiplayer
 * with zero API keys or server setup.
 */
export class NetworkManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private callbacks: NetworkCallbacks;
  private lastSyncSentAt = 0;
  private roomCode: string | null = null;
  private isHostFlag = false;

  constructor(callbacks: NetworkCallbacks) {
    this.callbacks = callbacks;
  }

  getRoomCode(): string | null {
    return this.roomCode;
  }

  isHost(): boolean {
    return this.isHostFlag;
  }

  isConnected(): boolean {
    return Boolean(this.conn && this.conn.open);
  }

  createRoom(): string {
    this.disconnect();
    const code = generateRoomCode();
    this.roomCode = code;
    this.isHostFlag = true;
    this.callbacks.onStatusChange('creating', code);

    const peerId = `${PEER_PREFIX}${code}`;
    try {
      const peer = new Peer(peerId, { debug: 0 });
      this.peer = peer;

      peer.on('open', () => {
        this.callbacks.onStatusChange('waiting_for_guest', code);
      });

      peer.on('connection', (incoming) => {
        if (this.conn && this.conn.open) {
          incoming.close();
          return;
        }
        this.attachConnection(incoming);
      });

      peer.on('error', (err) => {
        const msg =
          err.type === 'unavailable-id'
            ? 'Room code busy. Try creating a new room.'
            : 'Unable to reach PeerJS relay. Check connection or try Solo Test.';
        this.callbacks.onStatusChange('error', msg);
      });
    } catch {
      this.callbacks.onStatusChange('error', 'WebRTC initialization failed on this browser.');
    }

    return code;
  }

  joinRoom(rawCode: string): void {
    const code = normalizeRoomCode(rawCode);
    if (code.length !== 4) {
      this.callbacks.onStatusChange('error', 'Enter a valid 4-digit room code.');
      return;
    }

    this.disconnect();
    this.roomCode = code;
    this.isHostFlag = false;
    this.callbacks.onStatusChange('joining', code);

    try {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;

      peer.on('open', () => {
        const targetId = `${PEER_PREFIX}${code}`;
        const conn = peer.connect(targetId, { reliable: true });
        this.attachConnection(conn);
      });

      peer.on('error', (err) => {
        const msg =
          err.type === 'peer-unavailable'
            ? `Room ${code} not found. Check the 4-digit code.`
            : 'Connection error. Please try again.';
        this.callbacks.onStatusChange('error', msg);
      });
    } catch {
      this.callbacks.onStatusChange('error', 'WebRTC initialization failed on this browser.');
    }
  }

  private attachConnection(conn: DataConnection): void {
    this.conn = conn;

    conn.on('open', () => {
      this.callbacks.onStatusChange('connected', this.roomCode ?? '');
    });

    conn.on('data', (raw) => {
      if (raw && typeof raw === 'object' && 'type' in raw) {
        this.callbacks.onMessage(raw as NetMessage);
      }
    });

    conn.on('close', () => {
      this.conn = null;
      this.callbacks.onStatusChange('disconnected', 'Friend disconnected from room.');
    });

    conn.on('error', () => {
      this.callbacks.onStatusChange('error', 'Peer link interrupted.');
    });
  }

  send(msg: NetMessage): void {
    if (!this.conn || !this.conn.open) return;
    try {
      this.conn.send(msg);
    } catch {
      // Ignore transient WebRTC send errors
    }
  }

  /**
   * Sends movement/disguise telemetry throttled to ~20Hz (50ms) for smooth mobile WebRTC syncing.
   */
  sendStateSync(msg: Extract<NetMessage, { type: 'state_sync' }>, nowMs: number): void {
    if (nowMs - this.lastSyncSentAt < 50) return;
    this.lastSyncSentAt = nowMs;
    this.send(msg);
  }

  disconnect(): void {
    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // ignore
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
    this.roomCode = null;
  }
}
