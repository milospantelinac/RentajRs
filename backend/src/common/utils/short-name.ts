/** "Milica J.": a booking row names the other side by first name and initial only. */
export function shortName(person: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!person) return null;
  const initial = person.lastName?.trim().charAt(0);
  return initial ? `${person.firstName} ${initial}.` : person.firstName;
}
