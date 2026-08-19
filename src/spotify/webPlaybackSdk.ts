import type { SpotifyPlayerConstructor } from "./webPlaybackTypes";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const SCRIPT_ID = "amp99-spotify-web-playback-sdk";

let sdkPromise: Promise<SpotifyPlayerConstructor> | null = null;

export function loadSpotifyWebPlaybackSdk(): Promise<SpotifyPlayerConstructor> {
  if (window.Spotify?.Player) {
    return Promise.resolve(window.Spotify.Player);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise<SpotifyPlayerConstructor>((resolve, reject) => {
    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    const previousScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const resolveReady = () => {
      previousReady?.();

      if (!window.Spotify?.Player) {
        reject(new Error("Spotify Web Playback SDK loaded without a Player constructor."));
        return;
      }

      resolve(window.Spotify.Player);
    };

    window.onSpotifyWebPlaybackSDKReady = resolveReady;

    if (previousScript) {
      previousScript.addEventListener(
        "error",
        () => reject(new Error("Spotify Web Playback SDK failed to load.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SDK_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "error",
      () => {
        sdkPromise = null;
        reject(new Error("Spotify Web Playback SDK failed to load."));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return sdkPromise;
}
