import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    SUPABASE_URL: str
    SUPABASE_KEY: str
    API_KEY: str
    CREDENTIAL_ENCRYPTION_KEY: str

    def __init__(self) -> None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")

        missing = [name for name, value in [("SUPABASE_URL", url), ("SUPABASE_KEY", key)] if not value]
        if missing:
            raise RuntimeError(
                f"Missing required environment variable(s): {', '.join(missing)}. "
                "Copy .env.example to .env and set your Supabase credentials."
            )

        self.SUPABASE_URL = url  # type: ignore[assignment]
        self.SUPABASE_KEY = key  # type: ignore[assignment]
        self.API_KEY = os.getenv("API_KEY", "dev-api-key")
        self.CREDENTIAL_ENCRYPTION_KEY = os.getenv("CREDENTIAL_ENCRYPTION_KEY", "")


def get_config() -> Config:
    return Config()
