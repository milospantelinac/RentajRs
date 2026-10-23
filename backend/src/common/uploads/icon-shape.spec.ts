import sharp from 'sharp';
import { EmptyIconError, iconShape } from './icon-shape';

// A drop with a leaf cut out of it, in a 30 box like the site's icons. The drop
// spans x 5 to 25 and y 2 to 28.5; (15, 24) is inside it, (14.5, 16.5) in the leaf.
const DROP = (fill: string, size: number, background = '') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 30 30">
${background ? `<rect width="30" height="30" fill="${background}"/>` : ''}
<path fill-rule="evenodd" fill="${fill}" d="M15 2C15 2 5 13.5 5 19.5C5 25 9.5 28.5 15 28.5C20.5 28.5 25 25 25 19.5C25 13.5 15 2 15 2ZM11 20C11 16 14 13 19 12C18 17 15.5 20.5 11 21Z"/>
</svg>`);

async function shapeOf(output: Buffer) {
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // The drop's own coordinates, mapped onto the cut picture.
  const alphaAt = (x: number, y: number) => {
    const px = Math.round(((x - 5) / 20) * (info.width - 1));
    const py = Math.round(((y - 2) / 26.5) * (info.height - 1));
    return data[(py * info.width + px) * 4 + 3];
  };
  const rgbAt = (x: number, y: number) => {
    const px = Math.round(((x - 5) / 20) * (info.width - 1));
    const py = Math.round(((y - 2) / 26.5) * (info.height - 1));
    const i = (py * info.width + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  return { width: info.width, height: info.height, alphaAt, rgbAt };
}

describe('iconShape (T129)', () => {
  it('keeps the shape of a transparent PNG, cut to its edges, in black', async () => {
    const png = await sharp(DROP('#CED6DE', 120)).png().toBuffer();

    const shape = await shapeOf(await iconShape(png, false));

    // 20 x 26.5 of the 30 box, at 4 px a unit.
    expect(Math.abs(shape.width - 80)).toBeLessThanOrEqual(2);
    expect(Math.abs(shape.height - 106)).toBeLessThanOrEqual(2);
    expect(shape.alphaAt(15, 24)).toBeGreaterThan(240);
    expect(shape.alphaAt(14.5, 16.5)).toBeLessThan(15);
    expect(shape.rgbAt(15, 24)).toEqual([0, 0, 0]);
  });

  it('finds a dark icon on a white JPG by its contrast to the background', async () => {
    const jpg = await sharp(DROP('#000', 512, '#fff')).flatten({ background: '#fff' }).jpeg({ quality: 75 }).toBuffer();

    const shape = await shapeOf(await iconShape(jpg, false));

    expect(shape.width).toBeLessThan(512 * 0.7);
    expect(shape.alphaAt(15, 24)).toBeGreaterThan(240);
    expect(shape.alphaAt(14.5, 16.5)).toBeLessThan(15);
  });

  it('finds a light icon on a coloured square the same way', async () => {
    const png = await sharp(DROP('#fff', 256, '#0957df')).flatten({ background: '#0957df' }).png().toBuffer();

    const shape = await shapeOf(await iconShape(png, false));

    expect(shape.alphaAt(15, 24)).toBeGreaterThan(240);
    expect(shape.alphaAt(14.5, 16.5)).toBeLessThan(15);
  });

  it('draws a small SVG large, so the icon stays sharp on any screen', async () => {
    const shape = await shapeOf(await iconShape(DROP('#CED6DE', 30), true));

    // The drop's 26.5 of 30 at a longer side of 1024.
    expect(Math.abs(shape.height - 905)).toBeLessThanOrEqual(6);
    expect(shape.alphaAt(15, 24)).toBeGreaterThan(240);
    expect(shape.alphaAt(14.5, 16.5)).toBeLessThan(15);
  });

  it('drops the empty room round an icon placed on a large canvas', async () => {
    const roomy = await sharp({ create: { width: 2000, height: 1400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp(DROP('#0957df', 300)).png().toBuffer(), left: 1200, top: 300 }])
      .png()
      .toBuffer();

    const shape = await shapeOf(await iconShape(roomy, false));

    // 200 x 265 of the canvas, which is drawn at 1024 / 2000.
    expect(Math.abs(shape.width - 102)).toBeLessThanOrEqual(3);
    expect(Math.abs(shape.height - 136)).toBeLessThanOrEqual(3);
  });

  it('refuses a picture with no shape in it', async () => {
    const white = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } }).png().toBuffer();
    const clear = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();

    await expect(iconShape(white, false)).rejects.toBeInstanceOf(EmptyIconError);
    await expect(iconShape(clear, false)).rejects.toBeInstanceOf(EmptyIconError);
  });

  it('fails on a file that is no picture', async () => {
    await expect(iconShape(Buffer.from('<html></html>'), false)).rejects.not.toBeInstanceOf(EmptyIconError);
  });
});
