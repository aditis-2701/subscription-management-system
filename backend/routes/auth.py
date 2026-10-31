from flask import Blueprint, request, jsonify, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash

from database import db
from models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def is_strong_password(password):
    return (
        len(password) >= 8
        and any(char.isupper() for char in password)
        and any(char.islower() for char in password)
        and any(char.isdigit() for char in password)
        and any(not char.isalnum() for char in password)
    )


@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not full_name or not email or not password:
        return jsonify({
            "success": False,
            "message": "Name, email and password are required."
        }), 400

    if not is_strong_password(password):
        return jsonify({
            "success": False,
            "message": (
                "Password must contain at least 8 characters, "
                "an uppercase letter, a lowercase letter, "
                "a number and a special character."
            )
        }), 400

    user = User(
        full_name=full_name,
        email=email,
        role="customer"
    )

    user.set_password(password)

    try:
        db.session.add(user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Registration successful.",
            "user": user.to_dict()
        }), 201

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "An account with this email already exists."
        }), 409


@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required."
        }), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({
            "success": False,
            "message": "Invalid email or password."
        }), 401

    if not user.is_active:
        return jsonify({
            "success": False,
            "message": "This account is inactive."
        }), 403

    session.clear()
    session["user_id"] = user.id
    session["role"] = user.role

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "user": user.to_dict()
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logout successful."
    }), 200


@auth_bp.route("/me", methods=["GET"])
def current_user():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    user = db.session.get(User, user_id)

    if not user or not user.is_active:
        session.clear()

        return jsonify({
            "success": False,
            "message": "User not found or inactive."
        }), 401

    return jsonify({
        "success": True,
        "user": user.to_dict()
    }), 200