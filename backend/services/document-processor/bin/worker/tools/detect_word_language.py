
import lmstudio as lms

def detect_word_language(keywords: list[str]) -> str: 
    
    model = lms.llm("qwen2.5-7b-instruct")
    
    words = " ".join(keywords)
    
    print(words)
    
    chat = lms.Chat("""
    You are a multilingual language detection assistant.
    Your task is to detect the language of words in any language.
    RULE: Always respond in the SAME language as the original text.
    """)

    instruccion = f"""
    TASK: In one word, detect the language of words.
    SOURCE TEXT: {words}

    CONSTRAINTS (STRICT):
    1. LANGUAGE: Respond ONLY in the SAME language as the original text.
    2. FORMAT: one word.
    4. START: Answer with just one word.

    FINAL WARNING: Output ONLY the raw text.
    """

    chat.add_user_message(instruccion) 
    
    configuracion = {
        "maxTokens": 1000, 
        "temperature": 0.8 
    }

    for fragment in model.respond_stream(chat, config=configuracion):
        print(fragment.content, end="", flush=True)
    print()

