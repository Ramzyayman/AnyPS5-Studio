import net from 'net';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface DiscordActivity {
  details?: string;
  state?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
}

export interface DiscordRpcOptions {
  clientId?: string;
  enabled?: boolean;
}

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const OP_PING = 3;
const OP_PONG = 4;

export class DiscordRpcClient {
  private clientId: string;
  private enabled: boolean;
  private socket: net.Socket | null = null;
  private readBuffer: Buffer = Buffer.alloc(0);
  private isReady: boolean = false;
  private isConnecting: boolean = false;
  private isDestroyed: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentActivity: DiscordActivity | null | undefined = undefined;
  private activeGame: { title: string; iconUrl?: string } | null = null;
  private reconnectAttempts: number = 0;

  constructor(options?: DiscordRpcOptions) {
    this.clientId = options?.clientId || '1562955881182920855';
    this.enabled = options?.enabled !== undefined ? options.enabled : true;
  }

  public connect(): void {
    if (this.isDestroyed || !this.enabled) return;
    if (this.socket && !this.socket.destroyed) return;
    if (this.isConnecting) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const candidates = this.getCandidatePaths();
    if (candidates.length === 0) {
      this.scheduleReconnect();
      return;
    }

    this.isConnecting = true;
    this.tryConnectCandidate(0, candidates);
  }

  public disconnect(): void {
    this.isConnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.isReady = false;
    this.readBuffer = Buffer.alloc(0);
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      if (this.socket && !this.socket.destroyed && this.isReady) {
        try {
          this.sendActivity(null);
        } catch {}
      }
      this.disconnect();
    } else {
      if (this.activeGame) {
        this.setGame(this.activeGame);
      } else {
        this.setIdle();
      }
      this.connect();
    }
  }

  public setClientId(clientId: string): void {
    if (this.clientId === clientId) return;
    this.clientId = clientId;
    if (this.enabled && this.socket && !this.socket.destroyed) {
      this.disconnect();
      this.connect();
    }
  }

  public setActivity(activityData: DiscordActivity | null): void {
    this.currentActivity = activityData;
    if (!this.enabled || !this.isReady || !this.socket || this.socket.destroyed) {
      return;
    }
    this.sendActivity(activityData);
  }

  public clearActivity(): void {
    this.currentActivity = null;
    if (!this.enabled || !this.isReady || !this.socket || this.socket.destroyed) {
      return;
    }
    this.sendActivity(null);
  }

  public setGame(game: { title?: string; iconUrl?: string }): void {
    const title = (game.title || '').trim() || 'PlayStation 5 Title';
    const isHttp = typeof game.iconUrl === 'string' &&
      (game.iconUrl.startsWith('http://') || game.iconUrl.startsWith('https://'));
    const largeImage = isHttp ? game.iconUrl! : 'anyps5_logo';

    this.activeGame = { title, iconUrl: game.iconUrl };

    this.setActivity({
      details: title,
      state: 'AnyPS5 Studio · Playing',
      timestamps: {
        start: Date.now(),
      },
      assets: {
        large_image: largeImage,
        large_text: title,
      },
    });
  }

  public setIdle(): void {
    this.activeGame = null;
    this.setActivity({
      details: 'AnyPS5 Studio',
      state: 'Browsing Games',
      assets: {
        large_image: 'anyps5_logo',
        large_text: 'AnyPS5 Studio',
      },
    });
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.enabled = false;
    this.isConnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket && !this.socket.destroyed) {
      try {
        if (this.isReady) {
          this.sendActivity(null);
        }
      } catch {}
      try {
        this.socket.removeAllListeners();
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.isReady = false;
    this.readBuffer = Buffer.alloc(0);
  }

  public isConnectedAndReady(): boolean {
    return Boolean(this.enabled && this.isReady && this.socket && !this.socket.destroyed);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getCurrentActivity(): DiscordActivity | null | undefined {
    return this.currentActivity;
  }

  private getCandidatePaths(): string[] {
    if (process.platform === 'win32') {
      const paths: string[] = [];
      for (let i = 0; i < 10; i++) {
        paths.push(`\\\\.\\pipe\\discord-ipc-${i}`);
        paths.push(`\\\\?\\pipe\\discord-ipc-${i}`);
      }
      return paths;
    }

    const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env;
    const prefixes = [
      XDG_RUNTIME_DIR,
      TMPDIR,
      TMP,
      TEMP,
      '/tmp',
    ].filter(Boolean) as string[];

    const paths: string[] = [];
    for (let i = 0; i < 10; i++) {
      for (const prefix of prefixes) {
        paths.push(path.join(prefix, `discord-ipc-${i}`));
        paths.push(path.join(prefix, 'app', 'com.discordapp.Discord', `discord-ipc-${i}`));
        paths.push(path.join(prefix, 'snap.discord', `discord-ipc-${i}`));
      }
    }

    const unique = Array.from(new Set(paths));
    return unique.filter((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return true;
      }
    });
  }

  private tryConnectCandidate(index: number, candidates: string[]): void {
    if (this.isDestroyed || !this.enabled) {
      this.isConnecting = false;
      return;
    }

    if (index >= candidates.length) {
      this.isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    const candidatePath = candidates[index];
    let resolved = false;

    const socket = net.connect(candidatePath);

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          socket.removeAllListeners();
          socket.destroy();
        } catch {}
        this.tryConnectCandidate(index + 1, candidates);
      }
    }, 1000);

    socket.once('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try {
          socket.removeAllListeners();
          socket.destroy();
        } catch {}
        this.tryConnectCandidate(index + 1, candidates);
      }
    });

    socket.once('connect', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        this.isConnecting = false;
        try {
          socket.removeAllListeners();
        } catch {}
        this.reconnectAttempts = 0;
        this.onSocketConnected(socket);
      }
    });
  }

  private onSocketConnected(socket: net.Socket): void {
    this.socket = socket;
    this.readBuffer = Buffer.alloc(0);

    this.socket.on('data', (chunk: Buffer) => {
      this.onData(chunk);
    });

    this.socket.on('close', () => {
      this.handleSocketClose();
    });

    this.socket.on('error', () => {
      this.handleSocketClose();
    });

    this.sendHandshake();
  }

  private sendHandshake(): void {
    const payload = {
      v: 1,
      client_id: this.clientId,
    };
    this.sendFrame(OP_HANDSHAKE, payload);
  }

  private sendFrame(opcode: number, payload: any): void {
    if (!this.socket || this.socket.destroyed) return;
    try {
      const jsonStr = JSON.stringify(payload);
      const byteLen = Buffer.byteLength(jsonStr, 'utf8');
      const packet = Buffer.alloc(8 + byteLen);
      packet.writeInt32LE(opcode, 0);
      packet.writeInt32LE(byteLen, 4);
      packet.write(jsonStr, 8, byteLen, 'utf8');
      this.socket.write(packet);
    } catch {}
  }

  private onData(chunk: Buffer): void {
    this.readBuffer = Buffer.concat([this.readBuffer, chunk]);
    while (this.readBuffer.length >= 8) {
      const opcode = this.readBuffer.readInt32LE(0);
      const length = this.readBuffer.readInt32LE(4);
      if (this.readBuffer.length < 8 + length) {
        break;
      }
      const payloadBuf = this.readBuffer.slice(8, 8 + length);
      this.readBuffer = this.readBuffer.slice(8 + length);

      try {
        const payload = JSON.parse(payloadBuf.toString('utf8'));
        this.handlePacket(opcode, payload);
      } catch {}
    }
  }

  private handlePacket(opcode: number, payload: any): void {
    if (opcode === OP_FRAME) {
      if (payload?.cmd === 'DISPATCH' && payload?.evt === 'READY') {
        this.isReady = true;
        if (this.currentActivity !== undefined) {
          this.sendActivity(this.currentActivity);
        }
      }
    } else if (opcode === OP_PING) {
      this.sendFrame(OP_PONG, payload);
    } else if (opcode === OP_CLOSE) {
      this.handleSocketClose();
    }
  }

  private handleSocketClose(): void {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.isReady = false;
    this.readBuffer = Buffer.alloc(0);

    if (!this.isDestroyed && this.enabled) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || !this.enabled || this.reconnectTimer) return;
    const delay = this.reconnectAttempts < 3 ? 3000 : (this.reconnectAttempts < 6 ? 8000 : 20000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendActivity(activityData: DiscordActivity | null): void {
    if (!this.socket || this.socket.destroyed || !this.isReady) return;

    let activity: any = null;
    if (activityData) {
      activity = {
        type: 0,
        details: activityData.details,
        state: activityData.state,
        assets: activityData.assets,
        instance: false,
      };

      if (activityData.timestamps?.start) {
        const rawStart = activityData.timestamps.start;
        const startSec = rawStart > 10000000000 ? Math.floor(rawStart / 1000) : rawStart;
        activity.timestamps = {
          start: startSec,
        };
        if (activityData.timestamps.end) {
          const rawEnd = activityData.timestamps.end;
          activity.timestamps.end = rawEnd > 10000000000 ? Math.floor(rawEnd / 1000) : rawEnd;
        }
      }
    }

    const nonce = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity,
      },
      nonce,
    };

    this.sendFrame(OP_FRAME, payload);
  }
}
