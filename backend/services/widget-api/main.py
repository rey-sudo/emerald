from dotenv import load_dotenv
load_dotenv()
from litellm.router import Router

model_list = [
    {
        "model_name": "models-1",
        "litellm_params": {
            "model": "gemini/gemini-2.5-flash"
        }
    },
    {
        "model_name": "smart-chat",
        "litellm_params": {
            "model": "ollama/llama3.2:3b",
            "api_base": "http://localhost:11434"
        }
    }
]

router = Router(model_list=model_list)

response = router.completion(
    model="models-1",
    messages=[
        {
            "role": "user",
            "content": "¿Qué es RAG?"
        }
    ]
)

print(response.choices[0].message.content)