import asyncio
from app.main import app
import httpx

async def test_in_process():
    print("--- 1. Testing Reset State ---")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/api/reset")
        assert r.status_code == 200
        data = r.json()
        assert data["balance"] == 500.00
        print(f"Initial balance: ${data['balance']}")

        print("\n--- 2. Nominal Single Click Checkout ---")
        r = await client.post("/api/checkout", json={
            "cart_id": "cart_sony_1000xm5",
            "amount": 50.00,
            "idempotency_key": "single_test_key_1"
        })
        assert r.status_code == 200
        data = r.json()
        print(f"Status: {data['status']}, Charged: {data['charged']}, New Balance: ${data['balance']}")
        assert data["balance"] == 450.00

        print("\n--- 3. Mode A (Naive Agent) Rapid Double-Click Attack ---")
        await client.post("/api/mode", json={"mode": "naive"})
        shared_key_naive = "shared_attack_key_naive"
        
        # Fire 2 concurrent requests
        t1 = client.post("/api/checkout", json={
            "cart_id": "cart_sony_1000xm5",
            "amount": 50.00,
            "idempotency_key": shared_key_naive
        })
        t2 = client.post("/api/checkout", json={
            "cart_id": "cart_sony_1000xm5",
            "amount": 50.00,
            "idempotency_key": shared_key_naive
        })
        r1, r2 = await asyncio.gather(t1, t2)
        d1, d2 = r1.json(), r2.json()
        print(f"Req1: Charged={d1.get('charged')}, Req2: Charged={d2.get('charged')}")
        
        state = (await client.get("/api/state")).json()
        print(f"Balance after Naive double-click: ${state['balance']}")
        assert state["balance"] == 350.00  # Was 450, double debited 2x $50 = 350!
        print("🚨 Confirmed: Both charges executed! Customer lost $100.00 for single cart.")

        print("\n--- 4. Reset & Mode B (NeverTwice Protected) Rapid Double-Click Attack ---")
        await client.post("/api/reset")
        await client.post("/api/mode", json={"mode": "protected"})
        shared_key_protected = "shared_attack_key_protected"

        t1 = client.post("/api/checkout", json={
            "cart_id": "cart_sony_1000xm5",
            "amount": 50.00,
            "idempotency_key": shared_key_protected
        })
        t2 = client.post("/api/checkout", json={
            "cart_id": "cart_sony_1000xm5",
            "amount": 50.00,
            "idempotency_key": shared_key_protected
        })
        r1, r2 = await asyncio.gather(t1, t2)
        d1, d2 = r1.json(), r2.json()
        print(f"Req1: Status={d1.get('status')}, Charged={d1.get('charged')}")
        print(f"Req2: Status={d2.get('status')}, Charged={d2.get('charged')}")

        state = (await client.get("/api/state")).json()
        print(f"Balance after Protected double-click: ${state['balance']}")
        assert state["balance"] == 450.00  # Exactly $50 debited once!
        
        statuses = [d1.get("status"), d2.get("status")]
        assert "success" in statuses
        assert "already_processed" in statuses
        print("🛡️ Confirmed: Second charge intercepted with 'already_processed'. Balance safe at $450.00.")

        print("\n--- 5. Escalate to NeverTwice Referee ---")
        esc_resp = await client.post("/api/escalate-to-never-twice", json={
            "run_id": "ACME-LIVE-001",
            "raw_crash_log": "Traceback...\nDuplicateChargeException: CRITICAL: Rapid duplicate checkout dispatched without idempotency lock.",
            "domain": "code",
            "enable_memory": True,
            "dry_run": False
        })
        assert esc_resp.status_code == 200
        verdict = esc_resp.json()
        print(f"Verdict: {verdict.get('verdict')}, Rule: {verdict.get('rule_id')}, Confidence: {verdict.get('safety_confidence')}")
        assert verdict.get("verdict") == "BLOCKED"
        assert verdict.get("rule_id") == "RULE-PAY-042"
        print("✅ NeverTwice Referee integration verified successfully!")

if __name__ == "__main__":
    asyncio.run(test_in_process())

