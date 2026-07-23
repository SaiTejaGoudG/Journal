import { MongoClient, Db } from "mongodb";

const RAW_MONGO_URL = process.env.MONGO_URL!;
const DB_NAME = process.env.DB_NAME || "secondbrain";

if (!RAW_MONGO_URL) {
  throw new Error("Please define the MONGO_URL environment variable in .env.local");
}

/**
 * On Windows, the local DNS resolver often refuses SRV queries, producing
 * `querySrv ECONNREFUSED`. We work around this by resolving the SRV record
 * via Google's DNS-over-HTTPS API (pure HTTPS — zero dependency on system DNS)
 * and converting the mongodb+srv:// URL into a standard mongodb:// URL.
 *
 * Falls back silently to the original URL on any error.
 */
async function resolveMongoUrl(url: string): Promise<string> {
  if (!url.startsWith("mongodb+srv://")) return url;

  try {
    // Extract the bare hostname from mongodb+srv://user:pass@HOST/...
    const hostMatch = url.match(/@([^/?]+)/);
    if (!hostMatch) return url;
    const host = hostMatch[1];

    // 1. Resolve SRV records via Google DNS-over-HTTPS
    const srvRes = await fetch(
      `https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!srvRes.ok) return url;
    const srvData = await srvRes.json();
    if (!srvData.Answer?.length) return url;

    const hosts = (srvData.Answer as any[])
      .map((r) => {
        const parts = r.data.trim().split(/\s+/);
        // SRV record data format: priority weight port target
        const port = parts[2];
        const target = parts[3].replace(/\.$/, ""); // strip trailing dot
        return `${target}:${port}`;
      })
      .join(",");

    // 2. Resolve TXT record to get replicaSet / authSource options
    const txtRes = await fetch(
      `https://dns.google/resolve?name=${host}&type=TXT`,
      { signal: AbortSignal.timeout(8000) }
    );
    let extraOptions = "authSource=admin";
    if (txtRes.ok) {
      const txtData = await txtRes.json();
      if (txtData.Answer?.length) {
        // TXT data comes back with surrounding quotes
        extraOptions = txtData.Answer[0].data.replace(/"/g, "");
      }
    }

    // 3. Build standard mongodb:// URL, preserving credentials & path
    // Original: mongodb+srv://user:pass@host/dbname?opts
    const withoutScheme = url.replace(/^mongodb\+srv:\/\//, "");
    const credAndRest = withoutScheme.split("@");
    const credentials = credAndRest[0]; // user:pass
    const afterAt = credAndRest.slice(1).join("@"); // host/dbname?opts
    const slashIdx = afterAt.indexOf("/");
    const pathAndQuery = slashIdx !== -1 ? afterAt.slice(slashIdx) : "/";

    // Merge original query params with TXT options
    const [path, origQuery] = pathAndQuery.split("?");
    const params = new URLSearchParams(origQuery || "");
    for (const [k, v] of new URLSearchParams(extraOptions)) {
      if (!params.has(k)) params.set(k, v);
    }
    params.set("tls", "true");

    const standardUrl = `mongodb://${credentials}@${hosts}${path}?${params.toString()}`;
    console.log("[db] Resolved SRV via DoH →", hosts);
    return standardUrl;
  } catch (err) {
    console.warn("[db] DoH SRV resolution failed, using original URL:", err);
    return url;
  }
}

// Cache the resolved URL so we only hit DoH once per process
let resolvedUrlPromise: Promise<string> | null = null;
function getResolvedUrl(): Promise<string> {
  if (!resolvedUrlPromise) {
    resolvedUrlPromise = resolveMongoUrl(RAW_MONGO_URL);
  }
  return resolvedUrlPromise;
}

// In development, re-use the cached client across hot-reloads.
// In production each serverless function gets its own module-scope cache.
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

async function createClientPromise(): Promise<MongoClient> {
  const url = await getResolvedUrl();
  const client = new MongoClient(url);
  return client.connect();
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClientPromise();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = createClientPromise();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export default clientPromise;
