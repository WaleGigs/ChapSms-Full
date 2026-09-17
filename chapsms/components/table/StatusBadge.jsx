export default function StatusBadge({ status }) {
  const value = status?.toLowerCase();

  const styles = {
    received: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    completed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    waiting: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    expired: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    successful: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    returned: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
        styles[value] || styles.completed
      }`}
    >
      {status}
    </span>
  );
}