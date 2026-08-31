from flask import Flask

from app.config import get_config
from app.routes import credentials_bp, runs_bp, webhooks_bp, workflows_bp


def create_app(testing: bool = False) -> Flask:
    """Application factory.

    Args:
        testing: When ``True``, skip loading real config (env vars may not be
                 set) and use test-friendly defaults.  Tests set this flag and
                 override config values as needed.
    """
    app = Flask(__name__)

    if testing:
        app.config.update(
            TESTING=True,
            TESTING_SYNC_EXECUTION=True,
            SUPABASE_URL="http://localhost:54321",
            SUPABASE_KEY="test-key",
            API_KEY="test-api-key",
            CREDENTIAL_ENCRYPTION_KEY="test-encryption-key",
        )
    else:
        config = get_config()
        app.config.from_mapping(
            SUPABASE_URL=config.SUPABASE_URL,
            SUPABASE_KEY=config.SUPABASE_KEY,
            API_KEY=config.API_KEY,
            CREDENTIAL_ENCRYPTION_KEY=config.CREDENTIAL_ENCRYPTION_KEY,
        )

    # Register blueprints
    app.register_blueprint(workflows_bp)
    app.register_blueprint(runs_bp)
    app.register_blueprint(credentials_bp)
    app.register_blueprint(webhooks_bp)

    return app
