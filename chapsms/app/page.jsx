import Navbar from "@/components/public/Navbar";
import Hero from "@/components/public/Hero";
import Stats from "@/components/home/Stats";
import PopularServices from "@/components/home/PopularServices";
import AccountsAndVpns from "@/components/home/AccountsAndVpns";
import SupportedCountries from "@/components/home/SupportedCountries";
import AppPurpose from "@/components/home/AppPurpose";
import ApiPreview from "@/components/home/ApiPreview";
import Features from "@/components/public/Features";
import HowItWorks from "@/components/public/HowItWorks";
import FAQ from "@/components/home/FAQ";
import CTA from "@/components/home/CTA";
import Footer from "@/components/public/Footer";

export default function Home() {
  return (
    <main
      id="top"
      className="public-mobile-scope min-w-0 overflow-x-clip"
    >
      <Navbar />
      <Hero />
      <Stats />
      <PopularServices />
      <AccountsAndVpns />
      <SupportedCountries />
      <AppPurpose />
      <ApiPreview />
      <Features />
      <HowItWorks />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
