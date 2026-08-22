import { useEffect, useMemo, useRef, useState } from "react";

/*
  HEALTHBRIDGE
  Anonymous Multilingual Health Support Prototype

  Features:
  - Anonymous start
  - Multilingual language selection
  - Auto language detection from typed text
  - Voice-based language detection using browser Speech Recognition
  - Health concern selection
  - Animated interactive cards
  - Customer-support chatbot
  - Accessible controls
  - No page navigation when selecting languages
  - Optional FastAPI integration
*/

const LANGUAGES = [
  {
    id: "auto",
    name: "Auto Detect",
    native: "Automatic",
    code: "auto",
  },
  {
    id: "en",
    name: "English",
    native: "English",
    code: "en-IN",
  },
  {
    id: "hi",
    name: "Hindi",
    native: "हिन्दी",
    code: "hi-IN",
  },
  {
    id: "te",
    name: "Telugu",
    native: "తెలుగు",
    code: "te-IN",
  },
  {
    id: "ta",
    name: "Tamil",
    native: "தமிழ்",
    code: "ta-IN",
  },
  {
    id: "kn",
    name: "Kannada",
    native: "ಕನ್ನಡ",
    code: "kn-IN",
  },
  {
    id: "ml",
    name: "Malayalam",
    native: "മലയാളം",
    code: "ml-IN",
  },
  {
    id: "bn",
    name: "Bengali",
    native: "বাংলা",
    code: "bn-IN",
  },
  {
    id: "mr",
    name: "Marathi",
    native: "मराठी",
    code: "mr-IN",
  },
  {
    id: "gu",
    name: "Gujarati",
    native: "ગુજરાતી",
    code: "gu-IN",
  },
  {
    id: "pa",
    name: "Punjabi",
    native: "ਪੰਜਾਬੀ",
    code: "pa-IN",
  },
  {
    id: "ur",
    name: "Urdu",
    native: "اردو",
    code: "ur-IN",
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
  "Relationships",
  "Loneliness",
  "Nutrition",
  "Self Confidence",
  "Other",
];

const QUICK_SUPPORT = [
  "How does HealthBridge work?",
  "Is my conversation anonymous?",
  "How does language detection work?",
  "Can I use voice instead of typing?",
];

const SUPPORT_REPLIES = {
  "How does HealthBridge work?":
    "HealthBridge provides an anonymous space where users can discuss health and wellbeing concerns. You can choose a language, select a concern, and continue to the support chat.",
  "Is my conversation anonymous?":
    "The prototype is designed around anonymous interaction. Avoid entering names, phone numbers, addresses, passwords, or other personally identifying information.",
  "How does language detection work?":
    "HealthBridge can use typed-script detection and browser voice recognition. For production deployment, the voice pipeline should use a dedicated multilingual speech-recognition service.",
  "Can I use voice instead of typing?":
    "Yes. Use the Detect by Voice control. Your browser must support Speech Recognition and microphone access must be allowed.",
};

function detectLanguageFromText(text) {
  if (!text || !text.trim()) {
    return null;
  }

  const checks = [
    {
      id: "hi",
      regex: /[\u0900-\u097F]/,
    },
    {
      id: "bn",
      regex: /[\u0980-\u09FF]/,
    },
    {
      id: "pa",
      regex: /[\u0A00-\u0A7F]/,
    },
    {
      id: "gu",
      regex: /[\u0A80-\u0AFF]/,
    },
    {
      id: "ta",
      regex: /[\u0B80-\u0BFF]/,
    },
    {
      id: "te",
      regex: /[\u0C00-\u0C7F]/,
    },
    {
      id: "kn",
      regex: /[\u0C80-\u0CFF]/,
    },
    {
      id: "ml",
      regex: /[\u0D00-\u0D7F]/,
    },
    {
      id: "ur",
      regex: /[\u0600-\u06FF\u0750-\u077F]/,
    },
  ];

  for (const item of checks) {
    if (item.regex.test(text)) {
      return item.id;
    }
  }

  if (/[a-zA-Z]/.test(text)) {
    return "en";
  }

  return null;
}

function getLanguageName(id) {
  return (
    LANGUAGES.find((language) => language.id === id)?.name ||
    "Unknown language"
  );
}

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [languageSearch, setLanguageSearch] = useState("");

  const [selectedConcern, setSelectedConcern] = useState("");
  const [showAllConcerns, setShowAllConcerns] = useState(false);

  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");

  const [typedText, setTypedText] = useState("");

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: "Hello. I am the HealthBridge support assistant. I can explain how the platform works, privacy features, language detection and voice support.",
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const [started, setStarted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  const filteredLanguages = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();

    if (!query) {
      return LANGUAGES;
    }

    return LANGUAGES.filter(
      (language) =>
        language.name.toLowerCase().includes(query) ||
        language.native.toLowerCase().includes(query)
    );
  }, [languageSearch]);

  const visibleConcerns = showAllConcerns
    ? CONCERNS
    : CONCERNS.slice(0, 6);

  useEffect(() => {
    if (!typedText.trim() || selectedLanguage !== "auto") {
      return;
    }

    const detected = detectLanguageFromText(typedText);

    if (detected) {
      setDetectedLanguage(detected);
    }
  }, [typedText, selectedLanguage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  function selectLanguage(languageId) {
    if (!languageId) {
      return;
    }

    setSelectedLanguage(languageId);
    setVoiceMessage("");
    setVoiceTranscript("");

    if (languageId !== "auto") {
      setDetectedLanguage(languageId);
    } else {
      setDetectedLanguage(null);
    }
  }

  function handleTypedLanguageDetection(event) {
    const value = event.target.value;

    setTypedText(value);

    if (selectedLanguage !== "auto") {
      return;
    }

    const detected = detectLanguageFromText(value);

    if (detected) {
      setDetectedLanguage(detected);
    }
  }

  function startVoiceDetection() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceMessage(
        "Voice recognition is not supported by this browser. Try Google Chrome or Microsoft Edge."
      );
      return;
    }

    if (voiceListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;

    /*
      The browser Speech API needs a recognition language.
      For Auto Detect, English-India is used as the initial
      recognition language and script detection is applied
      to the returned transcript.

      Production version:
      Replace this with a multilingual speech-to-text API
      on the FastAPI backend.
    */
    recognition.lang =
      selectedLanguage !== "auto"
        ? LANGUAGES.find(
            (language) => language.id === selectedLanguage
          )?.code || "en-IN"
        : "en-IN";

    recognition.onstart = () => {
      setVoiceListening(true);
      setVoiceMessage("Listening...");
      setVoiceTranscript("");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i += 1
      ) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();

      setVoiceTranscript(transcript);

      const detected = detectLanguageFromText(transcript);

      if (detected && selectedLanguage === "auto") {
        setDetectedLanguage(detected);
        setSelectedLanguage(detected);

        setVoiceMessage(
          `Detected language: ${getLanguageName(detected)}`
        );
      } else if (selectedLanguage !== "auto") {
        setDetectedLanguage(selectedLanguage);

        setVoiceMessage(
          `Voice captured in ${getLanguageName(
            selectedLanguage
          )}.`
        );
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      setVoiceListening(false);

      if (event.error === "not-allowed") {
        setVoiceMessage(
          "Microphone permission was denied. Allow microphone access and try again."
        );
      } else if (event.error === "no-speech") {
        setVoiceMessage(
          "No speech was detected. Please speak clearly and try again."
        );
      } else {
        setVoiceMessage(
          "Voice recognition could not be completed. Please try again."
        );
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
      setVoiceListening(false);
      setVoiceMessage("Unable to start the microphone.");
    }
  }

  function chooseConcern(concern) {
    setSelectedConcern(concern);
  }

  function startHealthChat() {
    setStarted(true);

    setTimeout(() => {
      document
        .getElementById("health-chat")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  function getFallbackSupportReply(message) {
    const normalized = message.toLowerCase();

    if (
      normalized.includes("anonymous") ||
      normalized.includes("privacy")
    ) {
      return SUPPORT_REPLIES["Is my conversation anonymous?"];
    }

    if (
      normalized.includes("language") ||
      normalized.includes("detect")
    ) {
      return SUPPORT_REPLIES[
        "How does language detection work?"
      ];
    }

    if (
      normalized.includes("voice") ||
      normalized.includes("microphone")
    ) {
      return SUPPORT_REPLIES[
        "Can I use voice instead of typing?"
      ];
    }

    if (
      normalized.includes("work") ||
      normalized.includes("healthbridge")
    ) {
      return SUPPORT_REPLIES[
        "How does HealthBridge work?"
      ];
    }

    return "I can help explain HealthBridge features, privacy, language detection, voice interaction and how to start a support conversation.";
  }

  async function sendSupportMessage(messageOverride = null) {
    const message =
      messageOverride !== null
        ? messageOverride
        : chatInput.trim();

    if (!message || chatLoading) {
      return;
    }

    setChatInput("");

    setChatMessages((previous) => [
      ...previous,
      {
        role: "user",
        text: message,
      },
    ]);

    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          language:
            detectedLanguage ||
            selectedLanguage ||
            "auto",
          concern: selectedConcern || "general",
        }),
      });

      if (!response.ok) {
        throw new Error("Backend unavailable");
      }

      const data = await response.json();

      const reply =
        data.reply ||
        data.message ||
        data.response;

      if (!reply) {
        throw new Error("Empty backend response");
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "bot",
          text: reply,
        },
      ]);
    } catch (error) {
      console.warn(
        "Support backend unavailable. Using local fallback.",
        error
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 500)
      );

      setChatMessages((previous) => [
        ...previous,
        {
          role: "bot",
          text: getFallbackSupportReply(message),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendSupportMessage();
    }
  }

  const activeLanguage =
    selectedLanguage === "auto"
      ? detectedLanguage
      : selectedLanguage;

  return (
    <div className="healthbridge-app">
      {/* Background animation */}
      <div className="ambient-background" aria-hidden="true">
        <div className="ambient-orb orb-one" />
        <div className="ambient-orb orb-two" />
        <div className="ambient-orb orb-three" />
      </div>

      {/* HEADER */}
      <header className="site-header">
        <div className="brand">
          <img
            src="/healthbridge-logo.png"
            alt="HealthBridge"
            className="brand-logo"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          <div>
            <div className="brand-name">
              HealthBridge
            </div>

            <div className="brand-tagline">
              Safe. Private. Connected.
            </div>
          </div>
        </div>

        <nav className="site-nav">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>

          <button
            type="button"
            className="header-support-button"
            onClick={() => setShowChat(true)}
          >
            Support
          </button>
        </nav>
      </header>

      {/* HERO */}
      {!started && (
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              ANONYMOUS MULTILINGUAL HEALTH SUPPORT
            </div>

            <h1>
              Talk freely.
              <br />
              Be understood.
            </h1>

            <p className="hero-description">
              A private digital space for discussing
              stress, anxiety, body image, addiction and
              other health concerns without revealing
              your identity.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  document
                    .getElementById("anonymous-start")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              >
                Start anonymously
                <span>→</span>
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowChat(true)}
              >
                Contact support
              </button>
            </div>

            <div className="hero-trust">
              <span>Anonymous interaction</span>
              <span>Multilingual support</span>
              <span>Voice enabled</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="floating-panel panel-main">
              <div className="visual-status">
                <span className="status-dot" />
                Private session
              </div>

              <div className="visual-wave">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>

              <p>
                Your words matter.
              </p>

              <small>
                Speak in the language you are
                comfortable with.
              </small>
            </div>

            <div className="floating-panel panel-small">
              <strong>12+</strong>
              <span>Languages</span>
            </div>
          </div>
        </section>
      )}

      {/* MAIN APP */}
      <main className="main-container">
        {!started && (
          <>
            {/* ANONYMOUS START */}
            <section
              id="anonymous-start"
              className="anonymous-card reveal-card"
            >
              <div className="section-intro">
                <div className="intro-icon">
                  H
                </div>

                <div>
                  <div className="eyebrow">
                    PRIVATE START
                  </div>

                  <h2>
                    Start anonymously
                  </h2>

                  <p>
                    You don't need to provide your
                    name or personal information.
                  </p>
                </div>
              </div>

              {/* LANGUAGE */}
              <section className="language-section">
                <div className="section-heading">
                  <h3>
                    How do you want to communicate?
                  </h3>

                  <p>
                    Select a language or let HealthBridge
                    detect it automatically.
                  </p>
                </div>

                <div className="language-search">
                  <input
                    type="text"
                    value={languageSearch}
                    onChange={(event) =>
                      setLanguageSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search language..."
                    aria-label="Search language"
                  />
                </div>

                <div className="language-grid">
                  {filteredLanguages.map(
                    (language) => (
                      <button
                        type="button"
                        key={language.id}
                        className={`language-card ${
                          selectedLanguage ===
                          language.id
                            ? "selected"
                            : ""
                        }`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          selectLanguage(
                            language.id
                          );
                        }}
                      >
                        <strong>
                          {language.name}
                        </strong>

                        <span>
                          {language.native}
                        </span>

                        {selectedLanguage ===
                          language.id && (
                          <small>
                            SELECTED
                          </small>
                        )}
                      </button>
                    )
                  )}
                </div>

                {/* TYPED AUTO DETECTION */}
                {selectedLanguage === "auto" && (
                  <div className="auto-detect-box">
                    <div>
                      <strong>
                        Automatic language detection
                      </strong>

                      <p>
                        Type a short sentence and
                        HealthBridge will inspect the
                        writing system.
                      </p>
                    </div>

                    <textarea
                      value={typedText}
                      onChange={
                        handleTypedLanguageDetection
                      }
                      placeholder="Type something in your language..."
                      rows={3}
                    />

                    {detectedLanguage && (
                      <div className="detection-result">
                        Detected:
                        <strong>
                          {" "}
                          {getLanguageName(
                            detectedLanguage
                          )}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {/* VOICE DETECTION */}
                <div className="voice-detection">
                  <div className="voice-header">
                    <div className="voice-icon">
                      MIC
                    </div>

                    <div>
                      <h4>
                        Detect your language by voice
                      </h4>

                      <p>
                        Speak naturally. HealthBridge
                        will analyze the captured speech
                        and select the detected language.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`voice-button ${
                      voiceListening
                        ? "listening"
                        : ""
                    }`}
                    onClick={startVoiceDetection}
                  >
                    <span>
                      {voiceListening
                        ? "Stop Listening"
                        : "Detect by Voice"}
                    </span>
                  </button>

                  {voiceMessage && (
                    <div className="voice-status">
                      {voiceMessage}
                    </div>
                  )}

                  {voiceTranscript && (
                    <div className="voice-transcript">
                      <span>
                        Transcript
                      </span>

                      <p>
                        {voiceTranscript}
                      </p>
                    </div>
                  )}

                  {activeLanguage && (
                    <div className="active-language">
                      Current language:
                      <strong>
                        {" "}
                        {getLanguageName(
                          activeLanguage
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              </section>

              {/* CONCERNS */}
              <section className="concern-section">
                <div className="section-heading">
                  <h3>
                    What are you dealing with?
                  </h3>

                  <p>
                    This helps HealthBridge understand
                    the type of support you are looking
                    for.
                  </p>
                </div>

                <div className="concern-window">
                  <div className="concern-track">
                    {visibleConcerns.map(
                      (concern) => (
                        <button
                          type="button"
                          key={concern}
                          className={`concern-card ${
                            selectedConcern ===
                            concern
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            chooseConcern(
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

                <button
                  type="button"
                  className="show-more-button"
                  onClick={() =>
                    setShowAllConcerns(
                      (value) => !value
                    )
                  }
                >
                  {showAllConcerns
                    ? "Show fewer concerns"
                    : "View more concerns"}
                </button>
              </section>

              {/* PRIVACY */}
              <section className="privacy-box">
                <div>
                  <strong>
                    Your privacy comes first
                  </strong>

                  <p>
                    Use an anonymous identity and avoid
                    sharing personal information.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowPrivacy(
                      (value) => !value
                    )
                  }
                >
                  {showPrivacy
                    ? "Hide details"
                    : "Privacy details"}
                </button>

                {showPrivacy && (
                  <div className="privacy-details">
                    HealthBridge should never require
                    your real name to begin a support
                    conversation. For a production
                    deployment, conversations should be
                    protected with encryption, access
                    controls and appropriate data
                    retention policies.
                  </div>
                )}
              </section>

              {/* START */}
              <button
                type="button"
                className="start-chat-button"
                disabled={!selectedConcern}
                onClick={startHealthChat}
              >
                {selectedConcern
                  ? `Continue with ${selectedConcern}`
                  : "Select a concern to continue"}
                <span>→</span>
              </button>
            </section>
          </>
        )}

        {/* ACTUAL HEALTH CHAT */}
        {started && (
          <section
            id="health-chat"
            className="health-chat-section"
          >
            <button
              type="button"
              className="back-button"
              onClick={() => setStarted(false)}
            >
              ← Back to setup
            </button>

            <div className="chat-layout">
              <div className="chat-main-card">
                <div className="chat-header">
                  <div>
                    <div className="eyebrow">
                      ANONYMOUS SESSION
                    </div>

                    <h2>
                      HealthBridge Support
                    </h2>

                    <p>
                      {selectedConcern ||
                        "General health support"}
                      {" · "}
                      {getLanguageName(
                        activeLanguage ||
                          "en"
                      )}
                    </p>
                  </div>

                  <div className="online-status">
                    <span />
                    Session active
                  </div>
                </div>

                <div className="chat-messages">
                  <div className="system-message">
                    You are using an anonymous
                    HealthBridge session. Do not share
                    passwords, financial information or
                    identifying information.
                  </div>

                  <div className="chat-placeholder">
                    <div className="chat-placeholder-icon">
                      H
                    </div>

                    <h3>
                      A private space to talk
                    </h3>

                    <p>
                      This is the place where the
                      multilingual health conversation
                      interface can be connected to your
                      AI or peer-support backend.
                    </p>
                  </div>
                </div>

                <div className="chat-composer">
                  <textarea
                    placeholder="Write what you are feeling..."
                    rows={3}
                    value={typedText}
                    onChange={(event) =>
                      setTypedText(
                        event.target.value
                      )
                    }
                  />

                  <div className="composer-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={startVoiceDetection}
                    >
                      Voice
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        setShowChat(true)
                      }
                    >
                      Support
                    </button>
                  </div>
                </div>
              </div>

              <aside className="chat-side-card">
                <span className="eyebrow">
                  SESSION INFO
                </span>

                <h3>
                  Your anonymous profile
                </h3>

                <div className="session-info">
                  <div>
                    <span>Language</span>
                    <strong>
                      {getLanguageName(
                        activeLanguage ||
                          "auto"
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Concern</span>
                    <strong>
                      {selectedConcern ||
                        "General"}
                    </strong>
                  </div>

                  <div>
                    <span>Identity</span>
                    <strong>
                      Anonymous
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="support-side-button"
                  onClick={() =>
                    setShowChat(true)
                  }
                >
                  Contact support
                </button>
              </aside>
            </div>
          </section>
        )}

        {/* FEATURES */}
        <section
          id="features"
          className="features-section"
        >
          <div className="section-heading centered">
            <div className="eyebrow">
              BUILT FOR ACCESSIBILITY
            </div>

            <h2>
              More than a basic chatbot
            </h2>

            <p>
              HealthBridge combines anonymous
              interaction, multilingual communication,
              voice input and guided support.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-number">
                01
              </div>

              <h3>
                Anonymous by design
              </h3>

              <p>
                Users can begin without providing a
                name or profile information.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-number">
                02
              </div>

              <h3>
                Multilingual interaction
              </h3>

              <p>
                Supports multiple Indian languages and
                automatic language selection.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-number">
                03
              </div>

              <h3>
                Voice accessibility
              </h3>

              <p>
                Voice interaction can help users who
                prefer speaking over typing.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-number">
                04
              </div>

              <h3>
                Guided support
              </h3>

              <p>
                Users can identify a concern before
                entering the support conversation.
              </p>
            </article>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how-it-works"
          className="how-section"
        >
          <div className="section-heading centered">
            <div className="eyebrow">
              SIMPLE WORKFLOW
            </div>

            <h2>
              From language to support
            </h2>
          </div>

          <div className="workflow">
            <div className="workflow-step">
              <span>01</span>
              <h3>
                Choose or detect
              </h3>
              <p>
                Select a language or use voice/text
                detection.
              </p>
            </div>

            <div className="workflow-line" />

            <div className="workflow-step">
              <span>02</span>
              <h3>
                Select concern
              </h3>
              <p>
                Choose the topic you want support with.
              </p>
            </div>

            <div className="workflow-line" />

            <div className="workflow-step">
              <span>03</span>
              <h3>
                Start anonymously
              </h3>
              <p>
                Enter the private support environment.
              </p>
            </div>

            <div className="workflow-line" />

            <div className="workflow-step">
              <span>04</span>
              <h3>
                Get support
              </h3>
              <p>
                Continue through the AI or peer-support
                layer.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* CUSTOMER SUPPORT CHATBOT */}
      <button
        type="button"
        className="floating-support-button"
        onClick={() => setShowChat(true)}
        aria-label="Open customer support"
      >
        <span className="support-pulse" />
        Support
      </button>

      {showChat && (
        <div
          className="support-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowChat(false);
            }
          }}
        >
          <div className="support-chatbot">
            <div className="support-chat-header">
              <div>
                <div className="eyebrow">
                  HEALTHBRIDGE SUPPORT
                </div>

                <h3>
                  How can we help?
                </h3>
              </div>

              <button
                type="button"
                className="close-chat"
                onClick={() =>
                  setShowChat(false)
                }
                aria-label="Close support"
              >
                ×
              </button>
            </div>

            <div className="support-chat-body">
              {chatMessages.map(
                (message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`support-message ${
                      message.role === "user"
                        ? "user-message"
                        : "bot-message"
                    }`}
                  >
                    {message.text}
                  </div>
                )
              )}

              {chatLoading && (
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className="quick-support">
              {QUICK_SUPPORT.map(
                (question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() =>
                      sendSupportMessage(
                        question
                      )
                    }
                  >
                    {question}
                  </button>
                )
              )}
            </div>

            <div className="support-chat-input">
              <textarea
                value={chatInput}
                onChange={(event) =>
                  setChatInput(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleChatKeyDown
                }
                placeholder="Ask about HealthBridge..."
                rows={2}
              />

              <button
                type="button"
                onClick={() =>
                  sendSupportMessage()
                }
                disabled={
                  chatLoading ||
                  !chatInput.trim()
                }
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-brand">
          <img
            src="/healthbridge-logo.png"
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          <div>
            <strong>
              HealthBridge
            </strong>

            <span>
              Anonymous multilingual health support
              prototype
            </span>
          </div>
        </div>

        <div className="footer-note">
          Designed for safer, more accessible health
          conversations.
        </div>
      </footer>
    </div>
  );
}

export default App;