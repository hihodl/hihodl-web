/**
 * What kind of device a page is open on, from its user agent. Pure, so the
 * check script can run it.
 *
 * The desktop side reports `desktopPlatform` and `desktopBrowser` when it
 * opens a link session (the device-mix KPI). The backend normalises the
 * platform to {mac, windows, linux, chromeos, phone, other}; a phone opening
 * onboarding on its own is a "phone only" web user, `phone`, and its browser
 * says which phone, e.g. `safari-ios`.
 */

export type DesktopPlatform = "mac" | "windows" | "linux" | "chromeos" | "phone" | "other";
export type Phone = "android" | "ios";

/** iPhone and iPod always; an iPad only when it says so (iPadOS 13+ says "Macintosh"). */
export function phoneOf(ua: string, maxTouchPoints = 0): Phone | null {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPod/i.test(ua)) return "ios";
  if (/iPad/i.test(ua)) return "ios";
  // iPadOS pretends to be a Mac; a Mac has no touch points.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  return null;
}

export type AppleDevice = "iPhone" | "iPad";

/**
 * Which Apple device, by the name the person knows it by, for copy only.
 * `phoneOf` files an iPad under "ios" because it behaves like one (Safari,
 * passkeys, no QR to scan), but "You are on your iPhone" on an iPad is wrong.
 * iPadOS 13+ says "Macintosh"; touch points give it away.
 */
export function appleDeviceOf(ua: string, maxTouchPoints = 0): AppleDevice | null {
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "iPad";
  return null;
}

export function platformOf(ua: string, maxTouchPoints = 0): DesktopPlatform {
  if (phoneOf(ua, maxTouchPoints)) return "phone";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  if (/CrOS/i.test(ua)) return "chromeos";
  if (/Linux|X11/i.test(ua)) return "linux";
  return "other";
}

/** chrome, safari, firefox, edge, opera, brave-ish browsers read as chrome; with `-android`/`-ios` on a phone. */
export function browserOf(ua: string, maxTouchPoints = 0): string {
  let b = "other";
  if (/Edg(e|A|iOS)?\//.test(ua)) b = "edge";
  else if (/OPR\/|Opera/.test(ua)) b = "opera";
  else if (/Firefox\/|FxiOS\//.test(ua)) b = "firefox";
  else if (/SamsungBrowser\//.test(ua)) b = "samsung";
  else if (/Chrome\/|CriOS\//.test(ua)) b = "chrome";
  else if (/Safari\//.test(ua)) b = "safari";
  const phone = phoneOf(ua, maxTouchPoints);
  return phone ? `${b}-${phone}` : b;
}

/** Read in the browser; `other` on the server. */
export function thisDevice(): { platform: DesktopPlatform; browser: string; phone: Phone | null; apple: AppleDevice | null } {
  if (typeof navigator === "undefined") return { platform: "other", browser: "other", phone: null, apple: null };
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints ?? 0;
  return { platform: platformOf(ua, touch), browser: browserOf(ua, touch), phone: phoneOf(ua, touch), apple: appleDeviceOf(ua, touch) };
}
