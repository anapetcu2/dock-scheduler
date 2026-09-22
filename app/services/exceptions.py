from app.schemas.validation import ValidationResult


class BookingValidationError(Exception):
    """Proposal fails business rules. Callers should return HTTP 422 with `.result`."""

    def __init__(self, result: ValidationResult):
        super().__init__("Booking failed validation")
        self.result = result


class BookingConflictError(Exception):
    """The database rejected the write (exclusion constraint) despite validation
    passing — i.e. a race with another request. Callers should return HTTP 409
    with `.result`, which was re-computed after the race to show the conflict."""

    def __init__(self, result: ValidationResult):
        super().__init__("Booking conflicts with a concurrent write")
        self.result = result
