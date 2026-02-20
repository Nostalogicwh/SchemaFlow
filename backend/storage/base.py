"""Storage abstract base class."""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime


class StorageBase(ABC):
    """Storage abstract base class."""

    # Workflow operations
    @abstractmethod
    async def save_workflow(self, workflow: Dict[str, Any]) -> str:
        """Save workflow and return workflow_id."""
        pass

    @abstractmethod
    async def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get workflow by ID."""
        pass

    @abstractmethod
    async def list_workflows(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """List workflows with pagination."""
        pass

    @abstractmethod
    async def delete_workflow(self, workflow_id: str) -> bool:
        """Delete workflow by ID."""
        pass

    # Execution log operations
    @abstractmethod
    async def save_execution_log(self, log: Dict[str, Any]) -> str:
        """Save execution log and return execution_id."""
        pass

    @abstractmethod
    async def get_execution_log(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get execution log by ID."""
        pass

    @abstractmethod
    async def list_execution_logs(
        self,
        workflow_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List execution logs for a workflow with pagination."""
        pass
