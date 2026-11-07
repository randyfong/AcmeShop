import asyncio
import time
import uuid
from typing import Dict, List, Optional
from datetime import datetime

class DuplicateChargeException(Exception):
    """Raised when duplicate checkout is dispatched without idempotency lock."""
    pass

class LedgerService:
    def __init__(self):
        self.balance: float = 500.00
        self.initial_balance: float = 500.00
        self.transactions: List[dict] = []
        self.processed_idempotency_keys: set = set()
        self.lock = asyncio.Lock()
        self.patch_mode: str = "naive"  # "naive" or "protected"
        # In-flight tracker for naive race condition detection
        self._in_flight_naive_requests: Dict[str, float] = {}

    def reset(self):
        self.balance = self.initial_balance
        self.transactions = []
        self.processed_idempotency_keys.clear()
        self._in_flight_naive_requests.clear()
        return {
            "balance": self.balance,
            "transactions": self.transactions,
            "patch_mode": self.patch_mode
        }

    def set_mode(self, mode: str):
        if mode in ["naive", "protected"]:
            self.patch_mode = mode
        return {"patch_mode": self.patch_mode}

    def get_state(self):
        return {
            "balance": self.balance,
            "transactions": self.transactions,
            "patch_mode": self.patch_mode
        }

    async def process_checkout(self, cart_id: str, amount: float, idempotency_key: Optional[str] = None) -> dict:
        tx_id = f"tx_{uuid.uuid4().hex[:10]}"
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

        if self.patch_mode == "naive":
            # Mode A: Naive Agent Implementation
            # ❌ FLAW: Naive execution without checking or locking idempotency_key
            # Notice concurrent requests arriving within ~50ms window will both execute!
            req_id = str(uuid.uuid4())
            self._in_flight_naive_requests[req_id] = time.time()
            is_concurrent_collision = len(self._in_flight_naive_requests) > 1

            # Simulated database debit latency (50ms)
            await asyncio.sleep(0.05)

            # Deduct customer balance directly (decrements each time called)
            self.balance = round(self.balance - amount, 2)
            
            tx_record = {
                "id": tx_id,
                "timestamp": timestamp,
                "cart_id": cart_id,
                "idempotency_key": idempotency_key or "none",
                "amount": amount,
                "status": "CHARGED",
                "mode": "naive",
                "notes": "Double-charge race vulnerability"
            }
            self.transactions.insert(0, tx_record)

            self._in_flight_naive_requests.pop(req_id, None)

            # If rapid collision occurred, raise DuplicateChargeException with the exact required stack trace text
            error_trace = None
            if is_concurrent_collision or (idempotency_key and [t for t in self.transactions if t["idempotency_key"] == idempotency_key and t["status"] == "CHARGED"].__len__() > 1):
                raw_trace = (
                    'Traceback (most recent call last):\n'
                    '  File "/app/services/checkout.py", line 42, in process_cart_payment\n'
                    '    raise DuplicateChargeException("Cart charge already in flight")\n'
                    'DuplicateChargeException: CRITICAL: Rapid duplicate checkout dispatched without idempotency lock.'
                )
                error_trace = raw_trace

            return {
                "status": "success",
                "charged": True,
                "amount": amount,
                "balance": self.balance,
                "transaction": tx_record,
                "patch_mode": "naive",
                "error_trace": error_trace
            }

        else:
            # Mode B: NeverTwice Protected Implementation
            # Enforced Invariant: Atomic lock check via RULE-PAY-042
            if not idempotency_key:
                raise ValueError("Missing required idempotency_key")

            async with self.lock:
                if idempotency_key in self.processed_idempotency_keys:
                    tx_record = {
                        "id": tx_id,
                        "timestamp": timestamp,
                        "cart_id": cart_id,
                        "idempotency_key": idempotency_key,
                        "amount": amount,
                        "status": "BLOCKED_DUPLICATE",
                        "mode": "protected",
                        "notes": "Intercepted and blocked by RULE-PAY-042"
                    }
                    self.transactions.insert(0, tx_record)
                    return {
                        "status": "already_processed",
                        "charged": False,
                        "amount": amount,
                        "balance": self.balance,
                        "transaction": tx_record,
                        "patch_mode": "protected",
                        "rule": "RULE-PAY-042"
                    }

                # Register token atomically
                self.processed_idempotency_keys.add(idempotency_key)
                
                # Simulated debit latency (50ms)
                await asyncio.sleep(0.05)
                self.balance = round(self.balance - amount, 2)

                tx_record = {
                    "id": tx_id,
                    "timestamp": timestamp,
                    "cart_id": cart_id,
                    "idempotency_key": idempotency_key,
                    "amount": amount,
                    "status": "CHARGED",
                    "mode": "protected",
                    "notes": "Verified single execution under RULE-PAY-042"
                }
                self.transactions.insert(0, tx_record)

                return {
                    "status": "success",
                    "charged": True,
                    "amount": amount,
                    "balance": self.balance,
                    "transaction": tx_record,
                    "patch_mode": "protected"
                }

ledger = LedgerService()

