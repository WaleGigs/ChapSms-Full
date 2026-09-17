// components/public/Features.jsx
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";

const features = [
  ["Instant OTP Delivery", "Receive verification messages quickly."],
  ["Global Numbers", "Access virtual numbers from different countries."],
  ["Wallet System", "Fund wallet, buy numbers, and track transactions."],
  ["Developer API", "Connect ChapsSmS directly to your own application."],
];

export default function Features() {
  return (
    <Section className="bg-white dark:bg-gray-950" id="features">
      <div className="mb-12 max-w-2xl">
        <h2 className="text-3xl font-bold text-gray-950 dark:text-white md:text-4xl">
          Everything you need for SMS verification
        </h2>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Built for OTP receiving, wallet management, and API automation.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {features.map(([title, text]) => (
          <Card key={title}>
            <h3 className="text-lg font-bold text-gray-950 dark:text-white">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
              {text}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}