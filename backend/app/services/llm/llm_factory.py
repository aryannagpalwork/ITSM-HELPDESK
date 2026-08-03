
"""Factory to create LLM service instances"""
from .base import LLMService
from .openai_service import OpenAIService


class LLMServiceFactory:
    """Factory to create an OpenAI LLM service instance."""

    @staticmethod
    def create(provider_name: str, **kwargs) -> LLMService:
        provider_name = provider_name.lower()
        if provider_name != "openai":
            raise ValueError(f"LLM provider '{provider_name}' not implemented")
        return OpenAIService(**kwargs)

