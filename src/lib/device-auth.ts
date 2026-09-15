const STORAGE_KEY = "finanzas:device-credentials";

export type DeviceCredentials = {
  email: string;
  password: string;
  savedAt: number;
};

export function getDeviceCredentials(): DeviceCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceCredentials>;
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string" && parsed.email && parsed.password) {
      return {
        email: parsed.email,
        password: parsed.password,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      };
    }
  } catch {
    // Si localStorage no está disponible o está bloqueado, se ignora silenciosamente.
  }
  return null;
}

export function saveDeviceCredentials(email: string, password: string): void {
  if (typeof window === "undefined") return;
  try {
    const data: DeviceCredentials = {
      email: email.trim(),
      password,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Si el navegador tiene el almacenamiento restringido, no bloquea el uso de la app.
  }
}

export function clearDeviceCredentials(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignorar errores de almacenamiento.
  }
}

export function updateSavedPassword(password: string): void {
  const current = getDeviceCredentials();
  if (current) {
    saveDeviceCredentials(current.email, password);
  }
}
