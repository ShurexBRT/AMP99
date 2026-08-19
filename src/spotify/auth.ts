import {
  SPOTIFY_AUTHORIZE_URL,
  SPOTIFY_TOKEN_URL,
  getSpotifyConfig,
} from "./config";
import { SpotifyAuthError, type SpotifySession } from "./types";

const SESSION_STORAGE_KEY = "amp99.spotify.session.v1";
const PKCE_VERIFIER_KEY = "amp99.spotify.pkceVerifier.v1";
const OAUTH_STATE_KEY = "amp99.spotify.oauthState.v1";
const ACCESS_TOKEN_SAFETY_WINDOW_MS = 60_000;

let refreshInFlight: Promise<SpotifySession> | null = null;

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

function getStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new SpotifyAuthError(
      "storage_unavailable",
      "Spotify authentication requires browser local storage.",
    );
  }

  return window.localStorage;
}

function createRandomString(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);

  return Array.from(random, (value) => alphabet[value % alphabet.length]).join(
    "",
  );
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );

  return base64UrlEncode(digest);
}

function parseTokenFailure(response: SpotifyTokenResponse): SpotifyAuthError {
  return new SpotifyAuthError(
    response.error || "token_request_failed",
    response.error_description || "Spotify token request failed.",
  );
}

function saveSession(session: SpotifySession): SpotifySession {
  getStorage().setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function getStoredSpotifySession(): SpotifySession | null {
  try {
    const raw = getStorage().getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SpotifySession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.tokenType !== "string" ||
      typeof parsed.scope !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.refreshTokenIssuedAt !== "number"
    ) {
      clearSpotifySession();
      return null;
    }

    return parsed as SpotifySession;
  } catch {
    clearSpotifySession();
    return null;
  }
}

export function clearSpotifySession(): void {
  try {
    getStorage().removeItem(SESSION_STORAGE_KEY);
  } catch {
    // A missing/blocked storage backend already means there is no usable session.
  }
}

export function clearSpotifyAuthorizationTransaction(): void {
  try {
    const storage = getStorage();
    storage.removeItem(PKCE_VERIFIER_KEY);
    storage.removeItem(OAUTH_STATE_KEY);
  } catch {
    // Nothing else to clean up when storage is unavailable.
  }
}

export async function createSpotifyAuthorizationUrl(): Promise<string> {
  const config = getSpotifyConfig();
  const verifier = createRandomString(64);
  const state = createRandomString(32);
  const challenge = await createCodeChallenge(verifier);
  const storage = getStorage();

  storage.setItem(PKCE_VERIFIER_KEY, verifier);
  storage.setItem(OAUTH_STATE_KEY, state);

  const url = new URL(SPOTIFY_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: config.scopes.join(" "),
  }).toString();

  return url.toString();
}

export async function exchangeSpotifyAuthorizationCode(
  code: string,
  returnedState: string,
): Promise<SpotifySession> {
  const config = getSpotifyConfig();
  const storage = getStorage();
  const verifier = storage.getItem(PKCE_VERIFIER_KEY);
  const expectedState = storage.getItem(OAUTH_STATE_KEY);

  if (!verifier || !expectedState) {
    throw new SpotifyAuthError(
      "missing_pkce_transaction",
      "The Spotify sign-in transaction is missing or expired. Start sign-in again.",
    );
  }

  if (!returnedState || returnedState !== expectedState) {
    clearSpotifyAuthorizationTransaction();
    throw new SpotifyAuthError(
      "invalid_state",
      "Spotify returned an invalid OAuth state value.",
    );
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: verifier,
    }),
  });

  const payload = (await response.json()) as SpotifyTokenResponse;
  clearSpotifyAuthorizationTransaction();

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw parseTokenFailure(payload);
  }

  const now = Date.now();
  return saveSession({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type || "Bearer",
    scope: payload.scope || config.scopes.join(" "),
    expiresAt: now + payload.expires_in * 1000,
    refreshTokenIssuedAt: now,
  });
}

export async function handleSpotifyAuthorizationCallback(
  callbackUrl: string = window.location.href,
): Promise<SpotifySession> {
  const url = new URL(callbackUrl);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";

  if (error) {
    clearSpotifyAuthorizationTransaction();
    throw new SpotifyAuthError(error, `Spotify authorization failed: ${error}.`);
  }

  if (!code) {
    throw new SpotifyAuthError(
      "missing_authorization_code",
      "Spotify callback did not contain an authorization code.",
    );
  }

  return exchangeSpotifyAuthorizationCode(code, state);
}

export async function refreshSpotifySession(): Promise<SpotifySession> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const current = getStoredSpotifySession();
    if (!current?.refreshToken) {
      throw new SpotifyAuthError(
        "missing_refresh_token",
        "Spotify session cannot be refreshed. Sign in again.",
      );
    }

    const config = getSpotifyConfig();
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
        client_id: config.clientId,
      }),
    });

    const payload = (await response.json()) as SpotifyTokenResponse;

    if (!response.ok || !payload.access_token) {
      if (payload.error === "invalid_grant") {
        clearSpotifySession();
      }
      throw parseTokenFailure(payload);
    }

    const now = Date.now();
    const receivedNewRefreshToken = Boolean(payload.refresh_token);

    return saveSession({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || current.refreshToken,
      tokenType: payload.token_type || current.tokenType || "Bearer",
      scope: payload.scope || current.scope,
      expiresAt: now + payload.expires_in * 1000,
      refreshTokenIssuedAt: receivedNewRefreshToken
        ? now
        : current.refreshTokenIssuedAt,
    });
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function getSpotifyAccessToken(options?: {
  forceRefresh?: boolean;
}): Promise<string> {
  const session = getStoredSpotifySession();

  if (!session) {
    throw new SpotifyAuthError(
      "not_authenticated",
      "No Spotify session is available. Sign in first.",
    );
  }

  const shouldRefresh =
    options?.forceRefresh === true ||
    Date.now() >= session.expiresAt - ACCESS_TOKEN_SAFETY_WINDOW_MS;

  if (!shouldRefresh) {
    return session.accessToken;
  }

  return (await refreshSpotifySession()).accessToken;
}
