"""
PDF Processor - Utility for extracting text content from PDF submissions
Handles PDF text extraction for the grading agent
"""
import logging
import PyPDF2
import requests
from io import BytesIO
from typing import Optional

logger = logging.getLogger(__name__)

class PDFProcessor:
    def __init__(self):
        self.max_pages = 50  # Limit to prevent processing very large documents
        self.max_chars = 50000  # Limit text length for API calls
    
    async def extract_text_from_url(self, file_url: str) -> Optional[str]:
        """
        Extract text content from a PDF file via URL
        
        Args:
            file_url: URL to the PDF file
            
        Returns:
            Extracted text content or None if extraction fails
        """
        try:
            # Download the PDF file
            response = requests.get(file_url, timeout=30)
            response.raise_for_status()
            
            # Extract text from the PDF bytes
            return self._extract_text_from_bytes(response.content)
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF URL {file_url}: {e}")
            return None
    
    async def extract_text_from_file_path(self, file_path: str) -> Optional[str]:
        """
        Extract text content from a local PDF file
        
        Args:
            file_path: Local path to the PDF file
            
        Returns:
            Extracted text content or None if extraction fails
        """
        try:
            with open(file_path, 'rb') as file:
                return self._extract_text_from_bytes(file.read())
                
        except Exception as e:
            logger.error(f"Error extracting text from PDF file {file_path}: {e}")
            return None
    
    def _extract_text_from_bytes(self, pdf_bytes: bytes) -> Optional[str]:
        """
        Extract text from PDF bytes using PyPDF2
        
        Args:
            pdf_bytes: PDF file content as bytes
            
        Returns:
            Extracted text content or None if extraction fails
        """
        try:
            # Create a PDF reader from bytes
            pdf_stream = BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            
            # Check if PDF is encrypted
            if pdf_reader.is_encrypted:
                logger.warning("PDF is encrypted, attempting to decrypt with empty password")
                if not pdf_reader.decrypt(''):
                    logger.error("Could not decrypt PDF")
                    return None
            
            # Extract text from all pages (up to limit)
            text_content = []
            num_pages = min(len(pdf_reader.pages), self.max_pages)
            
            for page_num in range(num_pages):
                try:
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    
                    if page_text.strip():
                        text_content.append(f"--- Page {page_num + 1} ---\n{page_text}\n")
                        
                except Exception as e:
                    logger.warning(f"Error extracting text from page {page_num + 1}: {e}")
                    continue
            
            # Combine all text
            full_text = "\n".join(text_content)
            
            # Limit text length for API processing
            if len(full_text) > self.max_chars:
                logger.warning(f"Text too long ({len(full_text)} chars), truncating to {self.max_chars}")
                full_text = full_text[:self.max_chars] + "\n\n[Document truncated due to length...]"
            
            return full_text if full_text.strip() else None
            
        except Exception as e:
            logger.error(f"Error processing PDF bytes: {e}")
            return None
    
    def get_document_info(self, pdf_bytes: bytes) -> dict:
        """
        Get basic information about the PDF document
        
        Args:
            pdf_bytes: PDF file content as bytes
            
        Returns:
            Dictionary with document information
        """
        try:
            pdf_stream = BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            
            info = {
                "num_pages": len(pdf_reader.pages),
                "is_encrypted": pdf_reader.is_encrypted,
                "title": None,
                "author": None,
                "subject": None
            }
            
            # Try to get metadata
            if pdf_reader.metadata:
                metadata = pdf_reader.metadata
                info["title"] = metadata.get("/Title")
                info["author"] = metadata.get("/Author")
                info["subject"] = metadata.get("/Subject")
            
            return info
            
        except Exception as e:
            logger.error(f"Error getting PDF info: {e}")
            return {"error": str(e)} 