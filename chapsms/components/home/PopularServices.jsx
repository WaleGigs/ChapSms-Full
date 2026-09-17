import {
  Gamepad2,
  Mail,
  MessageCircle,
  Music2,
  Send,
  ShoppingBag,
  Users,
  Video,
} from "lucide-react";

import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";

const services = [
  { name: "WhatsApp", icon: MessageCircle },
  { name: "Telegram", icon: Send },
  { name: "TikTok", icon: Music2 },
  { name: "Discord", icon: Gamepad2 },
  
];

const routeLink =
  "focus-ring relative z-30 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-sm transition duration-200 hover:border-blue-300 hover:bg-[var(--muted)] active:scale-[0.98] dark:hover:border-blue-800 lg:w-auto";

export default function PopularServices() {
  return (
    <Section className="bg-[var(--background)]" id="services">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          badge="Popular services"
          title="Use virtual numbers across familiar platforms"
          text="Availability and final pricing are checked live when you select a server, country, service, and operator."
          className="mb-0"
        />

        <a
          href="/login?next=/buy-number"
          className={routeLink}
        >
          View all services
        </a>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:mt-12">
        {services.map((service) => {
          const Icon = service.icon;

          return (
            <a
              key={service.name}
              href="/login?next=/buy-number"
              className="focus-ring block min-w-0 rounded-[var(--radius)]"
              aria-label={`Open ${service.name} virtual numbers`}
            >
              <Card className="group h-full min-w-0 p-4 transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl dark:hover:border-blue-900 sm:p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/70 dark:text-blue-300">
                  <Icon size={20} />
                </div>

                <h3 className="mt-4 truncate text-base font-black text-[var(--foreground)] sm:text-lg">
                  {service.name}
                </h3>

                <p className="mt-1.5 text-xs font-semibold text-blue-600 sm:text-sm">
                  Live pricing
                </p>
              </Card>
            </a>
          );
        })}
      </div>
    </Section>
  );
}
