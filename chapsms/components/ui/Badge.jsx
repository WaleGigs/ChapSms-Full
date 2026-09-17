export default function Badge({ children, variant = "info" }) {
  const styles = {
    info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    success:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    warning:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[variant]}`}>
      {children}
    </span>
  );
}