from typing import Any, Optional
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.exceptions import RequestValidationError

class AgriTraceAPIException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None,
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details

def create_error_response(status_code: int, code: str, message: str, details: Optional[Any] = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "details": details,
            },
        },
    )

async def agritrace_api_exception_handler(request: Request, exc: AgriTraceAPIException) -> JSONResponse:
    return create_error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code_map = {
        status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
        status.HTTP_403_FORBIDDEN: "FORBIDDEN",
        status.HTTP_404_NOT_FOUND: "NOT_FOUND",
        status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
        status.HTTP_422_UNPROCESSABLE_ENTITY: "VALIDATION_ERROR",
        status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
        status.HTTP_501_NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
        status.HTTP_503_SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
    }
    code = code_map.get(exc.status_code, "API_ERROR")
    return create_error_response(
        status_code=exc.status_code,
        code=code,
        message=str(exc.detail),
        details=None,
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    # Format readable validation error message
    formatted_msg = "; ".join([f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in errors])
    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="VALIDATION_ERROR",
        message=f"Request validation failed: {formatted_msg}",
        details=errors,
    )

async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Filter potential leaks in unhandled exceptions
    safe_message = "An unexpected internal server error occurred."
    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="INTERNAL_SERVER_ERROR",
        message=safe_message,
        details=None,
    )
