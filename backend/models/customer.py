from datetime import datetime, timezone

from database import db


class Customer(db.Model):

    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)

    customer_code = db.Column(
        db.String(30),
        unique=True,
        nullable=False
    )

    full_name = db.Column(db.String(100), nullable=False)

    email = db.Column(
        db.String(120),
        unique=True,
        nullable=True
    )

    phone = db.Column(db.String(20))

    company = db.Column(db.String(150))

    address = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    def to_dict(self):

        return {
            "id": self.id,
            "customer_code": self.customer_code,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "company": self.company,
            "address": self.address,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat()
        }