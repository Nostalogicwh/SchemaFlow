"""日志管理模块。

提供日志轮转、清理和查询功能。
"""

import gzip
import logging
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)


class LogManager:
    """日志文件管理器。

    负责日志文件的轮转、归档和清理。

    Attributes:
        log_dir: 日志目录
        max_bytes: 单个日志文件最大大小（字节）
        backup_count: 保留的备份文件数量
        retention_days: 日志保留天数
    """

    def __init__(
        self,
        log_dir: Path,
        max_bytes: int = 10 * 1024 * 1024,  # 10MB
        backup_count: int = 5,
        retention_days: int = 30,
    ):
        self.log_dir = Path(log_dir)
        self.max_bytes = max_bytes
        self.backup_count = backup_count
        self.retention_days = retention_days

        # 确保日志目录存在
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def get_log_files(self) -> List[Path]:
        """获取所有日志文件列表。

        Returns:
            按修改时间排序的日志文件列表
        """
        log_files = []
        for pattern in ["*.log", "*.log.gz"]:
            log_files.extend(self.log_dir.glob(pattern))
        return sorted(log_files, key=lambda p: p.stat().st_mtime, reverse=True)

    def get_log_info(self, log_file: Path) -> dict:
        """获取日志文件信息。

        Args:
            log_file: 日志文件路径

        Returns:
            包含大小、修改时间等信息的字典
        """
        stat = log_file.stat()
        return {
            "name": log_file.name,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "is_compressed": log_file.suffix == ".gz",
        }

    def rotate_log(self, log_file: Path) -> Optional[Path]:
        """轮转日志文件。

        当日志文件超过max_bytes时，进行轮转：
        1. 将当前日志重命名为 .log.1
        2. 如果 .log.1 已存在，则重命名为 .log.2，以此类推
        3. 超过backup_count的旧日志会被压缩或删除

        Args:
            log_file: 当前日志文件路径

        Returns:
            新的日志文件路径，或None表示无需轮转
        """
        if not log_file.exists():
            return None

        if log_file.stat().st_size < self.max_bytes:
            return None

        # 关闭文件句柄（调用者需要确保）
        # 轮转：file.log -> file.log.1 -> file.log.2.gz
        rotated_path = None

        for i in range(self.backup_count, 0, -1):
            src = self.log_dir / f"{log_file.name}.{i}"
            dst = self.log_dir / f"{log_file.name}.{i + 1}"

            if i == self.backup_count:
                # 删除最旧的备份
                if src.exists():
                    src.unlink()
                gz_src = self.log_dir / f"{log_file.name}.{i}.gz"
                if gz_src.exists():
                    gz_src.unlink()
            else:
                # 移动备份文件
                if src.exists():
                    src.rename(dst)
                gz_src = self.log_dir / f"{log_file.name}.{i}.gz"
                gz_dst = self.log_dir / f"{log_file.name}.{i + 1}.gz"
                if gz_src.exists():
                    gz_src.rename(gz_dst)

        # 重命名当前日志为 .log.1
        rotated_path = self.log_dir / f"{log_file.name}.1"
        log_file.rename(rotated_path)

        # 压缩 .log.backup_count 之前的日志
        for i in range(2, self.backup_count + 1):
            old_log = self.log_dir / f"{log_file.name}.{i}"
            if old_log.exists():
                self._compress_log(old_log)

        logger.info(f"日志已轮转: {log_file.name} -> {rotated_path.name}")
        return rotated_path

    def _compress_log(self, log_file: Path) -> Path:
        """压缩日志文件。

        Args:
            log_file: 要压缩的日志文件

        Returns:
            压缩后的文件路径
        """
        gz_path = log_file.with_suffix(log_file.suffix + ".gz")

        with open(log_file, "rb") as f_in:
            with gzip.open(gz_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        log_file.unlink()
        logger.debug(f"日志已压缩: {log_file.name} -> {gz_path.name}")
        return gz_path

    def cleanup_old_logs(self) -> int:
        """清理过期日志文件。

        删除超过retention_days天的日志文件。

        Returns:
            删除的文件数量
        """
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        deleted_count = 0

        for log_file in self.log_dir.glob("*.log*"):
            if log_file.is_file():
                modified_time = datetime.fromtimestamp(log_file.stat().st_mtime)
                if modified_time < cutoff_date:
                    log_file.unlink()
                    deleted_count += 1
                    logger.debug(f"删除过期日志: {log_file.name}")

        if deleted_count > 0:
            logger.info(f"已清理 {deleted_count} 个过期日志文件")

        return deleted_count

    def get_recent_logs(self, days: int = 7, level: Optional[str] = None) -> List[dict]:
        """获取最近的日志记录。

        Args:
            days: 查询最近几天的日志
            level: 过滤日志级别（可选）

        Returns:
            日志记录列表
        """
        cutoff_date = datetime.now() - timedelta(days=days)
        logs = []

        # 获取所有日志文件
        log_files = []
        for pattern in ["*.log", "*.log.1", "*.log.gz", "*.log.1.gz"]:
            log_files.extend(self.log_dir.glob(pattern))

        for log_file in log_files:
            if log_file.stat().st_mtime < cutoff_date.timestamp():
                continue

            try:
                if log_file.suffix == ".gz":
                    with gzip.open(log_file, "rt", encoding="utf-8") as f:
                        content = f.read()
                else:
                    with open(log_file, "r", encoding="utf-8") as f:
                        content = f.read()

                # 简单解析日志行
                for line in content.split("\n"):
                    line = line.strip()
                    if not line:
                        continue

                    # 检查日志级别过滤
                    if level and level.upper() not in line:
                        continue

                    logs.append(
                        {
                            "file": log_file.name,
                            "content": line,
                            "timestamp": datetime.fromtimestamp(
                                log_file.stat().st_mtime
                            ).isoformat(),
                        }
                    )
            except Exception as e:
                logger.warning(f"读取日志文件失败 {log_file.name}: {e}")

        # 按时间排序
        logs.sort(key=lambda x: x["timestamp"], reverse=True)
        return logs[:1000]  # 最多返回1000条


# 全局日志管理器实例
_log_manager: Optional[LogManager] = None


def get_log_manager() -> LogManager:
    """获取日志管理器实例（单例）。

    Returns:
        LogManager实例
    """
    global _log_manager
    if _log_manager is None:
        from config import get_settings

        settings = get_settings()
        log_dir = Path(settings.get("data_dir", "data")) / "logs"

        _log_manager = LogManager(
            log_dir=log_dir,
            max_bytes=settings.get("log_max_bytes", 10 * 1024 * 1024),
            backup_count=settings.get("log_backup_count", 5),
            retention_days=settings.get("log_retention_days", 30),
        )
    return _log_manager


def setup_log_rotation():
    """设置日志轮转处理器。

    替换默认的FileHandler为RotatingFileHandler。
    """
    import logging.handlers

    log_manager = get_log_manager()

    # 创建 RotatingFileHandler
    handler = logging.handlers.RotatingFileHandler(
        filename=log_manager.log_dir / "schemaflow.log",
        maxBytes=log_manager.max_bytes,
        backupCount=log_manager.backup_count,
        encoding="utf-8",
    )

    handler.setFormatter(
        logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )

    # 添加到根logger
    logging.getLogger().addHandler(handler)

    logger.info(f"日志轮转已启用: {log_manager.log_dir}")
