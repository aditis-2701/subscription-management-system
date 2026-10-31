from datetime import datetime, timezone

from database import db


class Plan(db.Model):

    __tablename__ = "plans"

    id = db.Column(db.Integer, primary_key=True)

    product_id = db.Column(
        db.Integer,
        db.ForeignKey("products.id"),
        nullable=False
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    description = db.Column(db.Text)

    price = db.Column(
        db.Numeric(12, 2),
        nullable=False
    )

    billing_frequency = db.Column(
        db.String(30),
        nullable=False
    )

    min_quantity = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    auto_close = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    start_date = db.Column(db.Date)

    end_date = db.Column(db.Date)

    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    product = db.relationship(
        "Product",
        backref="plans"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "name": self.name,
            "description": self.description,
            "price": float(self.price),
            "billing_frequency": self.billing_frequency,
            "min_quantity": self.min_quantity,
            "auto_close": self.auto_close,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat()
        }