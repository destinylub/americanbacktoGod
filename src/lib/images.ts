// Looks up the responsive variants produced by `npm run images`.
import manifest from '../data/images.generated.json';

export interface ImageInfo {
  id: string;
  width: number;
  height: number;
  widths: number[];
  alt: string;
}

const data = manifest as Record<string, Omit<ImageInfo, 'id'>>;

export function getImage(id: string): ImageInfo {
  const entry = data[id];
  if (!entry) throw new Error(`Unknown image id "${id}". Add it to src/data/images.json and run "npm run images".`);
  return { id, ...entry };
}

export const imageUrl = (id: string, width: number, format: 'avif' | 'webp') => `/images/${id}-${width}.${format}`;

export const srcset = (img: ImageInfo, format: 'avif' | 'webp') =>
  img.widths.map((w) => `${imageUrl(img.id, w, format)} ${w}w`).join(', ');
