# Mubashir - US-C: Shared Flask-Limiter instance so all route blueprints can import it
import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    get_remote_address,
    default_limits=[os.environ.get("RATE_LIMIT", "60 per minute")],
    storage_uri="memory://",
)
