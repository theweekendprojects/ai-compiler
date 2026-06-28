export interface Env {
  ENVIRONMENT: string;
  DEFAULT_PROVIDER: string;
  // Cloudflare account info for Workers AI REST API (free tier)
  CF_ACCOUNT_ID: string;   // set via wrangler secret put CF_ACCOUNT_ID
  CF_API_TOKEN: string;    // set via wrangler secret put CF_API_TOKEN
  // Optional — for Anthropic / Bedrock
  ANTHROPIC_API_KEY?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  CF_GATEWAY_URL?: string;
}
