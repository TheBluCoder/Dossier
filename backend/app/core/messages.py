"""Centralized user-safe error messages returned by the API.

Provider responses and stack traces belong in server logs. Only messages from
this module should be exposed to clients for expected application failures.
"""


class ErrorMessages:
    """Stable client-facing error text shared across routes and services."""

    GEMINI_NOT_CONFIGURED = "AI responses are not configured on this server."
    VOICE_NOT_CONFIGURED = "Voice playback is not configured on this server."
    VOICE_DIALOG_NOT_CONFIGURED = "Voice dialog is not configured on this server."
    VOICE_UNAVAILABLE = "Voice service is temporarily unavailable. Please use text chat or try again later."
    VOICE_PLAYBACK_UNAVAILABLE = "Voice playback is temporarily unavailable."

    NOT_FOUND = "Not found."
    INVESTIGATION_NOT_FOUND = "Investigation not found."
    CASE_NOT_FOUND = "Case not found."
    SUSPECT_NOT_FOUND = "Suspect not found."
    EVIDENCE_NOT_FOUND = "Evidence not found."
    INVESTIGATION_CLOSED = "Investigation is closed."
    MISSING_BEARER_TOKEN = "Authentication is required."
    AUTH_NOT_CONFIGURED = "Authentication is not configured on this server."
    INVALID_TOKEN = "Your session is invalid or has expired."
    VERDICT_ALREADY_SUBMITTED = "A verdict has already been submitted."
    ACCUSED_SUSPECT_NOT_FOUND = "Accused suspect not found."
    VERDICT_REQUIRED = "Submit a verdict first."
    RATE_LIMITED = "Slow down, Detective. Give it a moment and try again."
    CASE_ALREADY_CLAIMED = "Another detective just claimed this case. Pick a different one from the docket."
    MAX_ACTIVE_INVESTIGATIONS_REACHED = (
        "You already have 3 active investigations, Detective. Close one out before opening another."
    )
    INVALID_USERNAME = (
        "Detective name must be 2-24 characters: letters, numbers, spaces, and - _ . ' only."
    )

    GENERATED_CASE_CULPRIT_COUNT = "Generated case must contain exactly one culprit."
    GENERATED_CASE_INVALID = "Case generation produced an invalid case. Try again."
    SUSPECT_RESPONSE_UNAVAILABLE = "The suspect stares at you in silence. Try again."
    MESSAGE_UNAVAILABLE = "Message not found."

    IMAGE_GENERATION_NOT_CONFIGURED = "Image generation is not configured on this server."
    IMAGE_GENERATION_FAILED = "Image generation failed. Please try again."
    STORAGE_NOT_CONFIGURED = "Media storage is not configured on this server."
    STORAGE_PROVIDER_UNKNOWN = "Configured storage provider is not supported."

    DEV_BYPASS_IN_PROD = "DEV_AUTH_BYPASS must be false when ENVIRONMENT is production."

    CASE_MIN_SUSPECTS_INVALID = "CASE_MIN_SUSPECTS must be at least 3."
    CASE_SUSPECT_RANGE_INVALID = "CASE_MAX_SUSPECTS must be greater than or equal to CASE_MIN_SUSPECTS."
    CASE_MIN_EVIDENCE_INVALID = "CASE_MIN_EVIDENCE must be at least 1."
    CASE_EVIDENCE_RANGE_INVALID = "CASE_MAX_EVIDENCE must be greater than or equal to CASE_MIN_EVIDENCE."

    @staticmethod
    def generated_case_suspect_count(expected: int) -> str:
        """Build the validation message for an incorrect suspect count."""
        return f"Generated case must have exactly {expected} suspects."

    @staticmethod
    def generated_case_evidence_count(minimum: int, maximum: int) -> str:
        """Build the validation message for evidence outside its configured range."""
        return f"Generated case evidence count must be between {minimum} and {maximum}."

    @staticmethod
    def suspect_refuses(name: str) -> str:
        """Build a character-specific refusal without exposing internal state."""
        return f"{name} refuses to speak with you again."

    @staticmethod
    def suspect_cooling_down(name: str, seconds_remaining: int) -> str:
        """Build a cooldown message after the player has walked out on a suspect."""
        minutes, seconds = divmod(max(seconds_remaining, 1), 60)
        wait = f"{minutes}m {seconds}s" if minutes else f"{seconds}s"
        return f"{name} is still composing themselves. Try again in {wait}."
