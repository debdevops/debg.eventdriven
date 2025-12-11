export type SessionConnectRequest = {
  secretName?: string;
  raw?: string;
};

export type SessionConnectResponse = {
  sessionId: string;
};

export type EntityListResponse = {
  queues: Array<{ name: string }>;
  topics: Array<{ name: string; subscriptions: string[] }>;
};