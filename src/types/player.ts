export type Track = {
  id: string;
  artist: string;
  title: string;
  duration: number;
};

export type WindowId = "main" | "equalizer" | "playlist";

export type WindowPosition = {
  x: number;
  y: number;
};
