"""Lightweight proxies that defer heavy third-party imports until first use.

Keeping a module-level attribute (``cv2``, ``yt_dlp``, ``OpenAI``) avoids loading
tens of megabytes during sidecar startup / preflight while preserving
``unittest.mock.patch('backend.<mod>.<attr>')`` compatibility in tests.
"""
import importlib


class LazyModule:
    """Import ``module_name`` on first attribute access."""

    def __init__(self, module_name: str):
        object.__setattr__(self, "_module_name", module_name)
        object.__setattr__(self, "_loaded", None)

    def _load(self):
        loaded = object.__getattribute__(self, "_loaded")
        if loaded is None:
            loaded = importlib.import_module(object.__getattribute__(self, "_module_name"))
            object.__setattr__(self, "_loaded", loaded)
        return loaded

    def __getattr__(self, name: str):
        return getattr(self._load(), name)

    def __setattr__(self, name: str, value) -> None:
        setattr(self._load(), name, value)

    def __delattr__(self, name: str) -> None:
        delattr(self._load(), name)

    def __repr__(self) -> str:
        return f"<LazyModule {object.__getattribute__(self, '_module_name')!r}>"


class LazyAttr:
    """Import ``module_name`` and resolve ``attr_name`` only when called or accessed."""

    def __init__(self, module_name: str, attr_name: str):
        self._module_name = module_name
        self._attr_name = attr_name
        self._target = None

    def _load(self):
        if self._target is None:
            mod = importlib.import_module(self._module_name)
            self._target = getattr(mod, self._attr_name)
        return self._target

    def __call__(self, *args, **kwargs):
        return self._load()(*args, **kwargs)

    def __getattr__(self, name: str):
        return getattr(self._load(), name)

    def __repr__(self) -> str:
        return f"<LazyAttr {self._module_name}.{self._attr_name}>"
