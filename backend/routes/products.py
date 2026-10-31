
from functools import wraps

from flask import Blueprint, request, jsonify, session
from sqlalchemy.exc import IntegrityError

from database import db
from models import User, Product


products_bp = Blueprint(
    "products",
    __name__,
    url_prefix="/api/products"
)


def staff_or_admin_required(func):

    @wraps(func)
    def wrapper(*args, **kwargs):

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
                "message": "Invalid or inactive account."
            }), 401

        if user.role not in ["admin", "staff"]:
            return jsonify({
                "success": False,
                "message": "Permission denied."
            }), 403

        return func(*args, **kwargs)

    return wrapper


@products_bp.route("/", methods=["POST"])
@staff_or_admin_required
def create_product():

    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    product_type = data.get("product_type", "").strip()

    if not name or not product_type:
        return jsonify({
            "success": False,
            "message": "Product name and type are required."
        }), 400

    try:
        selling_price = float(data.get("selling_price"))
        cost_price = float(data.get("cost_price", 0))

        if selling_price < 0 or cost_price < 0:
            raise ValueError

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Prices must be valid non-negative numbers."
        }), 400

    product = Product(
        name=name,
        product_type=product_type,
        selling_price=selling_price,
        cost_price=cost_price,
        notes=data.get("notes")
    )

    db.session.add(product)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Product created successfully.",
        "product": product.to_dict()
    }), 201


@products_bp.route("/", methods=["GET"])
@staff_or_admin_required
def get_products():

    products = Product.query.order_by(
        Product.created_at.desc()
    ).all()

    return jsonify({
        "success": True,
        "count": len(products),
        "products": [
            product.to_dict() for product in products
        ]
    }), 200


@products_bp.route("/<int:product_id>", methods=["GET"])
@staff_or_admin_required
def get_product(product_id):

    product = db.session.get(Product, product_id)

    if not product:
        return jsonify({
            "success": False,
            "message": "Product not found."
        }), 404

    return jsonify({
        "success": True,
        "product": product.to_dict()
    }), 200


@products_bp.route("/<int:product_id>", methods=["PUT"])
@staff_or_admin_required
def update_product(product_id):

    product = db.session.get(Product, product_id)

    if not product:
        return jsonify({
            "success": False,
            "message": "Product not found."
        }), 404

    data = request.get_json(silent=True) or {}

    if "name" in data:
        product.name = data["name"].strip()

    if "product_type" in data:
        product.product_type = data["product_type"].strip()

    for field in ["selling_price", "cost_price"]:
        if field in data:
            try:
                value = float(data[field])

                if value < 0:
                    raise ValueError

                setattr(product, field, value)

            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "message": f"{field} must be a non-negative number."
                }), 400

    if "notes" in data:
        product.notes = data["notes"]
    if "is_active" in data:
        product.is_active = bool(data["is_active"])

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Product updated successfully.",
        "product": product.to_dict()
    }), 200


@products_bp.route("/<int:product_id>", methods=["DELETE"])
@staff_or_admin_required
def deactivate_product(product_id):

    product = db.session.get(Product, product_id)

    if not product:
        return jsonify({
            "success": False,
            "message": "Product not found."
        }), 404

    product.is_active = False
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Product deactivated successfully."
    }), 200
