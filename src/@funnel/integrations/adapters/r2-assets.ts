/**
 * Cloudflare R2 asset upload for generated/curated funnel images.
 *
 * Pattern:
 *   1. Image agent (or stock fallback) returns a *temporary* provider URL.
 *   2. Worker downloads bytes (signal-aware), optionally re-encodes to WebP.
 *   3. Uploads to bucket `gofunnelai-assets` at key
 *      `funnels/{funnelId}/{uuid}.webp`.
 *   4. Returns CDN URL `https://cdn.gofunnelai.com/funnels/...`.
 *
 * Two upload paths are supported:
 *   - R2-binding mode (Cloudflare Worker runtime: `env.ASSETS_BUCKET.put`).
 *   - S3-compatible mode (Node/Railway runtime: SigV4 against the R2 endpoint).
 *
 * Env (S3-compatible mode):
 *   CLOUDFLARE_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME       (default "gofunnelai-assets")
 *   R2_PUBLIC_BASE_URL   (default "https://cdn.gofunnelai.com")
 */

import crypto from "node:crypto";

export interface R2UploadInput {
  /** Funnel id — used in the object key prefix. */
  funnelId: string;
  /** Asset id (uuid). Defaults to randomUUID. */
  assetId?: string;
  /** Source URL to fetch and re-host. */
  sourceUrl: string;
  /** MIME — `image/webp`, `image/jpeg`, etc. */
  contentType?: string;
  /** Suffix override (default "webp"). */
  extension?: string;
  /** Cache-Control header to put on the object (default 31536000). */
  cacheControlSeconds?: number;
  abortSignal?: AbortSignal;
}

export interface R2UploadResult {
  /** Public CDN url (gofunnelai.com). */
  cdnUrl: string;
  /** Bucket key. */
  key: string;
  /** Bytes uploaded. */
  bytes: number;
  /** Resolved content type. */
  contentType: string;
}

export interface R2ClientConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  publicBaseUrl?: string;
  /** Cloudflare Worker R2 binding (preferred when available). */
  binding?: R2Bucket;
  fetchImpl?: typeof fetch;
}

/** Minimal Cloudflare Worker R2Bucket shape. */
export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
}

export class R2AssetsClient {
  private readonly accountId: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly binding?: R2Bucket;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: R2ClientConfig = {}) {
    this.accountId = cfg.accountId ?? process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "";
    this.accessKeyId = cfg.accessKeyId ?? process.env["R2_ACCESS_KEY_ID"] ?? "";
    this.secretAccessKey = cfg.secretAccessKey ?? process.env["R2_SECRET_ACCESS_KEY"] ?? "";
    // Bucket name matches infrastructure/cloudflare/r2-buckets.tf (funnel_assets).
    // Public CDN binding lives at assets.gofunnelai.com (production) — override
    // R2_PUBLIC_BASE_URL when you want the cdn.gofunnelai.com alias.
    this.bucket = cfg.bucket ?? process.env["R2_BUCKET_NAME"] ?? "funnel-assets";
    this.publicBaseUrl =
      cfg.publicBaseUrl ?? process.env["R2_PUBLIC_BASE_URL"] ?? "https://cdn.gofunnelai.com";
    this.binding = cfg.binding;
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  hasCredentials(): boolean {
    return !!this.binding || (!!this.accountId && !!this.accessKeyId && !!this.secretAccessKey);
  }

  async uploadFromUrl(input: R2UploadInput): Promise<R2UploadResult> {
    const ext = input.extension ?? "webp";
    const assetId = input.assetId ?? crypto.randomUUID();
    const key = `funnels/${input.funnelId}/${assetId}.${ext}`;
    const cacheControl = `public, max-age=${input.cacheControlSeconds ?? 31_536_000}, immutable`;
    const contentType = input.contentType ?? `image/${ext === "jpg" ? "jpeg" : ext}`;

    // Download bytes.
    const dl = await this.fetchImpl(input.sourceUrl, { signal: input.abortSignal });
    if (!dl.ok) {
      throw new Error(`R2 upload: source fetch failed ${dl.status}`);
    }
    const buf = await dl.arrayBuffer();

    if (this.binding) {
      await this.binding.put(key, buf, {
        httpMetadata: { contentType, cacheControl },
        customMetadata: { funnelId: input.funnelId, assetId },
      });
    } else {
      if (!this.hasCredentials()) {
        throw new Error("R2 upload: no binding and no S3 credentials configured");
      }
      await this.putS3(key, buf, contentType, cacheControl, input.abortSignal);
    }

    return {
      cdnUrl: `${this.publicBaseUrl}/${key}`,
      key,
      bytes: buf.byteLength,
      contentType,
    };
  }

  /** S3-compatible PUT to R2 via SigV4. */
  private async putS3(
    key: string,
    body: ArrayBuffer,
    contentType: string,
    cacheControl: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const region = "auto";
    const service = "s3";
    const now = new Date();
    const amzDate = isoBasic(now);
    const dateStamp = amzDate.slice(0, 8);

    const payloadHash = await sha256Hex(body);
    const canonicalUri = `/${this.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
    const headers: Record<string, string> = {
      "cache-control": cacheControl,
      "content-type": contentType,
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const sortedKeys = Object.keys(headers).sort();
    const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join("");
    const signedHeaders = sortedKeys.join(";");
    const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      await sha256Hex(new TextEncoder().encode(canonicalRequest).buffer as ArrayBuffer),
    ].join("\n");

    const kDate = await hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, "aws4_request");
    const signature = toHex(await hmac(kSigning, stringToSign));

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${host}${canonicalUri}`;
    const res = await this.fetchImpl(url, {
      method: "PUT",
      headers: {
        Authorization: authorization,
        "Cache-Control": cacheControl,
        "Content-Type": contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
      body,
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`R2 PUT failed ${res.status}: ${text}`);
    }
  }
}

function isoBasic(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function sha256Hex(buf: ArrayBuffer | Uint8Array): Promise<string> {
  const h = crypto.createHash("sha256");
  h.update(Buffer.from(buf as ArrayBuffer));
  return h.digest("hex");
}

async function hmac(key: string | Uint8Array, data: string): Promise<Uint8Array> {
  const k = typeof key === "string" ? Buffer.from(key, "utf8") : Buffer.from(key);
  const h = crypto.createHmac("sha256", k);
  h.update(data, "utf8");
  return new Uint8Array(h.digest());
}

function toHex(buf: Uint8Array): string {
  return Buffer.from(buf).toString("hex");
}
