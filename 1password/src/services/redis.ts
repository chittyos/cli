export class RedisClient {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.log('Mock Redis client connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('Mock Redis client disconnected');
  }

  async get(key: string): Promise<string | null> {
    console.log(`Mock Redis GET: ${key}`);
    return null;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    console.log(`Mock Redis SET: ${key} = ${value}`, options);
  }

  async del(key: string): Promise<number> {
    console.log(`Mock Redis DEL: ${key}`);
    return 1;
  }

  async ping(): Promise<string> {
    if (!this.connected) {
      throw new Error('Redis client not connected');
    }
    return 'PONG';
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const redis = new RedisClient();