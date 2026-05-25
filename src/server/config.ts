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
    // e.g. https://con-leafworks2.zendesk.com/api/v2
    baseUrl: required("ZENDESK_BASE_URL").replace(/\/+$/, ""),
    apiToken: required("ZENDESK_API_TOKEN"),
  },
  // The user whose CC'd tickets we display. Hard-coded for demo purposes.
  demoUserId: Number(required("DEMO_USER_ID")),
  cacheTtlMs: 2 * 60 * 1000,
};
