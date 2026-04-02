import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Shuffle,
  MessageCircle,
  Video,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Shield,
  Users,
  RefreshCw,
  UserPlus,
  LogIn,
  Sparkles,
  CircleDot,
  Swords,
  Crown,
  Trophy,
  X,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { MarbleBackground } from "@/components/layout/MarbleBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SOCKET_URL } from "@/config/env";
import { MAX_MESSAGE_LENGTH, STORAGE_KEY, topics } from "@/features/chat/constants";
import type {
  AuthResponse,
  AuthUser,
  ChatMessage,
  PeerUser,
} from "@/features/chat/types";
import { createSystemMessage, getCurrentTime } from "@/features/chat/utils/messages";
import {
  BriscolaBoard,
  BriscolaPanel,
  type BriscolaGameState,
  type BriscolaVoteState,
  type VoteMode,
} from "@/features/games/briscola";
import {
  ColorBoard,
  ColorPanel,
  type ColorGameState,
  type ColorVoteMode,
  type ColorVoteState,
} from "@/features/games/color";
import { apiRequest } from "@/lib/api";

const CLIENT_SESSION_KEY = "anonchat_client_session_id";
const BRAND_LOGO_SRC = "/logo.png";
const VIDEO_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function getClientSessionId() {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.sessionStorage.getItem(CLIENT_SESSION_KEY);
  if (existing) {
    return existing;
  }

  const created =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.sessionStorage.setItem(CLIENT_SESSION_KEY, created);
  return created;
}

export default function ChatSiteBase() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [appScreen, setAppScreen] = useState<"mode-select" | "chat" | "video">("mode-select");
  const [shouldAutoStartChat, setShouldAutoStartChat] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [connected, setConnected] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [typing, setTyping] = useState(false);
  const [stranger, setStranger] = useState<PeerUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createSystemMessage("Benvenuto. Premi 'Trova sconosciuto' per iniziare subito una nuova chat.", 1),
  ]);
  const [chatOnlineCount, setChatOnlineCount] = useState(0);
  const [videoOnlineCount, setVideoOnlineCount] = useState(0);
  const [connectionError, setConnectionError] = useState("");

  const [isBriscolaActive, setIsBriscolaActive] = useState(false);
  const [briscolaVotes, setBriscolaVotes] = useState<BriscolaVoteState>({
    mode: "idle",
    myVote: false,
    peerVote: false,
  });
  const [briscolaGameState, setBriscolaGameState] = useState<BriscolaGameState | null>(null);
  const [isColorActive, setIsColorActive] = useState(false);
  const [colorVotes, setColorVotes] = useState<ColorVoteState>({
    mode: "idle",
    myVote: false,
    peerVote: false,
  });
  const [colorGameState, setColorGameState] = useState<ColorGameState | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const messageIdRef = useRef(2);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceLevelFrameRef = useRef<number | null>(null);
  const remoteAudioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteVoiceLevelFrameRef = useRef<number | null>(null);
  const clientSessionId = useMemo(() => getClientSessionId(), []);

  const [isVideoMicOn, setIsVideoMicOn] = useState(true);
  const [isVideoCameraOn, setIsVideoCameraOn] = useState(false);
  const [isVideoSpeaking, setIsVideoSpeaking] = useState(false);
  const [isRemoteVideoSpeaking, setIsRemoteVideoSpeaking] = useState(false);
  const [hasRemoteVideoStream, setHasRemoteVideoStream] = useState(false);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoInputId, setSelectedVideoInputId] = useState("");
  const [selectedAudioInputId, setSelectedAudioInputId] = useState("");

  const canSearch = useMemo(
    () => !!currentUser && !isSearching && !connected,
    [connected, currentUser, isSearching]
  );

  const trimmedMessage = message.trim();
  const canSend = connected && trimmedMessage.length > 0;

  const voteCount = Number(briscolaVotes.myVote) + Number(briscolaVotes.peerVote);
  const startVoteActive = !isBriscolaActive && briscolaVotes.mode === "start";
  const endVoteActive = isBriscolaActive && briscolaVotes.mode === "end";
  const hasMyStartVote = startVoteActive && briscolaVotes.myVote;
  const hasMyEndVote = endVoteActive && briscolaVotes.myVote;
  const colorVoteCount = Number(colorVotes.myVote) + Number(colorVotes.peerVote);
  const colorStartVoteActive = !isColorActive && colorVotes.mode === "start";
  const colorEndVoteActive = isColorActive && colorVotes.mode === "end";
  const hasMyColorStartVote = colorStartVoteActive && colorVotes.myVote;
  const hasMyColorEndVote = colorEndVoteActive && colorVotes.myVote;
  const activeGameCount = Number(isBriscolaActive) + Number(isColorActive);

  const nextMessageId = () => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [...prev, createSystemMessage(text, nextMessageId())]);
  };

  const resetBriscolaState = () => {
    setIsBriscolaActive(false);
    setBriscolaGameState(null);
    setBriscolaVotes({
      mode: "idle",
      myVote: false,
      peerVote: false,
    });
  };

  const resetColorState = () => {
    setIsColorActive(false);
    setColorGameState(null);
    setColorVotes({
      mode: "idle",
      myVote: false,
      peerVote: false,
    });
  };

  const resetChatState = (keepWelcome = true) => {
    setConnected(false);
    setIsSearching(false);
    setConfirmingDisconnect(false);
    setTyping(false);
    setStranger(null);
    setMessage("");
    resetBriscolaState();
    resetColorState();
    setMessages(
      keepWelcome
        ? [
            createSystemMessage(
              "Benvenuto. Premi 'Trova sconosciuto' per iniziare subito una nuova chat.",
              1
            ),
          ]
        : []
    );
    messageIdRef.current = 2;
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const stopVideoPreview = () => {
    if (voiceLevelFrameRef.current !== null) {
      cancelAnimationFrame(voiceLevelFrameRef.current);
      voiceLevelFrameRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    audioAnalyserRef.current?.disconnect();
    audioAnalyserRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setIsVideoSpeaking(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const syncVideoTracks = (stream: MediaStream, micEnabled: boolean, cameraEnabled: boolean) => {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled;
    });
  };

  const stopVideoCall = () => {
    if (remoteVoiceLevelFrameRef.current !== null) {
      cancelAnimationFrame(remoteVoiceLevelFrameRef.current);
      remoteVoiceLevelFrameRef.current = null;
    }

    remoteAudioSourceRef.current?.disconnect();
    remoteAudioSourceRef.current = null;
    remoteAudioAnalyserRef.current?.disconnect();
    remoteAudioAnalyserRef.current = null;
    void remoteAudioContextRef.current?.close().catch(() => {});
    remoteAudioContextRef.current = null;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    setHasRemoteVideoStream(false);
    setIsRemoteVideoSpeaking(false);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const attachRemoteStream = (stream: MediaStream) => {
    remoteStreamRef.current = stream;
    setHasRemoteVideoStream(true);
    startRemoteVoiceLevelMeter(stream);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      void remoteVideoRef.current.play().catch(() => {});
    }
  };

  const syncPeerConnectionTracks = (stream: MediaStream) => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    const nextAudioTrack = stream.getAudioTracks()[0] || null;
    const nextVideoTrack = stream.getVideoTracks()[0] || null;

    const audioSender = peerConnection
      .getSenders()
      .find((sender) => sender.track?.kind === "audio");
    const videoSender = peerConnection
      .getSenders()
      .find((sender) => sender.track?.kind === "video");

    if (audioSender) {
      void audioSender.replaceTrack(nextAudioTrack);
    } else if (nextAudioTrack) {
      peerConnection.addTrack(nextAudioTrack, stream);
    }

    if (videoSender) {
      void videoSender.replaceTrack(nextVideoTrack);
    } else if (nextVideoTrack) {
      peerConnection.addTrack(nextVideoTrack, stream);
    }
  };

  const getOrCreatePeerConnection = () => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection({ iceServers: VIDEO_ICE_SERVERS });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit("video-signal", {
        type: "candidate",
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const stream = event.streams[0] || remoteStreamRef.current || new MediaStream();
      if (!event.streams[0]) {
        stream.addTrack(event.track);
      }
      attachRemoteStream(stream);
    };

    peerConnectionRef.current = peerConnection;

    if (localStreamRef.current) {
      syncPeerConnectionTracks(localStreamRef.current);
    }

    return peerConnection;
  };

  const applyPendingIceCandidates = async (peerConnection: RTCPeerConnection) => {
    const pendingCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of pendingCandidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
  };

  const startVideoCall = async (isInitiator: boolean) => {
    if (!socketRef.current) return;

    stopVideoCall();
    const peerConnection = getOrCreatePeerConnection();

    if (!isInitiator) return;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socketRef.current.emit("video-signal", {
      type: "offer",
      description: offer,
    });
  };

  const handleVideoSignal = async (payload: {
    type?: "offer" | "answer" | "candidate";
    description?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }) => {
    const peerConnection = getOrCreatePeerConnection();

    if (payload.type === "offer" && payload.description) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.description));
      await applyPendingIceCandidates(peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socketRef.current?.emit("video-signal", {
        type: "answer",
        description: answer,
      });
      return;
    }

    if (payload.type === "answer" && payload.description) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.description));
      await applyPendingIceCandidates(peerConnection);
      return;
    }

    if (payload.type === "candidate" && payload.candidate) {
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
      } else {
        pendingIceCandidatesRef.current.push(payload.candidate);
      }
    }
  };

  const refreshMediaDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    const audioDevices = devices.filter((device) => device.kind === "audioinput");

    setVideoInputDevices(videoDevices);
    setAudioInputDevices(audioDevices);
    setSelectedVideoInputId((current) => current || videoDevices[0]?.deviceId || "");
    setSelectedAudioInputId((current) => current || audioDevices[0]?.deviceId || "");
  };

  const startVoiceLevelMeter = (stream: MediaStream) => {
    if (voiceLevelFrameRef.current !== null) {
      cancelAnimationFrame(voiceLevelFrameRef.current);
      voiceLevelFrameRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioAnalyserRef.current?.disconnect();
    void audioContextRef.current?.close().catch(() => {});

    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    const samples = new Uint8Array(analyser.fftSize);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    audioAnalyserRef.current = analyser;

    const updateVoiceLevel = () => {
      analyser.getByteTimeDomainData(samples);

      let total = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const normalized = (samples[i] - 128) / 128;
        total += normalized * normalized;
      }

      const volume = Math.sqrt(total / samples.length);
      const hasEnabledAudio = stream.getAudioTracks().some((track) => track.enabled);
      setIsVideoSpeaking(hasEnabledAudio && volume > 0.05);
      voiceLevelFrameRef.current = requestAnimationFrame(updateVoiceLevel);
    };

    void audioContext.resume().catch(() => {});
    voiceLevelFrameRef.current = requestAnimationFrame(updateVoiceLevel);
  };

  const startRemoteVoiceLevelMeter = (stream: MediaStream) => {
    if (remoteVoiceLevelFrameRef.current !== null) {
      cancelAnimationFrame(remoteVoiceLevelFrameRef.current);
      remoteVoiceLevelFrameRef.current = null;
    }

    remoteAudioSourceRef.current?.disconnect();
    remoteAudioAnalyserRef.current?.disconnect();
    void remoteAudioContextRef.current?.close().catch(() => {});

    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass || stream.getAudioTracks().length === 0) {
      setIsRemoteVideoSpeaking(false);
      return;
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    const samples = new Uint8Array(analyser.fftSize);
    source.connect(analyser);

    remoteAudioContextRef.current = audioContext;
    remoteAudioSourceRef.current = source;
    remoteAudioAnalyserRef.current = analyser;

    const updateRemoteVoiceLevel = () => {
      analyser.getByteTimeDomainData(samples);

      let total = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const normalized = (samples[i] - 128) / 128;
        total += normalized * normalized;
      }

      setIsRemoteVideoSpeaking(Math.sqrt(total / samples.length) > 0.05);
      remoteVoiceLevelFrameRef.current = requestAnimationFrame(updateRemoteVoiceLevel);
    };

    void audioContext.resume().catch(() => {});
    remoteVoiceLevelFrameRef.current = requestAnimationFrame(updateRemoteVoiceLevel);
  };

  const handleAuth = async () => {
    const username = authUsername.trim();
    const password = authPassword.trim();

    if (!username || !password) {
      setAuthError("Inserisci username e password.");
      return;
    }

    if (username.length < 3) {
      setAuthError("L'username deve avere almeno 3 caratteri.");
      return;
    }

    if (password.length < 5) {
      setAuthError("La password deve avere almeno 5 caratteri.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const data = await apiRequest<AuthResponse>(endpoint, "POST", { username, password });
      const authUser: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        token: data.token,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      setCurrentUser(authUser);
      setAppScreen("mode-select");
      setShouldAutoStartChat(false);
      setAuthUsername("");
      setAuthPassword("");
      setConnectionError("");
      resetChatState(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Autenticazione non riuscita.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    stopVideoCall();
    disconnectSocket();
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
    setAppScreen("mode-select");
    setShouldAutoStartChat(false);
    setAuthError("");
    setConnectionError("");
    setChatOnlineCount(0);
    setVideoOnlineCount(0);
    resetChatState(true);
  };

  const handleBackToModeSelect = () => {
    stopVideoCall();
    disconnectSocket();
    setAppScreen("mode-select");
    setShouldAutoStartChat(false);
    setConnectionError("");
    setChatOnlineCount(0);
    setVideoOnlineCount(0);
    resetChatState(true);
  };

  const connectToRandomStranger = () => {
    if (!socketRef.current || !currentUser) return;

    setConnectionError("");
    setIsSearching(true);
    setConnected(false);
    setConfirmingDisconnect(false);
    setTyping(false);
    setStranger(null);
    setMessage("");
    resetBriscolaState();
    resetColorState();
    setMessages([createSystemMessage("Ricerca di uno sconosciuto in corso...", 1)]);
    messageIdRef.current = 2;

    socketRef.current.emit("find-stranger", {
      interests: topics,
    });
  };

  const connectToRandomVideoStranger = () => {
    if (!socketRef.current || !currentUser) return;

    stopVideoCall();
    setConnectionError("");
    setIsSearching(true);
    setConnected(false);
    setConfirmingDisconnect(false);
    setTyping(false);
    setStranger(null);
    setMessage("");
    resetBriscolaState();
    resetColorState();

    socketRef.current.emit("find-video-stranger");
  };

  const nextStranger = () => {
    if (!socketRef.current || !currentUser) return;

    socketRef.current.emit("leave-chat");
    setConnected(false);
    setConfirmingDisconnect(false);
    setTyping(false);
    setStranger(null);
    setMessage("");
    resetBriscolaState();
    resetColorState();
    setMessages([createSystemMessage("Cerco una nuova persona compatibile...", 1)]);
    messageIdRef.current = 2;
    setIsSearching(true);

    socketRef.current.emit("find-stranger", {
      interests: topics,
    });
  };

  const disconnectChat = () => {
    if (!socketRef.current) return;
    setConfirmingDisconnect(false);
    socketRef.current.emit("leave-chat");
    setConnected(false);
    setIsSearching(false);
    setTyping(false);
    setStranger(null);
    setMessage("");
    resetBriscolaState();
    resetColorState();
    addSystemMessage(
      connected ? "Hai terminato la conversazione." : "Hai interrotto la ricerca dello sconosciuto."
    );
  };

  const handleTerminateClick = () => {
    if (!connected && !isSearching) return;

    if (isSearching && !connected) {
      disconnectChat();
      return;
    }

    if (!confirmingDisconnect) {
      setConfirmingDisconnect(true);
      return;
    }

    disconnectChat();
  };

  const handleSend = () => {
    if (!socketRef.current || !connected || !stranger) return;

    const sentText = trimmedMessage.slice(0, MAX_MESSAGE_LENGTH);
    if (!sentText) return;

    const chatMessage: ChatMessage = {
      id: nextMessageId(),
      fromMe: true,
      text: sentText,
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, chatMessage]);
    setMessage("");

    socketRef.current.emit(appScreen === "video" ? "video-message" : "chat-message", {
      text: sentText,
    });

    inputRef.current?.focus();
  };


  const handleMessageKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleBriscolaVote = () => {
    if (!connected || !stranger || !socketRef.current) return;

    const mode: VoteMode = isBriscolaActive ? "end" : "start";
    const active = !(briscolaVotes.mode === mode && briscolaVotes.myVote);

    socketRef.current.emit("briscola-vote", {
      mode,
      active,
    });
  };

  const handlePlayCard = (cardId: string) => {
    if (!socketRef.current || !isBriscolaActive) return;
    socketRef.current.emit("briscola-play-card", { cardId });
  };

  const toggleColorVote = () => {
    if (!connected || !stranger || !socketRef.current) return;

    const mode: ColorVoteMode = isColorActive ? "end" : "start";
    const active = !(colorVotes.mode === mode && colorVotes.myVote);

    socketRef.current.emit("color-vote", {
      mode,
      active,
    });
  };

  const handleSubmitColorGuess = (guess: { h: number; s: number; l: number }) => {
    if (!socketRef.current || !isColorActive) return;
    socketRef.current.emit("color-submit", guess);
  };

  const handleChooseChatMode = () => {
    setAppScreen("chat");
    setShouldAutoStartChat(false);
    setConnectionError("");
    resetChatState(true);
  };

  const nextVideoStranger = () => {
    if (!socketRef.current || !currentUser) return;

    stopVideoCall();
    socketRef.current.emit("leave-video-chat");
    setConnected(false);
    setConfirmingDisconnect(false);
    setTyping(false);
    setStranger(null);
    setMessage("");
    resetBriscolaState();
    resetColorState();
    setIsSearching(true);

    socketRef.current.emit("find-video-stranger");
  };

  const disconnectVideoChat = () => {
    if (!socketRef.current) return;

    stopVideoCall();
    setConfirmingDisconnect(false);
    socketRef.current.emit("leave-video-chat");
    setConnected(false);
    setIsSearching(false);
    setTyping(false);
    setStranger(null);
    setMessage("");
    resetBriscolaState();
    resetColorState();
  };

  const handleTerminateVideoClick = () => {
    if (!connected && !isSearching) return;

    if (isSearching && !connected) {
      disconnectVideoChat();
      return;
    }

    if (!confirmingDisconnect) {
      setConfirmingDisconnect(true);
      return;
    }

    disconnectVideoChat();
  };

  const handleChooseVideoMode = () => {
    disconnectSocket();
    setAppScreen("video");
    setShouldAutoStartChat(false);
    setConnectionError("");
    setChatOnlineCount(0);
    setVideoOnlineCount(0);
    setIsVideoMicOn(true);
    setIsVideoCameraOn(false);
    resetChatState(true);
  };

  const toggleVideoMic = () => {
    const nextMicState = !isVideoMicOn;
    setIsVideoMicOn(nextMicState);

    if (localStreamRef.current) {
      syncVideoTracks(localStreamRef.current, nextMicState, isVideoCameraOn);
    }
  };

  const toggleVideoCamera = () => {
    const nextCameraState = !isVideoCameraOn;
    setIsVideoCameraOn(nextCameraState);

    if (localStreamRef.current) {
      syncVideoTracks(localStreamRef.current, isVideoMicOn, nextCameraState);
    }

    if (nextCameraState && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      void localVideoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as AuthUser;
      if (parsed?.token && parsed?.username && parsed?.id) {
        setCurrentUser(parsed);
        setAppScreen("mode-select");
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || (appScreen !== "chat" && appScreen !== "video")) return;

    const socket = io(SOCKET_URL, {
      auth: {
        token: currentUser.token,
        sessionId: clientSessionId,
      },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionError("");
      socket.emit("presence", {
        mode: appScreen,
      });
    });

    socket.on("connect_error", (error) => {
      const message = error.message || "Connessione al server non riuscita.";
      setConnectionError(message);
      setIsSearching(false);
    });

    socket.on(
      "online-count",
      (payload: { count: number; chatCount?: number; videoCount?: number }) => {
        setChatOnlineCount(payload.chatCount ?? payload.count);
        setVideoOnlineCount(payload.videoCount ?? payload.count);
      }
    );

    socket.on("match-found", (payload: { stranger: PeerUser }) => {
      setStranger(payload.stranger);
      setConnected(true);
      setIsSearching(false);
      setConfirmingDisconnect(false);
      setTyping(false);
      resetBriscolaState();
      resetColorState();
      setMessages([
        createSystemMessage(`Sei stato connesso con ${payload.stranger.username}.`, 1),
        {
          id: 2,
          fromMe: false,
          text: `Ciao, sono ${payload.stranger.username}.`,
          time: getCurrentTime(),
        },
      ]);
      messageIdRef.current = 2;
      requestAnimationFrame(() => inputRef.current?.focus());
    });

    socket.on("searching", () => {
      setIsSearching(true);
      setConfirmingDisconnect(false);
    });

    socket.on("video-searching", () => {
      setIsSearching(true);
      setConnected(false);
      setConfirmingDisconnect(false);
      setStranger(null);
      setMessages([createSystemMessage("Ricerca video in corso...", 1)]);
      messageIdRef.current = 2;
    });

    socket.on("chat-message", (payload: { text: string }) => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          fromMe: false,
          text: payload.text,
          time: getCurrentTime(),
        },
      ]);
    });

    socket.on("peer-typing", () => {
      setTyping(true);
    });

    socket.on("peer-stopped-typing", () => {
      setTyping(false);
    });

    socket.on("peer-left", () => {
      setConnected(false);
      setTyping(false);
      setConfirmingDisconnect(false);
      setStranger(null);
      setMessage("");
      resetBriscolaState();
      resetColorState();
      addSystemMessage("Lo sconosciuto ha lasciato la conversazione.");
    });

    socket.on("video-match-found", (payload: { stranger: PeerUser; isInitiator?: boolean }) => {
      setStranger(payload.stranger);
      setConnected(true);
      setIsSearching(false);
      setConfirmingDisconnect(false);
      setTyping(false);
      resetBriscolaState();
      resetColorState();
      setMessages([createSystemMessage(`Videochat avviata con ${payload.stranger.username}.`, 1)]);
      messageIdRef.current = 2;
      void startVideoCall(Boolean(payload.isInitiator)).catch(() => {
        setConnectionError("Non sono riuscito ad avviare la videochiamata.");
      });
    });

    socket.on("video-message", (payload: { text: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          fromMe: false,
          text: payload.text,
          time: getCurrentTime(),
        },
      ]);
    });

    socket.on("video-peer-left", () => {
      stopVideoCall();
      setConnected(false);
      setIsSearching(false);
      setConfirmingDisconnect(false);
      setTyping(false);
      setStranger(null);
      resetBriscolaState();
      resetColorState();
      setConnectionError("Lo sconosciuto ha lasciato la videochat.");
    });

    socket.on(
      "video-signal",
      (payload: {
        type?: "offer" | "answer" | "candidate";
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
      }) => {
        void handleVideoSignal(payload).catch(() => {
          setConnectionError("Segnalazione video non riuscita.");
        });
      }
    );

    socket.on(
      "briscola-vote-update",
      (payload: { mode: VoteMode; myVote: boolean; peerVote: boolean }) => {
        setBriscolaVotes({
          mode: payload.myVote || payload.peerVote ? payload.mode : "idle",
          myVote: payload.myVote,
          peerVote: payload.peerVote,
        });
      }
    );

    socket.on("briscola-started", () => {
      setIsBriscolaActive(true);
      setBriscolaVotes({
        mode: "idle",
        myVote: false,
        peerVote: false,
      });
      addSystemMessage("Entrambi avete accettato: la Briscola è iniziata.");
    });

    socket.on("briscola-state", (payload: BriscolaGameState) => {
      setBriscolaGameState(payload);
      setIsBriscolaActive(true);
    });

    socket.on("briscola-ended", () => {
      resetBriscolaState();
      addSystemMessage("La partita di Briscola è stata terminata.");
    });

    socket.on(
      "color-vote-update",
      (payload: { mode: ColorVoteMode; myVote: boolean; peerVote: boolean }) => {
        setColorVotes({
          mode: payload.myVote || payload.peerVote ? payload.mode : "idle",
          myVote: payload.myVote,
          peerVote: payload.peerVote,
        });
      }
    );

    socket.on("color-started", () => {
      setIsColorActive(true);
      setColorVotes({
        mode: "idle",
        myVote: false,
        peerVote: false,
      });
      addSystemMessage("Entrambi avete accettato: Color è iniziato.");
    });

    socket.on("color-state", (payload: ColorGameState) => {
      setColorGameState(payload);
      setIsColorActive(true);
    });

    socket.on("color-ended", () => {
      resetColorState();
      addSystemMessage("La partita di Color è stata terminata.");
    });

    socket.on("error-message", (payload: { message: string }) => {
      setConnectionError(payload.message);
      setIsSearching(false);
      setConfirmingDisconnect(false);
      addSystemMessage(payload.message);
    });

    socket.on("force-logout", (payload: { message?: string }) => {
      disconnectSocket();
      localStorage.removeItem(STORAGE_KEY);
      setCurrentUser(null);
      setAppScreen("mode-select");
      setShouldAutoStartChat(false);
      setAuthError(payload.message || "Sessione terminata.");
      setConnectionError("");
      setChatOnlineCount(0);
      setVideoOnlineCount(0);
      resetChatState(true);
    });

    socket.on("disconnect", () => {
      stopVideoCall();
      setConnected(false);
      setIsSearching(false);
      setConfirmingDisconnect(false);
      setTyping(false);
      setStranger(null);
      resetBriscolaState();
      resetColorState();
      setConnectionError("Connessione al server interrotta.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [appScreen, clientSessionId, currentUser]);

  useEffect(() => {
    if (localStreamRef.current) {
      syncVideoTracks(localStreamRef.current, isVideoMicOn, isVideoCameraOn);
    }
  }, [isVideoCameraOn, isVideoMicOn]);

  useEffect(() => {
    if (appScreen !== "video") {
      stopVideoPreview();
      return;
    }

    let cancelled = false;

    async function startVideoPreview() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setConnectionError("Camera o microfono non disponibili su questo browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoInputId
            ? { deviceId: { exact: selectedVideoInputId } }
            : true,
          audio: selectedAudioInputId
            ? { deviceId: { exact: selectedAudioInputId } }
            : true,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        syncVideoTracks(stream, isVideoMicOn, isVideoCameraOn);
        syncPeerConnectionTracks(stream);
        startVoiceLevelMeter(stream);
        void refreshMediaDevices();

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          void localVideoRef.current.play().catch(() => {});
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? `Permessi camera/microfono non disponibili: ${error.message}`
            : "Permessi camera/microfono non disponibili.";
        setConnectionError(message);
      }
    }

    void startVideoPreview();

    return () => {
      cancelled = true;
      stopVideoPreview();
    };
  }, [appScreen, selectedAudioInputId, selectedVideoInputId]);

  useEffect(() => {
    if (appScreen !== "video") return;

    const handleDeviceChange = () => {
      void refreshMediaDevices();
    };

    void refreshMediaDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, [appScreen]);

  useEffect(() => {
    if (appScreen !== "chat") return;

    const socket = socketRef.current;
    if (!socket || !connected) return;

    const timeout = setTimeout(() => {
      if (message.trim()) {
        socket.emit("typing");
      } else {
        socket.emit("stop-typing");
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [appScreen, message, connected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, typing, isSearching]);

  useEffect(() => {
    if (connected) {
      inputRef.current?.focus();
    }
  }, [connected]);

  useEffect(() => {
    if (!connectionError) return;

    const timeout = setTimeout(() => {
      setConnectionError("");
    }, 2000);

    return () => clearTimeout(timeout);
  }, [connectionError]);

  useEffect(() => {
    if (!currentUser || appScreen !== "chat" || !shouldAutoStartChat) return;
    if (!socketRef.current || connected || isSearching) return;

    setShouldAutoStartChat(false);
    connectToRandomStranger();
  }, [appScreen, connected, currentUser, isSearching, shouldAutoStartChat]);

  if (!currentUser) {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 py-8 text-white md:px-8">
        <MarbleBackground />
        <div className="relative mx-auto flex min-h-[92vh] max-w-7xl items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <Card className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.06] shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <CardContent className="relative p-8 md:p-10">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_30%,transparent_70%,rgba(255,255,255,0.04))]" />
                <div className="relative">
                  <div className="mb-8 flex flex-col items-center text-center">
                    <img
                      src={BRAND_LOGO_SRC}
                      alt="AnonChat"
                      className="h-56 w-56 object-contain md:h-64 md:w-64"
                    />
                    <h1 className="text-5xl font-black uppercase tracking-[-0.06em] text-white md:text-6xl">
                      ANONCHAT
                    </h1>
                  </div>

                  <div className="mb-8 max-w-2xl">
                    <h2 className="mb-4 text-4xl font-black leading-tight text-white md:text-5xl">
                      Entra, matcha e chatta in uno stile premium.
                    </h2>
                    <p className="text-base leading-7 text-zinc-300 md:text-lg">
                      Una chat casuale con look elegante, scuro e minimale. Pannelli glass,
                      riflessi bianchi, contrasti puliti e atmosfera luxury-tech.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <p className="mb-1 text-base font-semibold text-white">Accesso pulito</p>
                      <p className="text-sm leading-6 text-zinc-400">
                        Login e registrazione in una schermata premium, semplice e ordinata.
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <p className="mb-1 text-base font-semibold text-white">Look premium</p>
                      <p className="text-sm leading-6 text-zinc-400">
                        Marble dark, superfici vetro e dettagli chiari senza colori invadenti.
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                        <Shield className="h-5 w-5" />
                      </div>
                      <p className="mb-1 text-base font-semibold text-white">Pronta da crescere</p>
                      <p className="text-sm leading-6 text-zinc-400">
                        Base perfetta per backend, moderazione e funzioni più avanzate.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <CardContent className="p-6 md:p-8">
                <div className="mb-6 flex items-center justify-between rounded-[26px] border border-white/10 bg-white/[0.06] p-1.5 backdrop-blur-xl">
                  <button
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                    className={`flex-1 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                      authMode === "login"
                        ? "bg-gradient-to-r from-white to-zinc-300 text-black shadow-lg"
                        : "text-zinc-300 hover:bg-white/5"
                    }`}
                    type="button"
                  >
                    Accedi
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                    className={`flex-1 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                      authMode === "register"
                        ? "bg-gradient-to-r from-white to-zinc-300 text-black shadow-lg"
                        : "text-zinc-300 hover:bg-white/5"
                    }`}
                    type="button"
                  >
                    Registrati
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className="text-3xl font-bold text-white">
                    {authMode === "login" ? "Bentornato" : "Crea il tuo account"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {authMode === "login"
                      ? "Accedi per entrare nella tua chat casuale con interfaccia marble premium."
                      : "Registrati e preparati a parlare con sconosciuti in una UI elegante e moderna."}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">Username</label>
                    <Input
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                      placeholder="es. CarloNight"
                      className="h-12 rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">Password</label>
                    <Input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                      placeholder="Inserisci la password"
                      className="h-12 rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-zinc-500"
                    />
                  </div>

                  {authError ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {authError}
                    </div>
                  ) : null}

                  <Button
                    onClick={handleAuth}
                    disabled={authLoading}
                    className="h-12 w-full rounded-2xl bg-gradient-to-r from-white to-zinc-300 text-black shadow-lg shadow-white/10 hover:opacity-95"
                  >
                    {authLoading ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : authMode === "login" ? (
                      <LogIn className="mr-2 h-4 w-4" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    {authLoading ? "Attendi..." : authMode === "login" ? "Accedi" : "Registrati"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  if (appScreen === "mode-select") {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 py-8 text-white md:px-6 md:py-8">
        <MarbleBackground />
        <div className="relative mx-auto flex min-h-[92vh] max-w-5xl items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full"
          >
            <div className="mb-6 flex justify-center">
              <img
                src={BRAND_LOGO_SRC}
                alt="AnonChat"
                className="h-44 w-44 object-contain md:h-56 md:w-56"
              />
            </div>

            <Card className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.06] shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <CardContent className="relative p-8 md:p-10">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_30%,transparent_70%,rgba(255,255,255,0.04))]" />
                <div className="relative">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.35em] text-zinc-400">
                        Modalita
                      </p>
                      <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
                        Scegli modalità
                      </h1>
                      <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-300">
                        Sei dentro come{" "}
                        <span className="font-semibold text-white">{currentUser.username}</span>.
                        Scegli se entrare in chat testuale o avviare una videochat casuale.
                      </p>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                      type="button"
                    >
                      Esci
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleChooseChatMode}
                      className="group rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-6 text-left shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      <div className="mb-5 flex h-20 w-20 items-center justify-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-white to-zinc-300 text-black shadow-lg shadow-white/10">
                          <MessageCircle className="h-7 w-7" />
                        </div>
                      </div>
                      <h2 className="mt-4 text-2xl font-bold text-white">Chat</h2>
                      <p className="mt-3 text-sm leading-7 text-zinc-300">
                        Ti porto direttamente nella schermata principale e avvio subito il primo
                        match senza dover premere manualmente il pulsante.
                      </p>
                      <div className="mt-6 text-sm font-semibold text-zinc-100 transition group-hover:text-white">
                        Entra in chat
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleChooseVideoMode}
                      className="group rounded-[28px] border border-white/10 bg-black/25 p-6 text-left shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-white to-zinc-300 text-black shadow-lg shadow-white/10">
                        <Video className="h-7 w-7" />
                      </div>
                      <h2 className="mt-4 text-2xl font-bold text-white">Videochat</h2>
                      <p className="mt-3 text-sm leading-7 text-zinc-300">
                        Entra in una schermata video dedicata con layout immersivo, controlli
                        rapidi e spazio pronto per il prossimo matching cam.
                      </p>
                      <div className="mt-6 text-sm font-semibold text-zinc-100 transition group-hover:text-white">
                        Entra in video
                      </div>
                    </button>
                  </div>

                  {connectionError ? (
                    <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                      {connectionError}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  if (appScreen === "video") {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 py-4 text-white md:px-6 md:py-6">
        <MarbleBackground />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        className="relative mx-auto grid h-auto max-w-[1700px] gap-5 xl:h-[calc(100dvh-3rem)] xl:grid-cols-[360px_minmax(0,1fr)]"
        >
          <Card className="relative isolate h-auto overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_20px_80px_rgba(0,0,0,0.45)] xl:h-full xl:rounded-[32px]">
            <CardContent className="h-full overflow-y-auto p-5">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center">
                    <img
                      src={BRAND_LOGO_SRC}
                      alt="AnonChat"
                      className="h-16 w-16 object-contain"
                    />
                  </div>
                  <h1 className="text-xl font-bold text-white">Video</h1>
                </div>

                <button
                  onClick={handleBackToModeSelect}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                  type="button"
                >
                  Esci
                </button>
              </div>

              <div className="mb-4 rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <Users className="h-4 w-4" />
                  Utenti online
                </div>
                <p className="text-4xl font-black tracking-tight text-white">
                  {videoOnlineCount.toLocaleString("it-IT")}
                </p>
                <p className="mt-2 text-sm text-zinc-300">Connessi ora nella videochat casuale</p>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300 backdrop-blur">
                  <div>
                    Sei loggato come{" "}
                    <span className="font-semibold text-white">{currentUser.username}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                    type="button"
                  >
                    Esc
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={connectToRandomVideoStranger}
                  disabled={!canSearch}
                  className={`h-14 w-full rounded-[24px] text-base font-semibold shadow-[0_14px_34px_rgba(255,255,255,0.16)] shadow-white/10 ${
                    canSearch
                      ? "bg-gradient-to-r from-white via-zinc-100 to-zinc-300 text-black hover:scale-[1.01] hover:opacity-95"
                      : "bg-gradient-to-r from-zinc-500 via-zinc-600 to-zinc-700 text-zinc-200 shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
                  }`}
                >
                  {isSearching ? (
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Shuffle className="mr-2 h-5 w-5" />
                  )}
                  {isSearching ? "Ricerca in corso..." : "Trova sconosciuto"}
                </Button>

                <div className="grid grid-cols-2 gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur-xl">
                  <Button
                    variant="outline"
                    onClick={nextVideoStranger}
                    disabled={!connected}
                    className="h-13 rounded-[20px] border-white/10 bg-white/[0.07] text-sm font-semibold text-white hover:border-red-400/30 hover:bg-gradient-to-r hover:from-red-500/30 hover:to-rose-500/20 hover:text-red-100"
                  >
                    Prossimo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTerminateVideoClick}
                    disabled={!connected && !isSearching}
                    className={`h-13 rounded-[20px] border text-sm font-semibold text-white ${
                      confirmingDisconnect
                        ? "border-red-500/40 bg-gradient-to-r from-red-500/80 to-rose-600/70 text-red-50 hover:border-red-700/60 hover:from-red-950 hover:to-red-700"
                        : "border-white/10 bg-white/[0.07] hover:border-red-400/30 hover:bg-gradient-to-r hover:from-red-500/30 hover:to-rose-500/20 hover:text-red-100"
                    }`}
                  >
                    {confirmingDisconnect ? "Sicuro ?" : "Termina"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.05] p-3 backdrop-blur-xl">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Controlli rapidi
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={toggleVideoMic}
                    className={`flex h-12 items-center justify-center rounded-[18px] border text-white transition ${
                      isVideoMicOn
                        ? "border-white/10 bg-white/[0.08] hover:bg-white/[0.12]"
                        : "border-red-500/20 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                    }`}
                  >
                    {isVideoMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleVideoCamera}
                    className={`flex h-12 items-center justify-center rounded-[18px] border text-white transition ${
                      isVideoCameraOn
                        ? "border-white/10 bg-white/[0.08] hover:bg-white/[0.12]"
                        : "border-red-500/20 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                    }`}
                  >
                    {isVideoCameraOn ? (
                      <Camera className="h-5 w-5" />
                    ) : (
                      <CameraOff className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToModeSelect}
                    className="flex h-12 items-center justify-center rounded-[18px] border border-red-500/20 bg-red-500/15 text-red-100 transition hover:bg-red-500/25"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-[28px] border border-white/10 bg-white/[0.05] p-3 backdrop-blur-xl">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Dispositivi
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      Camera
                    </label>
                    <select
                      value={selectedVideoInputId}
                      onChange={(event) => setSelectedVideoInputId(event.target.value)}
                      className="h-10 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
                    >
                      {videoInputDevices.length === 0 ? (
                        <option value="">Camera predefinita</option>
                      ) : (
                        videoInputDevices.map((device, index) => (
                          <option key={device.deviceId || `video-${index}`} value={device.deviceId}>
                            {device.label || `Camera ${index + 1}`}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      Microfono
                    </label>
                    <select
                      value={selectedAudioInputId}
                      onChange={(event) => setSelectedAudioInputId(event.target.value)}
                      className="h-10 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
                    >
                      {audioInputDevices.length === 0 ? (
                        <option value="">Microfono predefinito</option>
                      ) : (
                        audioInputDevices.map((device, index) => (
                          <option key={device.deviceId || `audio-${index}`} value={device.deviceId}>
                            {device.label || `Microfono ${index + 1}`}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {connectionError ? (
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {connectionError}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="relative isolate h-auto overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] xl:h-full xl:rounded-[32px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_40%,rgba(255,255,255,0.015))]" />
            <CardContent className="relative flex h-full min-h-0 flex-col overflow-y-auto p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between rounded-[28px] border border-white/10 bg-white/[0.05] px-5 py-4 backdrop-blur-xl">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                    Video Room
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {connected && stranger
                      ? `In video con ${stranger.username}`
                      : isSearching
                      ? "Ricerca video in corso..."
                      : "In attesa di uno sconosciuto"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">
                  {connected ? "Live" : isSearching ? "Searching" : "Standby"}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-2">
                <div className="grid min-h-0 gap-5">
                  <div
                  className={`relative h-[320px] overflow-hidden rounded-[36px] border bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_45%,rgba(0,0,0,0.6)_100%)] transition-all duration-150 md:h-[360px] ${
                    isRemoteVideoSpeaking
                      ? "border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.55),0_0_42px_rgba(255,255,255,0.30),0_24px_80px_rgba(0,0,0,0.35)]"
                      : "border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
                  }`}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_25%,transparent_70%,rgba(255,255,255,0.03))]" />
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                      hasRemoteVideoStream ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div
                    className={`relative flex h-full flex-col items-center justify-center px-8 text-center transition-opacity duration-300 ${
                      hasRemoteVideoStream ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                      <Video className="h-9 w-9 text-white" />
                    </div>
                    <h3 className="max-w-md text-3xl font-black tracking-[-0.06em] text-white">
                      {connected && stranger
                        ? `${stranger.username} è entrato in stanza.`
                        : isSearching
                        ? "Sto cercando una persona in videochat."
                        : "La tua prossima videochat parte da qui."}
                    </h3>
                    <p className="mt-4 max-w-md text-sm leading-7 text-zinc-300">
                      {connected && stranger
                        ? "Matching video completato. Nel prossimo step colleghiamo lo stream remoto WebRTC dentro questo palco."
                        : "Apri la ricerca per entrare nella coda video e trovare un altro utente connesso alla sezione Video."}
                    </p>
                  </div>
                  </div>
                  <div
                    className={`relative h-[320px] overflow-hidden rounded-[36px] border bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_45%,rgba(0,0,0,0.6)_100%)] transition-all duration-150 md:h-[360px] ${
                      isVideoSpeaking
                        ? "border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.55),0_0_42px_rgba(255,255,255,0.30),0_24px_80px_rgba(0,0,0,0.35)]"
                        : "border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
                    }`}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_25%,transparent_70%,rgba(255,255,255,0.03))]" />
                    <div
                      className="absolute inset-0"
                    >
                      <video
                        ref={localVideoRef}
                        muted
                        playsInline
                        autoPlay
                        className={`h-full w-full object-cover transition-opacity duration-300 ${
                          isVideoCameraOn ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {!isVideoCameraOn ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CameraOff className="h-10 w-10 text-zinc-300" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex h-[72dvh] min-h-[520px] flex-col overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.04] backdrop-blur-xl xl:h-auto xl:min-h-0">
                  <div className="border-b border-white/10 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                      Chat testuale
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {connected && stranger ? stranger.username : "Nessuna chat attiva"}
                    </h3>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    <div className="space-y-4">
                      {messages.map((msg) =>
                        msg.system ? (
                          <div key={msg.id} className="flex justify-center">
                            <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-center text-xs text-zinc-300 backdrop-blur-xl">
                              {msg.text}
                            </div>
                          </div>
                        ) : (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-[20px] px-4 py-3 shadow-xl transition-all duration-200 ${
                                msg.fromMe
                                  ? "rounded-br-[8px] bg-gradient-to-br from-white via-zinc-100 to-zinc-300 text-black"
                                  : "rounded-bl-[8px] border border-white/10 bg-white/[0.06] text-white backdrop-blur-xl"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm leading-7">{msg.text}</p>
                              <p
                                className={`mt-1 text-[11px] ${
                                  msg.fromMe ? "text-zinc-700" : "text-zinc-400"
                                }`}
                              >
                                {msg.time}
                              </p>
                            </div>
                          </motion.div>
                        )
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="border-t border-white/10 p-4">
                    <div className="rounded-[26px] border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
                      <div className="flex items-end gap-3">
                        <textarea
                          ref={inputRef}
                          value={message}
                          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                          onKeyDown={handleMessageKeyDown}
                          placeholder={
                            connected
                              ? "Scrivi allo sconosciuto..."
                              : "Connettiti prima a una videochat"
                          }
                          disabled={!connected}
                          rows={1}
                          className="min-h-12 max-h-32 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed"
                        />
                        <Button
                          onClick={handleSend}
                          disabled={!canSend}
                          className="h-12 rounded-2xl bg-gradient-to-r from-white to-zinc-300 px-5 text-black shadow-lg shadow-white/10 hover:opacity-95 disabled:opacity-50"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Invia
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-zinc-500">
                        <span>Invia con Enter · Vai a capo con Shift + Enter</span>
                        <span>{message.length}/{MAX_MESSAGE_LENGTH}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 text-white md:px-6 md:py-6">
      <MarbleBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative mx-auto grid h-auto max-w-[1700px] gap-5 xl:h-[calc(100dvh-3rem)] xl:grid-cols-[360px_minmax(0,1fr)_330px]"
      >
        <Card className="relative isolate h-auto overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-[0_20px_80px_rgba(0,0,0,0.45)] xl:h-full xl:rounded-[32px]">
          <CardContent className="h-full overflow-y-auto p-5">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center">
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="AnonChat"
                    className="h-16 w-16 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Chat</h1>
                </div>
              </div>
              <button
                onClick={handleBackToModeSelect}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                type="button"
              >
                Esci
              </button>
            </div>

            <div className="mb-4 rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                <Users className="h-4 w-4" />
                Utenti online
              </div>
              <p className="text-4xl font-black tracking-tight text-white">
                {chatOnlineCount.toLocaleString("it-IT")}
              </p>
              <p className="mt-2 text-sm text-zinc-300">Connessi ora nella chat casuale</p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300 backdrop-blur">
                <div>
                  Sei loggato come{" "}
                  <span className="font-semibold text-white">{currentUser.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                  type="button"
                >
                  Esc
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={connectToRandomStranger}
                disabled={!canSearch}
                className={`h-14 w-full rounded-[24px] text-base font-semibold shadow-[0_14px_34px_rgba(255,255,255,0.16)] shadow-white/10 ${
                  canSearch
                    ? "bg-gradient-to-r from-white via-zinc-100 to-zinc-300 text-black hover:scale-[1.01] hover:opacity-95"
                    : "bg-gradient-to-r from-zinc-500 via-zinc-600 to-zinc-700 text-zinc-200 shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
                }`}
              >
                {isSearching ? (
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Shuffle className="mr-2 h-5 w-5" />
                )}
                {isSearching ? "Ricerca in corso..." : "Trova sconosciuto"}
              </Button>

              <div className="grid grid-cols-2 gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur-xl">
                <Button
                  variant="outline"
                  onClick={nextStranger}
                  disabled={!connected}
                  className="h-13 rounded-[20px] border-white/10 bg-white/[0.07] text-sm font-semibold text-white hover:border-red-400/30 hover:bg-gradient-to-r hover:from-red-500/30 hover:to-rose-500/20 hover:text-red-100"
                >
                  Prossimo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTerminateClick}
                  disabled={!connected && !isSearching}
                  className={`h-13 rounded-[20px] border text-sm font-semibold text-white ${
                    confirmingDisconnect
                      ? "border-red-500/40 bg-gradient-to-r from-red-500/80 to-rose-600/70 text-red-50 hover:border-red-700/60 hover:from-red-950 hover:to-red-700"
                      : "border-white/10 bg-white/[0.07] hover:border-red-400/30 hover:bg-gradient-to-r hover:from-red-500/30 hover:to-rose-500/20 hover:text-red-100"
                  }`}
                >
                  {confirmingDisconnect ? "Sicuro ?" : "Termina"}
                </Button>
              </div>
            </div>

            {connectionError && (
              <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                {connectionError}
              </div>
            )}

          </CardContent>
        </Card>

        <div className={`relative isolate grid min-h-0 gap-5 ${activeGameCount > 0 ? "xl:grid-cols-[340px_minmax(0,1fr)]" : "grid-cols-1"}`}>
          <Card className="relative isolate h-[78dvh] min-h-[620px] overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] xl:h-full xl:rounded-[32px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%,rgba(255,255,255,0.015))]" />
            <CardContent className="flex h-full min-h-0 flex-col p-0 text-white">
              <div className="border-b border-white/10 bg-white/[0.05] px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
                <div className="flex flex-col items-center gap-4">
                  <div>
                    {connected && stranger ? (
                      <div className="flex flex-wrap items-center justify-center gap-3 text-center">
                        <p className="text-center text-sm font-medium uppercase tracking-[0.22em] text-zinc-400">
                          Stai parlando con
                        </p>
                        <div className="inline-flex w-fit rounded-[20px] border border-white/10 bg-white/[0.07] px-5 py-3 text-base font-semibold uppercase tracking-[0.2em] text-zinc-100 shadow-[0_14px_34px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                          {stranger.username}
                        </div>
                      </div>
                    ) : (
                      <h2 className="text-xl font-medium text-white">
                        {isSearching ? "Connessione..." : "Nessuna chat attiva"}
                      </h2>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {isBriscolaActive ? (
                      <div className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur">
                        Briscola attiva
                      </div>
                    ) : null}
                    {isColorActive ? (
                      <div className="rounded-full border border-sky-400/30 bg-sky-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200 backdrop-blur">
                        Color attivo
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                <div className="relative space-y-4">
                  {messages.map((msg) =>
                    msg.system ? (
                      <div key={msg.id} className="flex justify-center">
                        <div
                          className={`border border-white/10 backdrop-blur-xl ${
                            messages.length === 1 && !connected && !isSearching
                              ? "max-w-xl rounded-[26px] bg-white/[0.07] px-7 py-4 text-center text-sm font-medium leading-7 text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
                              : "rounded-full bg-white/[0.05] px-4 py-2 text-xs text-zinc-300"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-[20px] px-4 py-3 shadow-xl transition-all duration-200 ${
                            msg.fromMe
                              ? "rounded-br-[8px] bg-gradient-to-br from-white via-zinc-100 to-zinc-300 text-black"
                              : "rounded-bl-[8px] border border-white/10 bg-white/[0.06] text-white backdrop-blur-xl"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-7">{msg.text}</p>
                          <p className={`mt-1 text-[11px] ${msg.fromMe ? "text-zinc-700" : "text-zinc-400"}`}>
                            {msg.time}
                          </p>
                        </div>
                      </motion.div>
                    )
                  )}

                  <AnimatePresence>
                    {typing ? (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="flex justify-start"
                      >
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.06] px-4 py-3 shadow-xl backdrop-blur-xl">
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <CircleDot className="h-4 w-4 animate-pulse" />
                            Lo sconosciuto sta scrivendo...
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="border-t border-white/10 bg-transparent p-3 backdrop-blur-xl sm:p-4">
                <div className="rounded-[26px] border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                      onKeyDown={handleMessageKeyDown}
                      placeholder={connected ? "Scrivi allo sconosciuto..." : "Connettiti prima a una chat"}
                      disabled={!connected}
                      rows={1}
                      className="min-h-12 max-h-36 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!canSend}
                      className="h-12 rounded-2xl bg-gradient-to-r from-white to-zinc-300 px-4 text-black shadow-lg shadow-white/10 hover:opacity-95 disabled:opacity-50 sm:px-5"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Invia
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-2 text-[11px] text-zinc-500">
                    <span>Invia con Enter · Vai a capo con Shift + Enter</span>
                    <span>{message.length}/{MAX_MESSAGE_LENGTH}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isBriscolaActive ? (
            <Card className="relative isolate h-[calc(100dvh-2rem)] min-h-[680px] overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] xl:h-full xl:rounded-[32px]">
              <CardContent className="h-full p-4">
                <BriscolaBoard
                  gameState={briscolaGameState}
                  strangerName={stranger?.username ?? "Sconosciuto"}
                  onPlayCard={handlePlayCard}
                />
              </CardContent>
            </Card>
          ) : isColorActive ? (
            <Card className="relative isolate h-[calc(100dvh-2rem)] min-h-[680px] overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] xl:h-full xl:rounded-[32px]">
              <CardContent className="h-full p-4">
                <ColorBoard
                  gameState={colorGameState}
                  strangerName={stranger?.username ?? "Sconosciuto"}
                  onSubmitGuess={handleSubmitColorGuess}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="relative isolate h-auto overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)] xl:h-full xl:rounded-[32px]">
          <CardContent className="h-full overflow-y-auto p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-white to-zinc-300 text-black shadow-lg shadow-white/10">
                <Swords className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Giochi</h2>
                <p className="text-sm text-zinc-400">Modalità di gioco condivise</p>
              </div>
            </div>

            <BriscolaPanel
              connected={connected}
              isBriscolaActive={isBriscolaActive}
              voteCount={voteCount}
              votes={briscolaVotes}
              hasMyStartVote={hasMyStartVote}
              hasMyEndVote={hasMyEndVote}
              onToggleVote={toggleBriscolaVote}
            />

            <div className="mt-4">
              <ColorPanel
                connected={connected}
                isColorActive={isColorActive}
                voteCount={colorVoteCount}
                votes={colorVotes}
                hasMyStartVote={hasMyColorStartVote}
                hasMyEndVote={hasMyColorEndVote}
                onToggleVote={toggleColorVote}
              />
            </div>

            {false && (
              <>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                    <Crown className="h-3.5 w-3.5" />
                    Mini game
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-white">Briscola</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Parte solo se entrambi votate. Durante la partita la chat resta attiva a lato.
                  </p>
                </div>

                <div
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                    startVoteActive || endVoteActive
                      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/[0.05] text-zinc-300"
                  }`}
                >
                  {voteCount}/2
                </div>
              </div>

              <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Stato attuale</span>
                  <span className="font-semibold text-white">
                    {isBriscolaActive ? "Partita in corso" : "In attesa"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div
                    className={`rounded-2xl border px-3 py-3 ${
                      briscolaVotes.myVote
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    Tu: {briscolaVotes.myVote ? "hai votato" : "nessun voto"}
                  </div>
                  <div
                    className={`rounded-2xl border px-3 py-3 ${
                      briscolaVotes.peerVote
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    Altro utente: {briscolaVotes.peerVote ? "ha votato" : "nessun voto"}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
                  {!connected ? (
                    "Connettiti a uno sconosciuto per proporre la Briscola."
                  ) : isBriscolaActive ? (
                    hasMyEndVote ? (
                      <>
                        Hai avviato la richiesta per <span className="font-semibold text-white">terminare</span> la partita. Serve il consenso di entrambi.
                      </>
                    ) : (
                      "La Briscola è attiva. Se volete chiuderla, entrambi dovete premere 'Termina gioco'."
                    )
                  ) : hasMyStartVote ? (
                    <>
                      Hai votato per <span className="font-semibold text-white">iniziare</span>. Quando anche l'altro utente voterà, la partita partirà automaticamente.
                    </>
                  ) : (
                    "Premi il pulsante per proporre la Briscola all'altro utente."
                  )}
                </div>
              </div>

              <Button
                onClick={toggleBriscolaVote}
                disabled={!connected}
                className={`h-12 w-full rounded-2xl ${
                  isBriscolaActive
                    ? "bg-gradient-to-r from-red-400 to-red-500 text-white hover:opacity-95"
                    : "bg-gradient-to-r from-white to-zinc-300 text-black hover:opacity-95"
                } shadow-lg`}
              >
                {isBriscolaActive ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    {hasMyEndVote ? "Rimuovi voto termina gioco" : "Termina gioco"}
                  </>
                ) : (
                  <>
                    <Trophy className="mr-2 h-4 w-4" />
                    {hasMyStartVote ? "Rimuovi voto Briscola" : "Briscola"}
                  </>
                )}
              </Button>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
