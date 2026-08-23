# RecoverAI
RecoverAI detects revenue at risk, diagnoses why a payment is likely to be lost, selects the lowest-cost effective intervention, executes it through Razorpay and communication tools, and verifies whether the money was recovered.

1. The core loop -
   DETECT
   ↓
   DIAGNOSE
   ↓
   PRIORITIZE
   ↓
   DECIDE
   ↓
   ACT
   ↓
   VERIFY
   ↓
   LEARN

   
2. Traditional Automation

   Payment failed → send reminder.

   RecoverAI:
   Payment failed → determine why → estimate recovery probability → determine customer context → select intervention → execute → observe outcome → adapt → stop when appropriate.


3. The specific Problem

   Imagine a merchant has:
   <img width="665" height="315" alt="image" src="https://github.com/user-attachments/assets/93e9bba5-1a19-4bc7-8032-03d89fee6bb6" />

   A merchant might handle these manually - 
   
   RecoverAI asks:
   Which ₹ amounts are actually recoverable, why are they at risk, and what should we do next?
   
4. Recovery Scenarios:

   Scenario A: Failed payment

   Payment failed
        ↓
   Determine failure context
        ↓
   Estimate recoverability
        ↓
   Choose intervention
        ↓
   Generate/send recovery link
        ↓
   Track payment


   Scenario B: Checkout abandonment

   Payment link/order created
        ↓
   Customer doesn't pay
        ↓
   Agent waits appropriate interval
        ↓
   Determines whether reminder is justified
        ↓
   Sends personalized recovery message
        ↓
   Tracks payment


   Scenario C: Overdue B2B invoice

   Invoice due
        ↓
   Payment absent
        ↓
   Assess customer + invoice history
        ↓
   Send appropriate reminder
        ↓
   Customer responds
        ↓
   Promise-to-pay?
      ↙     ↘
    YES      NO
     ↓        ↓
   Track      Escalate
     ↓
   Verify payment
