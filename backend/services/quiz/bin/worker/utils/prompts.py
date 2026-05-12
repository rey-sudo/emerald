from pydantic import BaseModel, Field, ValidationError, RootModel
from typing import List
from litellm.router import Router

class QuestionItem(BaseModel):
    question: str = Field(..., description="Versbose question statement based on the QUIZ_CONTENT")
    options: List[str] = Field(..., min_length=4, max_length=4, description="List of possible answer choices")
    correct: int = Field(..., ge=0, le=3, description="Index of the correct option (0-3)")
    explanation: str = Field(..., description="Full explanation of why the answer is correct")
    
class Quiz(RootModel[List[QuestionItem]]):
    pass

quiz_response_scheme = Quiz.model_json_schema()

def build_quiz_prompt(domain: str):
    return f"""
SYSTEM ROLE:
You are an expert quiz generation system specialized in creating high-quality professional and academic assessments from source documents.

Your objective is to generate expert-level quizzes that evaluate:
- deep comprehension,
- analytical reasoning,
- conceptual interpretation,
- technical understanding,
- contextual application,
- institutional implications,
- terminology precision,
- legal and procedural interpretation when applicable.

The generated questions must resemble evaluations used in:
- professional certification,
- institutional training,
- public administration,
- legal and regulatory compliance,
- technical education,
- organizational governance,
- expert-level academic assessment.

====

QUIZ GENERATION RULES:
Generate quizzes exclusively from the provided QUIZ_CONTENT.

Requirements:
- Questions must evaluate understanding, interpretation, applicability, implications, scope, hierarchy, definitions, responsibilities, and technical meaning.
- Prioritize reasoning and interpretation over memorization.
- Avoid superficial questions.
- Avoid simple sentence extraction.
- Avoid obvious or weak distractors.
- Every question must be self-contained and understandable without external context.
- Maintain technical precision and semantic consistency with the source document.
- Use domain terminology correctly.
- Do not invent facts, entities, definitions, or conclusions not present in the source content.
- Distractors must be plausible and semantically related to the topic.
- Questions must differentiate clearly between partially correct and fully correct answers.
- Preserve institutional, legal, procedural, and technical meaning when applicable.
- If the source contains legal or regulatory language, preserve interpretive precision.

====

NEGATIVE RULES:
DO NOT:
- generate trivial questions,
- generate purely literal copy-paste questions,
- use yes/no questions,
- generate redundant questions,
- create vague distractors,
- oversimplify technical concepts,
- invent unsupported interpretations,
- generate opinion-based questions,
- produce ambiguous answers,
- rely only on factual recall,
- create questions whose answer is obvious from keyword matching alone.

====

QUESTION QUALITY STANDARD:
Questions should test one or more of the following:
- interpretation,
- applicability,
- scope,
- institutional responsibility,
- conceptual differentiation,
- procedural understanding,
- terminology comprehension,
- legal interpretation,
- hierarchical relationships,
- compliance understanding,
- contextual reasoning.

====

DIFFICULTY:
Difficulty level: Expert

Questions should require:
- careful reading,
- semantic interpretation,
- conceptual precision,
- discrimination between similar concepts,
- contextual understanding.

====

OUTPUT FORMAT:
Generate:
- Multiple choice questions only.
- Exactly 4 answer options per question.
- Only 1 correct answer.
- Include the correct answer.
- Include a short explanation justifying why the answer is correct.
- Respond in plain text without Markdown code blocks.
- Do not use ```json or triple backticks.
- Return only the raw JSON.
- Provide the response without Markdown formatting.
- Do not wrap the output in a code block.
- Return the response directly, not inside a code block.
- Return only valid JSON in a single response.
- Do not use Markdown, do not use ```json, and do not add explanations.
- Respond in plain text without code blocks or Markdown formatting.
- The output will be processed automatically by another system.

====

{domain}
"""
    
model_list = [
    {
        "model_name": "models-1",
        "litellm_params": {
            "model": "gemini/gemini-2.5-flash"
        }
    },
    {
        "model_name": "models-1",
        "litellm_params": {
            "model": "ollama/gemma4:e4b",
            "api_base": "http://localhost:11434"
        }
    }
]    

router = Router(model_list=model_list)

def _llm(prompt: str, max_tokens: int = 1000) -> Quiz:
    """Wrapper mínimo sobre tu router."""
    
    response = router.completion(
        model="models-1",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.3,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "Quiz",
                "schema": Quiz.model_json_schema()  
        }
    }
    )

    content = response.choices[0].message.content.strip()
    try:
        validated = Quiz.model_validate_json(content)
        return validated
    except ValidationError as e:
        raise ValueError(
            f"El modelo devolvió un JSON inválido:\n{e.json(indent=2)}\n\nContenido recibido:\n{content}"
        )

def create_quiz(prompt: str, max_tokens: int)-> Quiz:
    return _llm(prompt, max_tokens)