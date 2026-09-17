import Link from "next/link";

const footerLinks = {
  Product: [
    { href: "#services", label: "Buy Numbers" },
    { href: "#accounts-vpns", label: "Accounts & VPNs" },
    { href: "#countries", label: "Countries" },
    { href: "#api", label: "Developer API" },
    { href: "/signup", label: "Create Account" },
  ],
  Company: [
    { href: "/#about", label: "About" },
    { href: "/support", label: "Contact" },
    { href: "#faq", label: "FAQ" },
  ],
  Legal: [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/refund-policy", label: "Refund Policy" },
  ],
};

const developerWhatsApp = "https://wa.me/2348144075281";

export default function Footer() {
  return (
    <footer className="max-w-full overflow-x-clip border-t border-[var(--border)] bg-[var(--background)] px-4 py-10 min-[390px]:px-5 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-8 sm:gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="min-w-0">
          <Link
            href="/"
            className="text-xl font-black text-[var(--foreground)] sm:text-2xl"
          >
            Chaps<span className="text-blue-600">SmS</span>
          </Link>

          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted-foreground)] sm:mt-4 sm:leading-7">
            One platform for international virtual numbers, OTP delivery,
            accounts, VPN products, digital tools, wallet management and API access.
          </p>

          <div className="mt-5 space-y-2 text-sm text-[var(--muted-foreground)] sm:mt-6">
            <p>© {new Date().getFullYear()} ChapsSmS. All rights reserved.</p>

            <p>
              Built by{" "}
              <a
                href={developerWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring rounded-md font-black text-blue-600 transition hover:text-blue-500"
                aria-label="Contact Walegigs on WhatsApp"
              >
                @walegigs
              </a>
            </p>
          </div>
        </div>

        {Object.entries(footerLinks).map(([title, links]) => (
          <div
            key={title}
            className="min-w-0"
          >
            <h3 className="text-sm font-black text-[var(--foreground)] sm:text-base">
              {title}
            </h3>

            <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block text-sm font-medium text-[var(--muted-foreground)] transition hover:text-blue-600"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
