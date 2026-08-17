import { Hero } from "../components/Hero";
import { Marquee } from "../components/Marquee";
import { About } from "../components/About";
import { Services } from "../components/Services";
import { Process } from "../components/Process";
import { Areas } from "../components/Areas";
import { ListingsTeaser } from "../components/ListingsTeaser";
import { Testimonials } from "../components/Testimonials";
import { Contact } from "../components/Contact";
import { FinalCTA } from "../components/FinalCTA";
import { useI18n } from "../i18n";
import { useSeo } from "../lib/useSeo";
import { homeSeo } from "../lib/seo";

export function HomePage() {
  const { lang } = useI18n();
  useSeo(homeSeo(lang));
  return (
    <main>
      <Hero />
      <Marquee />
      <About />
      <Services />
      <Process />
      <Areas />
      <ListingsTeaser />
      <Testimonials />
      <Contact />
      <FinalCTA />
    </main>
  );
}
