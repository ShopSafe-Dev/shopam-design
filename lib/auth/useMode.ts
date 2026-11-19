'use client';

import { useSyncExternalStore } from 'react';
import { getState, getServerState, subscribe } from './session';
import { canSwitchMode, getMode, subscribeMode, type Mode } from './mode';

/** const { mode, canSwitch } = useMode();  mode is null for guests and while unknown. */
export function useMode(): { mode: Mode | null; canSwitch: boolean } {
  const user = useSyncExternalStore(subscribe, () => getState().user, () => getServerState().user);
  const mode = useSyncExternalStore(
    subscribeMode,
    () => getMode(user),
    () => null
  );
  return { mode, canSwitch: canSwitchMode(user) };
}
