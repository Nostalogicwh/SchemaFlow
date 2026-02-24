from typing import Any, Optional


def success_response(data: Any = None) -> dict:
    return {"success": True, "data": data}


def error_response(message: str, code: str = "ERROR") -> dict:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message
        }
    }


def paginated_response(
    items: list,
    total: int,
    page: int = 1,
    page_size: int = 20
) -> dict:
    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    }
