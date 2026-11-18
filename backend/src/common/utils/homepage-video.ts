import { VIDEO_FILE_NAME } from '../uploads/site-video';

/**
 * The homepage "how it works" video, kept in four Setting rows: a link
 * (YouTube, Vimeo or a direct file URL), a video uploaded to this server, the
 * poster shown over either, and which of the two shows when there are both.
 */
export const HOMEPAGE_VIDEO_KEYS = {
  link: 'homepage_video_url',
  poster: 'homepage_video_thumbnail',
  upload: 'homepage_video_upload',
  source: 'homepage_video_source',
} as const;

export const HOMEPAGE_VIDEO_SOURCES = ['link', 'upload'] as const;
export type HomepageVideoSource = (typeof HOMEPAGE_VIDEO_SOURCES)[number];

export interface HomepageVideoUpload {
  /** The stored file's name in UPLOADS_DIR/videos, also its address under /videos/. */
  file: string;
  /** The name the admin's file had. */
  name: string;
  size: number;
  type: string;
  /** Sample entry types of an MP4's tracks ("avc1" is H.264); empty for WebM. */
  codecs: string[];
  uploadedAt: string | null;
}

export interface HomepageVideo {
  link: string | null;
  /** The poster's image key (the API hands it out as a URL). */
  poster: string | null;
  upload: HomepageVideoUpload | null;
  /** The admin's choice for when there are both. */
  source: HomepageVideoSource;
  /** What the homepage shows: the only one there is, the chosen one when there are both, or nothing. */
  showing: HomepageVideoSource | null;
}

/** The homepage video from the Setting rows' values, by key. */
export function readHomepageVideo(values: Record<string, unknown>): HomepageVideo {
  const link = text(values[HOMEPAGE_VIDEO_KEYS.link]);
  const poster = text(values[HOMEPAGE_VIDEO_KEYS.poster]);
  const upload = uploadOf(values[HOMEPAGE_VIDEO_KEYS.upload]);
  const stored = values[HOMEPAGE_VIDEO_KEYS.source];
  const source: HomepageVideoSource =
    stored === 'link' || stored === 'upload' ? stored : upload ? 'upload' : 'link';
  const showing: HomepageVideoSource | null = link && upload ? source : upload ? 'upload' : link ? 'link' : null;
  return { link, poster, upload, source, showing };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uploadOf(value: unknown): HomepageVideoUpload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.file !== 'string' || !VIDEO_FILE_NAME.test(row.file)) return null;
  return {
    file: row.file,
    name: typeof row.name === 'string' && row.name ? row.name : row.file,
    size: typeof row.size === 'number' ? row.size : 0,
    // From the stored name, which the upload chose by the file's bytes.
    type: row.file.endsWith('.webm') ? 'video/webm' : 'video/mp4',
    codecs: Array.isArray(row.codecs) ? row.codecs.filter((codec): codec is string => typeof codec === 'string') : [],
    uploadedAt: typeof row.uploadedAt === 'string' ? row.uploadedAt : null,
  };
}
