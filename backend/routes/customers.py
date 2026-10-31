from functools import wraps

from flask import Blueprint, request, jsonify, session
from sqlalchemy.exc import IntegrityError

from database import db
from models import Customer


customers_bp = Blueprint(
    "customers",
    __name__,
    url_prefix="/api/customers"
)


def staff_or_admin_required(func):

    @wraps(func)
    def wrapper(*args, **kwargs):

        user_id = session.get("user_id")
        role = session.get("role")

        if not user_id:
            return jsonify({
                "success": False,
                "message": "Authentication required."
            }), 401

        if role not in ["admin", "staff"]:
            return jsonify({
                "success": False,
                "message": "Permission denied."
            }), 403

        return func(*args, **kwargs)

    return wrapper


@customers_bp.route("/", methods=["POST"])
@staff_or_admin_required
def create_customer():

    data = request.get_json(silent=True) or {}

    customer_code = data.get("customer_code", "").strip()
    full_name = data.get("full_name", "").strip()

    if not customer_code or not full_name:
        return jsonify({
            "success": False,
            "message": "Customer code and full name are required."
        }), 400

    customer = Customer(
        customer_code=customer_code,
        full_name=full_name,
        email=data.get("email"),
        phone=data.get("phone"),
        company=data.get("company"),
        address=data.get("address")
    )

    try:
        db.session.add(customer)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Customer created successfully.",
            "customer": customer.to_dict()
        }), 201

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Customer code or email already exists."
        }), 409


@customers_bp.route("/", methods=["GET"])
@staff_or_admin_required
def get_customers():

    customers = Customer.query.order_by(
        Customer.created_at.desc()
    ).all()

    return jsonify({
        "success": True,
        "count": len(customers),
        "customers": [
            customer.to_dict() for customer in customers
        ]
    }), 200


@customers_bp.route("/<int:customer_id>", methods=["GET"])
@staff_or_admin_required
def get_customer(customer_id):

    customer = db.session.get(Customer, customer_id)

    if not customer:
        return jsonify({
            "success": False,
            "message": "Customer not found."
        }), 404

    return jsonify({
        "success": True,
        "customer": customer.to_dict()
    }), 200


@customers_bp.route("/<int:customer_id>", methods=["PUT"])
@staff_or_admin_required
def update_customer(customer_id):

    customer = db.session.get(Customer, customer_id)

    if not customer:
        return jsonify({
            "success": False,
            "message": "Customer not found."
        }), 404

    data = request.get_json(silent=True) or {}

    allowed_fields = [
        "full_name",
        "email",
        "phone",
        "company",
        "address"
    ]

    for field in allowed_fields:
        if field in data:
            value = data[field]

            setattr(
                customer,
                field,
                value.strip() if isinstance(value, str) else value
            )

    try:
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Customer updated successfully.",
            "customer": customer.to_dict()
        }), 200

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "This email is already in use."
        }), 409


@customers_bp.route("/<int:customer_id>", methods=["DELETE"])
@staff_or_admin_required
def deactivate_customer(customer_id):

    customer = db.session.get(Customer, customer_id)

    if not customer:
        return jsonify({
            "success": False,
            "message": "Customer not found."
        }), 404

    customer.is_active = False
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Customer deactivated successfully."
    }), 200