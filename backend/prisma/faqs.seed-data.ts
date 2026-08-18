/**
 * Initial FAQ content, migrated from the fixed faq.q1..q6/a1..a6 i18n keys
 * (locales/{sr,en}.json) into admin-editable rows. From here on, admins
 * manage this list through /admin/sadrzaj — this seed only sets the
 * starting point.
 */
export interface FaqSeed {
  sr: { question: string; answer: string };
  en: { question: string; answer: string };
}

export const faqs: FaqSeed[] = [
  {
    sr: {
      question: 'Kako mogu objaviti oglas?',
      answer:
        'Registrujete se, kroz čarobnjak u nekoliko koraka unesete podatke o oglasu i izaberete paket. Nakon što administrator odobri oglas, on postaje vidljiv gostima.',
    },
    en: {
      question: 'How do I publish a listing?',
      answer:
        "Sign up, fill in your listing through a short wizard, and choose a package. Once an admin approves it, your listing becomes visible to guests.",
    },
  },
  {
    sr: {
      question: 'Da li Rentaj naplaćuje proviziju?',
      answer:
        'Ne. Rentaj ne uzima proviziju po rezervaciji — prihod ostvarujemo isključivo kroz mesečnu ili godišnju pretplatu vlasnika. Sav novac od rezervacije ide direktno vama.',
    },
    en: {
      question: 'Does Rentaj charge a commission?',
      answer:
        "No. Rentaj doesn't take a commission per booking — our revenue comes exclusively from the owner's monthly or yearly subscription. All the money from a booking goes directly to you.",
    },
  },
  {
    sr: {
      question: 'Mogu li povezati postojeći kalendar?',
      answer:
        'Da, dostupna je iCal sinhronizacija (uvoz i izvoz), tako da izbegavate duple rezervacije ako oglas već koristite na drugim platformama.',
    },
    en: {
      question: 'Can I connect an existing calendar?',
      answer:
        "Yes, iCal sync (import and export) is available, so you avoid double bookings if you already list the same place elsewhere.",
    },
  },
  {
    sr: {
      question: 'Ko može koristiti Rentaj?',
      answer: 'Svako ko izdaje nekretnine, prostore za proslave, igraonice, vozila, mašine ili opremu.',
    },
    en: {
      question: 'Who can use Rentaj?',
      answer: 'Anyone renting out real estate, event venues, playrooms, vehicles, machinery, or equipment.',
    },
  },
  {
    sr: {
      question: 'Koje vrste rezervacija mogu da koristim?',
      answer:
        'Možete primati direktne rezervacije, rezervacije po boravku ili po terminu, sa ili bez ugrađenog rezervacionog sistema — u zavisnosti od vaših potreba.',
    },
    en: {
      question: 'What kinds of bookings can I use?',
      answer:
        "You can accept direct booking requests, stay-based or slot-based bookings, with or without the built-in booking system — depending on your needs.",
    },
  },
  {
    sr: {
      question: 'Mogu li primati poruke od gostiju pre rezervacije?',
      answer:
        'Da, ugrađeni sistem poruka omogućava komunikaciju sa gostima direktno kroz platformu, pre i posle rezervacije.',
    },
    en: {
      question: 'Can I receive messages from guests before a booking?',
      answer:
        "Yes, the built-in messaging system lets you communicate with guests directly through the platform, before and after a booking.",
    },
  },
];
