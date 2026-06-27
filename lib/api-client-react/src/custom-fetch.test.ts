import { createApiClient, ApiError, ResponseParseError } from "./custom-fetch";

// Fake fetch response creation
function createMockResponse(body: any, init: ResponseInit = {}) {
  const jsonStr = typeof body === "string" ? body : JSON.stringify(body);
  const status = init.status || 200;
  
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText || "",
    headers: new Headers(init.headers || { "content-type": "application/json" }),
    text: async () => jsonStr,
    json: async () => JSON.parse(jsonStr),
    blob: typeof body === "string" ? undefined : async () => body,
    url: "mock-url",
  } as unknown as Response;
}

describe("API Client Factory", () => {
  it("prepends base URL for relative paths", async () => {
    const mockFetch = jest.fn().mockResolvedValue(createMockResponse({}));
    const client = createApiClient({
      baseUrl: "https://api.example.com/v1",
      fetcher: mockFetch as typeof fetch,
    });

    await client("/users");
    expect(mockFetch).toHaveBeenCalled();
    const req = mockFetch.mock.calls[0][0];
    expect(req).toBe("https://api.example.com/v1/users");
  });

  it("does not prepend base URL for absolute paths", async () => {
    const mockFetch = jest.fn().mockResolvedValue(createMockResponse({}));
    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetcher: mockFetch as typeof fetch,
    });

    await client("https://other.com/data");
    const req = mockFetch.mock.calls[0][0];
    expect(req).toBe("https://other.com/data");
  });

  it("injects token from provider", async () => {
    const mockFetch = jest.fn().mockResolvedValue(createMockResponse({}));
    const client = createApiClient({
      tokenProvider: async () => "mock-token",
      fetcher: mockFetch as typeof fetch,
    });

    await client("https://api.example.com/users");
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers.get("authorization")).toBe("Bearer mock-token");
  });

  it("parses success JSON body automatically", async () => {
    const mockFetch = jest.fn().mockResolvedValue(createMockResponse({ hello: "world" }));
    const client = createApiClient({ fetcher: mockFetch as typeof fetch });

    const result = await client("https://api.example.com/users");
    expect(result).toEqual({ hello: "world" });
  });

  it("throws ApiError on HTTP failure", async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      createMockResponse({ message: "Not found" }, { status: 404, statusText: "Not Found" })
    );
    const client = createApiClient({ fetcher: mockFetch as typeof fetch });

    try {
      await client("https://api.example.com/users");
      fail("Should have thrown");
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(404);
      expect(e.message).toBe("HTTP 404 Not Found: Not found");
    }
  });

  it("rejects GET requests with a body", async () => {
    const client = createApiClient();
    await expect(client("https://api.example.com", { method: "GET", body: "x" }))
      .rejects.toThrow(TypeError);
  });
});
