declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    NEURALAKE_MODE?: string;
    NEURALAKE_BASE_URL?: string;
    NEURALAKE_MODEL?: string;
    NEURALAKE_API_KEY?: string;
    NEURALAKE_CUSTOMER_API_KEY?: string;
    NEURALAKE_NIKO_API_KEY?: string;
    NEURALAKE_CASA_API_KEY?: string;
    NEURALAKE_PANELA_API_KEY?: string;
  }
}
