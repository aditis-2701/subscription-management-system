from datetime import datetime, timezone

from database import db


class Product(db.Model):

    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(150),
        nullable=False
    )

    product_type = db.Column(
        db.String(50),
        nullable=False
    )

    selling_price = db.Column(
        db.Numeric(12, 2),
        nullable=False
    )

    cost_price = db.Column(
        db.Numeric(12, 2),
        nullable=False,
        default=0
    )

    notes = db.Column(db.Text)

    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):

        return {
            "id": self.id,
            "name": self.name,
            "product_type": self.product_type,
            "selling_price": float(self.selling_price),
            "cost_price": float(self.cost_price),
            "notes": self.notes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat()
        }