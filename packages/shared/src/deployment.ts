/** URL mount path, independent of the source directory or internal API prefix. */
export function normalizeBasePath(value = "") {
  const path = value.trim().replace(/\/+$/, "");
  if (!/^(?:\/[A-Za-z0-9_-]+)*$/.test(path)) throw new Error("Base path harus kosong atau berupa path seperti /erp tanpa domain, query, atau segmen relatif");
  return path;
}
export function deploymentApiPath(basePath: string, path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("API path harus diawali satu garis miring");
  return `${normalizeBasePath(basePath)}/api${path}`;
}

/** Adapt a Passenger mount without decoding or normalizing the raw request target. */
export function deploymentRequestPath(basePath: string, requestUrl: string, mode: "restore" | "strip") {
  const mount = normalizeBasePath(basePath);
  if (!requestUrl.startsWith("/") || requestUrl.startsWith("//") || /[\r\n\\]/.test(requestUrl)) {
    throw new Error("Request URL harus berupa path lokal");
  }
  if (!mount) return requestUrl;
  const pathname = requestUrl.split("?", 1)[0];
  const mounted = pathname === mount || pathname.startsWith(`${mount}/`);
  if (mode === "restore") return mounted ? requestUrl : `${mount}${requestUrl}`;
  if (!mounted) return requestUrl;
  const suffix = requestUrl.slice(mount.length);
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
}
