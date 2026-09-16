import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  clearDeviceCredentials,
  getDeviceCredentials,
  saveDeviceCredentials,
  updateSavedPassword,
} from "@/lib/device-auth";

describe("device-auth persistence", () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: mockLocalStorage },
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    // @ts-expect-error cleanup globalThis.window for node env
    delete globalThis.window;
  });

  it("returns null when no credentials are saved", () => {
    expect(getDeviceCredentials()).toBeNull();
  });

  it("saves and retrieves credentials accurately", () => {
    saveDeviceCredentials("usuario@ejemplo.com", "ClaveSecreta10");
    const creds = getDeviceCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.email).toBe("usuario@ejemplo.com");
    expect(creds?.password).toBe("ClaveSecreta10");
    expect(typeof creds?.savedAt).toBe("number");
  });

  it("clears credentials on clearDeviceCredentials", () => {
    saveDeviceCredentials("usuario@ejemplo.com", "ClaveSecreta10");
    expect(getDeviceCredentials()).not.toBeNull();
    clearDeviceCredentials();
    expect(getDeviceCredentials()).toBeNull();
  });

  it("updates the password while keeping the same email", () => {
    saveDeviceCredentials("usuario@ejemplo.com", "ClaveVieja10");
    updateSavedPassword("ClaveNueva10");
    const updated = getDeviceCredentials();
    expect(updated?.email).toBe("usuario@ejemplo.com");
    expect(updated?.password).toBe("ClaveNueva10");
  });

  it("ignores updateSavedPassword when nothing was previously saved", () => {
    updateSavedPassword("ClaveNueva10");
    expect(getDeviceCredentials()).toBeNull();
  });
});
