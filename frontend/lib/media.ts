export type VideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "direct"; url: string };

/**
 * Mengenali link YouTube/Vimeo dan mengubahnya jadi URL embed yang bisa
 * dipasang di <iframe>. Link lain (mis. link .mp4 langsung, Google Drive
 * yang sudah di-share sebagai file video) diperlakukan sebagai video
 * langsung lewat tag <video>.
 */
export function resolveVideoEmbed(rawUrl: string): VideoEmbed {
  const url = rawUrl.trim();

  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  if (youtubeMatch) {
    return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}` };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  return { kind: "direct", url };
}
