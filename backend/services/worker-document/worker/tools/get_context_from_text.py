import lmstudio as lms

def recortar_texto_para_contexto(model: lms.LLM, texto_original: str, margen_respuesta: int = 2000) -> str:
    """
    Recorta un texto línea por línea desde el final hasta que quepa 
    en el contexto del modelo, dejando espacio para la respuesta.
    """

    context_limit = model.get_context_length()
    
    limite_seguro = context_limit - margen_respuesta
    
    lineas = texto_original.splitlines()
    texto_actual = texto_original
    
    # Bucle de control: Mientras el texto sea muy largo, quitamos la última línea
    while len(lineas) > 0:
        # 1. Creamos un chat temporal para medir el peso real con el template
        chat_temp = lms.Chat("Summary assistant")
        chat_temp.add_user_message(texto_actual)
        
        # 2. Aplicamos el template y contamos tokens
        formatted = model.apply_prompt_template(chat_temp)
        token_count = len(model.tokenize(formatted))
        
        if token_count <= limite_seguro:
            print(f"✅ Texto ajustado: {token_count} tokens (Límite: {limite_seguro})")
            return texto_actual
        
        # 3. Si no cabe, eliminamos la última línea y volvemos a probar
        lineas.pop() 
        texto_actual = "\n".join(lineas)
        
    return "" # Si llegamos aquí, ni una sola línea cabía (muy raro)

def get_context_from_text(text: str) -> str: 

    model = lms.llm("qwen2.5-7b-instruct")
    
    texto_final = recortar_texto_para_contexto(
        model=model, 
        texto_original=text, 
        margen_respuesta=3000 
    )    
    
    print(texto_final)
   
    chat = lms.Chat("""
    You are a polyglot research assistant. 
    Your task is to analyze documents in any language and summarize them.
    RULE: Always respond in the SAME language as the original text, 
    unless the user explicitly asks for a specific language.
    """)

    instruccion = f"""
    TASK: Analyze and summarize this text in its original language.
    SOURCE TEXT: {texto_final}

    CONSTRAINTS (STRICT):
    1. LANGUAGE: Respond ONLY in the SAME language as the original text.
    2. FORMAT: Provide the summary as a SINGLE continuous paragraph.
    3. FORBIDDEN: Do NOT include titles, subtitles, bullet points, headers, or bold text. 
    4. START: Start the response directly with the summary text.
    5. LENGTH: Aim for approximately 500 words.

    FINAL WARNING: Output ONLY the raw text of the paragraph. No markdown, no "Sure, here is the summary", no intros.
    """

    chat.add_user_message(instruccion) 
    
    configuracion = {
        "maxTokens": 16384, 
        "temperature": 0.8 
    }

    for fragment in model.respond_stream(chat, config=configuracion):
        print(fragment.content, end="", flush=True)
    print()


    
