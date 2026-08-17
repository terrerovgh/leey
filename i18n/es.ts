/**
 * Español — copy profesional, local y anti-slop.
 * Bilingüe solo en bio (+ frase corta opcional en hero).
 * No inventar métricas ni años de experiencia.
 */
export const es = {
  nav: {
    home: "Inicio",
    listings: "Propiedades",
    about: "Sobre mí",
    services: "Servicios",
    areas: "Zonas",
    testimonials: "Testimonios",
    contact: "Contacto",
    call: "Llamar",
    lang: "EN",
  },

  hero: {
    title: "Compra o vende en el sur de Georgia con una agente que habla tu idioma.",
    subtitle:
      "Leyanis “Leey” Hernandez, Lock & Key Realty. Licenciada en Georgia y Florida. Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton y el norte de Florida.",
    cta1: "Ver casas en venta",
    cta2: "Hablar con Leey",
    speakEs: "Atención en español e inglés",
  },

  marquee: {
    items: [
      "Valdosta",
      "Hahira",
      "Adel",
      "Sparks",
      "Lenox",
      "Ray City",
      "Moultrie",
      "Thomasville",
      "Nashville",
      "Tifton",
      "Norte de Florida",
    ],
  },

  about: {
    eyebrow: "Sobre mí",
    title: "Soy Leey.",
    paragraph1:
      "Me llamo Leyanis Hernandez. Nací en La Habana, Cuba, e inmigré a Estados Unidos en 1998. Soy madre de dos hijas y un hijo, y abuela de dos nietas. Junto a mi esposo dirijo un negocio de restauración y remodelación de casas en el sur de Georgia.",
    paragraph2:
      "Esa mirada de obra es lo que llevo a cada transacción: no solo encontrar una dirección bonita, sino un hogar sólido. Estoy licenciada en Georgia y Florida. Atiendo en español e inglés, con calma, números claros y sin prisa artificial.",
    signature: "Leey.",
  },

  services: {
    eyebrow: "Servicios",
    title: "Cómo te acompaño",
    items: [
      {
        title: "Comprar",
        desc: "Búsqueda local, visitas, ofertas y cierre. Filtro lo que no conviene y te explico el porqué.",
      },
      {
        title: "Vender",
        desc: "Precio realista, preparación de la casa y negociación hasta las llaves. Menos sorpresas en el camino.",
      },
      {
        title: "Primera vivienda",
        desc: "Financiación, inspecciones y papeles en lenguaje claro. Paso a paso, sin jerga innecesaria.",
      },
      {
        title: "Georgia y Florida",
        desc: "Una sola agente licenciada en ambos estados cuando tu compra o venta cruza la frontera.",
      },
    ],
  },

  process: {
    eyebrow: "Proceso",
    title: "Así trabajamos",
    steps: [
      {
        n: "01",
        title: "Conversamos",
        desc: "Presupuesto, plazos y lo que de verdad necesitas — no un catálogo genérico.",
      },
      {
        n: "02",
        title: "Plan local",
        desc: "Zonas, estructura e inversión con mirada de remodelación y mercado real.",
      },
      {
        n: "03",
        title: "Búsqueda o listado",
        desc: "Visitas curadas, o preparamos tu casa para salir al mercado con ventaja.",
      },
      {
        n: "04",
        title: "Negociación",
        desc: "Oferta y términos pensados para proteger tu dinero y tu tiempo.",
      },
      {
        n: "05",
        title: "Cierre",
        desc: "Inspección, tasación, financiamiento y entrega de llaves, sin dejar cabos sueltos.",
      },
    ],
  },

  areas: {
    eyebrow: "Zonas",
    title: "Dónde trabajo",
    subtitle:
      "Sur de Georgia y oportunidades al otro lado de la línea en Florida — mercados que conozco de cerca.",
    items: [
      {
        city: "Valdosta",
        desc: "Centro del sur de Georgia. Barrios establecidos, campus y acceso a la I-75.",
        highlight: true,
      },
      {
        city: "Hahira",
        desc: "Comunidad cercana, lotes amplios y minutos de Valdosta.",
      },
      {
        city: "Adel",
        desc: "Condado de Cook. Buen valor por metro y ritmo familiar.",
      },
      {
        city: "Sparks",
        desc: "Opciones más accesibles junto a Adel.",
      },
      {
        city: "Lenox",
        desc: "Calma de pueblo, cerca del corredor I-75.",
      },
      {
        city: "Ray City",
        desc: "Condado de Berrien. Casas con terreno y comunidad unida.",
      },
      {
        city: "Moultrie",
        desc: "Condado de Colquitt. Ciudad activa con buen stock residencial.",
      },
      {
        city: "Thomasville",
        desc: "Condado de Thomas. Encanto histórico y barrios consolidados.",
      },
      {
        city: "Nashville",
        desc: "Condado de Berrien. Ritmo de pueblo y opciones alcanzables.",
      },
      {
        city: "Tifton",
        desc: "Condado de Tift. Campus, comercio y vivienda familiar.",
      },
      {
        city: "Norte de Florida",
        desc: "Compras y ventas al sur de la frontera estatal, con licencia en Florida.",
      },
    ],
  },

  listings: {
    eyebrow: "Propiedades",
    title: "Listados Lock & Key Realty",
    subtitle:
      "Casas de Lock & Key Realty en el sur de Georgia y el norte de Florida. Cada ficha te conecta conmigo para visitas y ofertas.",
    viewAll: "Ver todas",
    filters: "Filtros",
    liveLabel: "Inventario actualizado",
    marketLabel: "Solo Lock & Key Realty",
    previewLabel: "Vista previa · aún no hay listados Lock & Key cargados",
    emptyAgent:
      "Ahora mismo no hay listados activos de Lock & Key en el sitio. Escríbeme y te muestro lo que hay en MLS hoy.",
    loadingLabel: "Cargando inventario…",
    search: {
      placeholder: "Ciudad, dirección o ZIP",
      type: "Tipo",
      beds: "Habitaciones",
      price: "Precio máximo",
      city: "Ciudad",
      all: "Todos",
      any: "Cualquiera",
      from: "Desde",
      upTo: "Hasta",
      clear: "Limpiar",
      apply: "Aplicar",
      noResults: "Sin resultados con esos filtros. Prueba otra ciudad o sube el precio.",
      nResults: (n: number) => `${n} ${n === 1 ? "propiedad" : "propiedades"}`,
    },
    types: {
      house: "Casa",
      townhouse: "Townhouse",
      condo: "Condo",
      land: "Terreno",
      multifamily: "Multifamiliar",
      commercial: "Comercial",
    },
    badges: {
      new: "Nuevo",
      hot: "Activo",
      reduced: "Rebajado",
      exclusive: "Exclusivo",
    },
    fields: {
      beds: "hab",
      baths: "baños",
      sqft: "sq ft",
      yearBuilt: "Año",
      lotSize: "Lote",
      hoa: "HOA",
    },
    cta: "Agendar visita",
    contactForPrice: "Consultar precio",
    sort: {
      newest: "Más recientes",
      priceAsc: "Precio: bajo a alto",
      priceDesc: "Precio: alto a bajo",
      sqftDesc: "Más tamaño",
    },
  },

  testimonials: {
    eyebrow: "Clientes",
    title: "Lo que cuentan",
    items: [
      {
        quote:
          "Leey nos explicó cada papel con calma. Compramos en Hahira sin sentirnos perdidos.",
        name: "Familia M.",
        role: "Hahira, GA",
      },
      {
        quote:
          "Conocía el mercado de Valdosta y nos orientó en las reparaciones antes de listar. Venta limpia.",
        name: "J. & A. Thompson",
        role: "Valdosta, GA",
      },
      {
        quote:
          "Cruzamos de Florida a Georgia. Una agente con licencia en ambos estados nos ahorró meses.",
        name: "Carlos R.",
        role: "Lowndes / N. Florida",
      },
    ],
  },

  contact: {
    eyebrow: "Contacto",
    title: "Cuéntame qué buscas.",
    subtitle: "Respondo el mismo día cuando puedo. Español o inglés.",
    formTitle: "Mensaje",
    formName: "Nombre",
    formEmail: "Email",
    formPhone: "Teléfono",
    formMessage: "¿Compras, vendes o quieres una visita?",
    formSend: "Enviar mensaje",
    formSending: "Enviando…",
    formSent: "Gracias. Te escribo pronto.",
    formPrivacy: "Tu información no se comparte.",
    directTitle: "Directo",
    phone: "Teléfono",
    email: "Email",
    office: "Brokerage",
    officeValue: "Lock & Key Realty",
    hours: "Lun–Sáb · 9 am – 7 pm",
  },

  footer: {
    tagline: "Realtor bilingüe · Sur de Georgia y Florida",
    columns: {
      navigate: "Navegación",
      services: "Servicios",
      legal: "Legal",
      contact: "Contacto",
    },
    legalLinks: {
      privacy: "Privacidad",
      fairHousing: "Equal Housing",
      license: "Licenciada GA & FL",
    },
    copyright: "Leyanis Hernandez",
    fairHousingNote: "Equal Housing Opportunity.",
  },
};

export type Strings = typeof es;
