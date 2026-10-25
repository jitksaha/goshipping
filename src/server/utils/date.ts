/**
 * GoShipping — Bangladesh Standard Time (BST, UTC+6) Date & Time Utilities
 * Required format: "25 Oct 2026, 08:15 PM BST"
 */

export function formatBstDateTime(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  try {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const parts = dtf.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const day = partMap.day || '01';
    const month = partMap.month || 'Jan';
    const year = partMap.year || '2026';
    const hour = partMap.hour || '12';
    const minute = partMap.minute || '00';
    const dayPeriod = (partMap.dayPeriod || 'AM').toUpperCase();

    return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} BST`;
  } catch (err) {
    // Fallback if Intl fails
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Offset +6 hours for BST
    const bstMillis = date.getTime() + 6 * 60 * 60 * 1000;
    const bstDate = new Date(bstMillis);
    const d = pad(bstDate.getUTCDate());
    const m = months[bstDate.getUTCMonth()];
    const y = bstDate.getUTCFullYear();
    let hours = bstDate.getUTCHours();
    const minutes = pad(bstDate.getUTCMinutes());
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${d} ${m} ${y}, ${pad(hours)}:${minutes} ${period} BST`;
  }
}

/**
 * Format relative time (e.g. "Just now", "5 mins ago", "2 hours ago")
 */
export function formatRelativeTime(dateInput: string | Date | number): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 90) return '1 min ago';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  if (diffSec < 172800) return '1 day ago';
  return `${Math.floor(diffSec / 86400)} days ago`;
}
