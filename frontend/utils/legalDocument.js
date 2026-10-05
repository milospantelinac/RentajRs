// Dizajn 48: a legal page body is admin-edited HTML (StaticPage.bodyHtml,
// written in Administracija > Sadrzaj), and its h2 headings are the page's
// sections. Each heading gets an id here for the "Sadrzaj" anchors, since the
// editor drops ids on save, and when every heading starts with a roman
// numeral ("I UVOD") the numeral moves into its own badge. Plain string work,
// so the server render and the browser build the same markup.

const ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const LATIN = { č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'dj' }

function decodeEntities(text) {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, name) => {
    if (name[0] === '#') {
      const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITIES[name.toLowerCase()] ?? match
  })
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function headingText(inner) {
  return decodeEntities(inner.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

// ASCII ids that start with a letter: the router looks an anchor up with
// querySelector('#...'), which throws on an id that starts with a digit.
function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/[čćšžđ]/g, (ch) => LATIN[ch])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return /^[a-z]/.test(slug) ? slug : `sekcija-${slug || 'bez-naslova'}`
}

export function buildLegalDocument(html) {
  const source = html || ''
  const headings = [...source.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => headingText(match[1]))
  const parts = headings.map((text) => {
    const [first, ...rest] = text.split(' ')
    return first && rest.length && ROMAN.test(first) ? { num: first, label: rest.join(' ') } : null
  })
  // Numbered only when every heading carries a numeral, so a heading that
  // merely starts with the word "I" never turns into a badge.
  const numbered = headings.length > 0 && parts.every(Boolean)

  const used = new Set()
  const sections = headings.map((text, i) => {
    const label = numbered ? parts[i].label : text
    const base = slugify(label)
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    return { id, num: numbered ? parts[i].num : '', label }
  })

  let index = 0
  const body = source.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi, () => {
    const section = sections[index++]
    const badge = section.num ? `<span class="legal-h2-num">${escapeHtml(section.num)}</span>` : ''
    return `<h2 id="${section.id}" class="legal-h2">${badge}<span class="legal-h2-text">${escapeHtml(section.label)}</span></h2>`
  })

  return { html: body, sections }
}
