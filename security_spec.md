# Security Specification for SparkleShare

## Data Invariants
1. A **User** profile can only be created/updated by the owner.
2. A **ServiceRequest** can only be created by a user with the 'customer' role.
3. A **Quote** can only be created by a user with the 'provider' role.
4. A **Quote** must reference a valid **ServiceRequest**.
5. Only the customer who created the request can accept/reject a quote.
6. A provider can only see requests that are 'open'.
7. A customer can only see quotes for their own requests.
8. Providers can see their own quotes.

## The Dirty Dozen Payloads (Rejection Targets)
1. User A tries to update User B's profile.
2. A Customer tries to create a Quote.
3. A Provider tries to create a ServiceRequest.
4. A Provider tries to update the `customerId` of a ServiceRequest.
5. User A tries to accept a Quote for User B's ServiceRequest.
6. A Quote with a negative `amount`.
7. A ServiceRequest with a `status` update from 'booked' to 'open' by a non-admin.
8. A Quote created for a non-existent ServiceRequest (relational check).
9. Injection of a 1MB string into the `title` field of a ServiceRequest.
10. A user tries to set their own `role` to 'admin' (if that existed).
11. A customer tries to see quotes for a request they don't own.
12. A provider tries to update a quote they didn't create.

## Testing Strategy
We will use `firestore.rules` to enforce these invariants.
A `firestore.rules.test.ts` will be created to verify these denials.
