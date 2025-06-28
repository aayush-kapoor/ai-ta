"""
Date processing utilities for the AI Teaching Assistant
Handles natural language date expressions and converts them to ISO format
"""
import re
import logging
from datetime import datetime, timedelta
import dateutil.parser

logger = logging.getLogger(__name__)

def process_date_expression(date_expression: str) -> str:
    """
    Process natural language date expressions and convert to ISO format.
    Returns date in format: "YYYY-MM-DDTHH:MM:SS"
    """
    try:
        now = datetime.now()
        logger.info(f"Processing date expression: '{date_expression}' (current time: {now})")
        date_expression = date_expression.lower().strip()
        
        # Handle relative dates
        if date_expression == "tomorrow":
            target_date = now + timedelta(days=1)
        elif date_expression == "today":
            target_date = now
        elif date_expression == "next week":
            target_date = now + timedelta(days=7)
        elif "next monday" in date_expression:
            days_ahead = 0 - now.weekday()  # Monday is 0
            if days_ahead <= 0:  # Target day already happened this week
                days_ahead += 7
            target_date = now + timedelta(days_ahead)
        elif "next tuesday" in date_expression:
            days_ahead = 1 - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target_date = now + timedelta(days_ahead)
        elif "next wednesday" in date_expression:
            days_ahead = 2 - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target_date = now + timedelta(days_ahead)
        elif "next thursday" in date_expression:
            days_ahead = 3 - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target_date = now + timedelta(days_ahead)
        elif "next friday" in date_expression:
            days_ahead = 4 - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target_date = now + timedelta(days_ahead)
        elif "next saturday" in date_expression:
            days_ahead = 5 - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target_date = now + timedelta(days_ahead)
        elif "next sunday" in date_expression:
            days_ahead = 6 - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            target_date = now + timedelta(days_ahead)
        elif "in" in date_expression and "day" in date_expression:
            # Handle "in 3 days", "in 5 days", etc.
            match = re.search(r'in (\d+) days?', date_expression)
            if match:
                days = int(match.group(1))
                target_date = now + timedelta(days=days)
            else:
                # Fallback to dateutil parser
                target_date = dateutil.parser.parse(date_expression)
        else:
            # Try to parse absolute dates using dateutil
            target_date = dateutil.parser.parse(date_expression)
            
        # Set time to end of day (23:59:59) unless specific time was provided
        if target_date.hour == 0 and target_date.minute == 0 and target_date.second == 0:
            target_date = target_date.replace(hour=23, minute=59, second=59)
        
        logger.info(f"Processed '{date_expression}' → {target_date.isoformat()}")
        return target_date.isoformat()
        
    except Exception as e:
        logger.warning(f"Could not parse date expression '{date_expression}': {e}")
        # Return tomorrow as default fallback
        fallback_date = now + timedelta(days=1)
        fallback_date = fallback_date.replace(hour=23, minute=59, second=59)
        return fallback_date.isoformat() 