/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameModals } from './components/GameModals';
import { GameplayHud } from './components/GameplayHud';
import { LobbyOverlay } from './components/LobbyOverlay';
import { MobileControls } from './components/MobileControls';
import { PortraitGuard } from './components/PortraitGuard';
import { gameModes } from './game/gameModes';
import { HeistEngine } from './game/heistEngine';
import { NetworkManager, type NetworkStatus } from './game/networkManager';
import { soundEngine } from './game/soundEngine';
import type { GameModeId, HudSnapshot, PlayerRole } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  screen: 'lobby',
  roundNumber: 1,
  roundStage: 'hide',
  timeRemaining: 90,
  hideCountdown: 6,
  localRole: 'robber',
  remoteRole: 'police',
  currentRoom: 'Main Lobby',
  goldCollected: 0,
  goldTotal: 3,
  exitUnlocked: false,
  disguiseProp: null,
  nearbyProp: null,
  sprintCooldownPct: 0,
  sprintActive: false,
  tagCooldownPct: 0,
  penaltyRemaining: 0,
  disguiseCooldownPct: 0,
  statusBanner: null,
  statusBannerTone: 'info',
  penaltyFlash: false,
  roundSummary: null,
  matchSummary: null,
  isConnectedPeer: false,
  matchType: 'solo',
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HeistEngine | null>(null);
  const networkRef = useRef<NetworkManager | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedModeId, setSelectedModeId] = useState<GameModeId>(
    () => gameModes.getDefaultPlayable().id,
  );
  const [hostRoleRound1, setHostRoleRound1] = useState<PlayerRole>('robber');
  const [muted, setMuted] = useState(false);

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('idle');
  const [networkDetail, setNetworkDetail] = useState('');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Mount Three.js HeistEngine and PeerJS NetworkManager once (isolated from React HUD re-renders)
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new HeistEngine(mountEl, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    const network = new NetworkManager({
      onStatusChange: (status, detail) => {
        setNetworkStatus(status);
        setNetworkDetail(detail ?? '');
        if (status === 'disconnected') {
          engine.returnToLobby(false);
        }
      },
      onMessage: (msg) => {
        engine.handleNetworkMessage(msg);
      },
    });
    networkRef.current = network;
    engine.attachNetwork(network);

    // Support ?autostart=1 (and optional ?role=police) for instant launch / verification
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const startRole: PlayerRole = params.get('role') === 'police' ? 'police' : 'robber';
      setHostRoleRound1(startRole);
      engine.startMatch({
        modeId: gameModes.getDefaultPlayable().id,
        matchType: 'solo',
        hostRoleRound1: startRole,
      });
    }

    return () => {
      network.disconnect();
      engine.dispose();
      engineRef.current = null;
      networkRef.current = null;
    };
  }, []);

  // Global Mute hotkey (M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleMute]);

  const handleStartSolo = useCallback(() => {
    networkRef.current?.disconnect();
    setNetworkStatus('idle');
    setRoomCode(null);
    setIsHost(false);
    engineRef.current?.startMatch({
      modeId: selectedModeId,
      matchType: 'solo',
      hostRoleRound1,
    });
  }, [selectedModeId, hostRoleRound1]);

  const handleCreateRoom = useCallback(() => {
    soundEngine.unlock();
    const code = networkRef.current?.createRoom() ?? null;
    setRoomCode(code);
    setIsHost(true);
  }, []);

  const handleJoinRoom = useCallback((code: string) => {
    soundEngine.unlock();
    setRoomCode(code);
    setIsHost(false);
    networkRef.current?.joinRoom(code);
  }, []);

  const handleCancelRoom = useCallback(() => {
    networkRef.current?.disconnect();
    setNetworkStatus('idle');
    setNetworkDetail('');
    setRoomCode(null);
    setIsHost(false);
  }, []);

  const handleStartMultiplayer = useCallback(() => {
    engineRef.current?.startMatch({
      modeId: selectedModeId,
      matchType: 'multiplayer_host',
      hostRoleRound1,
    });
  }, [selectedModeId, hostRoleRound1]);

  const handleRematch = useCallback(() => {
    if (hud.matchType === 'multiplayer_host') {
      engineRef.current?.startMatch({
        modeId: selectedModeId,
        matchType: 'multiplayer_host',
        hostRoleRound1,
      });
    } else {
      engineRef.current?.restartSoloMatch();
    }
  }, [hud.matchType, selectedModeId, hostRoleRound1]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0f17] select-none">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-viewport"
        className="fixed inset-0 h-full w-full"
      />

      {/* Landscape Lobby / 5-Mode Selector */}
      {hud.screen === 'lobby' && (
        <LobbyOverlay
          selectedModeId={selectedModeId}
          onSelectMode={setSelectedModeId}
          hostRoleRound1={hostRoleRound1}
          onChangeHostRole={setHostRoleRound1}
          onStartSolo={handleStartSolo}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onCancelRoom={handleCancelRoom}
          onStartMultiplayer={handleStartMultiplayer}
          networkStatus={networkStatus}
          networkDetail={networkDetail}
          roomCode={roomCode}
          isHost={isHost}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {/* Active Gameplay HUD & Multi-Touch Controls */}
      {hud.screen === 'playing' && (
        <>
          <MobileControls
            hud={hud}
            onJoystickMove={(x, y) => engineRef.current?.setJoystickVector(x, y)}
            onCameraDrag={(dx, dy) => engineRef.current?.rotateCameraBy(dx, dy)}
            onPrimaryAction={() => engineRef.current?.triggerPrimaryAction()}
            onSnapAlign={() => engineRef.current?.triggerSnapAlign()}
            onSprintJump={() => engineRef.current?.triggerSprintJump()}
          />
          <GameplayHud
            hud={hud}
            muted={muted}
            onToggleMute={toggleMute}
            onPause={() => engineRef.current?.setPaused(true)}
          />
        </>
      )}

      {/* Pause, Round 1 Swap, and End-of-Match Modals */}
      <GameModals
        hud={hud}
        onResume={() => engineRef.current?.setPaused(false)}
        onRestartSolo={() => engineRef.current?.restartSoloMatch()}
        onStartRound2={() => engineRef.current?.startRound2()}
        onRematch={handleRematch}
        onReturnLobby={() => engineRef.current?.returnToLobby(true)}
      />

      {/* Portrait Mobile Orientation Guard */}
      <PortraitGuard />
    </main>
  );
}
