import os
import json
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from dotenv import load_dotenv


# =========================================================
# LOAD ENVIRONMENT
# =========================================================

load_dotenv()


# =========================================================
# OPENAI CLIENT
# =========================================================

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise RuntimeError(
        "OPENAI_API_KEY is not configured."
    )

client = OpenAI(api_key=api_key)


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    title="HealthBridge API",
    description="Backend API for HealthBridge",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "HealthBridge API",
    }


# =========================================================
# LANGUAGE DETECTION
# =========================================================

@app.post("/api/detect-language")
async def detect_language(
    audio: UploadFile = File(...)
):

    if not audio:
        raise HTTPException(
            status_code=400,
            detail="No audio file received.",
        )

    allowed_types = [
        "audio/webm",
        "audio/wav",
        "audio/wave",
        "audio/mpeg",
        "audio/mp4",
        "audio/ogg",
        "audio/x-wav",
    ]

    content_type = audio.content_type or ""

    # Browser MediaRecorder may append codecs,
    # therefore we only check the beginning.
    valid_type = any(
        content_type.startswith(item)
        for item in allowed_types
    )

    if not valid_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type: {content_type}",
        )

    audio_bytes = await audio.read()

    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="Audio file is empty.",
        )

    temp_path = None

    try:

        # =================================================
        # CREATE TEMP AUDIO FILE
        # =================================================

        suffix = ".webm"

        if "wav" in content_type:
            suffix = ".wav"
        elif "mpeg" in content_type:
            suffix = ".mp3"
        elif "mp4" in content_type:
            suffix = ".mp4"
        elif "ogg" in content_type:
            suffix = ".ogg"

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temp_file:

            temp_file.write(audio_bytes)

            temp_path = temp_file.name


        # =================================================
        # TRANSCRIBE AUDIO
        # =================================================

        with open(
            temp_path,
            "rb",
        ) as audio_file:

            transcription = (
                client.audio.transcriptions.create(
                    model="gpt-4o-mini-transcribe",
                    file=audio_file,
                    response_format="json",
                )
            )


        transcript = getattr(
            transcription,
            "text",
            "",
        )


        # =================================================
        # LANGUAGE IDENTIFICATION
        # =================================================

        if not transcript.strip():

            raise HTTPException(
                status_code=422,
                detail="No speech could be detected.",
            )


        language_prompt = f"""
You are a language identification system.

Identify the primary language used in the
following speech transcript.

The system is designed for Indian users.

Possible languages include:

English
Hindi
Telugu
Tamil
Kannada
Malayalam
Bengali
Marathi
Gujarati
Punjabi
Urdu

Also identify mixed-language speech when appropriate.

Examples:

"mujhe bahut stress ho raha hai"
=> Hindi

"నాకు చాలా stress గా ఉంది"
=> Telugu

"எனக்கு மிகவும் stress ஆக உள்ளது"
=> Tamil

"mujhe exam ka tension hai"
=> Hinglish / Hindi

Return ONLY valid JSON.

Required format:

{
    "language": "Telugu",
    "language_code": "te-IN",
    "confidence": 0.96,
    "mixed_language": false
}

Transcript:

{transcript}
"""


        response = client.responses.create(
            model="gpt-5.6-mini",
            input=language_prompt,
        )


        result_text = response.output_text.strip()


        # =================================================
        # CLEAN POSSIBLE MARKDOWN
        # =================================================

        if result_text.startswith("```"):

            result_text = (
                result_text
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )


        # =================================================
        # PARSE JSON
        # =================================================

        try:

            result = json.loads(
                result_text
            )

        except json.JSONDecodeError:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Language identification "
                    "returned invalid JSON."
                ),
            )


        # =================================================
        # NORMALIZE RESPONSE
        # =================================================

        language = result.get(
            "language",
            "English",
        )

        language_code = result.get(
            "language_code",
            "en-IN",
        )

        confidence = result.get(
            "confidence",
            0.0,
        )

        mixed_language = result.get(
            "mixed_language",
            False,
        )


        # =================================================
        # FINAL RESPONSE
        # =================================================

        return {
            "success": True,

            "language": language,

            "language_code": language_code,

            "confidence": confidence,

            "mixed_language": mixed_language,

            "transcript": transcript,
        }


    except HTTPException:
        raise

    except Exception as error:

        print(
            "Language detection error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Language detection failed."
            ),
        )


    finally:

        # =================================================
        # DELETE TEMP AUDIO
        # =================================================

        if temp_path and os.path.exists(
            temp_path
        ):

            try:
                os.remove(temp_path)
            except Exception:
                pass    