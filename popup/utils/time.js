export function formatFollowUpTime(timestamp) {
  const now = Date.now();
  const diffMs = now - timestamp;

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `Followed up ${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `Followed up ${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `Followed up ${days} day${days > 1 ? "s" : ""} ago`;
}
