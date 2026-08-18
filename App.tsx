/**
 * App shell — Header arriba (siempre visible), routes abajo.
 * El footer va dentro de cada layout de página para que aparezca después del contenido.
 */
import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { HomePage } from "./pages/Home";
import { ListingsPage } from "./pages/Listings";
import { PropertyDetailPage } from "./pages/PropertyDetail";
import { AreaPage } from "./pages/Area";
import { BlogPage } from "./pages/Blog";
import { BlogPostPage } from "./pages/BlogPost";
import { StudioApp } from "./pages/Studio";

export function App() {
  const loc = useLocation();
  const isStudio = loc.pathname.startsWith("/studio");

  // Safety net: si tras 3.5s el usuario NO ha hecho scroll (típico de un
  // crawler / renderizador headless / fullPage screenshot), forzamos
  // visibilidad para que el contenido nunca quede invisible. Si el usuario
  // SÍ scrolleó, las animaciones whileInView ya se dispararon normalmente.
  useEffect(() => {
    let scrolled = false;
    const onScroll = () => {
      scrolled = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true, once: true });
    const t = setTimeout(() => {
      if (!scrolled) document.documentElement.classList.add("fx-safe");
    }, 3500);
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  // Smooth scroll-to-anchor handling — cuando vas a /#contact desde otra ruta
  useEffect(() => {
    if (loc.hash) {
      const el = document.querySelector(loc.hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 60);
      }
    } else if (!isStudio) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [loc.pathname, loc.hash, isStudio]);

  if (isStudio) {
    return (
      <Routes>
        <Route path="/studio/*" element={<StudioApp />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-ivory-50 text-ink-900">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/properties" element={<ListingsPage />} />
        <Route path="/properties/:id" element={<PropertyDetailPage />} />
        <Route path="/areas/:slug" element={<AreaPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      <Footer />
    </div>
  );
}
