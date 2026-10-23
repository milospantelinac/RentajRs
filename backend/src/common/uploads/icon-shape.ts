import sharp from 'sharp';

/**
 * T129: an icon an admin uploads in Administracija > Kategorije (for a
 * category, or for a field or an amenity item) is shown like the site's own
 * SVG icons: one colour, the colour of the text around it (grey on an idle
 * card, blue on the chosen one). So only its shape is kept: black wherever the
 * icon is, transparent everywhere else, cut to the shape's own edges so it
 * fills its box as the library icons do. The site paints that shape in the
 * text colour (CategoryUploadedIcon.vue).
 *
 * A picture with a transparent background (a Figma or PNG export) gives its
 * shape by its alpha. A flat one (a JPG, a PNG on white) gives it by what
 * differs from the colour round its edge, so a dark icon on white and a white
 * icon on a coloured square both work. An SVG is drawn here first; nothing of
 * the uploaded file itself is ever served.
 */

/** Longest side the shape is worked out at; the widths the site uses are made from it. */
const WORK_SIZE = 1024;
/** A picture counts as having a transparent background from this share of see-through pixels. */
const SEE_THROUGH_SHARE = 0.01;
/** Below this alpha a pixel is background when the shape is cut to its edges. */
const EDGE_ALPHA = 8;
/** A flat picture whose strongest contrast to its background is below this has no shape in it. */
const MIN_CONTRAST = 24;
/** How many pixels must reach a contrast for it to count as the icon's own. */
const STRONGEST_PIXELS = 24;

export class EmptyIconError extends Error {}

/** The shape of an uploaded icon as a PNG, or EmptyIconError when there is none. Throws on a file sharp cannot read. */
export async function iconShape(input: Buffer, svg: boolean): Promise<Buffer> {
  const source = svg ? sharp(input, { density: await svgDensity(input) }) : sharp(input);
  const { data, info } = await source
    .rotate()
    .resize({ width: WORK_SIZE, height: WORK_SIZE, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const alpha = shapeAlpha(data, width, height);
  const box = boundsOf(alpha, width, height);
  if (!box) throw new EmptyIconError();

  // Black where the icon is; the colour comes from the page.
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      out[(y * box.width + x) * 4 + 3] = alpha[(box.top + y) * width + box.left + x];
    }
  }
  return sharp(out, { raw: { width: box.width, height: box.height, channels: 4 } }).png().toBuffer();
}

/** An SVG is drawn at a density that makes its longer side WORK_SIZE, however small its own size is. */
async function svgDensity(input: Buffer): Promise<number> {
  const { width, height } = await sharp(input).metadata();
  const longest = Math.max(width ?? 0, height ?? 0);
  if (!longest) return 72;
  return Math.min(Math.max((72 * WORK_SIZE) / longest, 1), 100000);
}

function shapeAlpha(rgba: Buffer, width: number, height: number): Uint8Array {
  const pixels = width * height;
  const alpha = new Uint8Array(pixels);
  let seeThrough = 0;
  for (let i = 0; i < pixels; i++) {
    alpha[i] = rgba[i * 4 + 3];
    if (alpha[i] < 250) seeThrough++;
  }
  if (seeThrough >= pixels * SEE_THROUGH_SHARE) return alpha;

  // A flat picture: how far each pixel is from the background's colour.
  const background = borderColour(rgba, width, height);
  const contrast = new Uint8Array(pixels);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < pixels; i++) {
    const d = Math.max(
      Math.abs(rgba[i * 4] - background[0]),
      Math.abs(rgba[i * 4 + 1] - background[1]),
      Math.abs(rgba[i * 4 + 2] - background[2]),
    );
    contrast[i] = d;
    histogram[d]++;
  }
  // The icon's own colour is the strongest contrast a few dozen of its pixels
  // reach, so a stray pixel (JPG noise) does not set it, a small icon does.
  let strongest = 0;
  for (let counted = 0, d = 255; d > 0; d--) {
    counted += histogram[d];
    if (counted >= STRONGEST_PIXELS) {
      strongest = d;
      break;
    }
  }
  if (strongest < MIN_CONTRAST) return new Uint8Array(pixels);
  // Faint noise round the background stays out; the icon's colour is fully opaque.
  const floor = strongest * 0.15;
  const span = strongest - floor;
  for (let i = 0; i < pixels; i++) {
    alpha[i] = Math.round(Math.min(Math.max((contrast[i] - floor) / span, 0), 1) * 255);
  }
  return alpha;
}

/** The background of a flat picture: the middle value of each channel along its edge. */
function borderColour(rgba: Buffer, width: number, height: number): [number, number, number] {
  const channels: [number[], number[], number[]] = [[], [], []];
  const take = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    channels[0].push(rgba[i]);
    channels[1].push(rgba[i + 1]);
    channels[2].push(rgba[i + 2]);
  };
  for (let x = 0; x < width; x++) {
    take(x, 0);
    take(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    take(0, y);
    take(width - 1, y);
  }
  const middle = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  return [middle(channels[0]), middle(channels[1]), middle(channels[2])];
}

function boundsOf(alpha: Uint8Array, width: number, height: number) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < EDGE_ALPHA) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}
