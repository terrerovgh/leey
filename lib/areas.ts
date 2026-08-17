/**
 * Area content for SEO landing pages (/areas/:city).
 * Each area has unique editorial copy in ES + EN so every city page is
 * indexable on its own ("realtor en Valdosta", "Hahira homes for sale", etc.).
 * Kept separate from i18n UI strings so it can be rendered both in the
 * SPA (Areas component) and in static pre-rendered HTML.
 */
export interface AreaContent {
  slug: string;
  city: string;
  state: "GA" | "FL";
  /** One-line positioning used on cards and meta. */
  taglineEs: string;
  taglineEn: string;
  /** Short paragraph for the section grid (already in i18n AreaDesc). */
  blurbEs: string;
  blurbEn: string;
  /** Longer SEO copy for the dedicated landing page. */
  bodyEs: string[];
  bodyEn: string[];
  /** Local search keywords surfaced as text + meta keywords. */
  keywordsEs: string[];
  keywordsEn: string[];
}

export const AREAS: AreaContent[] = [
  {
    slug: "valdosta",
    city: "Valdosta",
    state: "GA",
    taglineEs: "El centro del sur de Georgia para comprar o vender con guía local.",
    taglineEn: "South Georgia’s hub for buying or selling with local guidance.",
    blurbEs: "Centro del sur de Georgia. Barrios establecidos, campus y acceso a la I-75.",
    blurbEn: "South Georgia’s hub. Established neighborhoods, campus life, and I-75 access.",
    bodyEs: [
      "Valdosta es el centro económico del sur de Georgia: sede de Valdosta State University, hospital regional y corredores comerciales sobre la I-75. Sus barrios —Northside, Weedonville, Brookwood— combinan ranchos de ladrillo asequibles con casas nuevas en desarrollos planificados.",
      "Como agente bilingüe de Lock & Key Realty, licenciada en Georgia y Florida, ayudo a familias a comprar y vender en Valdosta en español o en inglés. Te oriento en precio por zona, escuelas y qué reparaciones valen la pena antes de listar o ofertar.",
    ],
    bodyEn: [
      "Valdosta is the economic hub of South Georgia — home to Valdosta State University, a regional hospital, and I-75 commercial corridors. Neighborhoods like Northside, Weedonville, and Brookwood mix affordable brick ranches with new construction in planned developments.",
      "As a bilingual Lock & Key Realty agent licensed in Georgia and Florida, I help families buy and sell in Valdosta in Spanish or English. I walk you through pricing by area, schools, and which repairs actually pay off before you list or offer.",
    ],
    keywordsEs: ["realtor Valdosta GA", "casas en venta Valdosta", "Valdosta homes for sale", "agente inmobiliario Valdosta", "Leey Hernandez Valdosta"],
    keywordsEn: ["Valdosta realtor", "homes for sale Valdosta GA", "Valdosta GA real estate agent", "Leey Hernandez Valdosta"],
  },
  {
    slug: "hahira",
    city: "Hahira",
    state: "GA",
    taglineEs: "Pueblo unido, lotes amplios, a minutos de Valdosta.",
    taglineEn: "Close-knit town, wider lots, minutes from Valdosta.",
    blurbEs: "Pueblo unido, lotes más amplios, a minutos de Valdosta.",
    blurbEn: "Close-knit town, wider lots, minutes from Valdosta.",
    bodyEs: [
      "Hahira conserva el encanto de un pueblo pequeño con lotes más generosos y una comunidad muy unida. Muchas familias se mudan aquí por las escuelas del condado de Lowndes y la tranquilidad, sin alejarse de los empleos de Valdosta.",
      "Te ayudo a encontrar esa casa con porche y jardín en Hahira, o a listar la tuya frente a los compradores que buscan justo eso: espacio y comunidad.",
    ],
    bodyEn: [
      "Hahira keeps small-town charm with wider lots and a tight-knit community. Many families move here for Lowndes County schools and the quiet — without giving up a Valdosta commute.",
      "I'll help you find that porch-and-yard home in Hahira, or list yours to the buyers who are specifically searching for space and community.",
    ],
    keywordsEs: ["realtor Hahira GA", "casas Hahira", "Hahira homes for sale"],
    keywordsEn: ["Hahira realtor", "homes for sale Hahira GA", "Hahira GA real estate"],
  },
  {
    slug: "adel",
    city: "Adel",
    state: "GA",
    taglineEs: "Condado de Cook. Buen valor y ambiente familiar.",
    taglineEn: "Cook County. Solid value and a family feel.",
    blurbEs: "Condado de Cook. Buen valor y ambiente familiar.",
    blurbEn: "Cook County. Solid value and a family feel.",
    bodyEs: [
      "Adel, en el condado de Cook, ofrece casas con muy buen valor y un ambiente familiar auténtico. Es ideal para quienes quieren más casa por su dinero y seguir cerca de la I-75.",
      "Conozco el inventario de Adel y te guío desde la búsqueda hasta el cierre, en el idioma que prefieras.",
    ],
    bodyEn: [
      "Adel, in Cook County, offers strong home value and an authentic family feel — ideal for buyers who want more house for the money while staying near I-75.",
      "I know Adel's inventory and I'll walk you from search to closing in the language you prefer.",
    ],
    keywordsEs: ["realtor Adel GA", "casas en Adel GA", "Adel real estate"],
    keywordsEn: ["Adel realtor", "homes for sale Adel GA", "Adel GA real estate"],
  },
  {
    slug: "sparks",
    city: "Sparks",
    state: "GA",
    taglineEs: "Opciones accesibles junto a Adel.",
    taglineEn: "Attainable options next to Adel.",
    blurbEs: "Opciones más accesibles junto a Adel.",
    blurbEn: "Attainable options next to Adel.",
    bodyEs: [
      "Sparks es una comunidad pequeña junto a Adel con opciones de vivienda más accesibles y un ritmo tranquilo. Perfecta para primera casa o inversión.",
      "Te ayudo a evaluar propiedades en Sparks y sus alrededores con datos reales de mercado.",
    ],
    bodyEn: [
      "Sparks is a small community next to Adel with attainable housing and a quiet pace — great for a first home or an investment.",
      "I'll help you evaluate Sparks and surrounding properties with real market data.",
    ],
    keywordsEs: ["realtor Sparks GA", "casas Sparks GA"],
    keywordsEn: ["Sparks realtor", "homes for sale Sparks GA"],
  },
  {
    slug: "lenox",
    city: "Lenox",
    state: "GA",
    taglineEs: "Vida de pueblo tranquilo cerca del corredor I-75.",
    taglineEn: "Quiet town living near the I-75 corridor.",
    blurbEs: "Vida de pueblo tranquilo cerca del corredor I-75.",
    blurbEn: "Quiet town living near the I-75 corridor.",
    bodyEs: [
      "Lenox combina la calma de un pueblo con la ventaja de estar cerca del corredor I-75. Buen punto de partida para quienes trabajan en la región.",
      "Busco contigo la propiedad adecuada en Lenox y te acompaño en todo el proceso.",
    ],
    bodyEn: [
      "Lenox pairs small-town calm with proximity to the I-75 corridor — a smart base for regional commuters.",
      "I'll search Lenox with you and stay with you through the whole process.",
    ],
    keywordsEs: ["realtor Lenox GA", "casas Lenox GA"],
    keywordsEn: ["Lenox realtor", "homes for sale Lenox GA"],
  },
  {
    slug: "ray-city",
    city: "Ray City",
    state: "GA",
    taglineEs: "Condado de Berrien. Casas con terreno y comunidad.",
    taglineEn: "Berrien County. Homes with land and community.",
    blurbEs: "Condado de Berrien. Casas con terreno y comunidad.",
    blurbEn: "Berrien County. Homes with land and community.",
    bodyEs: [
      "Ray City, en el condado de Berrien, atrae a quienes buscan casa con terreno y una comunidad cercana. Ideal para quienes quieren espacio sin irse lejos.",
      "Te ayudo a encontrar esa propiedad con terreno en Ray City y a cerrar sin sorpresas.",
    ],
    bodyEn: [
      "Ray City, in Berrien County, draws buyers wanting homes with land and a close community — space without going far.",
      "I'll help you find that land-and-home property in Ray City and close without surprises.",
    ],
    keywordsEs: ["realtor Ray City GA", "casas Ray City GA", "Ray City homes"],
    keywordsEn: ["Ray City realtor", "homes for sale Ray City GA"],
  },
  {
    slug: "moultrie",
    city: "Moultrie",
    state: "GA",
    taglineEs: "Condado de Colquitt. Pueblo activo con buen parque residencial.",
    taglineEn: "Colquitt County. Active town with solid residential stock.",
    blurbEs: "Condado de Colquitt. Pueblo activo con buen parque residencial.",
    blurbEn: "Colquitt County. Active town with solid residential stock.",
    bodyEs: [
      "Moultrie, en el condado de Colquitt, es un pueblo activo con inventario residencial sólido y lotes grandes. Conocida por su agricultura y eventos comunitarios.",
      "Si buscas casa con terreno en Moultrie, te ayudo a identificar la mejor opción y negociar el cierre.",
    ],
    bodyEn: [
      "Moultrie, in Colquitt County, is an active town with solid residential stock and large lots — known for agriculture and community events.",
      "If you want a home with land in Moultrie, I'll help you spot the best option and negotiate the close.",
    ],
    keywordsEs: ["realtor Moultrie GA", "casas Moultrie GA", "Moultrie homes for sale"],
    keywordsEn: ["Moultrie realtor", "homes for sale Moultrie GA"],
  },
  {
    slug: "thomasville",
    city: "Thomasville",
    state: "GA",
    taglineEs: "Condado de Thomas. Encanto histórico y barrios consolidados.",
    taglineEn: "Thomas County. Historic charm and established neighborhoods.",
    blurbEs: "Condado de Thomas. Encanto histórico y barrios consolidados.",
    blurbEn: "Thomas County. Historic charm and established neighborhoods.",
    bodyEs: [
      "Thomasville, en el condado de Thomas, destaca por su encanto histórico, sus bungalows y barrios con sombra de robles. Un mercado con carácter propio.",
      "Te ayudo a navegar el mercado histórico de Thomasville, desde bungalows restaurados hasta casas familiares.",
    ],
    bodyEn: [
      "Thomasville, in Thomas County, stands out for historic charm, oak-shaded streets, and character bungalows — a market with its own personality.",
      "I'll help you navigate Thomasville's historic market, from restored bungalows to family homes.",
    ],
    keywordsEs: ["realtor Thomasville GA", "casas Thomasville GA", "Thomasville homes for sale"],
    keywordsEn: ["Thomasville realtor", "homes for sale Thomasville GA"],
  },
  {
    slug: "nashville",
    city: "Nashville",
    state: "GA",
    taglineEs: "Condado de Berrien. Ritmo de pueblo pequeño y opciones accesibles.",
    taglineEn: "Berrien County. Small-town pace and attainable options.",
    blurbEs: "Condado de Berrien. Ritmo de pueblo pequeño y opciones accesibles.",
    blurbEn: "Berrien County. Small-town pace and attainable options.",
    bodyEs: [
      "Nashville, en el condado de Berrien, ofrece el ritmo de un pueblo pequeño y opciones de vivienda accesibles. Buen lugar para arraigarse.",
      "Te acompaño en la compra o venta de tu casa en Nashville con trato cercano y claro.",
    ],
    bodyEn: [
      "Nashville, in Berrien County, offers small-town pace and attainable housing — a good place to put down roots.",
      "I'll stand with you through buying or selling your Nashville home, with a close and clear approach.",
    ],
    keywordsEs: ["realtor Nashville GA", "casas Nashville GA"],
    keywordsEn: ["Nashville realtor", "homes for sale Nashville GA"],
  },
  {
    slug: "tifton",
    city: "Tifton",
    state: "GA",
    taglineEs: "Condado de Tift. Energía universitaria, comercios y casas familiares.",
    taglineEn: "Tift County. Campus energy, retail corridors, family homes.",
    blurbEs: "Condado de Tift. Energía universitaria, comercios y casas familiares.",
    blurbEn: "Tift County. Campus energy, retail corridors, family homes.",
    bodyEs: [
      "Tifton, en el condado de Tift, suma energía universitaria, corredores comerciales y casas familiares bien ubicadas. Punto clave sobre la I-75.",
      "Te ayudo a comprar o vender en Tifton con conocimiento del mercado local y seguimiento personal.",
    ],
    bodyEn: [
      "Tifton, in Tift County, blends campus energy, retail corridors, and well-located family homes — a key I-75 stop.",
      "I'll help you buy or sell in Tifton with local-market knowledge and personal follow-through.",
    ],
    keywordsEs: ["realtor Tifton GA", "casas Tifton GA", "Tifton homes for sale"],
    keywordsEn: ["Tifton realtor", "homes for sale Tifton GA"],
  },
  {
    slug: "north-florida",
    city: "North Florida",
    state: "FL",
    taglineEs: "Compra y vende al sur de la línea estatal.",
    taglineEn: "Buy and sell south of the state line.",
    blurbEs: "Compra y vende al sur de la línea estatal.",
    blurbEn: "Buy and sell south of the state line.",
    bodyEs: [
      "Si cruzas desde Georgia hacia el norte de Florida, trabajar con una sola agente licenciada en ambos estados evita cambiar de profesional a mitad de camino. Cubro la transición de un lado a otro con el mismo criterio y el mismo teléfono.",
      "Te ayudo a comprar o vender en el norte de Florida en español o en inglés, con el mismo proceso claro que uso en el sur de Georgia.",
    ],
    bodyEn: [
      "If you're crossing from Georgia into North Florida, one agent licensed in both states means you don't switch professionals mid-move. I cover the transition with the same judgment and the same phone number.",
      "I'll help you buy or sell in North Florida in Spanish or English, with the same clear process I use across South Georgia.",
    ],
    keywordsEs: ["realtor norte de Florida", "casas norte de Florida", "agente Florida Georgia"],
    keywordsEn: ["North Florida realtor", "homes for sale North Florida", "Florida Georgia agent"],
  },
];

export function getArea(slug: string): AreaContent | undefined {
  return AREAS.find((a) => a.slug === slug);
}
