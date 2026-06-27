import { AuthStore } from "../lib/authStore";
import { FakeAuthAdapter } from "../lib/authAdapters";
import { createInMemoryStorageAdapter, setAdapter as setStorageAdapter } from "../lib/storage";

describe("AuthStore", () => {
  let store: AuthStore;
  let adapter: FakeAuthAdapter;

  beforeEach(() => {
    setStorageAdapter(createInMemoryStorageAdapter());
    adapter = new FakeAuthAdapter();
    store = new AuthStore(adapter);
  });

  afterEach(() => {
    store.destroy();
  });

  it("initialises with empty state", async () => {
    await store.init();
    const state = store.getState();
    expect(state.session).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("handles sign in success", async () => {
    await store.init();
    await store.signIn();
    const state = store.getState();
    expect(state.session).not.toBeNull();
    expect(state.user?.id).toBe("test-user-id");
  });

  it("handles sign out cleanup", async () => {
    await store.init();
    await store.signIn();
    await store.completeOnboarding("https://model.jpg");
    
    expect(store.getState().hasCompletedOnboarding).toBe(true);

    await store.signOut();
    const state = store.getState();
    expect(state.session).toBeNull();
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.modelImageUrl).toBeNull();
  });

  it("emits auth change events", async () => {
    await store.init();
    const listener = jest.fn();
    store.subscribe(listener);

    await store.signIn();
    expect(listener).toHaveBeenCalled();
    const lastCallArg = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(lastCallArg.user?.id).toBe("test-user-id");
  });
});
