import { useCallback, useEffect, useMemo, useState } from "react";
import { sfx } from "./audio/sfx";
import type { GameSetup, GameState, NewPlayer } from "./game";
import { GameScreen } from "./GameScreen";
import { defaultServerUrl } from "./net/client";
import { getLastRoom, getPlayerId, getSavedName, saveLastRoom, saveName } from "./net/identity";
import { useLocalSession } from "./session/useLocalSession";
import { useOnlineSession, useRoomClient } from "./session/useOnlineSession";
import { Lobby } from "./ui/Lobby";
import { Menu } from "./ui/Menu";
import type { Settings } from "./ui/settings";
import { loadSettings, saveSettings } from "./ui/settings";
import { Setup } from "./ui/Setup";

declare global {
  interface Window {
    /** Dev-only hook (local mode) to inspect or replace the game state from the console. */
    __chacarero?: { getGame: () => GameState | null; setGame: (state: GameState) => void };
  }
}

type Screen = { readonly type: "menu" } | { readonly type: "localSetup" } | { readonly type: "local"; readonly players: readonly NewPlayer[]; readonly setup: GameSetup } | { readonly type: "online" };

function inviteCodeFromUrl(): string | null {
  const code = new URLSearchParams(location.search).get("mesa");
  return code && code.length === 4 ? code.toUpperCase() : null;
}

/** Route between the menu, the hot-seat table and the online room. */
export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>(() => (inviteCodeFromUrl() || getLastRoom() ? { type: "online" } : { type: "menu" }));
  const playerId = useMemo(getPlayerId, []);
  const serverUrl = useMemo(defaultServerUrl, []);
  const online = useRoomClient(serverUrl, playerId);

  useEffect(() => {
    saveSettings(settings);
    sfx.setVolume(settings.soundVolume);
    sfx.setMuted(settings.muted);
  }, [settings]);

  // The audio context needs a user gesture; the first pointer/key event unlocks it.
  useEffect(() => {
    const unlock = () => {
      sfx.unlock();
      sfx.preload();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Coming back to a room: from an invite link, or the room we were in before a refresh.
  const [autoJoined, setAutoJoined] = useState(false);
  useEffect(() => {
    if (autoJoined || online.status !== "open" || !online.client) return;
    const code = inviteCodeFromUrl() ?? getLastRoom();
    const name = getSavedName();
    if (code && name) {
      online.client.join(code, name);
      setScreen({ type: "online" });
    }
    setAutoJoined(true);
  }, [autoJoined, online.status, online.client]);

  useEffect(() => {
    if (online.room) saveLastRoom(online.room.code);
    if (online.left || online.notFound) saveLastRoom(null);
  }, [online.room, online.left, online.notFound]);

  const create = useCallback(
    (name: string) => {
      saveName(name);
      online.client?.createRoom(name);
      setScreen({ type: "online" });
    },
    [online.client],
  );

  const join = useCallback(
    (name: string, code: string) => {
      saveName(name);
      online.client?.join(code, name);
      setScreen({ type: "online" });
    },
    [online.client],
  );

  const leaveOnline = useCallback(() => {
    online.client?.leave();
    online.clearLeft();
    saveLastRoom(null);
    history.replaceState(null, "", location.pathname);
    setScreen({ type: "menu" });
  }, [online]);

  if (screen.type === "online" && online.room && online.you) {
    if (online.room.game && online.room.status !== "lobby") {
      return (
        <OnlineGame
          room={online.room}
          you={online.you}
          status={online.status}
          clockOffset={online.clockOffset}
          error={online.error}
          clearError={online.clearError}
          client={online.client}
          settings={settings}
          onSettings={setSettings}
        />
      );
    }
    return (
      <Lobby
        room={online.room}
        you={online.you}
        connection={online.status}
        onStart={(setup) => online.client?.startGame(setup)}
        onRename={(name) => {
          saveName(name);
          online.client?.updateName(name);
        }}
        onLeave={leaveOnline}
      />
    );
  }

  if (screen.type === "local") {
    return <LocalGame players={screen.players} setup={screen.setup} settings={settings} onSettings={setSettings} onLeave={() => setScreen({ type: "menu" })} />;
  }

  if (screen.type === "localSetup") {
    return (
      <Setup
        onStart={(players, setup) => setScreen({ type: "local", players, setup })}
        onBack={() => setScreen({ type: "menu" })}
        noClock={settings.countdownScale === 0}
        onNoClock={(noClock) => setSettings({ ...settings, countdownScale: noClock ? 0 : 1 })}
      />
    );
  }

  return (
    <Menu
      savedName={getSavedName()}
      inviteCode={inviteCodeFromUrl()}
      onlineAvailable={serverUrl !== null}
      connection={online.status}
      notFound={online.notFound}
      onCreate={create}
      onJoin={join}
      onLocal={() => setScreen({ type: "localSetup" })}
    />
  );
}

interface LocalGameProps {
  readonly players: readonly NewPlayer[];
  readonly setup: GameSetup;
  readonly settings: Settings;
  readonly onSettings: (settings: Settings) => void;
  readonly onLeave: () => void;
}

function LocalGame({ players, setup, settings, onSettings, onLeave }: LocalGameProps) {
  const session = useLocalSession({ players, setup, countdownScale: settings.countdownScale, bannerSeconds: settings.bannerSeconds, onLeave });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__chacarero = { getGame: () => session.game, setGame: session.setGame };
    return () => {
      delete window.__chacarero;
    };
  }, [session]);
  return <GameScreen session={session} settings={settings} onSettings={onSettings} canRestart />;
}

interface OnlineGameProps {
  readonly room: NonNullable<ReturnType<typeof useRoomClient>["room"]>;
  readonly you: string;
  readonly status: "connecting" | "open" | "closed";
  readonly clockOffset: number;
  readonly error: string | null;
  readonly clearError: () => void;
  readonly client: ReturnType<typeof useRoomClient>["client"];
  readonly settings: Settings;
  readonly onSettings: (settings: Settings) => void;
}

function OnlineGame({ room, you, status, clockOffset, error, clearError, client, settings, onSettings }: OnlineGameProps) {
  if (!client) throw new Error("OnlineGame needs a client");
  const session = useOnlineSession({ client, room, you, status, clockOffset, error, clearError });
  return <GameScreen session={session} settings={settings} onSettings={onSettings} canRestart={room.hostId === you} />;
}
