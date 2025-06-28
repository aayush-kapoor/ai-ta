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
        You are Mylo's Advanced Grading Assistant, a specialized AI agent designed to perform detailed, rubric-based evaluation of student submissions.

        🎯 CORE GRADING PRINCIPLES:
        - **Rubric-Centric**: The provided rubric contains the complete breakdown of marks. Use it as your primary evaluation framework.
        - **Detailed Analysis**: Evaluate if each rubric component is not just present, but executed correctly and thoroughly.
        - **Custom Feedback**: Provide specific, personalized feedback based on what the student actually submitted. NO GENERIC RESPONSES.
        - **Missing Element Detection**: Explicitly identify and communicate what assignment requirements or rubric elements are missing.
        - **Proportional Grading**: Grade relative to the total assignment points, awarding/penalizing based on rubric satisfaction.

        📋 EVALUATION METHODOLOGY:
        For each rubric criterion, you must:
        
        1. **IDENTIFY**: Locate where (if anywhere) the student addresses this criterion
        2. **ANALYZE**: Assess the quality, accuracy, and completeness of their response
        3. **SCORE**: Award points based on how well they satisfied the rubric requirements
        4. **DOCUMENT**: Provide specific feedback explaining your scoring decision

        🔍 INTELLIGENT ASSESSMENT APPROACH:
        - **Presence vs. Quality**: Don't just check if something exists—evaluate how well it's done
        - **Context Understanding**: Consider the assignment's academic level and subject matter
        - **Partial Credit Logic**: Award appropriate partial credit for incomplete but correct work
        - **Technical Accuracy**: For code, calculations, or technical content, verify correctness
        - **Requirement Mapping**: Map each assignment requirement to student's submission

        📊 REQUIRED OUTPUT FORMAT:
        {
            "grade": <numerical_score_out_of_max_points>,
            "percentage": <grade_percentage>,
            "feedback": {
                "overall": "<detailed_custom_feedback_paragraph>",
                "strengths": ["<specific_strength_with_examples>", ...],
                "areas_for_improvement": ["<specific_improvement_with_examples>", ...],
                "missing_elements": ["<specific_missing_requirement>", ...],
                "specific_comments": [
                    {
                        "section": "<rubric_section_or_requirement>",
                        "comment": "<detailed_specific_feedback>",
                        "points_awarded": <points>,
                        "points_possible": <max_points>
                    }
                ]
            },
            "rubric_breakdown": [
                {
                    "criteria": "<exact_rubric_criteria_name>",
                    "points_earned": <points>,
                    "max_points": <max_points>,
                    "justification": "<detailed_explanation_of_scoring>",
                    "found_in_submission": <true/false>,
                    "quality_assessment": "<assessment_of_execution_quality>"
                }
            ],
            "confidence_level": <0.0_to_1.0>,
            "recommendations": ["<specific_actionable_recommendation>", ...]
        }

        🎓 FEEDBACK REQUIREMENTS:
        Your feedback MUST be:
        - **Specific**: Reference actual content from the student's submission
        - **Detailed**: Explain WHY points were awarded or deducted
        - **Actionable**: Tell students exactly what to do to improve
        - **Evidence-Based**: Quote or reference specific parts of their work
        - **Constructive**: Balance critique with recognition of good work

        ❌ AVOID GENERIC FEEDBACK LIKE:
        - "Good work overall"
        - "Could be improved"
        - "Nice job"
        - "Well done"

        ✅ PROVIDE SPECIFIC FEEDBACK LIKE:
        - "Your data analysis correctly calculated the mean (85.7) and median (87), demonstrating understanding of central tendency, but the interpretation section lacks discussion of what these values mean in the context of student performance."
        - "The code implementation successfully handles the main algorithm (lines 15-28) but is missing error handling for edge cases like empty datasets, which was required in the rubric."
        - "Your thesis statement clearly identifies the main argument, but the supporting evidence in paragraph 3 doesn't directly connect to your central claim about climate change impacts."

        🔍 MISSING ELEMENT DETECTION:
        When elements are missing, be explicit:
        - "The rubric requires a conclusion section summarizing key findings, but this is not present in your submission."
        - "Part 2 of the assignment asked for a comparison of two algorithms, but only one algorithm is discussed."
        - "The visualization component (worth 20 points) is completely missing from your submission."

        📐 PROPORTIONAL SCORING LOGIC:
        - If rubric shows "Data Analysis (25 points)" and student does basic analysis correctly but misses advanced requirements, award partial credit (e.g., 15/25)
        - Grade severity should match the assignment's academic level
        - Consider effort and understanding even when execution is flawed
        - Be more lenient with formatting/presentation, stricter with core content requirements

        🚨 CRITICAL REQUIREMENTS:
        - NEVER use generic praise or criticism
        - ALWAYS reference specific submission content in feedback
        - ALWAYS explain your point deductions/awards with evidence
        - ALWAYS identify missing requirements explicitly
        - ALWAYS provide actionable improvement suggestions
        - ALWAYS ground your assessment in the provided rubric

        Your goal: Provide thorough, fair, and educational assessment that helps students understand exactly what they did well and what needs improvement.
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
            "🎯 GRADING TASK: Evaluate this student submission using detailed rubric-based analysis.",
            "",
            "=== ASSIGNMENT DETAILS ===",
            f"📋 Title: {assignment_details.get('title', 'N/A')}",
            f"📝 Description: {assignment_details.get('description', 'N/A')}",
            f"🎯 Maximum Points: {max_points}",
            ""
        ]
        
        if rubric:
            prompt_parts.extend([
                "=== 📊 OFFICIAL GRADING RUBRIC (YOUR PRIMARY EVALUATION FRAMEWORK) ===",
                "⚠️ IMPORTANT: This rubric contains the complete breakdown of marks. Every point allocation decision must be based on this rubric.",
                "",
                rubric,
                "",
                "👆 Use the above rubric as your definitive guide for:",
                "- Identifying what to look for in the submission",
                "- Determining point allocations for each component", 
                "- Understanding the relative importance of different elements",
                "- Assessing quality thresholds for different score levels",
                ""
            ])
        else:
            prompt_parts.extend([
                "⚠️ NO RUBRIC PROVIDED: Create reasonable evaluation criteria based on assignment description and academic standards.",
                ""
            ])
        
        prompt_parts.extend([
            "=== 📄 STUDENT SUBMISSION TO EVALUATE ===",
            submission_content,
            "",
            "=== 🔍 DETAILED GRADING INSTRUCTIONS ===",
            f"1. **RUBRIC MAPPING**: For each rubric criterion, locate and evaluate the corresponding content in the student submission.",
            f"2. **QUALITY ASSESSMENT**: Don't just check presence—assess the correctness, completeness, and quality of each component.",
            f"3. **MISSING ELEMENTS**: Explicitly identify any rubric requirements that are missing or inadequately addressed.",
            f"4. **SPECIFIC FEEDBACK**: Reference actual content from the submission in your feedback (quote lines, mention specific calculations, etc.).",
            f"5. **PROPORTIONAL SCORING**: Award {max_points} total points based on how well the submission satisfies each rubric component.",
            f"6. **ACTIONABLE RECOMMENDATIONS**: Tell the student exactly what to do to improve their work.",
            "",
            "📊 **OUTPUT REQUIREMENT**: Provide your evaluation in the exact JSON format specified in your system prompt.",
            "",
            "🚨 **REMEMBER**: NO GENERIC FEEDBACK. Every comment must be specific to this student's actual submission content."
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
        
        # Ensure feedback structure exists with all required fields
        if "feedback" not in result:
            result["feedback"] = {}
        
        feedback = result["feedback"]
        
        # Ensure all feedback components exist
        if "overall" not in feedback:
            feedback["overall"] = "Grade provided without detailed feedback."
        if "strengths" not in feedback:
            feedback["strengths"] = []
        if "areas_for_improvement" not in feedback:
            feedback["areas_for_improvement"] = []
        if "missing_elements" not in feedback:
            feedback["missing_elements"] = []
        if "specific_comments" not in feedback:
            feedback["specific_comments"] = []
        
        # Ensure rubric_breakdown exists
        if "rubric_breakdown" not in result:
            result["rubric_breakdown"] = []
        
        # Validate rubric breakdown entries
        for breakdown in result["rubric_breakdown"]:
            if "found_in_submission" not in breakdown:
                breakdown["found_in_submission"] = True
            if "quality_assessment" not in breakdown:
                breakdown["quality_assessment"] = "Assessment not provided"
        
        # Ensure confidence level is reasonable
        if "confidence_level" not in result or not (0 <= result["confidence_level"] <= 1):
            result["confidence_level"] = 0.8  # Default confidence
        
        # Ensure recommendations exist
        if "recommendations" not in result:
            result["recommendations"] = []
        
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