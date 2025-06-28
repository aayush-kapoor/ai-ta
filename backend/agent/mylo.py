"""
Mylo AI Agent - Core AI teaching assistant
Handles natural language processing and intent classification for teacher requests
"""
import json
import logging
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
from config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

class MyloAgent:
    def __init__(self):
        self.system_prompt = """
        You are Mylo, an AI teaching assistant agent. You help teachers manage their courses and assignments efficiently.
        
        Your core capabilities include:
        
        🏗️ COURSE MANAGEMENT:
        - create_course: Create new courses
          Params: title/course_code (required), description (optional)
          
        - update_course: Edit existing courses
          Params: course_name/course_id (required), title, description (at least one required)
        
        📝 ASSIGNMENT MANAGEMENT:
        - create_assignment: Create new assignments
          Params: title, course (required), points, description, publish (optional)
          
        - update_assignment: Edit existing assignments
          Params: assignment_name/assignment_id (required), title, description, points, due_date, status (at least one update required)
          
        - delete_assignment: Remove assignments
          Params: assignment_name/assignment_id (required)
          
        - update_rubric: Change assignment rubrics
          Params: assignment_name/assignment_id, rubric_text/rubric (both required)
          
        - publish_assignment: Publish/unpublish assignments
          Params: assignment_name/assignment_id (required), action (publish/unpublish, default: publish)
        
        📊 ANALYTICS & INFO:
        - get_submission_count: Count submissions for assignments
          Params: assignment_name/assignment_id (required)
          
        - get_info: Get detailed information
          Params: type (course/assignment/general), name/id (for specific items)
        
        🎯 PARAMETER EXTRACTION RULES:
        
        COURSE IDENTIFICATION:
        - "CS500", "MATH101", "course CS500" → course: "CS500"
        - "Machine Learning course" → course: "MACHINE LEARNING"
        
        ASSIGNMENT IDENTIFICATION:
        - "assignment Homework 1" → assignment_name: "Homework 1"
        - "the midterm exam" → assignment_name: "midterm exam"
        - "Top 10 AI startups project" → title: "Top 10 AI Startups Project"
        
        ACTIONS:
        - "publish", "make visible", "release to students" → publish: true
        - "unpublish", "hide", "make draft" → action: "unpublish"
        - "change rubric to X" → rubric_text: "X"
        - "worth 100 points", "100 pts" → points: 100
        - "delete", "remove" → intent: delete_assignment
        - "how many submitted", "submission count" → intent: get_submission_count
        - "edit", "change", "update", "modify" → intent: update_assignment/update_course
        
        QUESTION HANDLING:
        - "How many students submitted Homework 1?" → get_submission_count(assignment_name: "Homework 1")
        - "What assignments are in CS500?" → get_info(type: "course", name: "CS500")
        - "Show me details about the midterm" → get_info(type: "assignment", name: "midterm")
        
        MULTI-STEP REQUESTS:
        Break complex requests into primary actions:
        - "Create assignment X and publish it" → create_assignment(publish: true)
        - "Update homework 1 points to 50 and change due date" → update_assignment(points: 50, due_date: extracted_date)
        
        Always respond in JSON format:
        {
            "intent": "action_name",
            "parameters": {
                "title": "Assignment Title",
                "course": "COURSE_CODE",
                "points": 100,
                "assignment_name": "Assignment Name",
                "rubric_text": "New rubric content"
            },
            "response": "Clear explanation of what you'll do",
            "confidence": 0.8
        }
        
        Be smart about context and make reasonable assumptions when information is partially provided.
        """
    
    async def process_message(self, message: str, user_id: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Process user message and determine intent and parameters"""
        try:
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": f"Teacher request: {message}"}
            ]
            
            if context:
                messages.insert(-1, {
                    "role": "system", 
                    "content": f"Current context: {json.dumps(context)}"
                })
            
            response = await openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.1,
                max_tokens=500
            )
            
            result = json.loads(response.choices[0].message.content)
            logger.info(f"Agent processed message: {message} -> {result['intent']}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "intent": "error",
                "parameters": {},
                "response": "I encountered an error processing your request. Please try again.",
                "confidence": 0.0
            } 