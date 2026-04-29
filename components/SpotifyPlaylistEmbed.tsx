import { createSpotifyEmbedUrl } from '@/lib/releaseVoting';

export default function SpotifyPlaylistEmbed({ playlistId }: { playlistId?: string | null }) {
  const embedUrl = createSpotifyEmbedUrl(playlistId);

  if (!embedUrl) {
    return (
      <div className="spotify-placeholder">
        <strong>Spotify-Playlist</strong>
        <span>Im Backend kann pro Umfrage eine Playlist-ID hinterlegt werden.</span>
      </div>
    );
  }

  return (
    <iframe
      className="spotify-embed-frame"
      title="Spotify Playlist"
      src={embedUrl}
      width="100%"
      height="560"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
}
