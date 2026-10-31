
from functools import wraps

from flask import Blueprint, request, jsonify, session

from database import db
from models import User, Plan, Product


plans_bp = Blueprint(
    "plans",
    __name__,
    url_prefix="/api/plans"
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


@plans_bp.route("/", methods=["POST"])
@staff_or_admin_required
def create_plan():

    data = request.get_json(silent=True) or {}

    product_id = data.get("product_id")
    name = data.get("name", "").strip()
    billing_frequency = data.get("billing_frequency", "").strip()

    if not product_id or not name or not billing_frequency:
        return jsonify({
            "success": False,
            "message": "Product ID, plan name and billing frequency are required."
        }), 400

    product = db.session.get(Product, product_id)

    if not product or not product.is_active:
        return jsonify({
            "success": False,
            "message": "Active product not found."
        }), 404

    try:
        price = float(data.get("price"))

        min_quantity = int(data.get("min_quantity", 1))

        if price < 0 or min_quantity < 1:
            raise ValueError

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Enter a valid non-negative price and quantity of at least 1."
        }), 400

    plan = Plan(
        product_id=product_id,
        name=name,
        description=data.get("description"),
        price=price,
        billing_frequency=billing_frequency,
        min_quantity=min_quantity,
        auto_close=data.get("auto_close", False)
    )

    db.session.add(plan)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Plan created successfully.",
        "plan": plan.to_dict()
    }), 201


@plans_bp.route("/", methods=["GET"])
@staff_or_admin_required
def get_plans():

    plans = Plan.query.order_by(
        Plan.created_at.desc()
    ).all()

    return jsonify({
        "success": True,
        "count": len(plans),
        "plans": [
            plan.to_dict() for plan in plans
        ]
    }), 200


@plans_bp.route("/<int:plan_id>", methods=["GET"])
@staff_or_admin_required
def get_plan(plan_id):

    plan = db.session.get(Plan, plan_id)

    if not plan:
        return jsonify({
            "success": False,
            "message": "Plan not found."
        }), 404

    return jsonify({
        "success": True,
        "plan": plan.to_dict()
    }), 200


@plans_bp.route("/<int:plan_id>", methods=["PUT"])
@staff_or_admin_required
def update_plan(plan_id):

    plan = db.session.get(Plan, plan_id)

    if not plan:
        return jsonify({
            "success": False,
            "message": "Plan not found."
        }), 404

    data = request.get_json(silent=True) or {}

    if "product_id" in data:

        product = db.session.get(Product, data["product_id"])

        if not product or not product.is_active:
            return jsonify({
                "success": False,
                "message": "Active product not found."
            }), 404

        plan.product_id = product.id

    if "name" in data:
        name = data["name"].strip()

        if not name:
            return jsonify({
                "success": False,
                "message": "Plan name cannot be empty."
            }), 400

        plan.name = name

    if "billing_frequency" in data:
        frequency = data["billing_frequency"].strip()

        if not frequency:
            return jsonify({
                "success": False,
                "message": "Billing frequency cannot be empty."
            }), 400

        plan.billing_frequency = frequency

    if "price" in data:
        try:
            price = float(data["price"])

            if price < 0:
                raise ValueError

            plan.price = price

        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "message": "Price must be a non-negative number."
            }), 400

    if "min_quantity" in data:
        try:
            quantity = int(data["min_quantity"])

            if quantity < 1:
                raise ValueError

            plan.min_quantity = quantity

        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "message": "Minimum quantity must be at least 1."
            }), 400

    if "description" in data:
        plan.description = data["description"]

    if "auto_close" in data:
        plan.auto_close = bool(data["auto_close"])

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Plan updated successfully.",
        "plan": plan.to_dict()
    }), 200


@plans_bp.route("/<int:plan_id>", methods=["DELETE"])
@staff_or_admin_required
def deactivate_plan(plan_id):

    plan = db.session.get(Plan, plan_id)

    if not plan:
        return jsonify({
            "success": False,
            "message": "Plan not found."
        }), 404

    plan.is_active = False
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Plan deactivated successfully."
    }), 200
