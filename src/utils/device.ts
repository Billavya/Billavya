import { Platform } from "react-native";

export interface DeviceInfo {
  os: "ios" | "android";
  osVersion: string;
  brand: string | null;
  model: string | null;
}

/**
 * Reads whatever device info is available WITHOUT a native module — just
 * React Native core's `Platform`, which is already compiled into every RN
 * app (so this works over an OTA update, no rebuild needed).
 *
 * Android: RN core exposes the real hardware brand + model (e.g. "samsung" /
 * "SM-S911B") via Platform.constants — often a raw model code, not a
 * marketing name.
 *
 * iOS: Apple doesn't let JS-only code read the specific hardware model (no
 * "iPhone 15" vs "iPhone 14") — that needs a native module like
 * expo-device, which would require a new build. Core RN only tells us
 * iPhone vs iPad and the OS version, so that's all we can report here.
 */
export function getDeviceInfo(): DeviceInfo {
  const osVersion = String(Platform.Version);

  if (Platform.OS === "android") {
    const c = (Platform as any).constants || {};
    return {
      os: "android",
      osVersion,
      brand: c.Brand || c.Manufacturer || null,
      model: c.Model || null,
    };
  }

  const isPad = (Platform as any).isPad;
  return {
    os: "ios",
    osVersion,
    brand: "Apple",
    model: isPad ? "iPad (exact model unavailable)" : "iPhone (exact model unavailable)",
  };
}

export function formatDeviceLabel(d: DeviceInfo | null | undefined): string {
  if (!d) return "";
  const name = [d.brand, d.model].filter(Boolean).join(" ") || "Unknown device";
  return `${name} · ${d.os === "ios" ? "iOS" : "Android"} ${d.osVersion}`;
}
