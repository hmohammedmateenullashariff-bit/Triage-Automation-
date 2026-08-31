from app.nodes.base import BaseNode

NODE_REGISTRY: dict[str, type[BaseNode]] = {}


def register_node(type_name: str):
    def decorator(cls: type[BaseNode]) -> type[BaseNode]:
        NODE_REGISTRY[type_name] = cls
        return cls

    return decorator


def get_node_class(type_name: str) -> type[BaseNode]:
    if type_name not in NODE_REGISTRY:
        raise ValueError(f"Unknown node type: {type_name}")
    return NODE_REGISTRY[type_name]
