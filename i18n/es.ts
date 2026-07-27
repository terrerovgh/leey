/**
 * Español — copy compacto, sin repetición.
 * Bilingüe solo en bio (+ frase corta opcional).
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
    title: "Tu próxima casa en el sur de Georgia.",
    subtitle:
      "Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton y el norte de Florida.",
    cta1: "Ver propiedades",
    cta2: "Contactar",
    speakEs: "Hablamos español",
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
      "Me llamo Leyanis Hernandez. Nací en La Habana, Cuba, e inmigré a Estados Unidos en 1998. Soy madre de dos hijas y un hijo, y abuela de dos nietas. Junto a mi esposo dirigimos un negocio de restauración y remodelación de casas.",
    paragraph2:
      "Esa experiencia me llevó a la inmobiliaria: guiar a las familias no solo a mejorar un espacio, sino a ser dueñas de su hogar. Estoy licenciada en Georgia y Florida. Atiendo en español e inglés.",
    signature: "Leey.",
  },

  services: {
    eyebrow: "Servicios",
    title: "Cómo te ayudo",
    items: [
      {
        title: "Comprar",
        desc: "Búsqueda local, visitas, ofertas y cierre — con calma y números claros.",
      },
      {
        title: "Vender",
        desc: "Precio realista, preparación de la casa y negociación hasta las llaves.",
      },
      {
        title: "Primera vivienda",
        desc: "Financiación, inspecciones y papeles sin jerga, paso a paso.",
      },
      {
        title: "Georgia y Florida",
        desc: "Licencia en ambos estados si tu compra o venta cruza la frontera.",
      },
    ],
  },

  process: {
    eyebrow: "Proceso",
    title: "Cinco pasos",
    steps: [
      {
        n: "01",
        title: "Conversamos",
        desc: "Presupuesto, plazos y lo que de verdad buscas.",
      },
      {
        n: "02",
        title: "Plan local",
        desc: "Zonas, estructura e inversión con mirada de remodelación.",
      },
      {
        n: "03",
        title: "Búsqueda o listado",
        desc: "Visitas curadas, o preparamos tu casa para el mercado.",
      },
      {
        n: "04",
        title: "Negociación",
        desc: "Oferta y términos que protejan tu interés.",
      },
      {
        n: "05",
        title: "Cierre",
        desc: "Inspección, tasación, financiamiento y llaves.",
      },
    ],
  },

  areas: {
    eyebrow: "Zonas",
    title: "Dónde trabajo",
    subtitle: "Sur de Georgia y oportunidades al otro lado de la línea en Florida.",
    items: [
      {
        city: "Valdosta",
        desc: "El hub del sur de Georgia. Barrios establecidos y buen acceso.",
        highlight: true,
      },
      {
        city: "Hahira",
        desc: "Comunidad cercana, lotes amplios, minutos de Valdosta.",
      },
      {
        city: "Adel",
        desc: "Cook County. Valor sólido y ambiente familiar.",
      },
      {
        city: "Sparks",
        desc: "Opciones accesibles junto a Adel.",
      },
      {
        city: "Lenox",
        desc: "Calma de pueblo, cerca del corredor I-75.",
      },
      {
        city: "Ray City",
        desc: "Berrien County. Casas con terreno y comunidad unida.",
      },
      {
        city: "Moultrie",
        desc: "Colquitt County. Ciudad activa con buen stock residencial.",
      },
      {
        city: "Thomasville",
        desc: "Thomas County. Encanto histórico y barrios consolidados.",
      },
      {
        city: "Nashville",
        desc: "Berrien County. Ritmo de pueblo y opciones accesibles.",
      },
      {
        city: "Tifton",
        desc: "Tift County. Campus, corredores comerciales y vivienda familiar.",
      },
      {
        city: "Norte de Florida",
        desc: "Compras y ventas al sur de la frontera estatal.",
      },
    ],
  },

  listings: {
    eyebrow: "Propiedades",
    title: "Selección local",
    subtitle:
      "Inventario con Lock & Key Realty. Cada ficha muestra oficina, agente y contacto de Leey.",
    viewAll: "Ver todas",
    filters: "Filtros",
    search: {
      placeholder: "Ciudad o ZIP",
      type: "Tipo",
      beds: "Habitaciones",
      price: "Precio máximo",
      all: "Todos",
      any: "Cualquiera",
      from: "Desde",
      upTo: "Hasta",
      clear: "Limpiar",
      apply: "Aplicar",
      noResults: "Sin resultados con esos filtros.",
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
  },

  testimonials: {
    eyebrow: "Clientes",
    title: "Lo que dicen",
    items: [
      {
        quote:
          "Leey nos explicó cada papel con calma. Compramos en Hahira sin sentirnos perdidos.",
        name: "Familia M.",
        role: "Hahira, GA",
      },
      {
        quote:
          "Knew the Valdosta market and walked us through repairs before listing. Clean sale.",
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
    title: "Hablemos.",
    subtitle: "Respondo el mismo día, en la medida de lo posible.",
    formTitle: "Mensaje",
    formName: "Nombre",
    formEmail: "Email",
    formPhone: "Teléfono",
    formMessage: "¿En qué te ayudo?",
    formSend: "Enviar",
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
    tagline: "Realtor · Sur de Georgia y Florida",
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
