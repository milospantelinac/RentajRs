// The 18px icon in the wizard's category pill. Dizajn 19 drew it as a line
// icon; Dizajn 50 (frame 1651:3254, section 7) puts the solid one in its place:
// the subcategory's own, and for a listing filed on a category without
// subcategories (Igraonice, Magacini, Mašine, Ostalo) that category's, from the
// Dizajn 17 cards for the first three. The pill's CSS scales whichever it gets
// to 18 and gives it the text colour.
import { getCategoryIconMarkup } from './categoryIcons'
import { getWizardCategoryIconMarkup } from './wizardCategoryIcons'

/** A category added later from the admin panel has no icon of its own, so it gets the search tiles' generic one. */
export function getWizardPillCategoryIconMarkup(slug) {
  return getCategoryIconMarkup(slug) || getWizardCategoryIconMarkup(slug)
}
