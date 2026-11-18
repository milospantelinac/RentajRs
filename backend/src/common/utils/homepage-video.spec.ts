import { HOMEPAGE_VIDEO_KEYS, readHomepageVideo } from './homepage-video';

const FILE = '0b6f8e5e-6a43-4c39-9a52-2f3f43c9a001.mp4';
const LINK = 'https://www.youtube.com/watch?v=2PuFyjAs7JA';
const upload = { file: FILE, name: 'vodic.mp4', size: 1234, type: 'video/mp4', codecs: ['avc1'], uploadedAt: '2026-11-18T12:00:00.000Z' };

const values = (entries: Partial<Record<keyof typeof HOMEPAGE_VIDEO_KEYS, unknown>>) =>
  Object.fromEntries(Object.entries(entries).map(([name, value]) => [HOMEPAGE_VIDEO_KEYS[name as keyof typeof HOMEPAGE_VIDEO_KEYS], value]));

describe('readHomepageVideo: what the homepage shows', () => {
  it('shows nothing without a link or an uploaded video', () => {
    expect(readHomepageVideo(values({ link: '', upload: '' })).showing).toBeNull();
    expect(readHomepageVideo({}).showing).toBeNull();
  });

  it('shows the only one there is, whatever was chosen', () => {
    expect(readHomepageVideo(values({ link: ` ${LINK} `, source: 'upload' }))).toMatchObject({ link: LINK, showing: 'link' });
    expect(readHomepageVideo(values({ upload, source: 'link' }))).toMatchObject({ showing: 'upload' });
  });

  it('shows the chosen one when there are both, the upload when nothing was chosen', () => {
    expect(readHomepageVideo(values({ link: LINK, upload, source: 'link' })).showing).toBe('link');
    expect(readHomepageVideo(values({ link: LINK, upload, source: 'upload' })).showing).toBe('upload');
    expect(readHomepageVideo(values({ link: LINK, upload })).showing).toBe('upload');
  });

  it('ignores an upload value that names no file it could have stored', () => {
    for (const bad of ['', 'x', { file: '../../etc/passwd' }, { file: `${FILE}/..` }, [FILE], null]) {
      expect(readHomepageVideo(values({ link: LINK, upload: bad })).upload).toBeNull();
    }
  });

  it('takes the type from the stored name and keeps the rest of the row', () => {
    const webm = readHomepageVideo(values({ upload: { ...upload, file: FILE.replace('.mp4', '.webm'), type: 'video/mp4' } }));
    expect(webm.upload?.type).toBe('video/webm');
    expect(readHomepageVideo(values({ upload })).upload).toEqual(upload);
  });
});
