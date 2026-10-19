from typing import Protocol

from app.models import Payment


class PaymentProvider(Protocol):
    def charge(self, amount: int) -> str:
        """Charge the guest; returns the provider name recorded on the payment."""

    def refund(self, payment: Payment) -> None:
        """Return the money for a paid payment."""


class MockPaymentProvider:
    """Portfolio demo: always succeeds, moves no money."""

    def charge(self, amount: int) -> str:
        return "MOCK"

    def refund(self, payment: Payment) -> None:
        return None


def get_payment_provider() -> PaymentProvider:
    return MockPaymentProvider()
