// components/home/SupportedCountries.jsx
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import Badge from "@/components/ui/Badge";

const countries = [
  { flag: "🇺🇸", name: "United States", numbers: "12,430", price: "$0.19" },
  { flag: "🇬🇧", name: "United Kingdom", numbers: "8,210", price: "$0.22" },
  { flag: "🇨🇦", name: "Canada", numbers: "5,940", price: "$0.24" },
  
];

export default function SupportedCountries() {
  return (
    <Section className="bg-slate-50 dark:bg-slate-950" id="countries">
      <SectionHeader
        badge="Global Coverage"
        title="Virtual numbers from multiple countries"
        text="ChapsSmS gives users access to international numbers with live availability and transparent starting prices."
        center
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {countries.map((country) => (
          <Card
            key={country.name}
            className="transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] text-3xl">
                  {country.flag}
                </div>

                <div>
                  <h3 className="font-bold text-[var(--foreground)]">
                    {country.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {country.numbers} numbers
                  </p>
                </div>
              </div>

              <Badge variant="success">Live</Badge>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-xl bg-[var(--background)] p-4">
              <span className="text-sm text-[var(--muted-foreground)]]">Starting price</span>
              <span className="font-black text-blue-600">{country.price}</span>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}