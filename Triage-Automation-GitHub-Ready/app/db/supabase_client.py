from functools import lru_cache

from supabase import Client, create_client

from app.config import get_config


@lru_cache
def get_supabase_client() -> Client:
    config = get_config()
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
