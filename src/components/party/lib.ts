// Utilitaires partagés du salon OsaParty.

export type QueueItem = { id?: string; track: string; artist: string };
export type TrackInfo = {
  track: string;
  artist: string;
  state: string;
  queue?: QueueItem[];
  position?: number;
  duration?: number;
};
export type RoomUser = { id: string; username: string };
export type ChatMsg = { username: string; text: string; time: string; system?: boolean; kind?: string };
export type Notice = { id: number; text: string; icon?: string; tone?: "info" | "good" | "bad" | "game" };

export const PLACEHOLDERS = ["En attente...", "En attente du Bridge...", "Aucune musique", "Unknown", ""];
export const isBridge = (name: string) => (name || "").includes("MacBridge");
export const bridgeLabel = (name: string) => (name.includes("OsaNotch") ? "OsaNotch" : "Mac Bridge");
export const hasTrack = (t?: TrackInfo) => !!t && !PLACEHOLDERS.includes(t.track);

export const REACTIONS = ["🔥", "💃", "😍", "🤯", "😴", "🍻"];

// Couleur pastel stable par pseudo (avatars, noms dans le chat).
export function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 72%)`;
}
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export function fmtTime(s?: number) {
  if (s == null || !isFinite(s) || s < 0) return "0:00";
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function fmtDuration(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")}`;
}

// ── Pochettes iTunes (avec cache) ────────────────────────────────────────────
const artCache = new Map<string, string | null>();

export async function findArtwork(track: string, artist: string, size = 600): Promise<string | null> {
  const key = `${track}::${artist}::${size}`;
  if (artCache.has(key)) return artCache.get(key)!;
  // On récupère plusieurs résultats et on garde le plus fidèle : bon titre, bon artiste,
  // et pas un remix / live / version alternative si le titre d'origine n'en est pas un.
  const n = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const variant = /remix|live|acoustic|version|edit|instrumental|karaoke|sped up|slowed/i;
  for (const term of [`${track} ${artist}`, track]) {
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=12`);
      const d = await r.json();
      const best = (d.results || [])
        .map((x: any) => ({
          x,
          s: (n(x.trackName) === n(track) ? 4 : n(x.trackName).includes(n(track)) ? 1 : 0)
            + (n(x.artistName) === n(artist) ? 3 : n(x.artistName).includes(n(artist)) ? 1 : 0)
            - (variant.test(`${x.trackName} ${x.collectionName}`) && !variant.test(track) ? 3 : 0),
        }))
        .sort((a: any, b: any) => b.s - a.s)[0];
      const url: string | undefined = best?.x?.artworkUrl100;
      if (url) {
        const hd = url.replace("100x100bb", `${size}x${size}bb`);
        artCache.set(key, hd);
        return hd;
      }
    } catch {}
  }
  artCache.set(key, null);
  return null;
}

// ── Paroles LRCLIB ───────────────────────────────────────────────────────────
export type LyricLine = { time: number; text: string };
export async function findLyrics(track: string, artist: string): Promise<{ synced: LyricLine[]; plain: string }> {
  try {
    const r = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`);
    if (!r.ok) return { synced: [], plain: "" };
    const d = await r.json();
    if (d.syncedLyrics) {
      const synced: LyricLine[] = [];
      for (const line of String(d.syncedLyrics).split("\n")) {
        const m = line.match(/\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)/);
        if (m) synced.push({ time: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text: m[3].trim() });
      }
      return { synced, plain: "" };
    }
    if (d.instrumental) return { synced: [], plain: "♪ Instrumental ♪" };
    return { synced: [], plain: d.plainLyrics || "" };
  } catch {
    return { synced: [], plain: "" };
  }
}

// ── Couleur dominante d'une pochette (pour les halos) ────────────────────────
export function dominantColor(url: string): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    const fallback: [number, number, number] = [183, 165, 255];
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 24, 24);
        const px = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < px.length; i += 4) {
          const R = px[i], G = px[i + 1], B = px[i + 2];
          const max = Math.max(R, G, B), min = Math.min(R, G, B);
          const sat = max === 0 ? 0 : (max - min) / max;
          const weight = 0.15 + sat * sat * 2 * (max / 255); // privilégie les couleurs vives
          r += R * weight; g += G * weight; b += B * weight; w += weight;
        }
        let rgb: [number, number, number] = [r / w, g / w, b / w];
        // Éclaircit les couleurs trop sombres pour qu'un halo reste visible sur le noir.
        const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        if (lum < 0.45) { const k = 0.45 / Math.max(lum, 0.05); rgb = rgb.map((v) => Math.min(255, v * k)) as typeof rgb; }
        resolve(rgb.map(Math.round) as typeof rgb);
      } catch { resolve(fallback); }
    };
    img.onerror = () => resolve(fallback);
    img.src = url;
  });
}
