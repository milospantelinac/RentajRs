/**
 * T119: finding a place among some six thousand settlements as it is typed.
 * A visitor writes "sur", "Surduk", "Сурдук", "djurdjevo" or "durdevo": the
 * text is read in Latin, without the diacritics and with đ and dj as d, and
 * each typed word has to start a word of the place's name or of its
 * municipality ("novo selo leb" is Novo Selo near Lebane).
 */

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj',
  м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č',
  џ: 'dž', ш: 'š',
};

/** Lower case, Latin, no diacritics, đ and dj as d, words split by single spaces. */
export function foldPlaceText(text: string): string {
  return [...String(text ?? '').toLowerCase()]
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join('')
    .replace(/đ/g, 'd')
    .replace(/dj/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function placeWords(text: string): string[] {
  const folded = foldPlaceText(text);
  return folded ? folded.split(' ') : [];
}

export type PlaceKindName = 'SEAT' | 'TOWN' | 'VILLAGE';

/** A seat before a town before a village, among names that match as well. */
export const PLACE_KIND_ORDER: Record<PlaceKindName, number> = { SEAT: 2, TOWN: 1, VILLAGE: 0 };

export interface PlaceMatchFields {
  /** The folded name. */
  folded: string;
  /** The folded words of the name. */
  nameWords: string[];
  /** Words that may narrow it down without being its name: the municipality, a part's city. */
  extraWords: string[];
}

/** A typed word this short narrows by the name only: "nova p" is not Novake near Prizren. */
const MIN_EXTRA_WORD_LENGTH = 3;

/**
 * How well the typed text names the place: 5 the whole name, 4.5 its first
 * words ("nova" is Nova Pazova before Novaci), 4 the start of it, 3 the start
 * of the first word and every word in the name, 2 every word in the name, 1
 * when a word was found only in the municipality; -1 when a typed word
 * starts no word at all.
 */
export function scorePlace(typed: string, place: PlaceMatchFields): number {
  const query = foldPlaceText(typed);
  if (!query) return 0;
  const tokens = query.split(' ');
  const startsWord = (token: string) =>
    place.nameWords.some((word) => word.startsWith(token)) ||
    (token.length >= MIN_EXTRA_WORD_LENGTH && place.extraWords.some((word) => word.startsWith(token)));
  if (!tokens.every(startsWord)) return -1;
  if (place.folded === query) return 5;
  if (place.folded.startsWith(query)) return place.folded[query.length] === ' ' ? 4.5 : 4;
  const inName = tokens.every((token) => place.nameWords.some((word) => word.startsWith(token)));
  if (inName && place.nameWords[0]?.startsWith(tokens[0])) return 3;
  return inName ? 2 : 1;
}

/** The match fields of a place, from its name and whatever else may narrow it down. */
export function placeMatchFields(name: string, extra: Array<string | null | undefined> = []): PlaceMatchFields {
  return {
    folded: foldPlaceText(name),
    nameWords: placeWords(name),
    extraWords: extra.filter(Boolean).flatMap((text) => placeWords(text as string)),
  };
}

/** Sorting by the name the way a Serbian reader expects (č after c, š after s). */
export const placeNameCollator = new Intl.Collator('sr-Latn', { sensitivity: 'base' });
