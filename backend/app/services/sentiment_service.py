import json
import re
from typing import Any, Dict, List
import httpx

from app.core.config import get_settings

POSITIVE_TERMS = {
    "great", "good", "awesome", "love", "interested", "yes", "sure", "perfect",
    "helpful", "amazing", "book", "schedule", "demo", "ready", "excited", "sounds good",
    "works", "nice", "thank", "thanks", "definitely", "confirm", "approved",
    "अच्छा", "बढ़िया", "पसंद", "तैयार", "हाँ", "बिल्कुल", "जरूर", "धन्यवाद", "बुक",
}

NEGATIVE_TERMS = {
    "bad", "expensive", "costly", "too much", "not interested", "no", "stop", "waste",
    "cancel", "hate", "terrible", "confusing", "slow", "problem", "issue", "busy",
    "already using", "competitor", "never", "don't want",
    "महंगा", "नहीं", "रुचि नहीं", "बंद", "समय नहीं", "गलत", "समस्या",
}

HIGH_INTENT_TERMS = {
    "price", "pricing", "cost", "quote", "budget", "demo", "schedule", "book",
    "appointment", "slot", "buy", "purchase", "trial", "start", "onboarding",
    "contract", "plan", "enterprise", "integrate", "timeline", "this month", "this week",
    "कीमत", "प्लान", "डेमो", "मीटिंग", "अपॉइंटमेंट", "खरीद", "शुरू", "बजट", "बुक",
}

LOW_INTENT_TERMS = {
    "not interested", "just looking", "no thanks", "maybe later", "don't need",
    "stop calling", "unsubscribe", "रुचि नहीं", "बाद में",
}


def analyze_sentiment_and_intent_local(text: str) -> Dict[str, Any]:
    """Fast deterministic sentiment and buying-intent classifier."""
    lower = text.lower()
    pos_hits = [term for term in POSITIVE_TERMS if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", lower) or term in lower and not term.isascii()]
    neg_hits = [term for term in NEGATIVE_TERMS if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", lower) or term in lower and not term.isascii()]
    high_hits = [term for term in HIGH_INTENT_TERMS if term in lower]
    low_hits = [term for term in LOW_INTENT_TERMS if term in lower]

    pos_score = len(pos_hits)
    neg_score = len(neg_hits)

    if pos_score > neg_score:
        sentiment = "Positive"
    elif neg_score > pos_score:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"

    if low_hits and not high_hits:
        buying_intent = "Low intent"
    elif len(high_hits) >= 2 or any(k in lower for k in ["book", "schedule", "demo", "buy", "purchase", "confirm", "अपॉइंटमेंट", "डेमो"]):
        buying_intent = "High intent"
    elif high_hits or pos_score > 0:
        buying_intent = "Medium intent"
    elif neg_score > 0:
        buying_intent = "Low intent"
    else:
        buying_intent = "Medium intent"

    signals = list(dict.fromkeys(pos_hits + neg_hits + high_hits + low_hits))[:6]
    confidence = min(0.95, 0.58 + 0.08 * len(signals))
    return {
        "sentiment": sentiment,
        "buying_intent": buying_intent,
        "confidence": round(confidence, 2),
        "signals": signals,
        "mode": "demo",
    }


async def analyze_sentiment_and_intent(text: str, use_live_api: bool = False) -> Dict[str, Any]:
    """Analyze sentiment & buying intent via LLM in Live mode, or local fallback."""
    settings = get_settings()
    if use_live_api and settings.is_live_ai_available:
        try:
            prompt = (
                "Classify the customer message. Return strict JSON with keys: "
                '"sentiment" ("Positive"|"Neutral"|"Negative"), '
                '"buying_intent" ("High intent"|"Medium intent"|"Low intent"), '
                '"confidence" (0.0-1.0), "signals" (list of short strings).'
            )
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": prompt},
                            {"role": "user", "content": text},
                        ],
                        "temperature": 0.1,
                    },
                )
                resp.raise_for_status()
                parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
                return {
                    "sentiment": parsed.get("sentiment", "Neutral"),
                    "buying_intent": parsed.get("buying_intent", "Medium intent"),
                    "confidence": float(parsed.get("confidence", 0.8)),
                    "signals": parsed.get("signals", [])[:6],
                    "mode": "live",
                }
        except Exception:
            pass

    return analyze_sentiment_and_intent_local(text)
