import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const config = {
  zendesk: {
    subdomain: required("ZENDESK_SUBDOMAIN"),
    email: required("ZENDESK_EMAIL"),
    apiToken: required("ZENDESK_API_TOKEN"),
  },
  // The user whose CC'd tickets we display. Hard-coded for demo purposes.
  demoUserId: Number(required("DEMO_USER_ID")),
  cacheTtlMs: 2 * 60 * 1000,
};

export function zendeskAuthHeader(): string {
  const token = Buffer.from(
    `${config.zendesk.email}/token:${config.zendesk.apiToken}`,
  ).toString("base64");
  return `Basic ${token}`;
}

export function zendeskBaseUrl(): string {
  return `https://${config.zendesk.subdomain}.zendesk.com/api/v2`;
}
