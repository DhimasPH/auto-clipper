// Whether to raise a desktop (OS-level) notification right now.
//
// Suppresses notifications while the app window is focused — the user is
// already looking at the result, so a toast is enough. Only fires when the
// Notification API is available and permission has been granted.
export function shouldNotifyOS(): boolean {
  if (typeof Notification === "undefined" || !Notification) return false;
  if (Notification.permission !== "granted") return false;
  if (typeof document !== "undefined" && typeof document.hasFocus === "function" && document.hasFocus()) {
    return false;
  }
  return true;
}
