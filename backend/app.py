
import os

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from database import db
from models import User, Customer, Product, Plan

from routes.auth import auth_bp
from routes.customers import customers_bp
from routes.products import products_bp
from routes.plan import plans_bp


def create_app():

    app = Flask(__name__)

    app.config.from_object(Config)

    os.makedirs(
        os.path.join(os.path.dirname(__file__), "database"),
        exist_ok=True
    )

    db.init_app(app)

    CORS(app, supports_credentials=True)

    app.register_blueprint(auth_bp)
    app.register_blueprint(customers_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(plans_bp)

    with app.app_context():
        db.create_all()

    @app.route("/", methods=["GET"])
    def home():

        return jsonify({
            "success": True,
            "message": "Welcome to BrightLoop Backend API",
            "version": "1.0"
        })

    @app.route("/api/health", methods=["GET"])
    def health():

        try:
            with db.engine.connect() as connection:
                connection.exec_driver_sql("SELECT 1")

            return jsonify({
                "success": True,
                "status": "Backend running",
                "database": "Connected"
            })

        except Exception:
            return jsonify({
                "success": False,
                "status": "Backend running",
                "database": "Connection failed"
            }), 500

    return app


app = create_app()


if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True
    )
