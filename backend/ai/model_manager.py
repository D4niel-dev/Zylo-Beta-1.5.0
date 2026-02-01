import requests
import json
import os

class ModelManager:
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url
        self.api_chat = f"{base_url}/api/chat"

    def is_alive(self):
        try:
            requests.get(self.base_url)
            return True
        except requests.exceptions.ConnectionError:
            return False

    def generate_response(self, model: str, messages: list, system_prompt: str = None, stream: bool = False, options: dict = None):
        """
        Generate a response from the Ollama model.
        
        Args:
            model (str): allowed models like 'gemma:latest', 'gemma:2b'
            messages (list): list of dicts {'role': 'user', 'content': '...'}
            system_prompt (str): Optional system prompt to prepend.
            stream (bool): Whether to stream the response (not fully implemented in frontend yet).
            options (dict): Ollama options (temperature, etc.)
        """
        
        payload_messages = []
        
        # Prepend system prompt if provided
        if system_prompt:
            payload_messages.append({"role": "system", "content": system_prompt})
            
        payload_messages.extend(messages)

        payload = {
            "model": model,
            "messages": payload_messages,
            "stream": stream,
        }
        
        if options:
            payload["options"] = options

        try:
            response = requests.post(self.api_chat, json=payload, stream=stream)
            response.raise_for_status()
            
            if stream:
                # Return the raw response object for the caller to iterate over
                return response
            else:
                return response.json()
                
        except requests.exceptions.RequestException as e:
            print(f"Error communicating with Ollama: {e}")
            return {"error": str(e)}

# Singleton instance
model_manager = ModelManager()
