class APIException(Exception):
    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        status_code: int = 400
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(APIException):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            message=f"{resource} 不存在: {resource_id}",
            code="NOT_FOUND",
            status_code=404
        )


class ValidationError(APIException):
    def __init__(self, message: str):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422
        )


class AuthenticationError(APIException):
    def __init__(self, message: str = "未授权访问"):
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            status_code=401
        )


class ExecutionError(APIException):
    def __init__(self, message: str, execution_id: str = None):
        detail = f" (execution_id: {execution_id})" if execution_id else ""
        super().__init__(
            message=f"执行错误: {message}{detail}",
            code="EXECUTION_ERROR",
            status_code=500
        )
