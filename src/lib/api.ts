export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = init?.method ?? "POST";
  const response = await fetch(url, {
    method,
    headers: {
      "x-ujian-request": "1",
      ...(method === "GET" ? {} : { "content-type": "application/json" }),
    },
    body: method === "GET" ? undefined : init?.body === undefined ? "{}" : JSON.stringify(init.body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Permintaan gagal.");
  }
  return data;
}
