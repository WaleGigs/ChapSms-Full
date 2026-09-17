// components/home/Stats.jsx
import StatCard from "@/components/ui/StatCard";
import Section from "@/components/ui/Section";

const stats = [
  {
    value: "150+",
    label: "Supported Countries",
  },
  {
    value: "900+",
    label: "Online Services",
  },
  {
    value: "6M+",
    label: "OTP Codes Delivered",
  },
  {
    value: "99.9%",
    label: "Platform Availability",
  },
];

export default function Stats() {
  return (
    <Section className="bg-[var(--background)]">
      <div className="grid gap-6 md:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} value={item.value} label={item.label} />
        ))}
      </div>
    </Section>
  );
}