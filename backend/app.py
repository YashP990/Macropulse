# Author: Kevin Ngo, 4/21/26
# Main Flask application setup including configuration, security, and route registration.

import os
from dotenv import load_dotenv
load_dotenv()  # Must run before service imports so env vars are available at import time

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from services.limiter import limiter
from routes.search import search_bp
from routes.stock import stock_bp
from routes.signals import signals_bp
from routes.history import history_bp
from routes.watchlist import watchlist_bp
from routes.screener import screener_bp

# Kevin Ngo, 4/21/26
# Define the path to the frontend directory for serving static files.
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


def create_app():
    # Kevin Ngo, 4/21/26
    # Create the Flask application instance.
    app = Flask(__name__)

    # Kevin Ngo, 4/21/26
    # Configure CORS to only allow requests from approved frontend origins.
    # This prevents unauthorized domains from accessing the API.
    allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5000").split(",")
    CORS(app, origins=[o.strip() for o in allowed_origins if o.strip()])

    # Mubashir - US-C: Init shared limiter with app (instance created in services/limiter.py)
    limiter.init_app(app)

    # Kevin Ngo, 4/21/26
    # Register API route blueprints under the /api/v1 prefix (versioned).
    # Person 3 - US14: Versioned API under /api/v1/
    app.register_blueprint(search_bp, url_prefix="/api/v1")
    app.register_blueprint(stock_bp, url_prefix="/api/v1")
    app.register_blueprint(signals_bp, url_prefix="/api/v1")
    app.register_blueprint(history_bp, url_prefix="/api/v1")
    app.register_blueprint(watchlist_bp, url_prefix="/api/v1")
    app.register_blueprint(screener_bp, url_prefix="/api/v1")

    # Person 3 - US14: Legacy /api/ routes with deprecation header for backwards compatibility
    app.register_blueprint(search_bp, url_prefix="/api", name="search_legacy")
    app.register_blueprint(stock_bp, url_prefix="/api", name="stock_legacy")
    app.register_blueprint(signals_bp, url_prefix="/api", name="signals_legacy")

    @app.after_request
    def add_deprecation_header(response):
        if "/api/" in response.headers.get("Content-Location", "") or True:
            # Only add deprecation header for /api/ (non-versioned) routes
            from flask import request as flask_request
            if flask_request.path.startswith("/api/") and not flask_request.path.startswith("/api/v1/"):
                response.headers["Deprecation"] = "true"
                response.headers["Link"] = flask_request.path.replace("/api/", "/api/v1/", 1)
        return response

    # Kevin Ngo, 4/21/26
    # Health check endpoint used by monitoring tools to verify server status.
    # Exempt from rate limiting so it is always accessible.
    @app.route("/health")
    @limiter.exempt
    def health():
        return jsonify({"status": "ok"}), 200

    # Kevin Ngo, 4/21/26
    # Serve the main frontend HTML file when the root URL is accessed.
    @app.route("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    # Kevin Ngo, 4/21/26
    # Serve all other static frontend files (JS, CSS, etc.).
    @app.route("/<path:filename>")
    def static_files(filename):
        return send_from_directory(FRONTEND_DIR, filename)

    return app


if __name__ == "__main__":
    # Kevin Ngo, 4/21/26
    # Initialize the app using the factory function.
    app = create_app()

    # Kevin Ngo, 4/21/26
    # Enable or disable debug mode based on environment variable.
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    # Kevin Ngo, 4/21/26
    # Set the port dynamically for flexibility across environments.
    port = int(os.environ.get("FLASK_PORT", 5000))

    # Kevin Ngo, 4/21/26
    # Run the Flask development server.
    app.run(debug=debug_mode, port=port)
