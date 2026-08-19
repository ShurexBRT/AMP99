export type Track = {
  id: string;
  artist: string;
  title: string;
  duration: number;
  source?: "demo" | "spotify";
  uri?: string;
  albumArtUrl?: string | null;
};

export type WindowId = "main" | "equalizer" | "playlist";

export type WindowPosition = {
  x: number;
  y: number;
};
