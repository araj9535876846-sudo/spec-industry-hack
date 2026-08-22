import React, { useEffect, useRef, useState } from "react";

/*
===========================================================
 HEALTHBRIDGE
 Anonymous Multilingual Health Support
===========================================================

 Backend expected:

 GET  http://127.0.0.1:8000/

 POST http://127.0.0.1:8000/api/detect-language
      multipart/form-data
      field: audio

 POST http://127.0.0.1:8000/api/chat
      JSON:
      {
        message,
        language,
        concern
      }

===========================================================
*/

const API_BASE = "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const LANGUAGES = [
  {
    name: "Auto Detect",
    native: "Automatic",
    code: "auto",
    locale: "en-IN",
  },
  {
    name: "English",
    native: "English",
    code: "en",
    locale: "en-IN",
  },
  {
    name: "Hindi",
    native: "हिन्दी",
    code: "hi",
    locale: "hi-IN",
  },
  {
    name: "Telugu",
    native: "తెలుగు",
    code: "te",
    locale: "te-IN",
  },
  {
    name: "Tamil",
    native: "தமிழ்",
    code: "ta",
    locale: "ta-IN",
  },
  {
    name: "Kannada",
    native: "ಕನ್ನಡ",
    code: "kn",
    locale: "kn-IN",
  },
  {
    name: "Malayalam",
    native: "മലയാളം",
    code: "ml",
    locale: "ml-IN",
  },
  {
    name: "Bengali",
    native: "বাংলা",
    code: "bn",
    locale: "bn-IN",
  },
  {
    name: "Marathi",
    native: "मराठी",
    code: "mr",
    locale: "mr-IN",
  },
  {
    name: "Gujarati",
    native: "ગુજરાતી",
    code: "gu",
    locale: "gu-IN",
  },
  {
    name: "Punjabi",
    native: "ਪੰਜਾਬੀ",
    code: "pa",
    locale: "pa-IN",
  },
  {
    name: "Urdu",
    native: "اردو",
    code: "ur",
    locale: "ur-IN",
  },
];

const CONCERNS = [
  "Stress",
  "Anxiety",
  "Exam Pressure",
  "Body Image",
  "Addiction",
  "General Health",
  "Sleep",
  "Loneliness",
  "Relationships",
  "Nutrition",
  "Family Issues",
  "Other",
];

/*
===========================================================
 LOCAL SCRIPT DETECTION FALLBACK
===========================================================
This is NOT a replacement for AI language detection.
It helps the UI remain functional if the backend is
temporarily unavailable.
*/

function detectLanguageFromText(text) {
  if (!text || !text.trim()) {
    return null;
  }

  const checks = [
    {
      code: "te",
      pattern: /[\u0C00-\u0C7F]/,
      language: "Telugu",
      locale: "te-IN",
    },
    {
      code: "ta",
      pattern: /[\u0B80-\u0BFF]/,
      language: "Tamil",
      locale: "ta-IN",
    },
    {
      code: "kn",
      pattern: /[\u0C80-\u0CFF]/,
      language: "Kannada",
      locale: "kn-IN",
    },
    {
      code: "ml",
      pattern: /[\u0D00-\u0D7F]/,
      language: "Malayalam",
      locale: "ml-IN",
    },
    {
      code: "bn",
      pattern: /[\u0980-\u09FF]/,
      language: "Bengali",
      locale: "bn-IN",
    },
    {
      code: "gu",
      pattern: /[\u0A80-\u0AFF]/,
      language: "Gujarati",
      locale: "gu-IN",
    },
    {
      code: "pa",
      pattern: /[\u0A00-\u0A7F]/,
      language: "Punjabi",
      locale: "pa-IN",
    },
    {
      code: "hi",
      pattern: /[\u0900-\u097F]/,
      language: "Hindi",
      locale: "hi-IN",
    },
    {
      code: "mr",
      pattern: /[\u0900-\u097F]/,
      language: "Marathi",
      locale: "mr-IN",
    },
    {
      code: "ur",
      pattern: /[\u0600-\u06FF]/,
      language: "Urdu",
      locale: "ur-IN",
    },
  ];

  for (const item of checks) {
    if (item.pattern.test(text)) {
      return {
        language: item.language,
        language_code: item.locale,
        confidence: 0.82,
        mixed_language: false,
      };
    }
  }

  const hindiWords = [
    "mujhe",
    "mera",
    "meri",
    "bahut",
    "hai",
    "ho",
    "stress",
    "tension",
    "kyun",
    "kya",
    "nahi",
    "nahin",
    "exam",
  ];

  const lower = text.toLowerCase();

  const hindiMatches = hindiWords.filter((word) =>
    lower.includes(word)
  ).length;

  if (hindiMatches >= 2) {
    return {
      language: "Hindi",
      language_code: "hi-IN",
      confidence: 0.72,
      mixed_language: true,
    };
  }

  return {
    language: "English",
    language_code: "en-IN",
    confidence: 0.55,
    mixed_language: false,
  };
}

/*
===========================================================
 GET LANGUAGE OBJECT
===========================================================
*/

function getLanguageObject(languageName) {
  return (
    LANGUAGES.find(
      (language) =>
        language.name.toLowerCase() ===
        String(languageName).toLowerCase()
    ) || LANGUAGES[0]
  );
}

/*
===========================================================
 MAIN APP
===========================================================
*/

export default function App() {
  const [page, setPage] = useState("home");

  // Account is used only as an age/eligibility gate.
  // The health conversation remains anonymous.
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDob, setAuthDob] = useState("");
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [ageVerified, setAgeVerified] = useState(() => {
    try {
      const verified =
        localStorage.getItem("healthbridge_age_verified") === "true";
      const storedAge = Number(
        localStorage.getItem("healthbridge_verified_age") || 0
      );

      // Chat access requires age strictly greater than 18.
      return verified && storedAge > 18;
    } catch {
      return false;
    }
  });
  const [accountEmail, setAccountEmail] = useState(() => {
    try {
      return localStorage.getItem("healthbridge_account_email") || "";
    } catch {
      return "";
    }
  });

  const [selectedLanguage, setSelectedLanguage] =
    useState(LANGUAGES[0]);

  const [languageSearch, setLanguageSearch] = useState("");

  const [selectedConcern, setSelectedConcern] =
    useState("General Health");

  const [isRecording, setIsRecording] =
    useState(false);

  const [recordingTarget, setRecordingTarget] =
    useState(null);

  const [voiceStatus, setVoiceStatus] =
    useState("");

  const [detectedTranscript, setDetectedTranscript] =
    useState("");

  const [confidence, setConfidence] =
    useState(0);

  const [mixedLanguage, setMixedLanguage] =
    useState(false);

  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text:
        "Hello! I’m HealthBridge. This is an anonymous space. You can talk about what you are experiencing without sharing your identity.",
    },
  ]);

  const [chatText, setChatText] = useState("");

  const [chatLoading, setChatLoading] =
    useState(false);

  const [chatStatus, setChatStatus] =
    useState("");

  const [supportOpen, setSupportOpen] =
    useState(false);

  const [supportMessages, setSupportMessages] =
    useState([
      {
        id: 1,
        sender: "bot",
        text:
          "Hi! I’m the HealthBridge support assistant. I can help you understand how the app works.",
      },
    ]);

  const [supportText, setSupportText] =
    useState("");

  const [supportLoading, setSupportLoading] =
    useState(false);

  // Anonymous real-world peer chat
  const [peerMessages, setPeerMessages] = useState([
    {
      id: "peer-system-1",
      sender: "system",
      text: "You are anonymous. No name or profile is shared with your peer.",
    },
  ]);
  const [peerText, setPeerText] = useState("");
  const [peerStatus, setPeerStatus] = useState("Ready to find an anonymous peer.");
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerMatched, setPeerMatched] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  // Anonymous peer safety / moderation.
  const [peerStrikes, setPeerStrikes] = useState(0);
  const [peerViolations, setPeerViolations] = useState(0);
  const [peerMutedUntil, setPeerMutedUntil] = useState(0);
  const [peerModerationMessage, setPeerModerationMessage] = useState("");

  const peerSocketRef = useRef(null);
  const peerSessionRef = useRef(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  /*
  =========================================================
   BROWSER LANGUAGE
  =========================================================
  */

  useEffect(() => {
    const browserLanguage =
      navigator.language || "en-IN";

    const match = LANGUAGES.find(
      (language) =>
        language.locale.toLowerCase() ===
        browserLanguage.toLowerCase()
    );

    if (match && match.code !== "auto") {
      setSelectedLanguage(match);
    }
  }, []);

  /*
  =========================================================
   CLEANUP MICROPHONE
  =========================================================
  */

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  /*
  =========================================================
    ACCOUNT + AGE VERIFICATION
  =========================================================
  */

  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 0;

    const today = new Date();
    const birthDate = new Date(`${dateOfBirth}T00:00:00`);

    if (Number.isNaN(birthDate.getTime())) return 0;

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  function openAgeVerification(nextPage = "setup") {
    setAuthError("");
    setAuthSuccess("");
    setAuthMode("login");

    try {
      if (
        localStorage.getItem("healthbridge_age_verified") === "true"
      ) {
        setAgeVerified(true);
        setPage(nextPage);
        return;
      }
    } catch {
      // Continue to verification screen.
    }

    setPage("login");
  }

  function showLoginPage() {
    setAuthMode("login");
    setAuthError("");
    setAuthSuccess("");
    setPage("login");
  }

  function handleAccountSubmit(event) {
    event.preventDefault();

    setAuthError("");
    setAuthSuccess("");

    const email = authEmail.trim();
    const password = authPassword;
    const age = calculateAge(authDob);

    if (!email || !email.includes("@")) {
      setAuthError("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setAuthError("Password must contain at least 6 characters.");
      return;
    }

    if (!authDob) {
      setAuthError("Enter your date of birth to verify your age.");
      return;
    }

    if (age < 0 || age > 120) {
      setAuthError("Enter a valid date of birth.");
      return;
    }

    if (age <= 18) {
      setAuthError(
        "Chat access requires you to be older than 18."
      );
      setAgeVerified(false);
      setPage("home");
      return;
    }

    try {
      localStorage.setItem("healthbridge_age_verified", "true");
      localStorage.setItem("healthbridge_verified_age", String(age));
      localStorage.setItem("healthbridge_account_email", email);
    } catch {
      // Continue even if browser storage is unavailable.
    }

    setAgeVerified(true);
    setAccountEmail(email);
    setAuthSuccess(
      authMode === "signup"
        ? "Account created and age verified."
        : "Login successful. Age verified."
    );

    window.setTimeout(() => {
      setPage("setup");
      setAuthSuccess("");
    }, 450);
  }

  function logoutAccount() {
    try {
      localStorage.removeItem("healthbridge_age_verified");
      localStorage.removeItem("healthbridge_verified_age");
      localStorage.removeItem("healthbridge_account_email");
    } catch {
      // Ignore storage errors.
    }

    setAgeVerified(false);
    setAccountEmail("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthDob("");
    setAuthError("");
    setAuthSuccess("");
    setPage("home");
  }

  /*
  =========================================================
    PEER SAFETY / BAD-WORD MODERATION
  =========================================================
  */

  const BLOCKED_WORDS = [
    "fuck",
    "fucker",
    "fucking",
    "motherfucker",
    "shit",
    "shitty",
    "bitch",
    "bastard",
    "asshole",
    "dick",
    "cunt",
    "slut",
    "whore",
    "crap",
    "idiot",
    "stupid",
    "moron",
    "chutiya",
    "chutiye",
    "madarchod",
    "madarchod",
    "behenchod",
    "bhenchod",
    "harami",
    "gand",
    "bc",
    "mc",
  ];

  function normalizeModerationText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/0/g, "o")
      .replace(/1/g, "i")
      .replace(/3/g, "e")
      .replace(/4/g, "a")
      .replace(/5/g, "s")
      .replace(/7/g, "t")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findBlockedWord(value) {
    const normalized = normalizeModerationText(value);

    if (!normalized) return "";

    const words = normalized.split(/\s+/);

    for (const blocked of BLOCKED_WORDS) {
      if (blocked.length <= 2) {
        if (words.includes(blocked)) {
          return blocked;
        }
      } else if (
        words.includes(blocked) ||
        normalized.includes(` ${blocked} `) ||
        normalized.startsWith(`${blocked} `) ||
        normalized.endsWith(` ${blocked}`)
      ) {
        return blocked;
      }
    }

    return "";
  }

  function applyOwnModeration() {
    setPeerStrikes((previous) => {
      const next = previous + 1;

      if (next === 1) {
        setPeerModerationMessage(
          "Warning 1/3: abusive language is not allowed. Your message was blocked."
        );
      } else if (next === 2) {
        setPeerMutedUntil(Date.now() + 30_000);
        setPeerModerationMessage(
          "Strike 2/3: you are muted for 30 seconds."
        );
      } else {
        setPeerModerationMessage(
          "Strike 3/3: abusive behavior detected. This anonymous session has been ended."
        );

        window.setTimeout(() => {
          disconnectPeer();
          setPage("setup");
        }, 1200);
      }

      return next;
    });
  }

  function handleIncomingPeerModeration(text) {
    const badWord = findBlockedWord(text);

    if (!badWord) return false;

    setPeerViolations((previous) => {
      const next = previous + 1;

      if (next === 1) {
        setPeerModerationMessage(
          "The peer used abusive language. HealthBridge has blocked the message and issued a warning."
        );
      } else {
        setPeerModerationMessage(
          "Repeated abusive language detected. The peer has been disconnected."
        );

        window.setTimeout(() => {
          disconnectPeer(true);
        }, 800);
      }

      return next;
    });

    return true;
  }

/*
  =========================================================
   START RECORDING
  =========================================================
  */

  async function startRecording(target = "setup") {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setVoiceStatus(
        "Microphone is not supported by this browser."
      );
      return;
    }

    if (!window.MediaRecorder) {
      setVoiceStatus(
        "Audio recording is not supported by this browser."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;

      chunksRef.current = [];

      let mimeType = "";

      const possibleTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];

      for (const type of possibleTypes) {
        if (
          MediaRecorder.isTypeSupported(type)
        ) {
          mimeType = type;
          break;
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
          })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      setRecordingTarget(target);
      setIsRecording(true);
      setVoiceStatus(
        "Listening… speak naturally."
      );

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;

        const blob = new Blob(
          chunksRef.current,
          {
            type:
              recorder.mimeType ||
              "audio/webm",
          }
        );

        await processAudio(
          blob,
          target
        );
      };

      recorder.start();
    } catch (error) {
      console.error(error);

      setIsRecording(false);
      setRecordingTarget(null);

      if (
        error &&
        error.name === "NotAllowedError"
      ) {
        setVoiceStatus(
          "Microphone permission was denied. Allow microphone access and try again."
        );
      } else {
        setVoiceStatus(
          "Could not access the microphone."
        );
      }
    }
  }

  /*
  =========================================================
   STOP RECORDING
  =========================================================
  */

  function stopRecording() {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    setIsRecording(false);
  }

  /*
  =========================================================
   PROCESS AUDIO
  =========================================================
  */

  async function processAudio(blob, target) {
    setVoiceStatus(
      "Analyzing your voice and detecting language…"
    );

    try {
      const formData = new FormData();

      let extension = "webm";

      if (
        blob.type.includes("ogg")
      ) {
        extension = "ogg";
      }

      if (
        blob.type.includes("wav")
      ) {
        extension = "wav";
      }

      formData.append(
        "audio",
        blob,
        `healthbridge-voice.${extension}`
      );

      const response = await fetch(
        `${API_BASE}/api/detect-language`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const result =
        await response.json();

      const languageName =
        result.language ||
        "English";

      const detected =
        getLanguageObject(languageName);

      setSelectedLanguage({
        ...detected,
        code:
          detected.code === "auto"
            ? languageName.toLowerCase()
            : detected.code,
      });

      setDetectedTranscript(
        result.transcript || ""
      );

      setConfidence(
        Math.round(
          Number(
            result.confidence || 0
          ) * 100
        )
      );

      setMixedLanguage(
        Boolean(
          result.mixed_language
        )
      );

      if (target === "chat") {
        setChatText(
          result.transcript || ""
        );

        setChatStatus(
          `${languageName} detected. Voice converted to text.`
        );

        setVoiceStatus(
          `${languageName} detected successfully.`
        );
      } else {
        setVoiceStatus(
          `${languageName} detected successfully.`
        );
      }
    } catch (error) {
      console.error(
        "Voice detection error:",
        error
      );

      /*
      -------------------------------------------------------
      FALLBACK:
      Try browser speech recognition.
      This makes the demo usable even if FastAPI/OpenAI
      is temporarily unavailable.
      -------------------------------------------------------
      */

      try {
        await browserSpeechFallback(target);
        return;
      } catch (fallbackError) {
        console.error(
          fallbackError
        );
      }

      setVoiceStatus(
        "Voice detection service unavailable. You can select the language manually."
      );
    } finally {
      setRecordingTarget(null);
    }
  }

  /*
  =========================================================
   BROWSER SPEECH FALLBACK
  =========================================================
  */

  function browserSpeechFallback(target) {
    return new Promise(
      (resolve, reject) => {
        const SpeechRecognition =
          window.SpeechRecognition ||
          window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
          reject(
            new Error(
              "SpeechRecognition unavailable"
            )
          );
          return;
        }

        const recognition =
          new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;

        const locale =
          selectedLanguage.code === "auto"
            ? "en-IN"
            : selectedLanguage.locale;

        recognition.lang = locale;

        recognition.onresult = (
          event
        ) => {
          const transcript =
            event.results?.[0]?.[0]
              ?.transcript || "";

          if (!transcript) {
            reject(
              new Error(
                "No transcript"
              )
            );
            return;
          }

          const detected =
            detectLanguageFromText(
              transcript
            );

          if (detected) {
            const language =
              getLanguageObject(
                detected.language
              );

            setSelectedLanguage(
              language
            );

            setConfidence(
              Math.round(
                detected.confidence *
                  100
              )
            );
          }

          setDetectedTranscript(
            transcript
          );

          if (target === "chat") {
            setChatText(transcript);

            setChatStatus(
              "Voice converted to text using browser speech recognition."
            );
          }

          setVoiceStatus(
            "Voice captured successfully."
          );

          resolve();
        };

        recognition.onerror = (
          event
        ) => {
          reject(
            new Error(
              event.error ||
                "Speech recognition failed"
            )
          );
        };

        recognition.start();
      }
    );
  }

  /*
  =========================================================
   TEXT LANGUAGE AUTO DETECTION
  =========================================================
  */

  function handleTextLanguageDetection(
    text
  ) {
    if (
      selectedLanguage.code !== "auto"
    ) {
      return;
    }

    const detected =
      detectLanguageFromText(text);

    if (!detected) {
      return;
    }

    const language =
      getLanguageObject(
        detected.language
      );

    setSelectedLanguage(
      language
    );

    setConfidence(
      Math.round(
        detected.confidence * 100
      )
    );

    setMixedLanguage(
      Boolean(
        detected.mixed_language
      )
    );
  }

  /*
  =========================================================
    ANONYMOUS REAL-WORLD PEER CHAT
  =========================================================
  */

  function getAnonymousSessionId() {
    if (!peerSessionRef.current) {
      peerSessionRef.current =
        window.crypto?.randomUUID?.() ||
        `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    return peerSessionRef.current;
  }

  function disconnectPeer(showStatus = false) {
    const socket = peerSocketRef.current;

    if (socket) {
      try {
        socket.close();
      } catch (error) {
        console.error("Peer socket close error:", error);
      }
    }

    peerSocketRef.current = null;
    setPeerConnected(false);
    setPeerMatched(false);
    setPeerTyping(false);
    setPeerMutedUntil(0);

    if (showStatus) {
      setPeerStatus("You left the anonymous conversation.");
    }
  }

  function connectToPeerChat() {
    if (!ageVerified) {
      setPeerStatus("Age verification is required before anonymous peer chat.");
      setPage("login");
      return;
    }

    disconnectPeer();

    if (!window.WebSocket) {
      setPeerStatus("This browser does not support real-time chat.");
      return;
    }

    const sessionId = getAnonymousSessionId();
    setPeerStrikes(0);
    setPeerViolations(0);
    setPeerMutedUntil(0);
    setPeerModerationMessage("");

    setPeerMessages([
      {
        id: `peer-system-${Date.now()}`,
        sender: "system",
        text: "Searching anonymously for someone with a compatible language and concern…",
      },
    ]);
    setPeerStatus("Finding an anonymous peer…");

    const socket = new WebSocket(`${WS_BASE}/ws/peer`);
    peerSocketRef.current = socket;

    socket.onopen = () => {
      setPeerConnected(true);
      setPeerStatus("Connected securely. Finding a compatible peer…");

      socket.send(
        JSON.stringify({
          type: "join",
          session_id: sessionId,
          language: selectedLanguage.code,
          language_name: selectedLanguage.name,
          concern: selectedConcern,
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "matched") {
          setPeerMatched(true);
          setPeerStatus("Anonymous peer connected. You can start talking.");
          setPeerMessages((previous) => [
            ...previous,
            {
              id: `peer-system-${Date.now()}`,
              sender: "system",
              text: "You are now connected to an anonymous peer. Be respectful and avoid sharing identifying information.",
            },
          ]);
          return;
        }

        if (data.type === "message") {
          setPeerTyping(false);

          const incomingText =
            data.text || data.message || "";

          // Block abusive incoming content locally and apply
          // escalating session penalties.
          if (handleIncomingPeerModeration(incomingText)) {
            setPeerMessages((previous) => [
              ...previous,
              {
                id: data.id || `peer-moderated-${Date.now()}-${Math.random()}`,
                sender: "system",
                text:
                  "A message was blocked by HealthBridge moderation.",
              },
            ]);
            return;
          }

          setPeerMessages((previous) => [
            ...previous,
            {
              id: data.id || `peer-${Date.now()}-${Math.random()}`,
              sender: "peer",
              text: incomingText,
            },
          ]);
          return;
        }

        if (data.type === "typing") {
          setPeerTyping(Boolean(data.active));
          return;
        }

        if (data.type === "peer_left") {
          setPeerMatched(false);
          setPeerTyping(false);
          setPeerStatus("Your peer left. Find another anonymous peer when you are ready.");
          setPeerMessages((previous) => [
            ...previous,
            {
              id: `peer-system-${Date.now()}`,
              sender: "system",
              text: "The anonymous peer ended the conversation.",
            },
          ]);
        }

        if (data.type === "status") {
          setPeerStatus(data.message || "Waiting for an anonymous peer…");
        }
      } catch (error) {
        console.error("Invalid peer message:", error);
      }
    };

    socket.onerror = () => {
      setPeerConnected(false);
      setPeerMatched(false);
      setPeerStatus("Real-world peer chat is unavailable. Start the FastAPI WebSocket server and try again.");
    };

    socket.onclose = () => {
      setPeerConnected(false);
    };
  }

  function sendPeerTyping(active) {
    const socket = peerSocketRef.current;

    if (socket?.readyState === WebSocket.OPEN && peerMatched) {
      socket.send(JSON.stringify({ type: "typing", active }));
    }
  }

  function sendPeerMessage() {
    if (!ageVerified) {
      setPeerModerationMessage(
        "Age verification is required before anonymous peer chat."
      );
      setPage("login");
      return;
    }

    const message = peerText.trim();
    const socket = peerSocketRef.current;

    if (!message || !peerMatched || socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    // Temporary mute.
    if (peerMutedUntil > Date.now()) {
      const seconds = Math.ceil(
        (peerMutedUntil - Date.now()) / 1000
      );

      setPeerModerationMessage(
        `You are temporarily muted. Try again in ${seconds}s.`
      );
      return;
    }

    // Bad-word moderation.
    if (findBlockedWord(message)) {
      setPeerText("");
      sendPeerTyping(false);
      applyOwnModeration();
      return;
    }

    socket.send(
      JSON.stringify({
        type: "message",
        id: `message-${Date.now()}`,
        text: message,
        language: selectedLanguage.code,
      })
    );

    setPeerMessages((previous) => [
      ...previous,
      {
        id: `local-${Date.now()}`,
        sender: "user",
        text: message,
      },
    ]);

    setPeerText("");
    sendPeerTyping(false);
  }

  useEffect(() => {
    if (page === "peer") {
      connectToPeerChat();
    }

    return () => {
      if (peerSocketRef.current) {
        try {
          peerSocketRef.current.close();
        } catch (error) {
          console.error("Peer cleanup error:", error);
        }
        peerSocketRef.current = null;
      }
    };
  }, [page]);

  /*
=========================================================
    TEXT TO SPEECH
=========================================================
  */

  function speakText(text) {
    if (!text || !text.trim()) return;

    if (!("speechSynthesis" in window)) {
      console.warn("Text-to-Speech is not supported by this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    const locale =
      selectedLanguage?.code === "auto"
        ? "en-IN"
        : selectedLanguage?.locale || "en-IN";

    utterance.lang = locale;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    let voice = voices.find(
      (item) =>
        item.lang &&
        item.lang.toLowerCase() === locale.toLowerCase()
    );

    if (!voice) {
      const prefix = locale.split("-")[0].toLowerCase();
      voice = voices.find(
        (item) =>
          item.lang &&
          item.lang.toLowerCase().startsWith(prefix)
      );
    }

    if (!voice && locale !== "en-IN") {
      voice = voices.find(
        (item) =>
          item.lang &&
          item.lang.toLowerCase() === "en-in"
      );
    }

    if (!voice) {
      voice = voices.find(
        (item) =>
          item.lang &&
          item.lang.toLowerCase().startsWith("en")
      );
    }

    if (voice) {
      utterance.voice = voice;
      console.log(`HealthBridge TTS: ${voice.name} (${voice.lang})`);
    } else {
      console.warn(`No matching TTS voice found for ${locale}.`);
    }

    utterance.onerror = (event) => {
      console.error("HealthBridge TTS error:", event.error);
    };

    window.setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  }

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.getVoices();

    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };

    window.speechSynthesis.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );
      window.speechSynthesis.cancel();
    };
  }, []);

  /*
=========================================================
    SEND CHAT
=========================================================
  */

/*
  =========================================================
   SEND CHAT
  =========================================================
  */

  async function sendChatMessage() {
    if (!ageVerified) {
      setChatStatus("Age verification is required before chat access.");
      setPage("login");
      return;
    }

    const message =
      chatText.trim();

    if (!message || chatLoading) {
      return;
    }

    const userMessage = {
      id:
        Date.now(),
      sender: "user",
      text: message,
    };

    setChatMessages(
      (previous) => [
        ...previous,
        userMessage,
      ]
    );

    setChatText("");

    setChatLoading(true);

    setChatStatus(
      "HealthBridge is thinking…"
    );

    try {
      const response =
        await fetch(
          `${API_BASE}/api/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              message,
              language:
                selectedLanguage.name,
              language_code:
                selectedLanguage.locale,
              concern:
                selectedConcern,
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          `Chat server returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const reply =
        data.reply ||
        data.message ||
        data.response ||
        "I'm here with you. Could you tell me a little more about what you're experiencing?";

      setChatMessages(
        (previous) => [
          ...previous,
          {
            id:
              Date.now() + 1,
            sender: "bot",
            text: reply,
          },
        ]
      );

      speakText(reply);

      setChatStatus("");
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      /*
      -------------------------------------------------------
      DEMO FALLBACK
      -------------------------------------------------------
      */

      const fallbackReply =
        getHealthFallbackReply(
          message
        );

      speakText(fallbackReply);

      setChatMessages(
        (previous) => [
          ...previous,
          {
            id:
              Date.now() + 1,
            sender: "bot",
            text: fallbackReply,
          },
        ]
      );

      setChatStatus(
        "AI service temporarily unavailable — demo response shown."
      );
    } finally {
      setChatLoading(false);
    }
  }

  /*
  =========================================================
   HEALTH FALLBACK
  =========================================================
  */

  function getHealthFallbackReply(
    message
  ) {
    const lower =
      message.toLowerCase();

    if (
      lower.includes("stress") ||
      lower.includes("tension")
    ) {
      return "It sounds like you're dealing with stress. Try taking a slow breath, stepping away from the immediate pressure for a few minutes, and talking to someone you trust. You don't have to handle everything alone.";
    }

    if (
      lower.includes("anxiety") ||
      lower.includes("panic")
    ) {
      return "That sounds difficult. Try grounding yourself by noticing five things you can see, four you can touch, and three you can hear. If the feeling is severe or persistent, consider reaching out to a qualified professional.";
    }

    if (
      lower.includes("exam")
    ) {
      return "Exam pressure can feel overwhelming. Break your work into small tasks, use short focused study sessions, and schedule proper breaks. Your performance does not define your worth.";
    }

    if (
      lower.includes("sleep")
    ) {
      return "For sleep difficulties, try maintaining a consistent sleep schedule, reducing screen exposure before bed, and avoiding caffeine late in the day.";
    }

    return "Thank you for sharing that. I'm here to listen without judgment. Tell me a little more about what you're experiencing, and we can work through it together.";
  }

  /*
  =========================================================
   SUPPORT CHAT
  =========================================================
  */

  async function sendSupportMessage() {
    const message =
      supportText.trim();

    if (
      !message ||
      supportLoading
    ) {
      return;
    }

    setSupportMessages(
      (previous) => [
        ...previous,
        {
          id:
            Date.now(),
          sender: "user",
          text: message,
        },
      ]
    );

    setSupportText("");

    setSupportLoading(true);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              message: `You are the HealthBridge customer support assistant. Answer only questions about using HealthBridge, language selection, anonymous chat, voice detection, and basic navigation. User question: ${message}`,
              language: "English",
              concern:
                "Customer Support",
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          "Support API unavailable"
        );
      }

      const data =
        await response.json();

      const reply =
        data.reply ||
        data.message ||
        data.response ||
        getSupportFallback(
          message
        );

      setSupportMessages(
        (previous) => [
          ...previous,
          {
            id:
              Date.now() + 1,
            sender: "bot",
            text: reply,
          },
        ]
      );
    } catch {
      setSupportMessages(
        (previous) => [
          ...previous,
          {
            id:
              Date.now() + 1,
            sender: "bot",
            text:
              getSupportFallback(
                message
              ),
          },
        ]
      );
    } finally {
      setSupportLoading(false);
    }
  }

  function getSupportFallback(
    message
  ) {
    const lower =
      message.toLowerCase();

    if (
      lower.includes("language")
    ) {
      return "You can select a language manually from the language cards, or choose Auto Detect and use the microphone to detect your spoken language.";
    }

    if (
      lower.includes("voice") ||
      lower.includes("mic")
    ) {
      return "Press the microphone button and allow browser microphone permission. Speak for a few seconds and HealthBridge will attempt to identify the language and convert your speech to text.";
    }

    if (
      lower.includes("anonymous") ||
      lower.includes("privacy")
    ) {
      return "HealthBridge is designed around anonymous conversations. Avoid entering names, phone numbers, addresses, passwords, or other personally identifying information.";
    }

    return "I can help with language selection, voice detection, anonymous chat, and basic HealthBridge navigation. What would you like to know?";
  }

  /*
  =========================================================
   FILTER LANGUAGES
  =========================================================
  */

  const filteredLanguages =
    LANGUAGES.filter(
      (language) =>
        language.name
          .toLowerCase()
          .includes(
            languageSearch.toLowerCase()
          ) ||
        language.native
          .toLowerCase()
          .includes(
            languageSearch.toLowerCase()
          )
    );

  /*
  =========================================================
   SELECT LANGUAGE
  =========================================================
  */

  function selectLanguage(
    language
  ) {
    setSelectedLanguage(
      language
    );

    setVoiceStatus("");

    setConfidence(0);

    setDetectedTranscript("");
  }

  /*
  =========================================================
   RENDER HOME
  =========================================================
  */

  if (page === "home") {
    return (
      <>
        <HealthBridgeStyles />

        <div className="hb-app">
          <Header
            onSupport={() => setSupportOpen(true)}
            onLogin={showLoginPage}
            ageVerified={ageVerified}
            accountEmail={accountEmail}
            onLogout={logoutAccount}
          />

          <section className="hb-hero">
            <div className="hb-hero-content">
              <div className="hb-badge">
                ANONYMOUS • MULTILINGUAL • PRIVATE
              </div>

              <h1>
                Talk freely.
                <br />
                Be understood.
              </h1>

              <p>
                A private multilingual
                health-support space where
                people can discuss stress,
                anxiety, body image,
                addiction and other
                concerns without revealing
                their identity.
              </p>

              <div className="hb-hero-actions">
                <button
                  className="hb-primary"
                  onClick={() =>
                    openAgeVerification("setup")
                  }
                >
                  Start anonymously
                  <span>→</span>
                </button>

                <button
                  className="hb-secondary"
                  onClick={() =>
                    setSupportOpen(true)
                  }
                >
                  Customer support
                </button>
              </div>

              <button
                type="button"
                className="hb-home-login"
                onClick={showLoginPage}
              >
                Login / Verify Age
              </button>

              <div className="hb-trust">
                <span>✓</span>
                No name required
                <span>✓</span>
                Multilingual
                <span>✓</span>
                Voice enabled
              </div>
            </div>

            <div className="hb-hero-card">
              <div className="hb-orbit orbit-one" />
              <div className="hb-orbit orbit-two" />

              <div className="hb-floating-card">
                <div className="hb-live">
                  <span />
                  Anonymous session
                </div>

                <div className="hb-wave">
                  {[1,2,3,4,5,6,7].map(
                    (item) => (
                      <i key={item} />
                    )
                  )}
                </div>

                <strong>
                  Speak in your language
                </strong>

                <p>
                  Voice detection can
                  identify supported Indian
                  languages automatically.
                </p>

                <div className="hb-mini-languages">
                  <span>हिन्दी</span>
                  <span>తెలుగు</span>
                  <span>தமிழ்</span>
                  <span>ಕನ್ನಡ</span>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="hb-feature-strip">
            <Feature
              icon="◎"
              title="Anonymous"
              text="Start without creating a public identity."
            />

            <Feature
              icon="文"
              title="Multilingual"
              text="Communicate using regional Indian languages."
            />

            <Feature
              icon="◉"
              title="Voice"
              text="Use voice to detect language and communicate."
            />

            <Feature
              icon="♡"
              title="Non-judgmental"
              text="Designed for sensitive conversations."
            />
          </section>

          <section id="how" className="hb-how-section">
            <div className="hb-how-heading">
              <div className="hb-eyebrow">
                HOW IT WORKS
              </div>

              <h2>
                Support in three simple steps.
              </h2>

              <p>
                HealthBridge combines age verification,
                anonymous conversations and multilingual access
                into one simple flow.
              </p>
            </div>

            <div className="hb-how-grid">
              <article className="hb-how-card">
                <span>01</span>
                <h3>Verify eligibility</h3>
                <p>
                  Log in or create an account and verify
                  your age before entering the support space.
                </p>
              </article>

              <article className="hb-how-card">
                <span>02</span>
                <h3>Choose your support</h3>
                <p>
                  Select your language and concern, then
                  choose AI support or anonymous peer chat.
                </p>
              </article>

              <article className="hb-how-card">
                <span>03</span>
                <h3>Talk anonymously</h3>
                <p>
                  Your account verifies eligibility, while
                  your health conversation stays anonymous.
                </p>
              </article>
            </div>
          </section>

          <Footer />

          <SupportWidget
            open={supportOpen}
            setOpen={setSupportOpen}
            messages={supportMessages}
            text={supportText}
            setText={setSupportText}
            loading={supportLoading}
            send={sendSupportMessage}
          />
        </div>
      </>
    );
  }

    /*
    =========================================================
     LOGIN / AGE VERIFICATION PAGE
    =========================================================
  */

  if (page === "login") {
    const calculatedAge = calculateAge(authDob);

    return (
      <>
        <HealthBridgeStyles />

        <div className="hb-app hb-auth-app">
          <Header
            onSupport={() => setSupportOpen(true)}
            onLogin={showLoginPage}
            ageVerified={ageVerified}
            accountEmail={accountEmail}
            onLogout={logoutAccount}
          />

          <main className="hb-auth-main">
            <section className="hb-auth-card">
              <div className="hb-auth-brand">
                <div className="hb-auth-logo">
                  <img
                    src="/healthbridge-logo.png"
                    alt="HealthBridge"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      event.currentTarget.parentElement.innerHTML = "H";
                    }}
                  />
                </div>

                <div>
                  <div className="hb-eyebrow">
                    {authMode === "signup"
                      ? "CREATE ACCOUNT"
                      : "AGE VERIFICATION"}
                  </div>

                  <h1>
                    {authMode === "signup"
                      ? "Create your account"
                      : "Verify your age"}
                  </h1>

                  <p>
                    Your account is used as an eligibility gate.
                    Your identity is not shown inside anonymous conversations.
                  </p>
                </div>
              </div>

              <div className="hb-auth-privacy">
                <span>🔒</span>

                <div>
                  <strong>Why do we ask?</strong>

                  <p>
                    HealthBridge verifies age before allowing access to
                    anonymous health conversations.
                  </p>
                </div>
              </div>

              <form
                className="hb-auth-form"
                onSubmit={handleAccountSubmit}
              >
                <label>
                  Email address

                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) =>
                      setAuthEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                <label>
                  Password

                  <div className="hb-password-wrap">
                    <input
                      type={
                        authShowPassword
                          ? "text"
                          : "password"
                      }
                      value={authPassword}
                      onChange={(event) =>
                        setAuthPassword(
                          event.target.value
                        )
                      }
                      placeholder="At least 6 characters"
                      autoComplete={
                        authMode === "signup"
                          ? "new-password"
                          : "current-password"
                      }
                    />

                    <button
                      type="button"
                      className="hb-password-toggle"
                      onClick={() =>
                        setAuthShowPassword(
                          (previous) =>
                            !previous
                        )
                      }
                    >
                      {
                        authShowPassword
                          ? "Hide"
                          : "Show"
                      }
                    </button>
                  </div>
                </label>

                <label>
                  Date of birth

                  <input
                    type="date"
                    value={authDob}
                    max={
                      new Date()
                        .toISOString()
                        .split("T")[0]
                    }
                    onChange={(event) =>
                      setAuthDob(
                        event.target.value
                      )
                    }
                  />
                </label>

                {authDob &&
                  calculatedAge > 0 && (
                    <div className="hb-age-result">
                      <span>✓</span>

                      <strong>
                        Age calculated:{" "}
                        {calculatedAge}
                      </strong>

                      <small>
                        Used only for eligibility
                        verification in this demo.
                      </small>
                    </div>
                  )}

                {authError && (
                  <div className="hb-auth-error">
                    {authError}
                  </div>
                )}

                {authSuccess && (
                  <div className="hb-auth-success">
                    {authSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="hb-auth-submit"
                >
                  {authMode === "signup"
                    ? "Create account & verify →"
                    : "Login & verify age →"}
                </button>
              </form>

              <div className="hb-auth-switch">
                {authMode === "login"
                  ? "New to HealthBridge?"
                  : "Already have an account?"}

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(
                      authMode ===
                        "login"
                        ? "signup"
                        : "login"
                    );

                    setAuthError("");
                    setAuthSuccess("");
                  }}
                >
                  {authMode ===
                  "login"
                    ? "Create account"
                    : "Login"}
                </button>
              </div>

              <button
                className="hb-auth-back"
                onClick={() =>
                  setPage("home")
                }
              >
                ← Back to HealthBridge
              </button>

              <div className="hb-auth-note">
                <strong>
                  Anonymous after verification
                </strong>

                <span>
                  Your account is not your
                  public chat identity. Never
                  share your name, phone
                  number, address, OTP,
                  password or other identifying
                  information with an anonymous
                  peer.
                </span>
              </div>
            </section>
          </main>

          <SupportWidget
            open={supportOpen}
            setOpen={setSupportOpen}
            messages={supportMessages}
            text={supportText}
            setText={setSupportText}
            loading={supportLoading}
            send={sendSupportMessage}
          />
        </div>
      </>
    );
  }

/*
  =========================================================
   SETUP PAGE
  =========================================================
  */

  if ((page === "chat" || page === "peer") && !ageVerified) {
    setPage("login");
    return null;
  }

  if (page === "setup" && !ageVerified) {
    return (
      <>
        <HealthBridgeStyles />

        <div className="hb-app">
          <Header
            onSupport={() =>
              setSupportOpen(true)
            }
            onLogin={showLoginPage}
            ageVerified={ageVerified}
            accountEmail={accountEmail}
            onLogout={logoutAccount}
          />

          <main className="hb-auth-main">
            <section className="hb-auth-card">
              <div className="hb-eyebrow">
                AGE VERIFICATION REQUIRED
              </div>

              <h1>
                One quick step before you continue.
              </h1>

              <p
                style={{
                  color: "#71879d",
                  lineHeight: 1.7,
                }}
              >
                Please log in or create an
                account to verify your age.
                Your health conversation
                will remain anonymous.
              </p>

              <button
                className="hb-auth-submit"
                onClick={() =>
                  setPage("login")
                }
              >
                Login / Verify age →
              </button>
            </section>
          </main>
        </div>
      </>
    );
  }

  if (page === "setup") {
    return (
      <>
        <HealthBridgeStyles />

        <div className="hb-app">
          <Header
            onSupport={() =>
              setSupportOpen(true)
            }
            onLogin={showLoginPage}
            ageVerified={ageVerified}
            accountEmail={accountEmail}
            onLogout={logoutAccount}
          />

          <main className="hb-main">
            <button
              className="hb-back"
              onClick={() =>
                setPage("home")
              }
            >
              ← Back to HealthBridge
            </button>

            <section className="hb-setup-card">
              <div className="hb-setup-title">
                <div className="hb-logo-box">
                  <img
                    src="/healthbridge-logo.png"
                    alt="HealthBridge"
                    onError={(event) => {
                      event.currentTarget.style.display =
                        "none";

                      event.currentTarget.parentElement.innerHTML =
                        "H";
                    }}
                  />
                </div>

                <div>
                  <div className="hb-eyebrow">
                    PRIVATE START
                  </div>

                  <h2>
                    Start anonymously
                  </h2>

                  <p>
                    You don't need to provide
                    your name or personal
                    information.
                  </p>
                </div>
              </div>

              <div className="hb-section">
                <div className="hb-heading">
                  <h3>
                    How do you want to
                    communicate?
                  </h3>

                  <p>
                    Select your preferred
                    language or let HealthBridge
                    detect it from your voice.
                  </p>
                </div>

                <input
                  className="hb-search"
                  value={languageSearch}
                  onChange={(event) =>
                    setLanguageSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search language..."
                />

                <div className="hb-language-grid">
                  {filteredLanguages.map(
                    (language) => (
                      <button
                        key={language.code}
                        className={`hb-language-card ${
                          selectedLanguage.code ===
                          language.code
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          selectLanguage(
                            language
                          )
                        }
                      >
                        <strong>
                          {language.name}
                        </strong>

                        <span>
                          {language.native}
                        </span>

                        {selectedLanguage.code ===
                          language.code && (
                          <small>
                            SELECTED
                          </small>
                        )}
                      </button>
                    )
                  )}
                </div>

                <div className="hb-voice-box">
                  <div className="hb-voice-title">
                    <div className="hb-mic-icon">
                      MIC
                    </div>

                    <div>
                      <strong>
                        Detect your language
                        by voice
                      </strong>

                      <p>
                        Speak naturally.
                        HealthBridge will analyze
                        your speech and select the
                        detected language.
                      </p>
                    </div>
                  </div>

                  <button
                    className={`hb-voice-button ${
                      isRecording &&
                      recordingTarget ===
                        "setup"
                        ? "recording"
                        : ""
                    }`}
                    onClick={() => {
                      if (
                        isRecording &&
                        recordingTarget ===
                          "setup"
                      ) {
                        stopRecording();
                      } else {
                        startRecording(
                          "setup"
                        );
                      }
                    }}
                  >
                    {isRecording &&
                    recordingTarget ===
                      "setup"
                      ? "■ Stop & Detect"
                      : "🎙 Detect by Voice"}
                  </button>

                  {voiceStatus && (
                    <div className="hb-status">
                      {voiceStatus}
                    </div>
                  )}

                  {detectedTranscript && (
                    <div className="hb-transcript">
                      <small>
                        DETECTED SPEECH
                      </small>

                      <p>
                        {detectedTranscript}
                      </p>
                    </div>
                  )}

                  {confidence > 0 && (
                    <div className="hb-confidence">
                      <div>
                        <span>
                          Detection confidence
                        </span>

                        <strong>
                          {confidence}%
                        </strong>
                      </div>

                      <div className="hb-progress">
                        <span
                          style={{
                            width: `${confidence}%`,
                          }}
                        />
                      </div>

                      {mixedLanguage && (
                        <small>
                          Mixed-language speech
                          detected
                        </small>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="hb-section">
                <div className="hb-heading">
                  <h3>
                    What are you dealing
                    with?
                  </h3>

                  <p>
                    This helps personalize
                    your anonymous support
                    experience.
                  </p>
                </div>

                <div className="hb-concern-grid">
                  {CONCERNS.map(
                    (concern) => (
                      <button
                        key={concern}
                        className={`hb-concern ${
                          selectedConcern ===
                          concern
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedConcern(
                            concern
                          )
                        }
                      >
                        {concern}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="hb-privacy">
                <strong>
                  🔒 Your privacy
                </strong>

                <p>
                  You will be represented by a
                  temporary anonymous identity.
                  Avoid sharing names, phone
                  numbers, addresses or other
                  personal information.
                </p>
              </div>

              <button
                className="hb-start-chat"
                onClick={() =>
                  setPage("chat")
                }
              >
                Enter anonymous chat
                <span>→</span>
              </button>

              <button
                className="hb-peer-launch"
                onClick={() =>
                  setPage("peer")
                }
              >
                <span className="hb-peer-launch-icon">
                  ◎
                </span>

                <span>
                  <strong>
                    Chat with a real person anonymously
                  </strong>

                  <small>
                    Get matched with another
                    user by language + concern
                  </small>
                </span>

                <b>
                  →
                </b>
              </button>
            </section>
          </main>

          <SupportWidget
            open={supportOpen}
            setOpen={setSupportOpen}
            messages={supportMessages}
            text={supportText}
            setText={setSupportText}
            loading={supportLoading}
            send={sendSupportMessage}
          />
        </div>
      </>
    );
  }

  /*
  =========================================================
   REAL-WORLD ANONYMOUS PEER PAGE
  =========================================================
  */

  if (page === "peer") {
    return (
      <>
        <HealthBridgeStyles />

        <div className="hb-app">
          <Header
            onSupport={() =>
              setSupportOpen(true)
            }
            onLogin={showLoginPage}
            ageVerified={ageVerified}
            accountEmail={accountEmail}
            onLogout={logoutAccount}
          />

          <main className="hb-main">
            <button
              className="hb-back"
              onClick={() => {
                disconnectPeer();
                setPage("setup");
              }}
            >
              ← Back to setup
            </button>

            <div className="hb-peer-layout">
              <section className="hb-peer-card">
                <div className="hb-peer-header">
                  <div>
                    <div className="hb-eyebrow">
                      ANONYMOUS REAL-WORLD CHAT
                    </div>

                    <h2>
                      Talk to a real person
                    </h2>

                    <p>
                      No names, profiles or
                      public identity are exchanged.
                    </p>
                  </div>

                  <div
                    className={`hb-peer-status ${
                      peerMatched
                        ? "matched"
                        : ""
                    }`}
                  >
                    <span />

                    {
                      peerMatched
                        ? "Peer connected"
                        : peerConnected
                        ? "Searching"
                        : "Offline"
                    }
                  </div>
                </div>

                <div className="hb-peer-matching">
                  <div className="hb-peer-match-icon">
                    ◎
                  </div>

                  <div>
                    <strong>
                      {
                        peerMatched
                          ? "You're connected anonymously"
                          : "Finding someone who understands"
                      }
                    </strong>

                    <p>
                      {peerStatus}
                    </p>
                  </div>
                </div>

                {peerModerationMessage && (
                  <div className="hb-peer-moderation">
                    {peerModerationMessage}
                  </div>
                )}

                <div className="hb-peer-messages">
                  {peerMessages.map(
                    (message) => (
                      <div
                        key={message.id}
                        className={`hb-peer-message ${
                          message.sender
                        }`}
                      >
                        {message.sender ===
                          "peer" && (
                          <small>
                            Anonymous peer
                          </small>
                        )}

                        <div>
                          {message.text}
                        </div>
                      </div>
                    )
                  )}

                  {peerTyping && (
                    <div className="hb-peer-message peer">
                      <small>
                        Anonymous peer
                      </small>

                      <div className="hb-typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}

                  <div id="hb-peer-bottom" />
                </div>

                <div className="hb-peer-composer">
                  <textarea
                    value={peerText}
                    disabled={!peerMatched}
                    onChange={(event) => {
                      setPeerText(
                        event.target.value
                      );

                      sendPeerTyping(
                        Boolean(
                          event.target.value.trim()
                        )
                      );
                    }}
                    onBlur={() =>
                      sendPeerTyping(false)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();
                        sendPeerMessage();
                      }
                    }}
                    placeholder={
                      peerMatched
                        ? "Write to your anonymous peer…"
                        : "Waiting for a peer…"
                    }
                  />

                  <div className="hb-peer-composer-row">
                    <span>
                      🔒 Anonymous session •{" "}
                      {selectedLanguage.name}
                    </span>

                    <button
                      className="hb-peer-send"
                      disabled={
                        !peerMatched ||
                        !peerText.trim()
                      }
                      onClick={
                        sendPeerMessage
                      }
                    >
                      Send →
                    </button>
                  </div>
                </div>
              </section>

              <aside className="hb-peer-side-card">
                <div className="hb-session-icon">
                  ◎
                </div>

                <h3>
                  Real people. Zero profiles.
                </h3>

                <p>
                  HealthBridge matches you
                  without exposing your identity.
                </p>

                <div className="hb-peer-rule">
                  <span>
                    LANGUAGE
                  </span>

                  <strong>
                    {selectedLanguage.name}
                  </strong>
                </div>

                <div className="hb-peer-rule">
                  <span>
                    CONCERN
                  </span>

                  <strong>
                    {selectedConcern}
                  </strong>
                </div>

                <div className="hb-peer-rule">
                  <span>
                    IDENTITY
                  </span>

                  <strong>
                    Anonymous
                  </strong>
                </div>

                <div className="hb-peer-safety">
                  <strong>
                    🔒 Stay anonymous
                  </strong>

                  <p>
                    Do not share your name,
                    phone number, address,
                    passwords, OTPs or other
                    identifying information.
                  </p>
                </div>

                <button
                  className="hb-peer-new"
                  onClick={
                    connectToPeerChat
                  }
                >
                  Find another peer
                </button>

                <button
                  className="hb-support-side"
                  onClick={() =>
                    setSupportOpen(true)
                  }
                >
                  Need app support?
                </button>
              </aside>
            </div>
          </main>

          <SupportWidget
            open={supportOpen}
            setOpen={setSupportOpen}
            messages={supportMessages}
            text={supportText}
            setText={setSupportText}
            loading={supportLoading}
            send={sendSupportMessage}
          />
        </div>
      </>
    );
  }

  /*
  =========================================================
   CHAT PAGE
  =========================================================
  */

  return (
    <>
      <HealthBridgeStyles />

      <div className="hb-app">
        <Header
          onSupport={() =>
            setSupportOpen(true)
          }
          onLogin={showLoginPage}
          ageVerified={ageVerified}
          accountEmail={accountEmail}
          onLogout={logoutAccount}
        />

        <main className="hb-main">
          <button
            className="hb-back"
            onClick={() =>
              setPage("setup")
            }
          >
            ← Back to setup
          </button>

          <div className="hb-chat-layout">
            <section className="hb-chat-card">
              <div className="hb-chat-header">
                <div>
                  <div className="hb-eyebrow">
                    ANONYMOUS SESSION
                  </div>

                  <h2>
                    HealthBridge Chat
                  </h2>

                  <p>
                    Talk freely. You're not
                    being judged.
                  </p>
                </div>

                <div className="hb-online">
                  <span />
                  Online
                </div>
              </div>

              <div className="hb-chat-messages">
                <div className="hb-system">
                  🔒 Your conversation is
                  anonymous. Do not share
                  personally identifying
                  information.
                </div>

                {chatMessages.map(
                  (message) => (
                    <div
                      key={message.id}
                      className={`hb-message ${
                        message.sender ===
                        "user"
                          ? "user"
                          : "bot"
                      }`}
                    >
                      {message.text}
                    </div>
                  )
                )}

                {chatLoading && (
                  <div className="hb-message bot">
                    <div className="hb-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}

                <div id="hb-chat-bottom" />
              </div>

              <div className="hb-chat-composer">
                <div className="hb-detection-bar">
                  <span>
                    Language
                  </span>

                  <strong>
                    {selectedLanguage.name}
                  </strong>

                  {confidence > 0 && (
                    <small>
                      {confidence}% confidence
                    </small>
                  )}
                </div>

                <textarea
                  value={chatText}
                  onChange={(event) => {
                    const text =
                      event.target.value;

                    setChatText(text);

                    handleTextLanguageDetection(
                      text
                    );
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      sendChatMessage();
                    }
                  }}
                  placeholder="Write what you are feeling..."
                />

                <div className="hb-composer-row">
                  <button
                    className={`hb-mic ${
                      isRecording &&
                      recordingTarget ===
                        "chat"
                        ? "recording"
                        : ""
                    }`}
                    onClick={() => {
                      if (
                        isRecording &&
                        recordingTarget ===
                          "chat"
                      ) {
                        stopRecording();
                      } else {
                        startRecording(
                          "chat"
                        );
                      }
                    }}
                  >
                    {isRecording &&
                    recordingTarget ===
                      "chat"
                      ? "■ Stop"
                      : "🎙 Voice"}
                  </button>

                  <button
                    className="hb-send"
                    disabled={
                      !chatText.trim() ||
                      chatLoading
                    }
                    onClick={
                      sendChatMessage
                    }
                  >
                    {chatLoading
                      ? "Sending..."
                      : "Send →"}
                  </button>
                </div>

                {chatStatus && (
                  <div className="hb-chat-status">
                    {chatStatus}
                  </div>
                )}
              </div>
            </section>

            <aside className="hb-session-card">
              <div className="hb-session-icon">
                H
              </div>

              <h3>
                Anonymous session
              </h3>

              <p>
                No public profile is required.
              </p>

              <div className="hb-session-info">
                <div>
                  <small>
                    LANGUAGE
                  </small>

                  <strong>
                    {selectedLanguage.name}
                  </strong>
                </div>

                <div>
                  <small>
                    CONCERN
                  </small>

                  <strong>
                    {selectedConcern}
                  </strong>
                </div>

                <div>
                  <small>
                    SESSION
                  </small>

                  <strong>
                    Temporary
                  </strong>
                </div>
              </div>

              <button
                className="hb-support-side"
                onClick={() =>
                  setSupportOpen(true)
                }
              >
                Need app support?
              </button>
            </aside>
          </div>
        </main>

        <SupportWidget
          open={supportOpen}
          setOpen={setSupportOpen}
          messages={supportMessages}
          text={supportText}
          setText={setSupportText}
          loading={supportLoading}
          send={sendSupportMessage}
        />
      </div>
    </>
  );
}

/*
===========================================================
 HEADER
===========================================================
*/

function Header({
  onSupport,
  onLogin,
  ageVerified,
  accountEmail,
  onLogout,
}) {
  return (
    <header className="hb-header">
      <div className="hb-brand">
        <div className="hb-brand-logo">
          <img
            src="/healthbridge-logo.png"
            alt="HealthBridge"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";

              event.currentTarget.parentElement.innerHTML =
                "H";
            }}
          />
        </div>

        <div>
          <strong>
            HealthBridge
          </strong>

          <small>
            Safe. Private. Connected.
          </small>
        </div>
      </div>

      <nav>
        <a href="#features">
          Features
        </a>

        <a href="#how">
          How it works
        </a>

        <button
          onClick={onSupport}
        >
          Feedback
        </button>

        <button
          type="button"
          className="hb-login-button"
          onClick={onLogin}
        >
          {
            ageVerified
              ? "Account"
              : "Login"
          }
        </button>

        {ageVerified && (
          <div className="hb-account-menu">
            <span className="hb-account-badge">
              ✓ Age verified
            </span>

            <button
              type="button"
              className="hb-account-button"
              onClick={onLogout}
              title={
                accountEmail ||
                "Logout"
              }
            >
              Logout
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}

/*
===========================================================
 FEATURE
===========================================================
*/

function Feature({
  icon,
  title,
  text,
}) {
  return (
    <div className="hb-feature">
      <div className="hb-feature-icon">
        {icon}
      </div>

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>
      </div>
    </div>
  );
}

/*
===========================================================
 FOOTER
===========================================================
*/

function Footer() {
  return (
    <footer className="hb-footer">
      <div>
        <strong>
          HealthBridge
        </strong>

        <span>
          Anonymous multilingual health
          support prototype
        </span>
      </div>

      <span>
        Built for accessible digital
        communication.
      </span>
    </footer>
  );
}

/*
===========================================================
 SUPPORT WIDGET
===========================================================
*/

function SupportWidget({
  open,
  setOpen,
  messages,
  text,
  setText,
  loading,
  send,
}) {
  if (!open) {
    return (
      <button
        className="hb-floating-support"
        onClick={() =>
          setOpen(true)
        }
      >
        ↗ Support
      </button>
    );
  }

  return (
    <>
      <div
        className="hb-support-backdrop"
        onClick={() =>
          setOpen(false)
        }
      />

      <section className="hb-support">
        <header>
          <div>
            <span>
              HEALTHBRIDGE
            </span>

            <h3>
              Customer Support
            </h3>
          </div>

          <button
            onClick={() =>
              setOpen(false)
            }
          >
            ×
          </button>
        </header>

        <div className="hb-support-messages">
          {messages.map(
            (message) => (
              <div
                key={message.id}
                className={`hb-support-message ${
                  message.sender ===
                  "user"
                    ? "user"
                    : ""
                }`}
              >
                {message.text}
              </div>
            )
          )}

          {loading && (
            <div className="hb-support-message">
              Thinking…
            </div>
          )}
        </div>

        <div className="hb-support-input">
          <textarea
            value={text}
            onChange={(event) =>
              setText(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Ask about HealthBridge..."
          />

          <button
            disabled={
              !text.trim() ||
              loading
            }
            onClick={send}
          >
            →
          </button>
        </div>
      </section>
    </>
  );
}

/*
===========================================================
 COMPLETE CSS
===========================================================
*/

function HealthBridgeStyles() {
  return (
    <style>{`
      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
        scroll-padding-top: 90px;
      }

      body {
        margin: 0;
        padding: 0;
        min-width: 320px;
        background: #f3fbfa;
        color: #183149;
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      button,
      input,
      textarea {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: .55;
      }

      .hb-app {
        min-height: 100vh;
        overflow-x: hidden;
        position: relative;
        background:
          radial-gradient(
            circle at 5% 20%,
            rgba(83, 218, 202, .19),
            transparent 28%
          ),
          radial-gradient(
            circle at 95% 35%,
            rgba(72, 190, 220, .15),
            transparent 30%
          ),
          #f4fbfb;
      }

      .hb-header {
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto;
        padding: 24px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
        z-index: 20;
      }

      .hb-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .hb-brand-logo {
        width: 62px;
        height: 62px;
        border-radius: 18px;
        background: white;
        border: 1px solid #d8ecea;
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .hb-brand-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .hb-brand strong {
        display: block;
        font-size: 22px;
      }

      .hb-brand small {
        display: block;
        margin-top: 4px;
        color: #71879d;
      }

      .hb-header nav {
        display: flex;
        align-items: center;
        gap: 28px;
      }

      .hb-header nav a {
        color: #617b94;
        text-decoration: none;
      }

      .hb-header nav button {
        padding: 12px 20px;
        border: 1px solid #bce5e1;
        border-radius: 14px;
        background: rgba(255,255,255,.75);
        color: #078f88;
        font-weight: 700;
      }

      .hb-login-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 10px 18px !important;
        border: 1px solid #078f88 !important;
        border-radius: 14px;
        background: #078f88 !important;
        color: #fff !important;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(7,143,136,.14);
        transition: transform .2s ease, box-shadow .2s ease;
      }

      .hb-login-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 25px rgba(7,143,136,.2);
      }

      .hb-account-menu {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .hb-account-badge {
        padding: 8px 11px;
        border-radius: 999px;
        background: #eaf8f5;
        color: #087d72;
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
      }

      .hb-account-button {
        padding: 10px 14px !important;
      }

      .hb-hero {
        width: min(1180px, calc(100% - 40px));
        margin: 70px auto 80px;
        display: grid;
        grid-template-columns: 1fr .8fr;
        gap: 70px;
        align-items: center;
      }

      .hb-hero-content {
        animation: hbFadeUp .7s ease both;
      }

      .hb-badge,
      .hb-eyebrow {
        color: #079b90;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .15em;
      }

      .hb-hero h1 {
        margin: 18px 0;
        font-size: clamp(48px, 7vw, 78px);
        line-height: .96;
        letter-spacing: -.055em;
      }

      .hb-hero p {
        max-width: 650px;
        color: #6a8198;
        font-size: 18px;
        line-height: 1.75;
      }

      .hb-hero-actions {
        display: flex;
        gap: 12px;
        margin-top: 30px;
      }

      .hb-primary,
      .hb-secondary {
        border-radius: 15px;
        padding: 15px 22px;
        font-weight: 800;
        transition: .2s ease;
      }

      .hb-primary {
        border: none;
        background: #079d92;
        color: white;
        box-shadow: 0 15px 35px rgba(7,157,146,.22);
      }

      .hb-primary:hover {
        transform: translateY(-3px);
      }

      .hb-primary span {
        margin-left: 15px;
      }

      .hb-secondary {
        border: 1px solid #d1e7e5;
        background: white;
        color: #405870;
      }

      .hb-trust {
        margin-top: 25px;
        display: flex;
        gap: 13px;
        flex-wrap: wrap;
        color: #72879b;
        font-size: 13px;
      }

      .hb-trust span {
        color: #079d92;
        font-weight: 900;
      }

      .hb-home-login {
        width: 100%;
        max-width: 310px;
        min-height: 50px;
        margin-top: 12px;
        padding: 0 18px;
        border: 1px solid #078f88;
        border-radius: 14px;
        background: #fff;
        color: #078f88;
        font-weight: 900;
        cursor: pointer;
        transition: transform .2s ease, background .2s ease, box-shadow .2s ease;
      }

      .hb-home-login:hover {
        transform: translateY(-2px);
        background: #effaf8;
        box-shadow: 0 10px 24px rgba(7,143,136,.12);
      }

      .hb-hero-card {
        min-height: 420px;
        position: relative;
        display: grid;
        place-items: center;
      }

      .hb-orbit {
        position: absolute;
        border-radius: 50%;
        border: 1px solid rgba(8,157,146,.13);
        animation: hbRotate 18s linear infinite;
      }

      .orbit-one {
        width: 360px;
        height: 360px;
      }

      .orbit-two {
        width: 270px;
        height: 270px;
        animation-direction: reverse;
        animation-duration: 12s;
      }

      .hb-floating-card {
        width: min(390px, 90%);
        padding: 32px;
        border-radius: 30px;
        background: rgba(255,255,255,.92);
        border: 1px solid #dceeed;
        box-shadow: 0 35px 90px rgba(40,82,100,.14);
        animation: hbFloat 4s ease-in-out infinite;
        position: relative;
        z-index: 2;
      }

      .hb-live {
        color: #58768a;
        font-size: 13px;
      }

      .hb-live span {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 7px;
        border-radius: 50%;
        background: #14b99e;
      }

      .hb-wave {
        height: 110px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
      }

      .hb-wave i {
        display: block;
        width: 7px;
        border-radius: 10px;
        background: #0aa398;
        animation: hbWave 1s ease-in-out infinite alternate;
      }

      .hb-wave i:nth-child(1) { height: 25px; }
      .hb-wave i:nth-child(2) { height: 55px; animation-delay:.1s; }
      .hb-wave i:nth-child(3) { height: 85px; animation-delay:.2s; }
      .hb-wave i:nth-child(4) { height: 45px; animation-delay:.3s; }
      .hb-wave i:nth-child(5) { height: 70px; animation-delay:.4s; }
      .hb-wave i:nth-child(6) { height: 38px; animation-delay:.5s; }
      .hb-wave i:nth-child(7) { height: 60px; animation-delay:.6s; }

      .hb-floating-card strong {
        font-size: 21px;
      }

      .hb-floating-card p {
        color: #73899b;
        line-height: 1.6;
      }

      .hb-mini-languages {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 20px;
      }

      .hb-mini-languages span {
        padding: 7px 10px;
        border-radius: 9px;
        background: #edf9f7;
        color: #078f88;
        font-size: 12px;
        font-weight: 800;
      }

      .hb-feature-strip {
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto 80px;
        display: grid;
        grid-template-columns: repeat(4,1fr);
        gap: 15px;
      }

      .hb-feature {
        padding: 22px;
        border: 1px solid #dceceb;
        border-radius: 20px;
        background: rgba(255,255,255,.82);
        transition: .25s ease;
      }

      .hb-feature:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 50px rgba(40,80,100,.09);
      }

      .hb-feature-icon {
        color: #079d92;
        font-size: 24px;
        margin-bottom: 13px;
      }

      .hb-feature p {
        color: #74899c;
        font-size: 13px;
        line-height: 1.5;
      }

      .hb-how-section {
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto;
        padding: 90px 0 40px;
      }

      .hb-how-heading {
        max-width: 760px;
        margin-bottom: 34px;
      }

      .hb-how-heading h2 {
        margin: 8px 0 10px;
        font-size: clamp(32px, 5vw, 48px);
        line-height: 1.05;
        letter-spacing: -.035em;
      }

      .hb-how-heading p {
        margin: 0;
        color: #71879d;
        font-size: 15px;
        line-height: 1.7;
      }

      .hb-how-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }

      .hb-how-card {
        padding: 26px;
        border: 1px solid #dceceb;
        border-radius: 22px;
        background: rgba(255,255,255,.9);
        box-shadow: 0 15px 40px rgba(30,70,90,.07);
        transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
      }

      .hb-how-card:hover {
        transform: translateY(-6px);
        border-color: #b8ddd9;
        box-shadow: 0 22px 50px rgba(30,70,90,.11);
      }

      .hb-how-card > span {
        color: #079d92;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .12em;
      }

      .hb-how-card h3 {
        margin: 18px 0 8px;
        font-size: 19px;
      }

      .hb-how-card p {
        margin: 0;
        color: #71879d;
        line-height: 1.65;
        font-size: 13px;
      }

      .hb-footer {
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto;
        padding: 35px 0;
        border-top: 1px solid #dbeceb;
        display: flex;
        justify-content: space-between;
        color: #71879b;
        font-size: 13px;
      }

      .hb-footer div {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .hb-footer strong {
        color: #203b54;
        font-size: 16px;
      }

      .hb-main {
        width: min(1180px, calc(100% - 40px));
        margin: 45px auto 70px;
      }

      .hb-back {
        border: none;
        background: transparent;
        color: #607b94;
        font-size: 16px;
        padding: 10px 0;
        margin-bottom: 18px;
      }

      .hb-setup-card {
        background: rgba(255,255,255,.97);
        border: 1px solid #dceceb;
        border-radius: 32px;
        padding: 45px;
        box-shadow: 0 30px 90px rgba(40,82,100,.11);
        animation: hbFadeUp .5s ease both;
      }

      .hb-setup-title {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 45px;
      }

      .hb-logo-box {
        width: 78px;
        height: 78px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 24px;
        background: #e0faf6;
        color: #079d92;
        font-size: 34px;
        font-weight: 900;
      }

      .hb-logo-box img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .hb-setup-title h2 {
        margin: 5px 0;
        font-size: 38px;
      }

      .hb-setup-title p {
        margin: 0;
        color: #71879b;
      }

      .hb-section {
        margin-top: 38px;
      }

      .hb-heading {
        margin-bottom: 18px;
      }

      .hb-heading h3 {
        margin: 0 0 7px;
        font-size: 23px;
      }

      .hb-heading p {
        margin: 0;
        color: #71879b;
      }

      .hb-search {
        width: 100%;
        height: 55px;
        border: 1px solid #cfe4e4;
        border-radius: 16px;
        padding: 0 17px;
        outline: none;
        margin-bottom: 16px;
        color: #29445c;
      }

      .hb-search:focus,
      .hb-chat-composer textarea:focus,
      .hb-support-input textarea:focus {
        border-color: #079d92;
        box-shadow: 0 0 0 4px rgba(7,157,146,.10);
      }

      .hb-language-grid {
        display: grid;
        grid-template-columns: repeat(3,1fr);
        gap: 12px;
      }

      .hb-language-card {
        min-height: 84px;
        padding: 16px;
        text-align: left;
        border: 1px solid #d4e5e6;
        border-radius: 18px;
        background: white;
        color: #304a63;
        transition: .2s ease;
      }

      .hb-language-card:hover {
        transform: translateY(-2px);
        border-color: #0aa398;
      }

      .hb-language-card.active {
        border-color: #0aa398;
        background: #effcfa;
      }

      .hb-language-card strong,
      .hb-language-card span,
      .hb-language-card small {
        display: block;
      }

      .hb-language-card span {
        margin-top: 5px;
        color: #70869b;
        font-size: 16px;
      }

      .hb-language-card small {
        margin-top: 8px;
        color: #079d92;
        font-size: 9px;
        letter-spacing: .12em;
        font-weight: 900;
      }

      .hb-voice-box {
        margin-top: 18px;
        padding: 22px;
        border-radius: 22px;
        border: 1px solid #ccece8;
        background: #effcfa;
      }

      .hb-voice-title {
        display: flex;
        gap: 15px;
        align-items: center;
      }

      .hb-mic-icon {
        width: 50px;
        height: 50px;
        flex-shrink: 0;
        border-radius: 15px;
        display: grid;
        place-items: center;
        background: #079d92;
        color: white;
        font-size: 10px;
        font-weight: 900;
      }

      .hb-voice-title strong {
        font-size: 17px;
      }

      .hb-voice-title p {
        margin: 5px 0 0;
        color: #6e8598;
        font-size: 13px;
      }

      .hb-voice-button {
        width: 100%;
        margin-top: 18px;
        padding: 15px;
        border: none;
        border-radius: 14px;
        background: #0a9e93;
        color: white;
        font-weight: 900;
        transition: .2s ease;
      }

      .hb-voice-button:hover {
        transform: translateY(-2px);
      }

      .hb-voice-button.recording {
        background: #d6535c;
        animation: hbPulse 1.2s infinite;
      }

      .hb-status,
      .hb-chat-status {
        margin-top: 12px;
        color: #16877f;
        font-size: 13px;
      }

      .hb-transcript {
        margin-top: 15px;
        padding: 14px;
        border-radius: 13px;
        background: white;
        border: 1px solid #d7e9e7;
      }

      .hb-transcript small {
        color: #079d92;
        font-weight: 900;
        letter-spacing: .1em;
      }

      .hb-transcript p {
        margin: 7px 0 0;
        color: #3e566c;
      }

      .hb-confidence {
        margin-top: 15px;
      }

      .hb-confidence > div:first-child {
        display: flex;
        justify-content: space-between;
        color: #557087;
        font-size: 13px;
      }

      .hb-progress {
        height: 7px;
        margin-top: 7px;
        border-radius: 10px;
        overflow: hidden;
        background: #d5eae8;
      }

      .hb-progress span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: #0aa398;
        transition: width .5s ease;
      }

      .hb-confidence > small {
        display: block;
        margin-top: 7px;
        color: #7a8f9e;
      }

      .hb-concern-grid {
        display: grid;
        grid-template-columns: repeat(4,1fr);
        gap: 12px;
      }

      .hb-concern {
        min-height: 62px;
        border: 1px solid #d5e5e6;
        border-radius: 16px;
        background: white;
        color: #40566d;
        font-weight: 700;
        transition: .2s ease;
      }

      .hb-concern:hover,
      .hb-concern.active {
        border-color: #0aa398;
        color: #078f88;
        background: #effcfa;
        transform: translateY(-2px);
      }

      .hb-privacy {
        margin-top: 30px;
        padding: 20px;
        border: 1px solid #dbe8eb;
        border-radius: 18px;
        background: #f7fafb;
      }

      .hb-privacy strong {
        color: #40566d;
      }

      .hb-privacy p {
        margin: 7px 0 0;
        color: #71869a;
        font-size: 13px;
        line-height: 1.6;
      }

      .hb-start-chat {
        width: 100%;
        margin-top: 20px;
        padding: 16px;
        border: none;
        border-radius: 15px;
        background: #079d92;
        color: white;
        font-weight: 900;
        box-shadow: 0 12px 30px rgba(7,157,146,.18);
      }

      .hb-start-chat span {
        margin-left: 12px;
      }

      .hb-peer-launch {
        width: 100%;
        margin-top: 12px;
        padding: 17px 18px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 13px;
        text-align: left;
        border: 1px solid #bce5e1;
        border-radius: 16px;
        background: #effaf8;
        color: #245466;
        transition: .2s ease;
      }

      .hb-peer-launch:hover {
        transform: translateY(-2px);
        border-color: #079d92;
        box-shadow: 0 14px 28px rgba(7,143,136,.10);
      }

      .hb-peer-launch-icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 13px;
        background: #079d92;
        color: #fff;
        font-weight: 900;
      }

      .hb-peer-launch strong,
      .hb-peer-launch small {
        display: block;
      }

      .hb-peer-launch small {
        margin-top: 4px;
        color: #71879d;
        font-size: 12px;
      }

      .hb-peer-launch b {
        color: #079d92;
        font-size: 20px;
      }

      /* =====================================================
         LOGIN / AGE VERIFICATION
      ===================================================== */

      .hb-auth-main {
        width: min(760px, calc(100% - 32px));
        margin: 0 auto;
        padding: 42px 0 80px;
        display: flex;
        justify-content: center;
      }

      .hb-auth-card {
        width: 100%;
        background: rgba(255,255,255,.94);
        border: 1px solid #d7ece9;
        border-radius: 30px;
        padding: 38px;
        box-shadow: 0 24px 70px rgba(27,74,90,.12);
        backdrop-filter: blur(16px);
      }

      .hb-auth-brand {
        display: flex;
        gap: 18px;
        align-items: flex-start;
      }

      .hb-auth-logo {
        flex: 0 0 72px;
        width: 72px;
        height: 72px;
        border-radius: 21px;
        overflow: hidden;
        display: grid;
        place-items: center;
        background: #fff;
        border: 1px solid #d8ecea;
        color: #078f88;
        font-size: 30px;
        font-weight: 900;
      }

      .hb-auth-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .hb-auth-brand h1 {
        margin: 5px 0 9px;
        font-size: clamp(30px, 5vw, 46px);
        line-height: 1.05;
      }

      .hb-auth-brand p {
        margin: 0;
        color: #71879d;
        line-height: 1.7;
      }

      .hb-auth-privacy {
        display: flex;
        gap: 13px;
        margin: 28px 0;
        padding: 17px 18px;
        border-radius: 18px;
        background: #effaf8;
        border: 1px solid #cdebe7;
      }

      .hb-auth-privacy > span {
        font-size: 20px;
      }

      .hb-auth-privacy strong {
        display: block;
        margin-bottom: 4px;
      }

      .hb-auth-privacy p {
        margin: 0;
        color: #668095;
        line-height: 1.55;
        font-size: 14px;
      }

      .hb-auth-form {
        display: grid;
        gap: 18px;
      }

      .hb-auth-form label {
        display: grid;
        gap: 8px;
        color: #355169;
        font-size: 14px;
        font-weight: 800;
      }

      .hb-auth-form input {
        width: 100%;
        min-height: 52px;
        padding: 13px 15px;
        border-radius: 14px;
        border: 1px solid #cfe4e2;
        background: #fbfefe;
        color: #183149;
        outline: none;
      }

      .hb-auth-form input:focus {
        border-color: #5ccdc3;
        box-shadow: 0 0 0 4px rgba(92,205,195,.14);
      }

      .hb-password-wrap {
        position: relative;
      }

      .hb-password-wrap input {
        padding-right: 76px;
      }

      .hb-password-toggle {
        position: absolute;
        right: 9px;
        top: 50%;
        transform: translateY(-50%);
        border: 0;
        background: transparent;
        color: #078f88;
        font-weight: 800;
        padding: 7px;
      }

      .hb-age-result {
        display: grid;
        grid-template-columns: auto 1fr;
        column-gap: 10px;
        padding: 14px 16px;
        border-radius: 15px;
        background: #f0fbf8;
        border: 1px solid #c9e9e4;
      }

      .hb-age-result > span {
        grid-row: 1 / span 2;
        color: #079d92;
        font-size: 18px;
      }

      .hb-age-result strong {
        color: #1d5d58;
      }

      .hb-age-result small {
        color: #71879d;
        margin-top: 3px;
      }

      .hb-auth-error,
      .hb-auth-success {
        padding: 13px 15px;
        border-radius: 13px;
        font-size: 14px;
        line-height: 1.5;
      }

      .hb-auth-error {
        color: #9d3d3d;
        background: #fff2f2;
        border: 1px solid #f0cccc;
      }

      .hb-auth-success {
        color: #176c5d;
        background: #effaf6;
        border: 1px solid #c5e9df;
      }

      .hb-auth-submit {
        min-height: 55px;
        border: 0;
        border-radius: 16px;
        background: linear-gradient(135deg, #078f88, #38bcae);
        color: white;
        font-weight: 900;
        font-size: 15px;
        box-shadow: 0 13px 30px rgba(7,143,136,.2);
      }

      .hb-auth-switch {
        display: flex;
        justify-content: center;
        gap: 7px;
        margin-top: 22px;
        color: #71879d;
        font-size: 14px;
      }

      .hb-auth-switch button {
        border: 0;
        background: transparent;
        color: #078f88;
        font-weight: 900;
        padding: 0;
      }

      .hb-auth-back {
        display: block;
        margin: 20px auto 0;
        border: 0;
        background: transparent;
        color: #617b94;
        font-weight: 700;
      }

      .hb-auth-note {
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid #e2efed;
        display: grid;
        gap: 5px;
      }

      .hb-auth-note strong {
        color: #355169;
        font-size: 13px;
      }

      .hb-auth-note span {
        color: #8194a5;
        font-size: 12px;
        line-height: 1.6;
      }

      .hb-peer-layout {
        display: grid;
        grid-template-columns: minmax(0,1fr) 300px;
        gap: 20px;
      }

      .hb-peer-card,
      .hb-peer-side-card {
        background: white;
        border: 1px solid #dceceb;
        border-radius: 28px;
        box-shadow: 0 25px 70px rgba(40,82,100,.10);
      }

      .hb-peer-card {
        overflow: hidden;
      }

      .hb-peer-header {
        padding: 25px;
        display: flex;
        justify-content: space-between;
        gap: 20px;
        border-bottom: 1px solid #e2eded;
      }

      .hb-peer-header h2 {
        margin: 5px 0;
        font-size: 30px;
      }

      .hb-peer-header p {
        margin: 0;
        color: #71879b;
      }

      .hb-peer-status {
        align-self: flex-start;
        display: flex;
        gap: 7px;
        align-items: center;
        color: #798e9c;
        font-size: 12px;
      }

      .hb-peer-status span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #e5a129;
      }

      .hb-peer-status.matched {
        color: #138477;
      }

      .hb-peer-status.matched span {
        background: #14b99e;
      }

      .hb-peer-matching {
        margin: 20px;
        padding: 18px;
        display: flex;
        align-items: center;
        gap: 14px;
        border-radius: 18px;
        background: #effaf8;
        border: 1px solid #cceae6;
      }

      .hb-peer-match-icon {
        width: 48px;
        height: 48px;
        flex: 0 0 48px;
        display: grid;
        place-items: center;
        border-radius: 15px;
        background: #079d92;
        color: white;
        font-size: 23px;
      }

      .hb-peer-matching strong {
        color: #285366;
      }

      .hb-peer-matching p {
        margin: 5px 0 0;
        color: #71879d;
        font-size: 13px;
      }

      .hb-peer-messages {
        height: 480px;
        overflow-y: auto;
        padding: 20px;
        background: #f8fcfc;
      }

      .hb-peer-message {
        width: fit-content;
        max-width: 76%;
        padding: 12px 15px;
        border-radius: 17px;
        margin-bottom: 11px;
        line-height: 1.55;
        animation: hbMessage .2s ease both;
      }

      .hb-peer-message.user {
        margin-left: auto;
        background: #079d92;
        color: white;
        border-bottom-right-radius: 5px;
      }

      .hb-peer-message.peer {
        background: white;
        border: 1px solid #dceceb;
        border-bottom-left-radius: 5px;
      }

      .hb-peer-message.system {
        width: fit-content;
        max-width: 90%;
        margin: 10px auto 15px;
        background: #eaf7f5;
        color: #617a8d;
        font-size: 12px;
        text-align: center;
      }

      .hb-peer-message small {
        display: block;
        margin-bottom: 5px;
        color: #7e929f;
        font-size: 10px;
        font-weight: 800;
      }

      .hb-peer-message.user small {
        color: rgba(255,255,255,.7);
      }

      .hb-peer-composer {
        padding: 15px;
        border-top: 1px solid #e2eeee;
      }

      .hb-peer-composer textarea {
        width: 100%;
        min-height: 95px;
        resize: none;
        padding: 14px;
        border: 1px solid #cfe2e3;
        border-radius: 15px;
        outline: none;
      }

      .hb-peer-composer textarea:focus {
        border-color: #079d92;
        box-shadow: 0 0 0 4px rgba(7,157,146,.10);
      }

      .hb-peer-composer-row {
        margin-top: 9px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        color: #71879d;
        font-size: 12px;
      }

      .hb-peer-send {
        padding: 11px 19px;
        border: none;
        border-radius: 12px;
        background: #079d92;
        color: white;
        font-weight: 900;
      }

      .hb-peer-send:disabled {
        opacity: .45;
      }

      .hb-peer-side-card {
        height: fit-content;
        padding: 23px;
      }

      .hb-peer-side-card h3 {
        margin: 15px 0 5px;
      }

      .hb-peer-side-card > p {
        margin-top: 0;
        color: #71879d;
        line-height: 1.55;
        font-size: 13px;
      }

      .hb-session-icon {
        width: 50px;
        height: 50px;
        display: grid;
        place-items: center;
        border-radius: 15px;
        background: #def8f5;
        color: #079d92;
        font-size: 23px;
        font-weight: 900;
      }

      .hb-peer-rule {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e4eeee;
      }

      .hb-peer-rule span {
        color: #8396a4;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .08em;
      }

      .hb-peer-rule strong {
        color: #3a566b;
        font-size: 13px;
      }

      .hb-peer-safety {
        margin-top: 20px;
        padding: 14px;
        border-radius: 13px;
        background: #f7fafb;
        border: 1px solid #e0eaec;
      }

      .hb-peer-safety strong {
        color: #425e71;
        font-size: 12px;
      }

      .hb-peer-safety p {
        margin: 6px 0 0;
        color: #7a8d9b;
        font-size: 11px;
        line-height: 1.55;
      }

      .hb-peer-new {
        width: 100%;
        margin-top: 16px;
        padding: 12px;
        border: 1px solid #bce4df;
        border-radius: 12px;
        background: white;
        color: #078f88;
        font-weight: 800;
      }

      .hb-peer-moderation {
        margin: 0 20px 12px;
        padding: 11px 14px;
        border: 1px solid #f0caca;
        border-radius: 12px;
        background: #fff3f3;
        color: #a13f3f;
        font-size: 13px;
        line-height: 1.5;
        font-weight: 700;
      }

      .hb-peer-moderation-policy {
        margin-top: 15px;
        padding: 13px 14px;
        border: 1px solid #e9e1c7;
        border-radius: 12px;
        background: #fffaf0;
        color: #7d6a3d;
      }

      .hb-peer-moderation-policy strong {
        display: block;
        font-size: 12px;
      }

      .hb-peer-moderation-policy p {
        margin: 6px 0 0;
        font-size: 11px;
        line-height: 1.5;
      }

      .hb-peer-new:hover {
        background: #effaf8;
      }

      .hb-chat-layout {
        display: grid;
        grid-template-columns: 1fr 290px;
        gap: 20px;
      }

      .hb-chat-card,
      .hb-session-card {
        background: white;
        border: 1px solid #dceceb;
        border-radius: 28px;
        box-shadow: 0 25px 70px rgba(40,82,100,.10);
      }

      .hb-chat-card {
        overflow: hidden;
      }

      .hb-chat-header {
        padding: 25px;
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #e2eded;
      }

      .hb-chat-header h2 {
        margin: 5px 0;
        font-size: 29px;
      }

      .hb-chat-header p {
        margin: 0;
        color: #71879b;
      }

      .hb-online {
        align-self: flex-start;
        display: flex;
        align-items: center;
        gap: 7px;
        color: #3f8178;
        font-size: 13px;
      }

      .hb-online span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #15b99e;
      }

      .hb-chat-messages {
        min-height: 430px;
        max-height: 500px;
        overflow-y: auto;
        padding: 24px;
        background: #f8fcfc;
      }

      .hb-system {
        padding: 12px 15px;
        border-radius: 12px;
        background: #edf8f7;
        color: #607a8c;
        font-size: 12px;
        margin-bottom: 20px;
      }

      .hb-message {
        width: fit-content;
        max-width: 78%;
        padding: 13px 17px;
        border-radius: 18px;
        margin-bottom: 12px;
        line-height: 1.55;
        animation: hbMessage .25s ease both;
      }

      .hb-message.bot {
        background: white;
        border: 1px solid #dcebea;
        border-bottom-left-radius: 5px;
      }

      .hb-message.user {
        margin-left: auto;
        background: #079d92;
        color: white;
        border-bottom-right-radius: 5px;
      }

      .hb-typing {
        display: flex;
        gap: 5px;
      }

      .hb-typing span {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #6d9290;
        animation: hbTyping .7s infinite alternate;
      }

      .hb-typing span:nth-child(2) {
        animation-delay: .2s;
      }

      .hb-typing span:nth-child(3) {
        animation-delay: .4s;
      }

      .hb-chat-composer {
        padding: 17px;
        border-top: 1px solid #e2eded;
      }

      .hb-detection-bar {
        display: flex;
        gap: 9px;
        align-items: center;
        margin-bottom: 10px;
        padding: 8px 11px;
        border-radius: 10px;
        background: #effaf8;
        color: #557687;
        font-size: 12px;
      }

      .hb-detection-bar strong {
        color: #078f88;
      }

      .hb-detection-bar small {
        margin-left: auto;
        color: #79919d;
      }

      .hb-chat-composer textarea {
        width: 100%;
        min-height: 105px;
        resize: none;
        padding: 15px;
        border: 1px solid #cfe2e3;
        border-radius: 15px;
        outline: none;
        color: #263f56;
      }

      .hb-composer-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 10px;
      }

      .hb-mic,
      .hb-send {
        padding: 12px 20px;
        border-radius: 12px;
        border: none;
        font-weight: 900;
      }

      .hb-mic {
        background: #e9f8f6;
        color: #078f88;
      }

      .hb-mic.recording {
        background: #d6535c;
        color: white;
      }

      .hb-send {
        background: #079d92;
        color: white;
      }

      .hb-session-card {
        height: fit-content;
        padding: 25px;
      }

      .hb-session-icon {
        width: 50px;
        height: 50px;
        display: grid;
        place-items: center;
        border-radius: 15px;
        background: #ddf9f5;
        color: #079d92;
        font-size: 22px;
        font-weight: 900;
      }

      .hb-session-card h3 {
        margin: 15px 0 6px;
      }

      .hb-session-card > p {
        color: #72889b;
        font-size: 13px;
      }

      .hb-session-info {
        display: grid;
        gap: 17px;
        margin-top: 25px;
      }

      .hb-session-info div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .hb-session-info small {
        color: #8296a5;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .08em;
      }

      .hb-session-info strong {
        color: #304b63;
      }

      .hb-support-side {
        width: 100%;
        margin-top: 25px;
        padding: 12px;
        border: 1px solid #bce4e0;
        border-radius: 12px;
        background: white;
        color: #078f88;
        font-weight: 800;
      }

      .hb-floating-support {
        position: fixed;
        right: 25px;
        bottom: 25px;
        z-index: 80;
        border: 1px solid #bce5e1;
        background: white;
        color: #078f88;
        padding: 14px 22px;
        border-radius: 30px;
        box-shadow: 0 15px 40px rgba(40,80,100,.16);
        font-weight: 900;
      }

      .hb-support-backdrop {
        position: fixed;
        z-index: 90;
        inset: 0;
        background: rgba(12,32,48,.32);
        backdrop-filter: blur(5px);
      }

      .hb-support {
        position: fixed;
        z-index: 100;
        right: 25px;
        bottom: 25px;
        width: min(420px, calc(100vw - 30px));
        height: min(620px, calc(100vh - 40px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 25px;
        background: white;
        box-shadow: 0 35px 100px rgba(0,0,0,.24);
        animation: hbSlide .3s ease both;
      }

      .hb-support header {
        padding: 20px;
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #e2eeee;
      }

      .hb-support header span {
        color: #079d92;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .1em;
      }

      .hb-support header h3 {
        margin: 5px 0 0;
      }

      .hb-support header button {
        width: 38px;
        height: 38px;
        border: none;
        border-radius: 50%;
        background: #edf8f7;
        color: #587687;
        font-size: 24px;
      }

      .hb-support-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #f7fbfb;
      }

      .hb-support-message {
        width: fit-content;
        max-width: 82%;
        padding: 12px 15px;
        border-radius: 16px;
        margin-bottom: 10px;
        background: white;
        border: 1px solid #dcebea;
        line-height: 1.5;
        font-size: 14px;
      }

      .hb-support-message.user {
        margin-left: auto;
        background: #079d92;
        color: white;
        border: none;
      }

      .hb-support-input {
        padding: 15px;
        display: flex;
        gap: 8px;
        border-top: 1px solid #e2eeee;
      }

      .hb-support-input textarea {
        flex: 1;
        min-height: 48px;
        max-height: 100px;
        resize: vertical;
        padding: 10px;
        border: 1px solid #cfe2e2;
        border-radius: 12px;
        outline: none;
      }

      .hb-support-input button {
        width: 50px;
        border: none;
        border-radius: 12px;
        background: #079d92;
        color: white;
        font-size: 20px;
        font-weight: 900;
      }

      @keyframes hbFadeUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes hbFloat {
        0%,100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-10px);
        }
      }

      @keyframes hbRotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes hbWave {
        from {
          transform: scaleY(.5);
        }
        to {
          transform: scaleY(1);
        }
      }

      @keyframes hbPulse {
        0% {
          box-shadow: 0 0 0 0 rgba(214,83,92,.35);
        }
        70% {
          box-shadow: 0 0 0 13px rgba(214,83,92,0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(214,83,92,0);
        }
      }

      @keyframes hbTyping {
        from {
          opacity: .35;
          transform: translateY(0);
        }
        to {
          opacity: 1;
          transform: translateY(-3px);
        }
      }

      @keyframes hbMessage {
        from {
          opacity: 0;
          transform: translateY(7px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes hbSlide {
        from {
          opacity: 0;
          transform: translateY(25px) scale(.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (max-width: 900px) {
        .hb-hero {
          grid-template-columns: 1fr;
        }

        .hb-feature-strip {
          grid-template-columns: repeat(2,1fr);
        }

        .hb-language-grid {
          grid-template-columns: repeat(2,1fr);
        }

        .hb-concern-grid {
          grid-template-columns: repeat(2,1fr);
        }

        .hb-chat-layout {
          grid-template-columns: 1fr;
        }

        .hb-peer-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 600px) {
        .hb-header,
        .hb-main,
        .hb-hero,
        .hb-feature-strip,
        .hb-footer {
          width: calc(100% - 24px);
        }

        .hb-header nav a {
          display: none;
        }

        .hb-header nav {
          gap: 8px;
        }

        .hb-account-badge {
          display: none;
        }

        .hb-how-section {
          width: calc(100% - 24px);
          padding-top: 60px;
        }

        .hb-how-grid {
          grid-template-columns: 1fr;
        }

        .hb-auth-main {
          width: calc(100% - 24px);
          padding-top: 24px;
        }

        .hb-auth-card {
          padding: 24px 18px;
          border-radius: 22px;
        }

        .hb-auth-brand {
          gap: 12px;
        }

        .hb-auth-logo {
          flex-basis: 58px;
          width: 58px;
          height: 58px;
          border-radius: 17px;
        }

        .hb-brand-logo {
          width: 48px;
          height: 48px;
        }

        .hb-hero {
          margin-top: 35px;
        }

        .hb-hero h1 {
          font-size: 48px;
        }

        .hb-hero-actions {
          flex-direction: column;
        }

        .hb-feature-strip,
        .hb-language-grid,
        .hb-concern-grid {
          grid-template-columns: 1fr;
        }

        .hb-setup-card {
          padding: 22px;
          border-radius: 22px;
        }

        .hb-setup-title h2 {
          font-size: 30px;
        }

        .hb-setup-title {
          align-items: flex-start;
        }

        .hb-footer {
          flex-direction: column;
          gap: 15px;
        }

        .hb-floating-support {
          right: 15px;
          bottom: 15px;
        }

        .hb-support {
          right: 15px;
          bottom: 15px;
        }

        .hb-composer-row {
          flex-direction: column;
        }

        .hb-mic,
        .hb-send {
          width: 100%;
        }

        .hb-peer-header {
          flex-direction: column;
        }

        .hb-peer-message {
          max-width: 88%;
        }

        .hb-peer-composer-row {
          flex-direction: column;
          align-items: stretch;
        }

        .hb-peer-send {
          width: 100%;
        }

        .hb-peer-launch {
          grid-template-columns: auto 1fr;
        }

        .hb-peer-launch b {
          display: none;
        }
      }
    `}</style>
  );
}