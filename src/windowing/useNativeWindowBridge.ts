import { useEffect, useState } from "react";
import {
  publishMainSnapshot,
  subscribeMainSnapshot,
  type Amp99NativeWindowRole,
  type MainWindowSnapshot,
} from "./bridge";
import {
  applyNativeWindowSize,
  installNativeWindowHost,
} from "./nativeWindowHost";

export function useMainWindowSnapshot(): MainWindowSnapshot | null {
  const [snapshot, setSnapshot] = useState<MainWindowSnapshot | null>(null);

  useEffect(() => subscribeMainSnapshot(setSnapshot), []);

  return snapshot;
}

export function usePublishMainWindowSnapshot(snapshot: MainWindowSnapshot): void {
  useEffect(() => {
    publishMainSnapshot(snapshot);
    const heartbeat = window.setInterval(() => publishMainSnapshot(snapshot), 1_000);
    return () => window.clearInterval(heartbeat);
  }, [snapshot]);
}

export function useNativeWindowHost(
  role: Amp99NativeWindowRole,
  doubleSize: boolean,
  widthOverride?: number,
): void {
  useEffect(() => {
    let dispose: (() => void) | undefined;
    void installNativeWindowHost(role).then((cleanup) => {
      dispose = cleanup;
    });
    return () => dispose?.();
  }, [role]);

  useEffect(() => {
    void applyNativeWindowSize(role, doubleSize, undefined, widthOverride);
  }, [role, doubleSize, widthOverride]);
}
