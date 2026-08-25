/**
 * Ch.22.4 — every transactional email in the system, seeded as admin-editable
 * rows (R166/R171) rather than hardcoded strings. Placeholders use {token}
 * syntax; each listener in modules/email documents which tokens it fills in.
 *
 * The source doc's own section headers ("Nalog -- 7", "Oglasi -- 5", ...)
 * sum to 46, not the "Ukupno 41" stated at the top — an inconsistency in the
 * document itself. This file implements every individually named trigger
 * (45 of the 46 — "Promena e-mail adrese" is the one skipped, since no
 * change-email feature exists to fire it) rather than dropping real,
 * distinct triggers to force a match against an internally inconsistent
 * total.
 */
export interface EmailTemplateSeed {
  key: string;
  sr: { subject: string; heading: string; bodyText: string; buttonLabel: string | null };
  en: { subject: string; heading: string; bodyText: string; buttonLabel: string | null };
}

export const emailTemplates: EmailTemplateSeed[] = [
  // -- Nalog / Account -----------------------------------------------------
  {
    key: 'welcome_registration',
    sr: {
      subject: 'Dobrodošli na Rentaj',
      heading: 'Dobrodošli na Rentaj, {ime}',
      bodyText: 'Vaš nalog je kreiran. Potvrdite svoju e-mail adresu da biste mogli da objavljujete oglase i rezervišete.',
      buttonLabel: 'Potvrdi adresu',
    },
    en: {
      subject: 'Welcome to Rentaj',
      heading: 'Welcome to Rentaj, {ime}',
      bodyText: 'Your account has been created. Confirm your email address so you can publish listings and book.',
      buttonLabel: 'Confirm address',
    },
  },
  {
    key: 'verify_email_resend',
    sr: {
      subject: 'Potvrdite svoju e-mail adresu',
      heading: 'Potvrdite svoju e-mail adresu',
      bodyText: 'Zatražili ste novi link za potvrdu adrese. Kliknite na dugme ispod da dovršite potvrdu naloga.',
      buttonLabel: 'Potvrdi adresu',
    },
    en: {
      subject: 'Confirm your email address',
      heading: 'Confirm your email address',
      bodyText: 'You requested a new confirmation link. Click below to finish confirming your account.',
      buttonLabel: 'Confirm address',
    },
  },
  {
    key: 'password_reset_request',
    sr: {
      subject: 'Zahtev za novu lozinku',
      heading: 'Postavite novu lozinku',
      bodyText: 'Neko (verovatno vi) je zatražio promenu lozinke za ovaj nalog. Ako ovo niste bili vi, slobodno ignorišite ovu poruku.',
      buttonLabel: 'Postavi novu lozinku',
    },
    en: {
      subject: 'Request for a new password',
      heading: 'Set a new password',
      bodyText: 'Someone (probably you) requested a password change for this account. If this wasn’t you, you can safely ignore this email.',
      buttonLabel: 'Set new password',
    },
  },
  {
    key: 'password_changed',
    sr: {
      subject: 'Lozinka je promenjena',
      heading: 'Vaša lozinka je promenjena',
      bodyText: 'Lozinka za vaš Rentaj nalog je upravo promenjena. Ako niste vi izvršili ovu promenu, odmah kontaktirajte podršku.',
      buttonLabel: 'Otvori nalog',
    },
    en: {
      subject: 'Your password has been changed',
      heading: 'Your password has been changed',
      bodyText: 'The password for your Rentaj account was just changed. If this wasn’t you, contact support immediately.',
      buttonLabel: 'Open account',
    },
  },
  {
    key: 'two_factor_reset_by_password_reset',
    sr: {
      subject: 'Dvofaktorska autentikacija je isključena',
      heading: 'Dvofaktorska autentikacija je isključena',
      bodyText: 'Pošto ste upravo resetovali lozinku, dvofaktorska autentikacija na vašem nalogu je isključena — tako se rešava zaključavanje kada izgubite pristup aplikaciji za kodove. Ako ste administrator, moraćete da je ponovo podesite pri sledećoj prijavi. Ako niste vi zatražili resetovanje lozinke, odmah kontaktirajte podršku.',
      buttonLabel: 'Otvori nalog',
    },
    en: {
      subject: 'Two-factor authentication has been turned off',
      heading: 'Two-factor authentication has been turned off',
      bodyText: 'Since you just reset your password, two-factor authentication on your account has been turned off — that\'s how a lockout from your authenticator app gets resolved. If you\'re an admin, you\'ll need to set it up again on your next login. If you didn\'t request this password reset, contact support immediately.',
      buttonLabel: 'Open account',
    },
  },
  {
    key: 'new_device_login',
    sr: {
      subject: 'Nova prijava na vaš nalog',
      heading: 'Nova prijava na vaš nalog',
      bodyText: 'Prijavili ste se sa uređaja koji ranije nismo videli ({device}). Ako ste to bili vi, nema potrebe za akcijom.',
      buttonLabel: 'Pogledaj aktivnost',
    },
    en: {
      subject: 'New sign-in to your account',
      heading: 'New sign-in to your account',
      bodyText: 'Your account was just signed into from a device we haven’t seen before ({device}). If this was you, no action is needed.',
      buttonLabel: 'View activity',
    },
  },
  {
    key: 'account_blocked',
    sr: {
      subject: 'Vaš nalog je ograničen',
      heading: 'Vaš nalog je ograničen',
      bodyText: 'Administrator je ograničio vaš nalog. Razlog: {razlog}. Ako smatrate da je ovo greška, kontaktirajte podršku.',
      buttonLabel: 'Kontaktiraj podršku',
    },
    en: {
      subject: 'Your account has been restricted',
      heading: 'Your account has been restricted',
      bodyText: 'An administrator has restricted your account. Reason: {razlog}. If you believe this is a mistake, contact support.',
      buttonLabel: 'Contact support',
    },
  },

  // -- Oglasi / Listings -----------------------------------------------------
  {
    key: 'listing_submitted_for_approval',
    sr: {
      subject: 'Oglas je poslat na odobrenje',
      heading: 'Oglas "{oglas}" je poslat na odobrenje',
      bodyText: 'Administrator će pregledati vaš oglas u roku od 24 časa. Dobićete obaveštenje čim bude objavljen.',
      buttonLabel: 'Pogledaj oglas',
    },
    en: {
      subject: 'Listing sent for approval',
      heading: '"{oglas}" was sent for approval',
      bodyText: 'An administrator will review your listing within 24 hours. You’ll get a notification once it’s published.',
      buttonLabel: 'View listing',
    },
  },
  {
    key: 'listing_approved',
    sr: {
      subject: 'Vaš oglas je objavljen',
      heading: '"{oglas}" je sada objavljen',
      bodyText: 'Vaš oglas je prošao proveru i sada je vidljiv na Rentaju. Gosti ga od sada mogu pronaći i rezervisati.',
      buttonLabel: 'Pogledaj oglas',
    },
    en: {
      subject: 'Your listing is live',
      heading: '"{oglas}" is now live',
      bodyText: 'Your listing passed review and is now visible on Rentaj. Guests can find and book it from now on.',
      buttonLabel: 'View listing',
    },
  },
  {
    key: 'listing_rejected',
    sr: {
      subject: 'Oglas zahteva ispravku',
      heading: 'Oglas "{oglas}" zahteva ispravku',
      bodyText: 'Vaš oglas nije prošao proveru. Razlog: {razlog}. Ispravite navedeno i ponovo pošaljite oglas na odobrenje.',
      buttonLabel: 'Ispravi oglas',
    },
    en: {
      subject: 'Your listing needs a fix',
      heading: '"{oglas}" needs a fix',
      bodyText: 'Your listing didn’t pass review. Reason: {razlog}. Fix the issue and resubmit it for approval.',
      buttonLabel: 'Fix listing',
    },
  },
  {
    key: 'listing_edit_approved',
    sr: {
      subject: 'Izmene su objavljene',
      heading: 'Izmene oglasa "{oglas}" su objavljene',
      bodyText: 'Izmene koje ste poslali na proveru su odobrene i sada su vidljive na oglasu.',
      buttonLabel: 'Pogledaj oglas',
    },
    en: {
      subject: 'Your edits are live',
      heading: 'Your edits to "{oglas}" are live',
      bodyText: 'The changes you submitted for review have been approved and are now visible on the listing.',
      buttonLabel: 'View listing',
    },
  },
  {
    key: 'listing_edit_rejected',
    sr: {
      subject: 'Izmene nisu prihvaćene',
      heading: 'Izmene oglasa "{oglas}" nisu prihvaćene',
      bodyText: 'Razlog: {razlog}. Oglas ostaje u prethodnom stanju dok ponovo ne pošaljete izmene na proveru.',
      buttonLabel: 'Ispravi izmene',
    },
    en: {
      subject: 'Your edits were not accepted',
      heading: 'Your edits to "{oglas}" were not accepted',
      bodyText: 'Reason: {razlog}. The listing stays as it was until you resubmit your changes for review.',
      buttonLabel: 'Fix edits',
    },
  },

  // -- Rezervacije / Bookings -----------------------------------------------------
  {
    key: 'booking_requested_guest',
    sr: {
      subject: 'Zahtev je poslat — čekate odgovor',
      heading: 'Zahtev za "{oglas}" je poslat',
      bodyText: 'Vlasnik ima 24 časa da odgovori na vaš zahtev za rezervaciju. Obavestićemo vas čim odgovori.',
      buttonLabel: 'Pogledaj zahtev',
    },
    en: {
      subject: 'Request sent — awaiting a reply',
      heading: 'Your request for "{oglas}" was sent',
      bodyText: 'The owner has 24 hours to respond to your booking request. We’ll notify you as soon as they do.',
      buttonLabel: 'View request',
    },
  },
  {
    key: 'booking_requested_owner',
    sr: {
      subject: 'Nova rezervacija za {oglas}',
      heading: 'Novi zahtev za "{oglas}"',
      bodyText: 'Dobili ste novi zahtev za rezervaciju. Odgovorite u roku od 24 časa da ne biste izgubili gosta.',
      buttonLabel: 'Pogledaj zahtev',
    },
    en: {
      subject: 'New booking for {oglas}',
      heading: 'New request for "{oglas}"',
      bodyText: 'You’ve received a new booking request. Respond within 24 hours so you don’t lose the guest.',
      buttonLabel: 'View request',
    },
  },
  {
    key: 'booking_request_unopened_reminder',
    sr: {
      subject: 'Gost čeka odgovor — {oglas}',
      heading: 'Gost i dalje čeka odgovor',
      bodyText: 'Prošlo je 6 časova otkako je stigao zahtev za "{oglas}", a još uvek niste odgovorili. Brz odgovor povećava šansu da rezervacija bude potvrđena.',
      buttonLabel: 'Odgovori',
    },
    en: {
      subject: 'Guest is waiting — {oglas}',
      heading: 'A guest is still waiting for a reply',
      bodyText: 'It’s been 6 hours since a request came in for "{oglas}" and you haven’t responded yet. A quick reply improves your odds of confirming the booking.',
      buttonLabel: 'Reply',
    },
  },
  {
    key: 'booking_rejected',
    sr: {
      subject: 'Rezervacija nije prihvaćena',
      heading: 'Zahtev za "{oglas}" nije prihvaćen',
      bodyText: 'Vlasnik nije mogao da prihvati vaš zahtev za rezervaciju. Pogledajte slične oglase koji su dostupni za izabrani termin.',
      buttonLabel: 'Pretraži slično',
    },
    en: {
      subject: 'Booking not accepted',
      heading: 'Your request for "{oglas}" was not accepted',
      bodyText: 'The owner wasn’t able to accept your booking request. Take a look at similar listings available for your dates.',
      buttonLabel: 'Search similar',
    },
  },
  {
    key: 'booking_payment_instructions',
    sr: {
      subject: 'Uplatite {iznos} da potvrdite rezervaciju',
      heading: 'Uplatite {iznos} da potvrdite rezervaciju',
      bodyText:
        'Vaš zahtev za "{oglas}" je prihvaćen. Uplatite {iznos} do {rok} da potvrdite rezervaciju — u suprotnom termin se automatski oslobađa. Uplata ide direktno vlasniku; Rentaj ne posreduje u plaćanju i nema pristup vašim sredstvima.',
      buttonLabel: 'Otvori uputstvo',
    },
    en: {
      subject: 'Pay {iznos} to confirm your booking',
      heading: 'Pay {iznos} to confirm your booking',
      bodyText:
        'Your request for "{oglas}" was accepted. Pay {iznos} by {rok} to confirm the booking — otherwise the term is automatically released. Payment goes directly to the owner; Rentaj never mediates payment and has no access to your funds.',
      buttonLabel: 'Open instructions',
    },
  },
  {
    key: 'booking_payment_reminder_half',
    sr: {
      subject: 'Rok za uplatu ističe {rok}',
      heading: 'Podsetnik: rok za uplatu ističe {rok}',
      bodyText: 'Još uvek niste uplatili {iznos} za "{oglas}". Ako rok istekne bez uplate, termin se oslobađa i rezervacija se otkazuje.',
      buttonLabel: 'Otvori uputstvo',
    },
    en: {
      subject: 'Payment deadline is {rok}',
      heading: 'Reminder: payment deadline is {rok}',
      bodyText: 'You haven’t paid the {iznos} for "{oglas}" yet. If the deadline passes unpaid, the term is released and the booking is cancelled.',
      buttonLabel: 'Open instructions',
    },
  },
  {
    key: 'booking_payment_reminder_final',
    sr: {
      subject: 'Poslednji dan za uplatu',
      heading: 'Ovo je poslednji dan za uplatu',
      bodyText: 'Rok za uplatu {iznos} za "{oglas}" ističe danas ({rok}). Posle toga se rezervacija automatski otkazuje.',
      buttonLabel: 'Otvori uputstvo',
    },
    en: {
      subject: 'Last day to pay',
      heading: 'This is your last day to pay',
      bodyText: 'The deadline to pay {iznos} for "{oglas}" is today ({rok}). After that the booking is cancelled automatically.',
      buttonLabel: 'Open instructions',
    },
  },
  {
    key: 'booking_expired',
    sr: {
      subject: 'Rezervacija je istekla',
      heading: 'Rezervacija za "{oglas}" je istekla',
      bodyText: 'Rok za uplatu je prošao bez uplate, pa je rezervacija automatski otkazana i termin je ponovo dostupan.',
      buttonLabel: 'Pogledaj oglas',
    },
    en: {
      subject: 'Booking has expired',
      heading: 'The booking for "{oglas}" has expired',
      bodyText: 'The payment deadline passed with no payment, so the booking was automatically cancelled and the term is available again.',
      buttonLabel: 'View listing',
    },
  },
  {
    key: 'booking_confirmed_cash',
    sr: {
      subject: 'Rezervacija je potvrđena',
      heading: 'Rezervacija za "{oglas}" je potvrđena',
      bodyText: 'Vlasnik je prihvatio vaš zahtev. Plaćanje je gotovinsko i dogovara se direktno sa vlasnikom prilikom preuzimanja.',
      buttonLabel: 'Pogledaj detalje',
    },
    en: {
      subject: 'Booking confirmed',
      heading: 'Your booking for "{oglas}" is confirmed',
      bodyText: 'The owner accepted your request. Payment is by cash and is arranged directly with the owner at pickup/check-in.',
      buttonLabel: 'View details',
    },
  },
  {
    key: 'booking_payment_confirmed',
    sr: {
      subject: 'Rezervacija je potvrđena',
      heading: 'Uplata je potvrđena',
      bodyText: 'Vlasnik je potvrdio da je uplata za "{oglas}" primljena. Rezervacija je sada potvrđena.',
      buttonLabel: 'Pogledaj rezervaciju',
    },
    en: {
      subject: 'Booking confirmed',
      heading: 'Payment confirmed',
      bodyText: 'The owner confirmed that payment for "{oglas}" was received. The booking is now confirmed.',
      buttonLabel: 'View booking',
    },
  },
  {
    key: 'booking_cancelled',
    sr: {
      subject: 'Rezervacija je otkazana',
      heading: 'Rezervacija za "{oglas}" je otkazana',
      bodyText: 'Razlog: {razlog}. Ako imate pitanja, pogledajte detalje rezervacije.',
      buttonLabel: 'Pogledaj detalje',
    },
    en: {
      subject: 'Booking cancelled',
      heading: 'The booking for "{oglas}" was cancelled',
      bodyText: 'Reason: {razlog}. If you have questions, check the booking details.',
      buttonLabel: 'View details',
    },
  },
  {
    key: 'booking_reminder_day_before',
    sr: {
      subject: 'Sutra: {oglas}',
      heading: 'Podsetnik: sutra je "{oglas}"',
      bodyText: 'Vaša rezervacija je zakazana za sutra. Proverite detalje termina i uslove pre dolaska.',
      buttonLabel: 'Pogledaj detalje',
    },
    en: {
      subject: 'Tomorrow: {oglas}',
      heading: 'Reminder: tomorrow is "{oglas}"',
      bodyText: 'Your booking is scheduled for tomorrow. Double-check the term details and terms before you go.',
      buttonLabel: 'View details',
    },
  },
  {
    key: 'booking_no_show_marked',
    sr: {
      subject: 'Vlasnik je označio nedolazak',
      heading: 'Označeni ste kao "nije se pojavio"',
      bodyText: 'Vlasnik je označio da se niste pojavili na rezervaciji za "{oglas}". Ako smatrate da je ovo greška, možete osporiti oznaku.',
      buttonLabel: 'Ospori',
    },
    en: {
      subject: 'Owner marked you as a no-show',
      heading: 'You were marked as a no-show',
      bodyText: 'The owner marked you as a no-show for the "{oglas}" booking. If you believe this is a mistake, you can dispute it.',
      buttonLabel: 'Dispute',
    },
  },

  // -- Poruke i recenzije / Messages & reviews -----------------------------------------------------
  {
    key: 'new_message',
    sr: {
      subject: 'Nova poruka — {oglas}',
      heading: 'Nova poruka o "{oglas}"',
      bodyText: 'Dobili ste novu poruku. Odgovorite što pre da ne biste propustili priliku.',
      buttonLabel: 'Pogledaj poruku',
    },
    en: {
      subject: 'New message — {oglas}',
      heading: 'New message about "{oglas}"',
      bodyText: 'You’ve received a new message. Reply promptly so you don’t miss the opportunity.',
      buttonLabel: 'View message',
    },
  },
  {
    key: 'review_invitation',
    sr: {
      subject: 'Kako je prošlo? Ocenite {oglas}',
      heading: 'Kako je prošlo?',
      bodyText: 'Vaša rezervacija za "{oglas}" je realizovana. Ostavite recenziju — pomaže drugima da odaberu, a vidljiva je tek kada obe strane ocene.',
      buttonLabel: 'Ostavi recenziju',
    },
    en: {
      subject: 'How did it go? Rate {oglas}',
      heading: 'How did it go?',
      bodyText: 'Your booking for "{oglas}" is complete. Leave a review — it helps others choose, and only becomes visible once both sides have reviewed.',
      buttonLabel: 'Leave a review',
    },
  },
  {
    key: 'reviews_published',
    sr: {
      subject: 'Ocene su objavljene',
      heading: 'Recenzije za "{oglas}" su objavljene',
      bodyText: 'Obe strane su ostavile recenziju, pa su sada obe javno vidljive.',
      buttonLabel: 'Pogledaj recenzije',
    },
    en: {
      subject: 'Reviews are published',
      heading: 'Reviews for "{oglas}" are published',
      bodyText: 'Both sides have left a review, so both are now publicly visible.',
      buttonLabel: 'View reviews',
    },
  },
  {
    key: 'review_reminder_7d',
    sr: {
      subject: 'Podsećamo: ocenite {oglas}',
      heading: 'Podsetnik za ocenu',
      bodyText: 'Prošlo je 7 dana od realizacije rezervacije za "{oglas}", a još niste ostavili recenziju. Ostavite je pre nego što prođe 14 dana.',
      buttonLabel: 'Ostavi recenziju',
    },
    en: {
      subject: 'Reminder: rate {oglas}',
      heading: 'Review reminder',
      bodyText: 'It’s been 7 days since your booking for "{oglas}" was completed and you haven’t left a review yet. Leave one before the 14-day window closes.',
      buttonLabel: 'Leave a review',
    },
  },
  {
    key: 'review_replied',
    sr: {
      subject: 'Vlasnik je odgovorio na vašu recenziju',
      heading: 'Dobili ste odgovor na recenziju',
      bodyText: 'Vlasnik oglasa "{oglas}" je odgovorio na vašu recenziju.',
      buttonLabel: 'Pogledaj odgovor',
    },
    en: {
      subject: 'The owner replied to your review',
      heading: 'You got a reply to your review',
      bodyText: 'The owner of "{oglas}" replied to your review.',
      buttonLabel: 'View reply',
    },
  },

  // -- Pretplata / Subscription -----------------------------------------------------
  {
    key: 'subscription_activated',
    sr: {
      subject: 'Paket je aktiviran',
      heading: 'Paket {paket} je aktiviran',
      bodyText: 'Vaša pretplata je aktivna. Naplaćeno: {iznos}, dana {datum}. Upravljajte oglasima i paketima iz kontrolne table.',
      buttonLabel: 'Otvori kontrolnu tablu',
    },
    en: {
      subject: 'Your package is active',
      heading: '{paket} is now active',
      bodyText: 'Your subscription is active. Charged: {iznos} on {datum}. Manage your listings and packages from the dashboard.',
      buttonLabel: 'Open dashboard',
    },
  },
  {
    key: 'subscription_invoice',
    sr: {
      subject: 'Račun za {paket}',
      heading: 'Vaš račun je spreman',
      bodyText: 'Paket: {paket}. Iznos: {iznos}. Datum: {datum}. Broj računa: {broj}. Sačuvajte ovaj mejl za svoju evidenciju.',
      buttonLabel: 'Pogledaj pretplatu',
    },
    en: {
      subject: 'Invoice for {paket}',
      heading: 'Your invoice is ready',
      bodyText: 'Package: {paket}. Amount: {iznos}. Date: {datum}. Invoice number: {broj}. Keep this email for your records.',
      buttonLabel: 'View subscription',
    },
  },
  {
    key: 'subscription_pro_forma',
    sr: {
      subject: 'Predračun za obnovu',
      heading: 'Predračun za {paket}',
      bodyText: 'U prilogu je predračun za pravna lica. Paket se aktivira nakon što administrator potvrdi uplatu.',
      buttonLabel: 'Preuzmi predračun',
    },
    en: {
      subject: 'Pro forma invoice for renewal',
      heading: 'Pro forma invoice for {paket}',
      bodyText: 'Attached is the pro forma invoice for legal entities. The package activates once an administrator confirms the transfer.',
      buttonLabel: 'Download pro forma',
    },
  },
  {
    key: 'subscription_expiring_soon',
    sr: {
      subject: 'Oglas prestaje da radi za {broj} dana',
      heading: 'Pretplata ističe za {broj} dana',
      bodyText: 'Vaš paket {paket} ističe {datum}. Obnovite pretplatu da oglas ostane vidljiv gostima.',
      buttonLabel: 'Obnovi',
    },
    en: {
      subject: 'Your listing stops working in {broj} day(s)',
      heading: 'Subscription expires in {broj} day(s)',
      bodyText: 'Your {paket} package expires on {datum}. Renew your subscription to keep the listing visible to guests.',
      buttonLabel: 'Renew',
    },
  },
  {
    key: 'subscription_expired',
    sr: {
      subject: 'Oglas više nije vidljiv',
      heading: 'Pretplata je istekla',
      bodyText: 'Paket {paket} je istekao, pa oglas više nije vidljiv gostima. Obnovite pretplatu da ga ponovo objavite.',
      buttonLabel: 'Obnovi',
    },
    en: {
      subject: 'Your listing is no longer visible',
      heading: 'Your subscription has expired',
      bodyText: 'The {paket} package expired, so the listing is no longer visible to guests. Renew your subscription to publish it again.',
      buttonLabel: 'Renew',
    },
  },

  // -- Administrator -----------------------------------------------------
  {
    key: 'admin_new_listing_to_review',
    sr: {
      subject: 'Nov oglas na proveru: {oglas}',
      heading: 'Nov oglas čeka proveru',
      bodyText: 'Oglas "{oglas}" je poslat na odobrenje i čeka u redu za rad.',
      buttonLabel: 'Otvori red za rad',
    },
    en: {
      subject: 'New listing to review: {oglas}',
      heading: 'A new listing is waiting for review',
      bodyText: '"{oglas}" was submitted for approval and is waiting in the moderation queue.',
      buttonLabel: 'Open queue',
    },
  },
  {
    key: 'admin_proposed_category',
    sr: {
      subject: 'Predložena kategorija: {kategorija}',
      heading: 'Predložena je nova kategorija',
      bodyText: 'Korisnik je predložio kategoriju "{kategorija}" koja ne postoji u trenutnoj taksonomiji.',
      buttonLabel: 'Pregledaj predlog',
    },
    en: {
      subject: 'Proposed category: {kategorija}',
      heading: 'A new category was proposed',
      bodyText: 'A user proposed the category "{kategorija}", which doesn’t exist in the current taxonomy.',
      buttonLabel: 'Review proposal',
    },
  },
  {
    key: 'admin_listing_reported',
    sr: {
      subject: 'Prijava oglasa: {oglas}',
      heading: 'Oglas je prijavljen',
      bodyText: 'Oglas "{oglas}" je prijavljen od strane korisnika i čeka pregled.',
      buttonLabel: 'Pregledaj prijavu',
    },
    en: {
      subject: 'Listing reported: {oglas}',
      heading: 'A listing was reported',
      bodyText: '"{oglas}" was reported by a user and is waiting for review.',
      buttonLabel: 'Review report',
    },
  },
  {
    key: 'admin_listing_report_priority',
    sr: {
      subject: 'Hitno: {oglas} ima više prijava',
      heading: 'Oglas je dostigao prag za prioritetnu proveru',
      bodyText: 'Oglas "{oglas}" je prijavljen {broj} puta — dostignut je prag za prioritetnu proveru (R144).',
      buttonLabel: 'Pregledaj prijave',
    },
    en: {
      subject: 'Urgent: {oglas} has multiple reports',
      heading: 'A listing crossed the priority-review threshold',
      bodyText: '"{oglas}" has been reported {broj} times — this crosses the priority-review threshold (R144).',
      buttonLabel: 'Review reports',
    },
  },
  {
    key: 'admin_payment_disputed',
    sr: {
      subject: 'Spor oko uplate — {oglas}',
      heading: 'Prijavljen je spor oko uplate',
      bodyText: 'Gost je prijavio da je uplatu poslao, ali vlasnik nije potvrdio prijem za "{oglas}".',
      buttonLabel: 'Pregledaj spor',
    },
    en: {
      subject: 'Payment dispute — {oglas}',
      heading: 'A payment dispute was filed',
      bodyText: 'A guest reported sending payment that the owner hasn’t confirmed for "{oglas}".',
      buttonLabel: 'Review dispute',
    },
  },
  {
    key: 'admin_no_show_disputed',
    sr: {
      subject: 'Osporena oznaka nedolaska — {oglas}',
      heading: 'Oznaka nedolaska je osporena',
      bodyText: 'Gost je osporio oznaku "nije se pojavio" za rezervaciju "{oglas}".',
      buttonLabel: 'Pregledaj spor',
    },
    en: {
      subject: 'Disputed no-show — {oglas}',
      heading: 'A no-show mark was disputed',
      bodyText: 'A guest disputed the "no-show" mark on the "{oglas}" booking.',
      buttonLabel: 'Review dispute',
    },
  },
  {
    key: 'admin_new_booking',
    sr: {
      subject: 'Nova rezervacija — {oglas}',
      heading: 'Nova rezervacija je kreirana',
      bodyText: 'Nova rezervacija je kreirana za "{oglas}". Ovo obaveštenje možete isključiti u podešavanjima.',
      buttonLabel: 'Pogledaj rezervaciju',
    },
    en: {
      subject: 'New booking — {oglas}',
      heading: 'A new booking was created',
      bodyText: 'A new booking was created for "{oglas}". You can turn this notification off in settings.',
      buttonLabel: 'View booking',
    },
  },

  // -- Zaštita podataka / Data protection -----------------------------------------------------
  {
    key: 'account_deletion_confirm',
    sr: {
      subject: 'Potvrdite brisanje naloga',
      heading: 'Potvrdite brisanje naloga',
      bodyText:
        'Zatražili ste brisanje svog Rentaj naloga. Ova radnja je trajna. Ako ste sigurni, potvrdite ispod — link važi 1 čas. Ako niste vi zatražili ovo, ignorišite ovu poruku.',
      buttonLabel: 'Potvrdi brisanje',
    },
    en: {
      subject: 'Confirm account deletion',
      heading: 'Confirm account deletion',
      bodyText:
        'You requested deletion of your Rentaj account. This action is permanent. If you’re sure, confirm below — the link is valid for 1 hour. If you didn’t request this, ignore this email.',
      buttonLabel: 'Confirm deletion',
    },
  },
  {
    key: 'data_export_ready',
    sr: {
      subject: 'Vaši podaci su spremni',
      heading: 'Vaši podaci su spremni za preuzimanje',
      bodyText: 'Pripremili smo izvoz svih vaših podataka sa Rentaja, u skladu sa pravom na prenosivost podataka.',
      buttonLabel: 'Preuzmi',
    },
    en: {
      subject: 'Your data is ready',
      heading: 'Your data is ready for download',
      bodyText: 'We’ve prepared an export of all your Rentaj data, in line with your right to data portability.',
      buttonLabel: 'Download',
    },
  },

  // -- Kontakt / Contact form (T15) -----------------------------------------
  {
    key: 'contact_message_received',
    sr: {
      subject: 'Nova poruka sa kontakt forme: {naslov}',
      heading: 'Nova poruka sa /kontakt',
      bodyText: 'Od: {ime} ({email})<br/><br/>Naslov: {naslov}<br/><br/>{poruka}',
      buttonLabel: null,
    },
    en: {
      subject: 'New contact form message: {naslov}',
      heading: 'New message from /kontakt',
      bodyText: 'From: {ime} ({email})<br/><br/>Subject: {naslov}<br/><br/>{poruka}',
      buttonLabel: null,
    },
  },
  // -- Ostalo / Other -----------------------------------------------------
  {
    key: 'listing_price_dropped',
    sr: {
      subject: 'Cena je pala za {oglas}',
      heading: 'Cena je pala za sačuvani oglas',
      bodyText: 'Oglas "{oglas}" koji ste sačuvali sada ima nižu cenu nego kada ste ga dodali u sačuvano.',
      buttonLabel: 'Pogledaj oglas',
    },
    en: {
      subject: 'Price dropped for {oglas}',
      heading: 'Price dropped on a saved listing',
      bodyText: '"{oglas}", which you saved, now has a lower price than when you added it to your favorites.',
      buttonLabel: 'View listing',
    },
  },
];
