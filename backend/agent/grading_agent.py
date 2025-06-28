"""
Grading Agent - Specialized AI agent for automatic grading of student submissions
Handles PDF document analysis and grading based on assignment criteria and rubrics
"""
import json
import logging
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
from config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

class GradingAgent:
    def __init__(self):
        self.system_prompt = """
        You are Mylo's Grading Assistant, a specialized AI agent designed to evaluate and grade student submissions fairly and constructively.

        🎯 GRADING PHILOSOPHY:
        - Provide fair, objective, and constructive assessment
        - Focus on both content quality and adherence to assignment requirements
        - Offer specific, actionable feedback to help students improve
        - Maintain consistency in grading standards
        - Consider the academic level and context of the assignment

        📋 GRADING PROCESS:
        You will receive:
        1. **Assignment Details**: Title, description, learning objectives
        2. **Grading Rubric**: Specific criteria and point distributions
        3. **Maximum Points**: Total points possible for this assignment
        4. **Student Submission**: Content extracted from their submitted document

        🔍 EVALUATION CRITERIA:
        Assess submissions based on:
        - **Content Understanding**: Demonstrates comprehension of key concepts
        - **Requirement Fulfillment**: Meets specified assignment requirements
        - **Quality of Analysis**: Depth and accuracy of analysis or reasoning
        - **Organization & Structure**: Clear presentation and logical flow
        - **Supporting Evidence**: Use of appropriate examples, data, or citations
        - **Writing Quality**: Grammar, clarity, and professional presentation
        - **Creativity & Insight**: Original thinking and novel perspectives (when applicable)

        📊 GRADING OUTPUT FORMAT:
        Provide your assessment in the following JSON structure:
        {
            "grade": <numerical_score>,
            "percentage": <grade_percentage>,
            "feedback": {
                "overall": "<comprehensive_overall_feedback>",
                "strengths": ["<strength_1>", "<strength_2>", ...],
                "areas_for_improvement": ["<improvement_1>", "<improvement_2>", ...],
                "specific_comments": [
                    {
                        "section": "<section_name>",
                        "comment": "<detailed_comment>"
                    }
                ]
            },
            "rubric_breakdown": [
                {
                    "criteria": "<criteria_name>",
                    "points_earned": <points>,
                    "max_points": <max_points>,
                    "justification": "<explanation_for_score>"
                }
            ],
            "confidence_level": <0.0_to_1.0>,
            "recommendations": ["<recommendation_1>", "<recommendation_2>", ...]
        }

        🎓 FEEDBACK GUIDELINES:
        - Be encouraging and constructive, not punitive
        - Provide specific examples from the submission when possible
        - Suggest concrete steps for improvement
        - Acknowledge good work and creative thinking
        - Use professional, supportive language
        - Balance criticism with positive reinforcement

        🔄 CONSISTENCY STANDARDS:
        - Apply the same standards to all submissions
        - Base grades primarily on the provided rubric
        - Consider the assignment's learning objectives
        - Account for the academic level (undergraduate, graduate, etc.)
        - Maintain objectivity regardless of writing style preferences

        ⚠️ IMPORTANT NOTES:
        - If the submission is incomplete or missing major components, explain clearly what's missing
        - If content is unclear or confusing, provide specific guidance on clarity
        - For technical subjects, verify accuracy of facts and calculations
        - Consider partial credit for work that shows understanding but has errors
        - Flag any potential academic integrity concerns (plagiarism, excessive AI usage)

        Remember: Your goal is to provide fair assessment that helps students learn and improve while maintaining academic standards.
        """

    async def grade_submission(
        self,
        submission_content: str,
        assignment_details: Dict[str, Any],
        rubric: Optional[str] = None,
        max_points: int = 100
    ) -> Dict[str, Any]:
        """
        Grade a student submission based on assignment criteria and rubric
        
        Args:
            submission_content: The text content extracted from the student's submission
            assignment_details: Dictionary containing assignment title, description, etc.
            rubric: The grading rubric text (optional)
            max_points: Maximum points possible for this assignment
            
        Returns:
            Dictionary containing grade, feedback, and detailed assessment
        """
        try:
            # Construct the grading prompt
            grading_prompt = self._build_grading_prompt(
                submission_content, assignment_details, rubric, max_points
            )
            
            # Make API call to OpenAI
            response = await openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": grading_prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent grading
                max_tokens=2000
            )
            
            # Parse the response
            result_text = response.choices[0].message.content
            
            # Try to parse as JSON, fallback to text analysis if needed
            try:
                result = json.loads(result_text)
                
                # Validate and ensure proper structure
                result = self._validate_grading_result(result, max_points)
                
                return {
                    "success": True,
                    "grade": result["grade"],
                    "feedback": result["feedback"]["overall"],
                    "detailed_result": result
                }
                
            except json.JSONDecodeError:
                # Fallback: parse text response manually
                logger.warning("Failed to parse JSON response, using fallback parsing")
                return self._parse_text_response(result_text, max_points)
                
        except Exception as e:
            logger.error(f"Error in grading submission: {e}")
            return {
                "success": False,
                "error": str(e),
                "grade": 0,
                "feedback": "Sorry, I encountered an error while grading this submission. Please try again or grade manually."
            }

    def _build_grading_prompt(
        self,
        submission_content: str,
        assignment_details: Dict[str, Any],
        rubric: Optional[str],
        max_points: int
    ) -> str:
        """Build the specific grading prompt for this submission"""
        
        prompt_parts = [
            "Please grade the following student submission:",
            "",
            "=== ASSIGNMENT DETAILS ===",
            f"Title: {assignment_details.get('title', 'N/A')}",
            f"Description: {assignment_details.get('description', 'N/A')}",
            f"Maximum Points: {max_points}",
            ""
        ]
        
        if rubric:
            prompt_parts.extend([
                "=== GRADING RUBRIC ===",
                rubric,
                ""
            ])
        
        prompt_parts.extend([
            "=== STUDENT SUBMISSION ===",
            submission_content,
            "",
            "=== GRADING REQUEST ===",
            f"Please evaluate this submission and provide a grade out of {max_points} points.",
            "Follow the JSON format specified in your system prompt.",
            "Provide constructive feedback that will help the student improve."
        ])
        
        return "\n".join(prompt_parts)

    def _validate_grading_result(self, result: Dict[str, Any], max_points: int) -> Dict[str, Any]:
        """Validate and fix the grading result structure"""
        
        # Ensure grade is within bounds
        grade = result.get("grade", 0)
        if grade > max_points:
            grade = max_points
        elif grade < 0:
            grade = 0
        
        result["grade"] = grade
        result["percentage"] = round((grade / max_points) * 100, 1)
        
        # Ensure feedback structure exists
        if "feedback" not in result:
            result["feedback"] = {
                "overall": "Grade provided without detailed feedback.",
                "strengths": [],
                "areas_for_improvement": []
            }
        
        # Ensure confidence level is reasonable
        if "confidence_level" not in result or not (0 <= result["confidence_level"] <= 1):
            result["confidence_level"] = 0.8  # Default confidence
        
        return result

    def _parse_text_response(self, response_text: str, max_points: int) -> Dict[str, Any]:
        """Fallback method to parse non-JSON responses"""
        
        # Simple parsing for grade extraction
        lines = response_text.split('\n')
        grade = 0
        feedback = response_text
        
        # Look for grade patterns
        for line in lines:
            if 'grade' in line.lower() or 'score' in line.lower():
                # Try to extract numbers
                import re
                numbers = re.findall(r'\d+', line)
                if numbers:
                    potential_grade = int(numbers[0])
                    if potential_grade <= max_points:
                        grade = potential_grade
                        break
        
        return {
            "success": True,
            "grade": grade,
            "feedback": feedback,
            "detailed_result": {
                "grade": grade,
                "percentage": round((grade / max_points) * 100, 1),
                "feedback": {"overall": feedback},
                "confidence_level": 0.6  # Lower confidence for text parsing
            }
        } 