export default function SectionHeader({ badge, title, text, center = false }) {
  return (
    <div className={`mb-12 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      {badge && (
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-blue-600">
          {badge}
        </p>
      )}

      <h2 className="text-3xl font-bold text-[var(--foreground)] md:text-5xl">
        {title}
      </h2>

      {text && (
        <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)] md:text-lg">
          {text}
        </p>
      )}
    </div>
  );
}