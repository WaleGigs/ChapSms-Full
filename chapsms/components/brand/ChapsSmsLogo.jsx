import Image from "next/image";
import Link from "next/link";

export default function ChapsSmsLogo({
  href = "/",
  compact = false,
  priority = false,
  className = "",
  imageClassName = "",
  label = "ChapsSmS home",
}) {
  const logoContent = compact ? (
    <Image
      src="/brand/chapssms-icon.png"
      alt="ChapsSmS"
      width={512}
      height={512}
      priority={priority}
      className={`h-10 w-10 object-contain ${imageClassName}`}
    />
  ) : (
    <>
      <Image
        src="/brand/chapssms-logo-light.png"
        alt="ChapsSmS"
        width={1200}
        height={241}
        priority={priority}
        className={`block h-10 w-auto object-contain dark:hidden sm:h-11 ${imageClassName}`}
      />

      <Image
        src="/brand/chapssms-logo-dark.png"
        alt="ChapsSmS"
        width={1200}
        height={241}
        priority={priority}
        className={`hidden h-10 w-auto object-contain dark:block sm:h-11 ${imageClassName}`}
      />
    </>
  );

  if (!href) {
    return (
      <div
        aria-label={label}
        className={`inline-flex shrink-0 items-center ${className}`}
      >
        {logoContent}
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`inline-flex shrink-0 items-center rounded-lg ${className}`}
    >
      {logoContent}
    </Link>
  );
}